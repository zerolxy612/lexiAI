import {
  ModelAdapter,
  ModelConfig,
  ModelResponse,
  StreamChunk,
  ModelAdapterFactory,
} from '../interfaces/model-adapter';
import { simpleHKGAIClient } from '../llm/simple-hkgai-client';

/**
 * HKGAI模型适配器实现
 */
export class HKGAIModelAdapter implements ModelAdapter {
  readonly modelName: string;
  readonly provider: string = 'hkgai';
  readonly tier: string;

  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
    this.modelName = config.modelName;
    this.tier = config.tier || 't2';
  }

  async call(query: string, options?: any): Promise<ModelResponse> {
    try {
      const content = await simpleHKGAIClient.call(this.modelName, query);

      // 从HKGAI响应中提取使用信息（如果可用）
      const usage = simpleHKGAIClient.getLastUsage();

      return {
        content,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            }
          : undefined,
        metadata: {
          model: this.modelName,
          provider: this.provider,
          tier: this.tier,
        },
      };
    } catch (error) {
      throw new Error(`HKGAI model call failed: ${error.message}`);
    }
  }

  async *stream(query: string, options?: any): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      // 获取完整响应
      const response = await this.call(query, options);

      // 分块发送，模拟流式响应
      const chunkSize = 50;
      const content = response.content;

      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        const isLast = i + chunkSize >= content.length;

        yield {
          content: chunk,
          isLast,
          metadata: {
            model: this.modelName,
            provider: this.provider,
            chunkIndex: Math.floor(i / chunkSize),
          },
        };

        // 添加延迟模拟真实流式响应
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (error) {
      throw new Error(`HKGAI stream failed: ${error.message}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // 简单的配置验证
      if (!this.config.apiKey || !this.config.baseUrl) {
        return false;
      }

      // 可以添加实际的API调用来验证配置
      // const testResponse = await this.call('test', { timeout: 5000 });
      // return !!testResponse;

      return true;
    } catch {
      return false;
    }
  }

  getMetadata(): Record<string, any> {
    return {
      modelName: this.modelName,
      provider: this.provider,
      tier: this.tier,
      apiKey: this.config.apiKey.substring(0, 8) + '...',
      baseUrl: this.config.baseUrl,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      capabilities: ['chat', 'completion'],
      contextLimit: 16384,
      maxOutput: 4096,
    };
  }
}

/**
 * HKGAI模型适配器工厂
 */
export class HKGAIAdapterFactory implements ModelAdapterFactory {
  private supportedModels = [
    'hkgai/searchentry',
    'hkgai/missinginfo',
    'hkgai/timeline',
    'hkgai/general',
  ];

  createAdapter(config: ModelConfig): ModelAdapter {
    if (!this.supports(config.modelName)) {
      throw new Error(`Unsupported HKGAI model: ${config.modelName}`);
    }

    return new HKGAIModelAdapter(config);
  }

  getSupportedModels(): string[] {
    return [...this.supportedModels];
  }

  supports(modelName: string): boolean {
    return this.supportedModels.includes(modelName) || modelName.startsWith('hkgai/');
  }
}

// 导出单例工厂实例
export const hkgaiAdapterFactory = new HKGAIAdapterFactory();
