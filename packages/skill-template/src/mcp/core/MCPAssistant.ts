import { McpService } from './MCPService';
import { MCPCallToolResponse, MCPServer, MCPTool, MCPToolInputSchema } from './types';

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
  async addServer(server: MCPServer): Promise<void> {
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
  private buildSystemPrompt(): string {
    // If no tools or custom system prompt, use default prompt
    if (this.tools.length === 0 && !this.customSystemPrompt) {
      return "You are a helpful assistant. Answer the user's questions to the best of your ability.";
    }

    // Use Cherry Studio prompt template
    const SYSTEM_PROMPT = `In this environment you have access to a set of tools you can use to answer the user's question. \
You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

## Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_use>
  <n>{tool_name}</n>
  <arguments>{json_arguments}</arguments>
</tool_use>

The tool name should be the exact name of the tool you are using, and the arguments should be a JSON object containing the parameters required by that tool. For example:
<tool_use>
  <n>python_interpreter</n>
  <arguments>{"code": "5 + 3 + 1294.678"}</arguments>
</tool_use>

The user will respond with the result of the tool use, which should be formatted as follows:

<tool_use_result>
  <n>{tool_name}</n>
  <r>{result}</r>
</tool_use_result>

The result should be a string, which can represent a file or any other output type. You can use this result as input for the next action.
For example, if the result of the tool use is an image file, you can use it in the next action like this:

<tool_use>
  <n>image_transformer</n>
  <arguments>{"image": "image_1.jpg"}</arguments>
</tool_use>

Always adhere to this format for the tool use to ensure proper parsing and execution.

## Tool Use Examples
Here are a few examples using notional tools:
---
User: Generate an image of the oldest person in this document.

A: I can use the document_qa tool to find out who the oldest person is in the document.
<tool_use>
  <n>document_qa</n>
  <arguments>{"document": "document.pdf", "question": "Who is the oldest person mentioned?"}</arguments>
</tool_use>

User: <tool_use_result>
  <n>document_qa</n>
  <r>John Doe, a 55 year old lumberjack living in Newfoundland.</r>
</tool_use_result>

A: I can use the image_generator tool to create a portrait of John Doe.
<tool_use>
  <n>image_generator</n>
  <arguments>{"prompt": "A portrait of John Doe, a 55-year-old man living in Canada."}</arguments>
</tool_use>

User: <tool_use_result>
  <n>image_generator</n>
  <r>image.png</r>
</tool_use_result>

A: the image is generated as image.png

---
User: "What is the result of the following operation: 5 + 3 + 1294.678?"

A: I can use the python_interpreter tool to calculate the result of the operation.
<tool_use>
  <n>python_interpreter</n>
  <arguments>{"code": "5 + 3 + 1294.678"}</arguments>
</tool_use>

User: <tool_use_result>
  <n>python_interpreter</n>
  <r>1302.678</r>
</tool_use_result>

A: The result of the operation is 1302.678.

---
User: "Which city has the highest population , Guangzhou or Shanghai?"

A: I can use the search tool to find the population of Guangzhou.
<tool_use>
  <n>search</n>
  <arguments>{"query": "Population Guangzhou"}</arguments>
</tool_use>

User: <tool_use_result>
  <n>search</n>
  <r>Guangzhou has a population of 15 million inhabitants as of 2021.</r>
</tool_use_result>

A: I can use the search tool to find the population of Shanghai.
<tool_use>
  <n>search</n>
  <arguments>{"query": "Population Shanghai"}</arguments>
</tool_use>

User: <tool_use_result>
  <n>search</n>
  <r>26 million (2019)</r>
</tool_use_result>
Assistant: The population of Shanghai is 26 million, while Guangzhou has a population of 15 million. Therefore, Shanghai has the highest population.

## Tool Use Available Tools
Above example were using notional tools that might not exist for you. You only have access to these tools:
${this.formatAvailableTools()}

## Tool Use Rules
Here are the rules you should always follow to solve your task:
1. Always use the right arguments for the tools. Never use variable names as the action arguments, use the value instead.
2. Call a tool only when needed: do not call the search agent if you do not need information, try to solve the task yourself.
3. If no tool call is needed, just answer the question directly.
4. Never re-do a tool call that you previously did with the exact same parameters.
5. For tool use, MARK SURE use XML tag format as shown in the examples above. Do not use any other format.

# User Instructions
${this.customSystemPrompt || "You are a helpful assistant. Answer the user's questions to the best of your ability."}

Now Begin! If you solve the task correctly, you will receive a reward of $1,000,000.`;

    return SYSTEM_PROMPT;
  }

  /**
   * 格式化可用工具为XML字符串
   * @returns 格式化的工具XML字符串
   */
  private formatAvailableTools(): string {
    if (this.tools.length === 0) {
      return '<tools></tools>';
    }

    const toolStrings = this.tools
      .map((tool) => {
        return `
<tool>
  <n>${tool.id}</n>
  <description>${tool.description || ''}</description>
  <arguments>
    ${tool.inputSchema ? JSON.stringify(tool.inputSchema) : ''}
  </arguments>
</tool>`;
      })
      .join('\n');

    return `<tools>
${toolStrings}
</tools>`;
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
  parseToolUse(content: string): MCPToolResponse[] {
    if (!content || !this.tools || this.tools.length === 0) {
      return [];
    }

    // Use global regex to match all tool calls
    const toolUsePattern =
      /<tool_use>[\s\S]*?<n>([\s\S]*?)<\/n>[\s\S]*?<arguments>([\s\S]*?)<\/arguments>[\s\S]*?<\/tool_use>/g;
    const tools: MCPToolResponse[] = [];
    let idx = 0;

    // Find all tool call blocks
    let match = toolUsePattern.exec(content);
    while (match !== null) {
      const toolName = match[1].trim();
      const toolArgs = match[2].trim();

      // Try to parse arguments as JSON
      let parsedArgs: MCPToolInputSchema;
      try {
        parsedArgs = JSON.parse(toolArgs);
      } catch (error) {
        console.error(`Failed to parse tool arguments for ${toolName}:`, error);
        match = toolUsePattern.exec(content);
        continue;
      }

      // Find corresponding tool
      const mcpTool = this.tools.find((tool) => tool.id === toolName);
      if (!mcpTool) {
        console.error(`Tool "${toolName}" not found in available tools`);
        match = toolUsePattern.exec(content);
        continue;
      }

      // Add to tools array
      tools.push({
        id: `${toolName}-${idx++}`,
        tool: {
          ...mcpTool,
          inputSchema: parsedArgs,
        },
        status: 'pending',
      });

      match = toolUsePattern.exec(content);
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
  <n>${toolName}</n>
  <r>${result}</r>
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
