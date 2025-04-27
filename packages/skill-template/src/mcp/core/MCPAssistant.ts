import { buildSystemPrompt } from './prompt';
import { McpService } from './MCPService';
import { MCPCallToolResponse, MCPServer, MCPTool } from './types';

/**
 * Assistant message type
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * Assistant message interface
 */
export interface Message {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
}

/**
 * Tool call extraction result
 */
export interface ToolCallExtraction {
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, any>;
  /** Raw extraction text */
  rawText: string;
}

/**
 * Tool response status
 */
export type ToolResponseStatus = 'pending' | 'invoking' | 'done' | 'error';

/**
 * Tool response
 */
export interface MCPToolResponse {
  /** Response ID */
  id: string;
  /** Tool */
  tool: MCPTool;
  /** Response status */
  status: ToolResponseStatus;
  /** Tool call response */
  response?: MCPCallToolResponse;
}

/**
 * Callback data
 */
export interface ChunkCallbackData {
  /** Text content */
  text?: string;
  /** Tool response */
  mcpToolResponse?: MCPToolResponse[];
}

/**
 * MCP assistant options
 */
export interface MCPAssistantOptions {
  /** Whether to auto-inject tools */
  autoInjectTools?: boolean;
  /** Custom system prompt */
  customSystemPrompt?: string;
  /** Large model provider function */
  modelProvider: (messages: Message[]) => Promise<string>;
  /** Progress callback function */
  onChunk?: (data: ChunkCallbackData) => void;
  /** MCP client instance (optional) */
  client?: McpService;
}

/**
 * MCP Assistant
 * Implements interaction with large models, injects tools into system prompts
 */
export class MCPAssistant {
  private client: McpService;
  private servers: MCPServer[] = [];
  private tools: MCPTool[] = [];
  private messages: Message[] = [];
  private autoInjectTools: boolean;
  private customSystemPrompt: string | undefined;
  private modelProvider: (messages: Message[]) => Promise<string>;
  private onChunk?: (data: ChunkCallbackData) => void;

  /**
   * Create MCP assistant
   * @param options Assistant options
   */
  constructor(options: MCPAssistantOptions) {
    this.client = options.client || new McpService();
    this.autoInjectTools = options.autoInjectTools !== false;
    this.customSystemPrompt = options.customSystemPrompt;
    this.modelProvider = options.modelProvider;
    this.onChunk = options.onChunk;

    // Initialize system prompt
    this.resetMessages();
  }

  /**
   * Reset message history
   */
  resetMessages(): void {
    this.messages = [];

    // Add default system prompt
    const systemPrompt = this.buildSystemPrompt();
    this.messages.push({
      role: MessageRole.SYSTEM,
      content: systemPrompt,
    });
  }

  /**
   * Add server
   * @param server Server configuration
   */
  async addServer(server: MCPServer): Promise<MCPTool[]> {
    // Connect to server
    const connected = await this.client.initClient(server);
    if (!connected) {
      throw new Error(`Failed to connect to server: ${server.id}`);
    }

    this.servers.push(server);

    // If auto-inject tools is enabled, get tools and rebuild system prompt
    if (this.autoInjectTools) {
      await this.loadTools();
      this.updateSystemPrompt();
    }
    return this.tools;
  }

  /**
   * Load tools from all servers
   */
  async loadTools(): Promise<void> {
    this.tools = [];

    for (const server of this.servers) {
      const serverTools = await this.client.listTools(server);
      this.tools.push(...serverTools);
    }
  }

  /**
   * Update system prompt
   */
  updateSystemPrompt(): void {
    const systemPrompt = this.buildSystemPrompt();

    // Update existing system prompt or add new system prompt
    if (this.messages.length > 0 && this.messages[0].role === MessageRole.SYSTEM) {
      this.messages[0].content = systemPrompt;
    } else {
      this.messages.unshift({
        role: MessageRole.SYSTEM,
        content: systemPrompt,
      });
    }
  }

  /**
   * Build system prompt
   * @returns Complete system prompt
   */
  private buildSystemPrompt(userSystemPrompt?: string): string {
    // If no tools or custom system prompt, use default prompt
    if (this.tools.length === 0 && !this.customSystemPrompt) {
      return "You are a helpful assistant. Answer the user's questions to the best of your ability.";
    }

    return buildSystemPrompt(
      userSystemPrompt ||
        'You are an advanced AI assistant with specialized expertise in leveraging the Model Context Protocol (MCP) to solve complex problems efficiently. Your intelligence manifests through precise tool orchestration, context-aware execution, and proactive optimization of MCP server capabilities.',
      this.tools,
    );
  }

  /**
   * 添加用户消息
   * @param content 消息内容
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: MessageRole.USER,
      content,
    });
  }

  /**
   * 添加助手消息
   * @param content 消息内容
   */
  addAssistantMessage(content: string): void {
    this.messages.push({
      role: MessageRole.ASSISTANT,
      content,
    });
  }

  /**
   * 获取完整对话历史
   * @returns 消息历史
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * 从助手响应中提取所有工具调用
   * @param content 响应内容
   * @returns 工具响应数组
   */
  parseToolUse(content: string, mcpTools: MCPTool[] = this.tools): MCPToolResponse[] {
    if (!content || !mcpTools || mcpTools.length === 0) {
      return [];
    }
    const toolUsePattern =
      /<tool_use>([\s\S]*?)<name>([\s\S]*?)<\/name>([\s\S]*?)<arguments>([\s\S]*?)<\/arguments>([\s\S]*?)<\/tool_use>/g;
    const tools: MCPToolResponse[] = [];
    let match: RegExpExecArray | null;
    let idx = 0;

    // Reset regex lastIndex to ensure we start from the beginning
    toolUsePattern.lastIndex = 0;

    // Find all tool use blocks
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    while ((match = toolUsePattern.exec(content)) !== null) {
      // const fullMatch = match[0]
      const toolName = match[2].trim();
      const toolArgs = match[4].trim();

      // Try to parse the arguments as JSON
      let parsedArgs: any;
      try {
        parsedArgs = JSON.parse(toolArgs);
      } catch {
        // If parsing fails, use the string as is
        parsedArgs = toolArgs;
      }
      // console.log(`Parsed arguments for tool "${toolName}":`, parsedArgs)
      const mcpTool = mcpTools.find((tool) => tool.id === toolName);
      if (!mcpTool) {
        console.error(`Tool "${toolName}" not found in MCP tools`);
        continue;
      }

      // Add to tools array
      tools.push({
        id: `${toolName}-${idx++}`, // Unique ID for each tool use
        tool: {
          ...mcpTool,
          inputSchema: parsedArgs,
        },
        status: 'pending',
      });

      // 如果匹配的内容长度为0，手动增加lastIndex防止死循环
      if (match[0].length === 0) {
        toolUsePattern.lastIndex++;
      }
    }
    return tools;
  }

  /**
   * Update tool response
   * @param results Results array
   * @param resp Response
   */
  private upsertToolResponse(results: MCPToolResponse[], resp: MCPToolResponse): void {
    const index = results.findIndex((r) => r.id === resp.id);
    if (index !== -1) {
      results[index] = resp;
    } else {
      results.push(resp);
    }

    // Notify progress
    if (this.onChunk) {
      this.onChunk({ mcpToolResponse: results });
    }
  }

  /**
   * Execute assistant conversation
   * @param userMessage User message
   * @returns Assistant response
   */
  async run(userMessage: string): Promise<string> {
    // Add user message
    this.addUserMessage(userMessage);

    // Start recursive processing
    return this.processConversation(0);
  }

  /**
   * Process conversation recursively
   * @param depth Recursion depth
   * @returns Final assistant response
   */
  private async processConversation(depth: number): Promise<string> {
    // Prevent infinite recursion
    if (depth > 10) {
      console.warn('Maximum recursion depth reached in processConversation');
      return 'Maximum tool call depth reached. Please continue the conversation.';
    }

    // Call model to get response
    const assistantResponse = await this.modelProvider(this.messages);

    // Add assistant response
    this.addAssistantMessage(assistantResponse);

    // Notify progress
    if (this.onChunk) {
      this.onChunk({ text: assistantResponse });
    }

    // Parse all tool calls
    const toolResponses = this.parseToolUse(assistantResponse);

    // If no tool calls, return assistant response
    if (toolResponses.length === 0) {
      return assistantResponse;
    }

    // Process all tool calls
    const toolCallPromises = toolResponses.map(async (toolResponse) => {
      // Update status to invoking
      this.upsertToolResponse(toolResponses, { ...toolResponse, status: 'invoking' });

      try {
        // Execute tool call
        const result = await this.executeToolCall(
          toolResponse.tool,
          toolResponse.tool.inputSchema as Record<string, any>,
        );

        // Format result
        const formattedResult = this.formatToolResult(toolResponse.tool.id, result);

        // Add result to conversation
        this.addUserMessage(formattedResult);

        // Update status to done
        this.upsertToolResponse(toolResponses, {
          ...toolResponse,
          status: 'done',
          response: {
            content: [{ type: 'text', text: result }],
          },
        });

        return { success: true, result };
      } catch (error) {
        // Handle error
        const errorMessage = `Error executing tool ${toolResponse.tool.id}: ${error instanceof Error ? error.message : String(error)}`;
        const formattedError = this.formatToolResult(toolResponse.tool.id, errorMessage);

        // Add error to conversation
        this.addUserMessage(formattedError);

        // Update status to error
        this.upsertToolResponse(toolResponses, {
          ...toolResponse,
          status: 'error',
          response: {
            isError: true,
            content: [{ type: 'text', text: errorMessage }],
          },
        });

        return { success: false, error: errorMessage };
      }
    });

    // Wait for all tool calls to complete
    await Promise.all(toolCallPromises);

    // Recursively process next round of conversation
    return this.processConversation(depth + 1);
  }

  /**
   * Format tool call result
   * @param toolName Tool name
   * @param result Result text
   * @returns Formatted tool call result
   */
  formatToolResult(toolName: string, result: string): string {
    return `<tool_use_result>
  <name>${toolName}</name>
  <result>${result}</result>
</tool_use_result>`;
  }

  /**
   * Execute tool call
   * @param tool Tool object
   * @param args Tool arguments
   * @returns Tool call result text
   */
  private async executeToolCall(tool: MCPTool, args: Record<string, any>): Promise<string> {
    // Get server configuration
    const serverConfig = this.servers.find((s) => s.id === tool.serverId);

    if (!serverConfig) {
      throw new Error(`Server ${tool.serverId} not found`);
    }

    // Call tool
    const response = await this.client.callTool({
      server: serverConfig,
      name: tool.name,
      args,
    });

    // Extract text content
    if (response.isError) {
      throw new Error(response.content?.[0]?.text || 'Unknown error');
    }

    // Convert content to text
    return this.formatToolResponseContent(response);
  }

  /**
   * Format tool response content
   * @param response Tool call response
   * @returns Formatted text
   */
  private formatToolResponseContent(response: MCPCallToolResponse): string {
    if (!response.content || response.content.length === 0) {
      return '';
    }

    // Connect all text content
    return response.content
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n');
  }

  /**
   * Close assistant and disconnect all connections
   */
  async close(): Promise<void> {
    await this.client.cleanup();
  }
}
