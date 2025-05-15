import {
  START,
  END,
  StateGraphArgs,
  StateGraph,
  MessagesAnnotation,
  CompiledStateGraph,
  StateDefinition,
} from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON, isValidUrl } from '@refly/utils';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Source,
} from '@refly/openapi-schema';
import { createSkillTemplateInventory } from '../inventory';
import { ToolNode } from '@langchain/langgraph/prebuilt';

// types
import { GraphState } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { truncateSource } from '../scheduler/utils/truncator';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';
import { extractAndCrawlUrls, crawlExtractedUrls } from '../scheduler/utils/extract-weblink';

// prompts
import * as commonQnA from '../scheduler/module/commonQnA';
import { checkModelContextLenSupport } from '../scheduler/utils/model';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { MultiServerMCPClient } from '../adapters';
import { buildSystemPrompt } from '../mcp/core/prompt';
import { convertMcpServersToClientConfig } from '../utils/mcp-utils';

export class Agent extends BaseSkill {
  name = 'commonQnA';

  icon: Icon = { type: 'emoji', value: '💬' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Answer common questions';

  schema = z.object({
    query: z.string().optional().describe('The question to be answered'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  skills: BaseSkill[] = createSkillTemplateInventory(this.engine);
  private userAgentComponentsCache = new Map<string, CachedAgentComponents>();

  isValidSkillName = (name: string) => {
    return this.skills.some((skill) => skill.name === name);
  };

  commonPreprocess = async (
    state: GraphState,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
    customInstructions?: string,
  ) => {
    const { messages = [], images = [] } = state;
    const { locale = 'en', modelConfigMap, project, runtimeConfig } = config.configurable;

    config.metadata.step = { name: 'analyzeQuery' };

    const {
      optimizedQuery,
      query,
      usedChatHistory,
      hasContext,
      remainingTokens,
      mentionedContext,
      rewrittenQueries,
    } = await processQuery({
      config,
      ctxThis: this,
      state,
      shouldSkipAnalysis: true,
    });

    const projectId = project?.projectId;
    const enableKnowledgeBaseSearch = !!projectId && !!runtimeConfig?.enabledKnowledgeBase;
    this.engine.logger.log(
      `ProjectId: ${projectId}, Enable KB Search: ${enableKnowledgeBaseSearch}`,
    );

    const contextUrls = config.configurable?.urls || [];
    this.engine.logger.log(`Context URLs: ${safeStringifyJSON(contextUrls)}`);

    let contextUrlSources: Source[] = [];
    if (contextUrls.length > 0) {
      const urls = contextUrls.map((item) => item.url).filter((url) => url && isValidUrl(url));
      if (urls.length > 0) {
        this.engine.logger.log(`Processing ${urls.length} URLs from context`);
        contextUrlSources = await crawlExtractedUrls(urls, config, this, {
          concurrencyLimit: 5,
          batchSize: 8,
        });
        this.engine.logger.log(`Processed context URL sources count: ${contextUrlSources.length}`);
      }
    }

    const { sources: queryUrlSources, analysis } = await extractAndCrawlUrls(query, config, this, {
      concurrencyLimit: 5,
      batchSize: 8,
    });
    this.engine.logger.log(`URL extraction analysis: ${safeStringifyJSON(analysis)}`);
    this.engine.logger.log(`Extracted query URL sources count: ${queryUrlSources.length}`);

    const urlSources = [...contextUrlSources, ...queryUrlSources];
    this.engine.logger.log(`Total URL sources count: ${urlSources.length}`);

    let context = '';
    let sources: Source[] = [];
    const hasUrlSources = urlSources.length > 0;
    const needPrepareContext =
      (hasContext || hasUrlSources || enableKnowledgeBaseSearch) && remainingTokens > 0;
    const isModelContextLenSupport = checkModelContextLenSupport(modelConfigMap.chat);

    this.engine.logger.log(`optimizedQuery: ${optimizedQuery}`);
    this.engine.logger.log(`mentionedContext: ${safeStringifyJSON(mentionedContext)}`);
    this.engine.logger.log(`hasUrlSources: ${hasUrlSources}`);

    if (needPrepareContext) {
      config.metadata.step = { name: 'analyzeContext' };
      const preparedRes = await prepareContext(
        {
          query: optimizedQuery,
          mentionedContext,
          maxTokens: remainingTokens,
          enableMentionedContext: hasContext,
          rewrittenQueries,
          urlSources,
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig: {
            ...(config?.configurable?.tplConfig || {}),
            enableKnowledgeBaseSearch: {
              value: enableKnowledgeBaseSearch,
              label: 'Knowledge Base Search',
              displayValue: enableKnowledgeBaseSearch ? 'true' : 'false',
            },
          },
        },
      );
      context = preparedRes.contextStr;
      sources = preparedRes.sources;
      this.engine.logger.log(`context: ${safeStringifyJSON(context)}`);
      this.engine.logger.log(`sources: ${safeStringifyJSON(sources)}`);
    }

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: needPrepareContext && isModelContextLenSupport,
      context,
      images,
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo: config?.configurable?.modelConfigMap.chat,
      customInstructions,
    });

    return { requestMessages, sources };
  };

  private async getOrInitializeAgentComponents(user: any): Promise<CachedAgentComponents> {
    const userId = user?.id ?? JSON.stringify(user);

    if (this.userAgentComponentsCache.has(userId)) {
      this.engine.logger.log(`Using cached agent components for user ${userId}`);
      return this.userAgentComponentsCache.get(userId)!;
    }

    this.engine.logger.log(`Initializing new agent components for user ${userId}`);

    const mcpServersResponse = await this.engine.service.listMcpServers(user, {
      enabled: true,
    });
    const mcpClientConfig = convertMcpServersToClientConfig(mcpServersResponse);
    const mcpClient = new MultiServerMCPClient(mcpClientConfig);

    try {
      await mcpClient.initializeConnections();
      this.engine.logger.log('MCP connections initialized successfully for new components');

      const mcpTools = await mcpClient.getTools();
      if (!mcpTools?.length) {
        throw new Error('No tools found during new components initialization');
      }
      this.engine.logger.log(
        `Loaded ${mcpTools.length} MCP tools for new components: ${mcpTools.map((tool) => tool.name).join(', ')}`,
      );

      const llmModel = this.engine
        .chatModel({ temperature: 0.1 })
        .bindTools(mcpTools, { strict: true } as never);
      const toolNodeInstance = new ToolNode(mcpTools);

      const llmNodeForCachedGraph = async (nodeState: typeof MessagesAnnotation.State) => {
        this.engine.logger.log(
          'Calling LLM (cached graph) with messages count:',
          nodeState.messages.length,
        );
        const response = await llmModel.invoke(nodeState.messages);
        return { messages: [response as BaseMessage] };
      };

      const workflow = new StateGraph(MessagesAnnotation)
        .addNode('llm', llmNodeForCachedGraph)
        .addNode('tools', toolNodeInstance)
        .addEdge(START, 'llm')
        .addEdge('tools', 'llm')
        .addConditionalEdges('llm', (graphState) => {
          const lastMessage = graphState.messages[graphState.messages.length - 1];
          const aiMessage = lastMessage as AIMessage;
          if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            this.engine.logger.log('Tool calls detected (cached graph), routing to tools node');
            return 'tools';
          }
          this.engine.logger.log('No tool calls (cached graph), ending the workflow');
          return END;
        });

      const compiledLangGraphApp = workflow.compile();

      const components: CachedAgentComponents = {
        mcpClient,
        mcpTools,
        llmModel,
        toolNodeInstance,
        compiledLangGraphApp,
      };
      this.userAgentComponentsCache.set(userId, components);
      this.engine.logger.log(`Agent components initialized and cached for user ${userId}`);
      return components;
    } catch (error) {
      this.engine.logger.error('Error during new agent components initialization:', error);
      await mcpClient
        .close()
        .catch((closeError) =>
          this.engine.logger.error('Error closing MCP client during setup failure:', closeError),
        );
      if (error instanceof Error) {
        this.engine.logger.error('Error stack for new components initialization:', error.stack);
      }
      throw new Error('Failed to initialize agent components');
    }
  }

  agentNode = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, user } = config.configurable;
    const project = config.configurable?.project as
      | { projectId: string; customInstructions?: string }
      | undefined;
    const customInstructions = project?.projectId ? project?.customInstructions : undefined;

    const module: SkillPromptModule = {
      buildSystemPrompt: () =>
        buildSystemPrompt(
          'You are an advanced AI assistant with specialized expertise in leveraging the Model Context Protocol (MCP) to solve complex problems efficiently. Your intelligence manifests through precise tool orchestration, context-aware execution, and proactive optimization of MCP server capabilities. ' +
            'When a tool call is made, you will receive a ToolMessage with the result. ' +
            'If an MCP server call fails or returns malformed data, the ToolMessage will contain the error details. ' +
            'You MUST carefully analyze this error message. ' +
            'If the error indicates incorrect arguments (e.g., missing parameters, invalid values, type mismatches), you MUST revise the arguments and attempt the tool call again. Do NOT repeat the previous mistake. ' +
            'If the error seems to be a transient issue (e.g., network error, temporary unavailability), you should retry the call, perhaps after a brief conceptual pause. ' +
            "You must continuously retry and adapt your approach to achieve the user's expected outcome. Never abandon the operation prematurely. " +
            'After several (e.g., 3-5) persistent failures for the same tool call despite your best efforts to correct it, and if no alternative tools or approaches are viable, you may then inform the user about the specific difficulty encountered and suggest a different course of action or ask for clarification.',
        ),
      buildContextUserPrompt: commonQnA.buildCommonQnAContextUserPrompt,
      buildUserPrompt: commonQnA.buildCommonQnAUserPrompt,
    };

    const { requestMessages, sources } = await this.commonPreprocess(
      state,
      config,
      module,
      customInstructions,
    );

    config.metadata.step = { name: 'answerQuestion' };

    if (sources.length > 0) {
      const truncatedSources = truncateSource(sources);
      await this.emitLargeDataEvent(
        {
          data: truncatedSources,
          buildEventData: (chunk, { isPartial, chunkIndex, totalChunks }) => ({
            structuredData: {
              sources: chunk,
              isPartial,
              chunkIndex,
              totalChunks,
            },
          }),
        },
        config,
      );
    }

    console.log('\n=== GETTING OR INITIALIZING CACHED LANGGRAPH AGENT FLOW ===');
    const { compiledLangGraphApp } = await this.getOrInitializeAgentComponents(user);

    try {
      const result = await compiledLangGraphApp.invoke(
        { messages: requestMessages },
        {
          ...config,
          recursionLimit: 50,
          metadata: {
            ...config.metadata,
            ...currentSkill,
          },
        },
      );
      return { messages: result.messages };
    } finally {
      this.engine.logger.log('agentNode execution finished.');
    }
  };

  toRunnable(): Runnable {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('agent', this.agentNode)
      .addEdge(START, 'agent')
      .addEdge('agent', END);

    return workflow.compile();
  }

  public async dispose(): Promise<void> {
    this.engine.logger.log(`Disposing Agent (${this.name}) and closing all cached MCP clients...`);
    for (const [userId, components] of this.userAgentComponentsCache) {
      try {
        await components.mcpClient.close();
        this.engine.logger.log(`Closed MCP client for user ${userId}`);
      } catch (e) {
        this.engine.logger.error(`Error closing MCP client for user ${userId} during dispose:`, e);
      }
    }
    this.userAgentComponentsCache.clear();
    this.engine.logger.log(`Agent (${this.name}) disposed, cache cleared.`);
  }
}

interface CachedAgentComponents {
  mcpClient: MultiServerMCPClient;
  mcpTools: any[];
  llmModel: Runnable<BaseMessage[], AIMessage>;
  toolNodeInstance: ToolNode;
  compiledLangGraphApp: CompiledStateGraph<
    any, // S: State type
    Partial<any>, // U: Update type
    'llm' | 'tools' | '__start__', // N: Node names
    Partial<any>, // I: Input type for invoke
    any, // O: Output type from invoke
    StateDefinition // C: Config type
  >;
}
