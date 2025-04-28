import { McpService } from './MCPService';

export type MCPArgType = 'string' | 'list' | 'number';
export type MCPEnvType = 'string' | 'number';
export type MCPArgParameter = { [key: string]: MCPArgType };
export type MCPEnvParameter = { [key: string]: MCPEnvType };

export interface MCPServerParameter {
  name: string;
  type: MCPArgType | MCPEnvType;
  description: string;
}

export interface MCPConfigSample {
  command: string;
  args: string[];
  env?: Record<string, string> | undefined;
}

export interface MCPServer {
  id: string;
  name: string;
  type?: 'stdio' | 'sse' | 'inMemory' | 'streamableHttp';
  description?: string;
  baseUrl?: string;
  command?: string;
  registryUrl?: string;
  args?: string[];
  env?: Record<string, string>;
  isActive: boolean;
  disabledTools?: string[]; // List of tool names that are disabled for this server
  configSample?: MCPConfigSample;
  headers?: Record<string, string>; // Custom headers to be sent with requests to this server
}

export interface MCPToolInputSchema {
  type: string;
  title: string;
  description?: string;
  required?: string[];
  properties: Record<string, object>;
}

export interface MCPTool {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema: MCPToolInputSchema;
}

export interface MCPPromptArguments {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPrompt {
  id: string;
  name: string;
  description?: string;
  arguments?: MCPPromptArguments[];
  serverId: string;
  serverName: string;
}

export interface GetMCPPromptResponse {
  description?: string;
  messages?: {
    role?: string;
    content?: {
      type?: 'text' | 'image' | 'audio' | 'resource';
      text?: string;
      data?: string;
      mimeType?: string;
    };
  }[];
}

export interface MCPConfig {
  servers: MCPServer[];
}

export interface MCPToolResultContent {
  type: 'text' | 'image' | 'audio' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: {
    uri?: string;
    text?: string;
    mimeType?: string;
  };
}

export interface MCPCallToolResponse {
  content: MCPToolResultContent[];
  isError?: boolean;
}

export interface MCPResource {
  serverId: string;
  serverName: string;
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
  text?: string;
  blob?: string;
}

export interface GetResourceResponse {
  contents: MCPResource[];
}

export interface QuickPhrase {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  order?: number;
}

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
