import { END, START, StateGraph, StateGraphArgs } from '@langchain/langgraph';
import { z } from 'zod';
import { BaseSkill, BaseSkillState, baseStateGraphArgs, SkillRunnableConfig } from '../base';
import { Icon, SkillInvocationConfig, SkillTemplateConfigDefinition } from '@refly/openapi-schema';

// Import MCP modules
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { GraphState } from '../scheduler/types';
import { prepareContext } from '../scheduler/utils/context';
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';
import {
  ChunkCallbackData,
  MCPServer,
  MCPTool,
  Message,
  MessageRole,
  MCPToolResponse,
} from '../mcp/core/types';
import { MCPAssistant } from '../mcp/core/MCPAssistant';
import { safeStringifyJSON } from '@refly/utils';
import { IContext } from '../scheduler/types';

/**
 * Extended state for MCP Connector skill
 */
interface MCPAgentState extends BaseSkillState {
  mcpActionResult?: Message[];
}

/**
 * MCP Connector Skill
 * Connects to Model Context Protocol servers and makes intelligent decisions
 * about when and how to use their capabilities to solve user queries.
 * Uses MCPAssistant to manage interactions with MCP servers.
 */
export class MCPAgent extends BaseSkill {
  name = 'MCPAgent';

  icon: Icon = { type: 'emoji', value: '🔌' };

  displayName = {
    en: 'MCP Agent',
    'zh-CN': 'MCP Agent',
  };

  description =
    'Connect to MCP servers and intelligently leverage their capabilities to solve user queries';

  // MCPAssistant instances cache - store assistants by session ID
  private mcpAssistants: Record<string, MCPAssistant> = {};

  // Server configurations cache
  private serverConfigs: Record<string, MCPServer> = {};

  // Configuration schema for the skill
  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'mcpServerUrls',
        inputMode: 'inputTextArea',
        defaultValue: '',
        labelDict: {
          en: 'MCP Server URLs',
          'zh-CN': 'MCP服务器地址',
        },
        descriptionDict: {
          en: 'Comma-separated list of MCP server URLs',
          'zh-CN': '以逗号分隔的MCP服务器URL列表',
        },
      },
      {
        key: 'autoConnect',
        inputMode: 'switch',
        defaultValue: true,
        labelDict: {
          en: 'Auto Connect',
          'zh-CN': '自动连接',
        },
        descriptionDict: {
          en: 'Automatically connect to MCP servers on startup',
          'zh-CN': '启动时自动连接到MCP服务器',
        },
      },
      {
        key: 'modelTemperature',
        inputMode: 'inputNumber',
        defaultValue: 0.2,
        labelDict: {
          en: 'Model Temperature',
          'zh-CN': '模型温度',
        },
        descriptionDict: {
          en: 'Temperature for the model when making MCP decisions (0-1)',
          'zh-CN': '在进行MCP决策时模型的温度值（0-1）',
        },
        inputProps: {
          min: 0,
          max: 1,
          step: 0.1,
        },
      },
    ],
  };

  // Invocation configuration
  invocationConfig: SkillInvocationConfig = {};

  // Schema definition for input
  schema = z.object({
    query: z.string().optional().describe('User query for MCP interaction'),
    images: z.array(z.string()).optional().describe('Images that might be relevant'),
  });

  // State graph definition with additional mcpActionResult channel
  graphState: StateGraphArgs<MCPAgentState>['channels'] = {
    ...baseStateGraphArgs,
    mcpActionResult: {
      reducer: (_left, right) => right,
      default: () => undefined,
    },
  };

  /**
   * Create a new MCPAssistant or get an existing one
   * @param sessionId Unique session identifier
   * @param config Skill configuration
   * @returns MCPAssistant instance
   */
  private getOrCreateAssistant(sessionId: string, config: SkillRunnableConfig): MCPAssistant {
    // Check if we already have an assistant for this session
    if (this.mcpAssistants[sessionId]) {
      return this.mcpAssistants[sessionId];
    }

    // Create a new assistant
    const assistant = new MCPAssistant({
      autoInjectTools: true,
      modelProvider: (messages) => this.callModel(messages, config),
      onChunk: (data) => this.handleChunk(data, config),
    });

    // Cache the assistant
    this.mcpAssistants[sessionId] = assistant;

    return assistant;
  }

  /**
   * Call the model with messages
   * @param messages Messages to send to the model
   * @param config Skill configuration
   * @returns Model response text
   */
  private async callModel(messages: Message[], config: SkillRunnableConfig): Promise<string> {
    // Convert MCPAssistant messages to BaseMessage format
    const baseMessages = messages.map((msg) => {
      // Map roles
      const roleMap: Record<MessageRole, string> = {
        [MessageRole.SYSTEM]: 'system',
        [MessageRole.USER]: 'user',
        [MessageRole.ASSISTANT]: 'assistant',
      };

      return {
        role: roleMap[msg.role],
        content: msg.content,
      };
    });

    // Get temperature setting
    const temperature = (config.configurable.tplConfig?.modelTemperature?.value as number) || 0.2;

    // Call model
    const model = this.engine.chatModel({ temperature });
    const response = await model.invoke(baseMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        ...config.configurable.currentSkill,
      },
    });

    // Return response content
    return typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  }

  /**
   * Handle chunks from MCPAssistant
   * @param data Chunk data
   * @param config Skill configuration
   */
  private handleChunk(data: ChunkCallbackData, config: SkillRunnableConfig): void {
    // Handle text chunks for streaming
    // if (data.text) {
    //   this.emitEvent(
    //     {
    //       content: data.text,
    //       event: 'stream',
    //     },
    //     config,
    //   );
    // }

    // Handle tool response chunks
    if (data.mcpToolResponse) {
      this.handleToolResponses(data.mcpToolResponse, config);
    }
  }

  messageIndex = 0;

  /**
   * Process tool responses and emit structured data
   * @param toolResponses Array of tool response objects
   * @param config Skill configuration
   */
  private handleToolResponses(toolResponses: MCPToolResponse[], config: SkillRunnableConfig): void {
    // 收集不同状态的工具
    const executing = toolResponses.filter((tool) => tool.status === 'invoking');
    const completed = toolResponses.filter((tool) => tool.status === 'done');
    const errors = toolResponses.filter((tool) => tool.status === 'error');

    // 批量处理工具状态变化，减少事件发送次数
    if (executing.length > 0 || completed.length > 0 || errors.length > 0) {
      // 构建工具状态变化摘要

      if (completed.length > 0) {
        for (const t of completed) {
          // Set initial step

          config.metadata.step = { name: `${t.tool.name}-${this.messageIndex++}` };

          this.emitEvent(
            {
              event: 'log',
              log: {
                key: 'mcpCallingFinish',
                titleArgs: {
                  ...t.tool,
                  status: t.status,
                },
                descriptionArgs: {
                  ...t.tool,
                  status: t.status,

                  json: { params: t.tool.inputSchema, response: t.response },
                },
                ...{ status: 'finish' },
              },
            },
            config,
          );
        }
      }

      if (errors.length > 0) {
        for (const t of errors) {
          // Set initial step
          config.metadata.step = { name: `${t.tool.name}-${this.messageIndex++}` };

          this.emitEvent(
            {
              event: 'log',
              log: {
                key: 'mcpCallingError',
                titleArgs: {
                  ...t.tool,
                  status: t.status,
                },
                descriptionArgs: {
                  ...t.tool,
                  status: t.status,
                  json: { params: t.tool.inputSchema, response: t.response },
                },
                ...{ status: 'error' },
              },
            },
            config,
          );
        }
      }
    }

    // 记录工具错误到日志（仍然保留，因为错误信息对排查问题很重要）
    for (const tool of errors) {
      const errorMessage = tool.response?.content[0]?.text || 'Unknown error';
      this.engine.logger.error(`Tool ${tool.tool.name} error: ${errorMessage}`);
    }
  }

  /**
   * Build server configurations from URLs
   * @param serverUrls Array of server URLs
   * @returns Array of server configurations
   */
  private buildServerConfigs(serverUrls: string[]): MCPServer[] {
    return serverUrls.map((url, index) => {
      // Check if we already have a configuration for this URL
      if (this.serverConfigs[url]) {
        return this.serverConfigs[url];
      }

      // Create a new configuration
      const config: MCPServer = {
        id: `server-${index}`,
        name: `MCP Server ${index + 1}`,
        description: `MCP server at ${url}`,
        type: url.includes('/sse') ? 'sse' : 'streamableHttp',
        baseUrl: url,
        isActive: true,
      };

      // Cache the configuration
      this.serverConfigs[url] = config;

      return config;
    });
  }

  /**
   * Add servers to MCPAssistant
   * @param assistant MCPAssistant instance
   * @param serverConfigs Array of server configurations
   * @param config Skill configuration
   * @returns Connection results
   */
  private async addServersToAssistant(
    assistant: MCPAssistant,
    serverConfigs: MCPServer[],
    config: SkillRunnableConfig,
  ): Promise<{
    success: boolean;
    connectedServers: string[];
    failedServers: string[];
    loadedTools: MCPTool[];
  }> {
    const connectedServers: string[] = [];
    const failedServers: string[] = [];
    const loadedTools: MCPTool[] = [];

    // 只发送一个连接尝试事件，精简日志
    if (serverConfigs.length > 0) {
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'connecting_mcp_servers',
            titleArgs: {
              count: serverConfigs.length,
            },
          },
        },
        config,
      );
    }

    // Connect to each server
    for (const serverConfig of serverConfigs) {
      try {
        const tools = await assistant.addServer(serverConfig);
        connectedServers.push(serverConfig.baseUrl || serverConfig.id);
        loadedTools.push(...tools);

        this.engine.logger.log(
          `Connected to MCP server: ${serverConfig.baseUrl || serverConfig.id}`,
        );

        // 不再为每个服务器单独发送连接成功事件
      } catch (error) {
        failedServers.push(serverConfig.baseUrl || serverConfig.id);
        this.engine.logger.error(
          `Failed to connect to MCP server ${serverConfig.baseUrl || serverConfig.id}: ${error}`,
        );
        // 不再为每个失败的服务器单独发送事件
      }
    }

    // 只发送一次汇总事件，包含所有连接结果
    this.emitEvent(
      {
        event: 'log',
        log: {
          key: 'mcp_connection_summary',
          titleArgs: {
            total: serverConfigs.length,
            connected: connectedServers.length,
            failed: failedServers.length,
          },
          descriptionArgs: {
            totalTools: loadedTools.length,
            failedServers: failedServers.join(', '),
          },
        },
      },
      config,
    );

    return {
      success: connectedServers.length > 0,
      connectedServers,
      failedServers,
      loadedTools,
    };
  }

  /**
   * Clean up MCPAssistant instances and connections
   */
  cleanupSessions(): void {
    // Close all assistants
    for (const [sessionId, assistant] of Object.entries(this.mcpAssistants)) {
      try {
        assistant.close().catch((error) => {
          this.engine.logger.warn(`Failed to close MCPAssistant for ${sessionId}: ${error}`);
        });

        delete this.mcpAssistants[sessionId];
      } catch (error) {
        this.engine.logger.warn(`Error cleaning up MCPAssistant for ${sessionId}: ${error}`);
      }
    }

    // Clear caches
    this.mcpAssistants = {};
  }

  /**
   * Main handler method for the MCP Connector skill
   * @param state Graph state
   * @param config Skill configuration
   * @returns Updated graph state
   */
  callMCPAgent = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<MCPAgentState>> => {
    const { messages = [], images = [] } = state;
    const { tplConfig, project } = config.configurable;

    // Extract customInstructions from project if available
    const customInstructions = project?.customInstructions;

    // Get configuration values
    const mcpServersString = tplConfig?.mcpServerUrls?.value as string;
    const serverUrls = mcpServersString
      ? mcpServersString
          .split(',')
          .map((url) => url.trim())
          .filter((url) => url.length > 0)
      : [];

    const autoConnect = tplConfig?.autoConnect?.value !== false;

    // Generate a session ID for this request
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Set initial step
    config.metadata.step = { name: 'analyzeQuery' };

    // Process the query
    const { query, optimizedQuery, usedChatHistory, mentionedContext, remainingTokens } =
      await processQuery({
        config,
        ctxThis: this,
        state,
      });

    // 简化query处理事件，只在有优化时才发送事件
    if (optimizedQuery && optimizedQuery !== query) {
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'query_processed',
            titleArgs: {
              original: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
              optimized:
                optimizedQuery.substring(0, 50) + (optimizedQuery.length > 50 ? '...' : ''),
            },
          },
        },
        config,
      );
    }

    // If no servers or auto-connect disabled, answer directly
    if (!autoConnect || serverUrls.length === 0) {
      // 简化这里的事件，使用更简洁的形式
      this.engine.logger.log(
        `Using direct answer mode: ${!autoConnect ? 'auto-connect disabled' : 'no servers configured'}`,
      );

      return this.handleDirectAnswer(
        query,
        optimizedQuery,
        usedChatHistory,
        mentionedContext,
        remainingTokens,
        images,
        messages,
        config,
        customInstructions,
      );
    }

    // Create MCPAssistant and add servers
    const assistant = this.getOrCreateAssistant(sessionId, config);

    // Build server configurations
    const serverConfigs = this.buildServerConfigs(serverUrls);

    // Connect to servers
    const connectionResult = await this.addServersToAssistant(assistant, serverConfigs, config);

    // If connection failed, answer directly
    if (!connectionResult.success) {
      this.engine.logger.warn('No MCP servers connected, falling back to direct answer');

      return this.handleDirectAnswer(
        query,
        optimizedQuery,
        usedChatHistory,
        mentionedContext,
        remainingTokens,
        images,
        messages,
        config,
        customInstructions,
      );
    }

    try {
      // Set MCP processing step
      config.metadata.step = { name: 'processMCPQuery' };

      // 精简处理查询事件
      this.engine.logger.log(`Processing query with MCP: ${optimizedQuery || query}`);

      config.metadata.step = { name: 'mcpAssistantModelCalling' };

      // Run the assistant with the query
      const assistantResponse = await assistant.run(query);

      // Get all messages for context
      const mcpActionResult = assistant.getMessages();

      // 简化MCP结果事件
      this.engine.logger.log(
        `MCP execution complete: ${mcpActionResult.length} messages generated`,
      );

      // Create response message
      const responseMessage = new AIMessage({ content: assistantResponse });

      return {
        messages: [responseMessage],
        mcpActionResult,
      };
    } catch (error) {
      // Log error
      this.engine.logger.error(`Error in MCPAssistant processing: ${error}`);

      // 简化错误事件
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'mcp_processing_error',
            titleArgs: {
              error: String(error),
            },
          },
        },
        config,
      );

      // Fall back to direct answer
      return this.handleDirectAnswer(
        query,
        optimizedQuery,
        usedChatHistory,
        mentionedContext,
        remainingTokens,
        images,
        messages,
        config,
        customInstructions,
      );
    } finally {
      // Clean up the assistant after use
      try {
        await assistant.close();
        delete this.mcpAssistants[sessionId];
      } catch (closeError) {
        this.engine.logger.warn(`Error closing MCPAssistant: ${closeError}`);
      }
    }
  };

  /**
   * Handle direct answering without MCP
   * @param query Original query
   * @param optimizedQuery Optimized query
   * @param usedChatHistory Used chat history
   * @param mentionedContext Mentioned context
   * @param remainingTokens Remaining tokens
   * @param images Images
   * @param messages Messages
   * @param config Skill configuration
   * @param customInstructions Custom instructions from project
   * @returns Updated graph state
   */
  private async handleDirectAnswer(
    query: string,
    optimizedQuery: string,
    usedChatHistory: BaseMessage[],
    mentionedContext: IContext,
    remainingTokens: number,
    images: string[],
    messages: BaseMessage[],
    config: SkillRunnableConfig,
    customInstructions?: string,
  ): Promise<Partial<MCPAgentState>> {
    const { locale = 'en' } = config.configurable;

    // Prepare context for direct answering
    config.metadata.step = { name: 'prepareContext' };

    const { contextStr, sources } = await prepareContext(
      {
        query: optimizedQuery,
        mentionedContext,
        maxTokens: remainingTokens,
        enableMentionedContext: true,
      },
      {
        config,
        ctxThis: this,
        state: { query, images, messages: [] },
        tplConfig: config.configurable.tplConfig,
      },
    );

    // 简化上下文源事件，只在找到源且有上下文时才发送
    if (sources?.length > 0 && contextStr) {
      this.engine.logger.log(
        `Found ${sources.length} context sources with ${contextStr.length} characters`,
      );
    }

    // Use simple module for direct answering
    const module = {
      buildSystemPrompt: () =>
        'You are a helpful assistant. Answer the user query based on your knowledge and the provided context if any.',
      buildContextUserPrompt: (context: string) => context,
      buildUserPrompt: ({ originalQuery }: { originalQuery: string }) => originalQuery,
    };

    // Set answer generation step
    config.metadata.step = { name: 'generateDirectAnswer' };

    // Build request messages
    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: !!contextStr,
      context: contextStr,
      images,
      originalQuery: query,
      optimizedQuery,
      modelInfo: config?.configurable?.modelInfo,
      customInstructions,
    });

    // Call model directly with lower temperature for direct answers
    const model = this.engine.chatModel({ temperature: 0.1 });
    const responseMessage = await model.invoke(requestMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        ...config.configurable.currentSkill,
      },
    });

    // 精简响应事件，只记录响应长度到日志
    const responseLength =
      typeof responseMessage.content === 'string'
        ? responseMessage.content.length
        : safeStringifyJSON(responseMessage.content).length;

    this.engine.logger.log(`Generated direct answer with ${responseLength} characters`);

    return {
      messages: [responseMessage],
      mcpActionResult: null,
    };
  }

  /**
   * Define the workflow for this skill
   * @returns The compiled runnable
   */
  toRunnable(): Runnable<GraphState, unknown> {
    // Create a simple linear workflow
    const workflow = new StateGraph<MCPAgentState>({
      channels: this.graphState,
    })
      .addNode('callMCPAgent', this.callMCPAgent.bind(this))
      .addEdge(START, 'callMCPAgent')
      .addEdge('callMCPAgent', END);

    return workflow.compile();
  }
}
