import { START, END, StateGraphArgs, StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON } from '@refly/utils';
import {
  Icon,
  ListMcpServersResponse,
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
import { isValidUrl } from '@refly/utils';

// prompts
import * as commonQnA from '../scheduler/module/commonQnA';
import { checkModelContextLenSupport } from '../scheduler/utils/model';
import { AIMessage } from '@langchain/core/messages';
import { Connection, MultiServerMCPClient } from '../adapters';
import { buildSystemPrompt } from '../mcp/core/prompt';

export class Agent extends BaseSkill {
  name = 'agent';

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

  // Default skills to be scheduled (they are actually templates!).
  skills: BaseSkill[] = createSkillTemplateInventory(this.engine);

  isValidSkillName = (name: string) => {
    return this.skills.some((skill) => skill.name === name);
  };

  /**
   * Converts MCP servers response to MultiServerMCPClient configuration format
   * @param response - The response from listMcpServers API
   * @returns A record mapping server names to their connection configurations
   */
  private convertMcpServersToClientConfig = (
    response: ListMcpServersResponse,
  ): Record<string, Connection> => {
    const mcpServers = response.data || [];
    const config: Record<string, Connection> = {};

    for (const server of mcpServers) {
      // Skip servers without a name
      if (!server.name) continue;

      // Create connection config based on server type
      switch (server.type) {
        case 'sse':
          if (server.url) {
            config[server.name] = {
              type: 'sse',
              url: server.url,
              headers: server.headers,
              reconnect: server.reconnect,
            };
          }
          break;
        case 'streamable':
          if (server.url) {
            config[server.name] = {
              type: 'streamable',
              url: server.url,
              headers: server.headers,
              reconnect: server.reconnect,
            };
          }
          break;
        case 'stdio':
          if (server.command) {
            config[server.name] = {
              type: 'stdio',
              command: server.command,
              args: server.args,
              env: server.env,
              restart: server.reconnect
                ? {
                    enabled: server.reconnect.enabled,
                    maxAttempts: server.reconnect.maxAttempts,
                    delayMs: server.reconnect.delayMs,
                  }
                : undefined,
            };
          }
          break;
      }
    }

    return config;
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

    // Use shared query processor with shouldSkipAnalysis option
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
      shouldSkipAnalysis: true, // For common QnA, we can skip analysis when there's no context and chat history
    });

    // Extract custom instructions only if project ID exists
    const projectId = project?.projectId;

    // Only enable knowledge base search if both projectId AND runtimeConfig.enabledKnowledgeBase are true
    const enableKnowledgeBaseSearch = !!projectId && !!runtimeConfig?.enabledKnowledgeBase;

    this.engine.logger.log(
      `ProjectId: ${projectId}, Enable KB Search: ${enableKnowledgeBaseSearch}`,
    );

    // Process URLs from context first (frontend)
    const contextUrls = config.configurable?.urls || [];
    this.engine.logger.log(`Context URLs: ${safeStringifyJSON(contextUrls)}`);

    // Process context URLs
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

    // Extract URLs from the query and crawl them with optimized concurrent processing
    const { sources: queryUrlSources, analysis } = await extractAndCrawlUrls(query, config, this, {
      concurrencyLimit: 5, // 增加并发爬取的URL数量限制
      batchSize: 8, // 增加每批处理的URL数量
    });

    this.engine.logger.log(`URL extraction analysis: ${safeStringifyJSON(analysis)}`);
    this.engine.logger.log(`Extracted query URL sources count: ${queryUrlSources.length}`);

    // Combine URL sources, prioritizing context URLs
    const urlSources = [...contextUrlSources, ...queryUrlSources];
    this.engine.logger.log(`Total URL sources count: ${urlSources.length}`);

    let context = '';
    let sources: Source[] = [];

    // Consider URL sources for context preparation
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
          urlSources, // Pass URL sources to the prepareContext function
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

  private _cachedSetup: {
    model: any;
    toolNode: ToolNode;
    mcpTools: any[];
  } | null = null;

  async setupAgent(user) {
    // Return cached setup if available
    if (this._cachedSetup) {
      return this._cachedSetup;
    }

    // Create document with generated title
    const mcpServersResponse = await this.engine.service.listMcpServers(user, {
      enabled: true,
    });

    // Convert MCP servers response to MultiServerMCPClient config format
    const mcpClientConfig = this.convertMcpServersToClientConfig(mcpServersResponse);

    // Initialize MCP client with the converted config
    const client = new MultiServerMCPClient(mcpClientConfig);

    // Initialize MCP client
    // const client = new MultiServerMCPClient({
    //   'mcp-time': {
    //     type: 'sse',
    //     url: 'https://mcp.higress.ai/mcp-time/cmacdo7yu00469001xgwju1os/sse',
    //   },
    //   'mcp-ip-query': {
    //     type: 'streamable',
    //     url: 'https://mcp.higress.ai/mcp-ip-query/cmacdo7yu00469001xgwju1os',
    //   },
    //   'mcp-calendar-holiday-helper': {
    //     type: 'sse',
    //     url: 'https://mcp.higress.ai/mcp-calendar-holiday-helper/cmacdo7yu00469001xgwju1os/sse',
    //   },
    //   'mcp-firecrawl': {
    //     type: 'sse',
    //     url: 'https://mcp.higress.ai/mcp-firecrawl/cmacdo7yu00469001xgwju1os/sse',
    //   },
    //   'mcp-wolframalpha': {
    //     type: 'sse',
    //     url: 'https://mcp.higress.ai/mcp-wolframalpha/cmacdo7yu00469001xgwju1os/sse',
    //   },
    //   puppeteer: {
    //     command: '/Users/qiyuan/.nvm/versions/node/v20.19.0/bin/npx',
    //     args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    //     env: {
    //       ...process.env, // Include all current environment variables
    //     },
    //   },
    // });

    // Add more debug information
    this.engine.logger.log('Initializing MCP client and getting tools...');

    try {
      // 先初始化连接
      await client.initializeConnections();
      this.engine.logger.log('MCP connections initialized successfully');

      // 然后获取工具
      const mcpTools = await client.getTools();

      if (!mcpTools?.length) {
        throw new Error('No tools found');
      }

      this.engine.logger.log(
        `Loaded ${mcpTools.length} MCP tools: ${mcpTools.map((tool) => tool.name).join(', ')}`,
      );

      // Create model and tool node
      const model = this.engine.chatModel({ temperature: 0.1 }).bindTools(mcpTools);
      const toolNode = new ToolNode(mcpTools);

      // Cache the setup
      this._cachedSetup = { model, toolNode, mcpTools };

      return this._cachedSetup;
    } catch (error) {
      this.engine.logger.error('Error during MCP setup:', error);
      if (error instanceof Error) {
        this.engine.logger.error('Error stack:', error.stack);
      }
      throw new Error('Failed to initialize MCP tools');
    }
  }

  // LLM node - Process messages and call model
  agentNode = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, user } = config.configurable;

    const { model, toolNode, mcpTools } = await this.setupAgent(user);

    // Extract projectId and customInstructions from project
    const project = config.configurable?.project as
      | { projectId: string; customInstructions?: string }
      | undefined;

    // Use customInstructions only if projectId exists (regardless of knowledge base search status)
    const customInstructions = project?.projectId ? project?.customInstructions : undefined;

    // common preprocess
    const module = {
      buildSystemPrompt: () =>
        buildSystemPrompt(
          "You are an advanced AI assistant with specialized expertise in leveraging the Model Context Protocol (MCP) to solve complex problems efficiently. Your intelligence manifests through precise tool orchestration, context-aware execution, and proactive optimization of MCP server capabilities. If an MCP server call fails or returns malformed data, you must continuously retry until achieving the user's expected outcome — never abandon the operation prematurely.",
          mcpTools as any,
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

    // set current step
    config.metadata.step = { name: 'answerQuestion' };

    if (sources.length > 0) {
      // Truncate sources before emitting
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

    console.log('\n=== CREATING LANGGRAPH AGENT FLOW ===');

    // Define LLM node function
    const llmNode = async (nodeState: typeof MessagesAnnotation.State) => {
      console.log('Calling LLM with messages:', nodeState.messages.length);
      const response = await model.invoke(nodeState.messages);
      return { messages: [response] };
    };

    // Create workflow
    const workflow = new StateGraph(MessagesAnnotation)
      .addNode('llm', llmNode)
      .addNode('tools', toolNode)
      .addEdge(START, 'llm')
      .addEdge('tools', 'llm')
      .addConditionalEdges('llm', (graphState) => {
        const lastMessage = graphState.messages[graphState.messages.length - 1];
        const aiMessage = lastMessage as AIMessage;
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          console.log('Tool calls detected, routing to tools node');
          return 'tools';
        }
        console.log('No tool calls, ending the workflow');
        return END;
      });

    // Compile and execute workflow
    const app = workflow.compile();

    const result = await app.invoke(
      { messages: requestMessages },
      {
        ...config,
        metadata: {
          ...config.metadata,
          ...currentSkill,
        },
      },
    );

    console.log('result', result);

    return { messages: result.messages };
  };

  toRunnable(): Runnable {
    // Create a simple linear workflow
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('agent', this.agentNode)
      .addEdge(START, 'agent')
      .addEdge('agent', END);

    return workflow.compile();
  }
}
