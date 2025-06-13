/**
 * Unified Model Adapter Interface
 * 统一的模型适配器接口，为所有模型类型提供标准化的接口
 */

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelResponse {
  content: string;
  usage?: ModelUsage;
  metadata?: Record<string, any>;
}

export interface ModelConfig {
  modelName: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
  tier?: string;
  [key: string]: any; // 允许扩展配置
}

export interface StreamChunk {
  content: string;
  isLast: boolean;
  metadata?: Record<string, any>;
}

export interface ModelAdapter {
  /**
   * 模型标识符
   */
  readonly modelName: string;
  readonly provider: string;
  readonly tier: string;

  /**
   * 同步调用模型
   */
  call(query: string, options?: any): Promise<ModelResponse>;

  /**
   * 流式调用模型
   */
  stream(query: string, options?: any): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * 验证配置是否有效
   */
  validateConfig(): Promise<boolean>;

  /**
   * 获取模型元数据
   */
  getMetadata(): Record<string, any>;
}

/**
 * 模型适配器工厂接口
 */
export interface ModelAdapterFactory {
  /**
   * 创建模型适配器实例
   */
  createAdapter(config: ModelConfig): ModelAdapter;

  /**
   * 支持的模型类型
   */
  getSupportedModels(): string[];

  /**
   * 检查是否支持指定模型
   */
  supports(modelName: string): boolean;
}

/**
 * 模型注册表接口
 */
export interface ModelRegistry {
  /**
   * 注册模型适配器工厂
   */
  registerFactory(provider: string, factory: ModelAdapterFactory): void;

  /**
   * 创建模型适配器
   */
  createAdapter(config: ModelConfig): ModelAdapter;

  /**
   * 获取所有支持的模型
   */
  getAllSupportedModels(): Record<string, string[]>;
}
