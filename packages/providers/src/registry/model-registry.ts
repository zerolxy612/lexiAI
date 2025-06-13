import {
  ModelRegistry,
  ModelAdapterFactory,
  ModelAdapter,
  ModelConfig,
} from '../interfaces/model-adapter';

/**
 * 模型注册表实现
 * 负责管理所有模型适配器工厂，提供统一的模型创建接口
 */
export class DefaultModelRegistry implements ModelRegistry {
  private factories = new Map<string, ModelAdapterFactory>();

  registerFactory(provider: string, factory: ModelAdapterFactory): void {
    this.factories.set(provider, factory);
    console.log(`[ModelRegistry] Registered factory for provider: ${provider}`);
  }

  createAdapter(config: ModelConfig): ModelAdapter {
    const factory = this.factories.get(config.provider);

    if (!factory) {
      throw new Error(`No factory registered for provider: ${config.provider}`);
    }

    if (!factory.supports(config.modelName)) {
      throw new Error(`Provider ${config.provider} does not support model: ${config.modelName}`);
    }

    return factory.createAdapter(config);
  }

  getAllSupportedModels(): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const [provider, factory] of this.factories) {
      result[provider] = factory.getSupportedModels();
    }

    return result;
  }

  /**
   * 检查是否支持指定的模型
   */
  supports(modelName: string, provider?: string): boolean {
    if (provider) {
      const factory = this.factories.get(provider);
      return factory ? factory.supports(modelName) : false;
    }

    // 检查所有provider
    for (const factory of this.factories.values()) {
      if (factory.supports(modelName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取支持指定模型的provider列表
   */
  getProvidersForModel(modelName: string): string[] {
    const providers: string[] = [];

    for (const [provider, factory] of this.factories) {
      if (factory.supports(modelName)) {
        providers.push(provider);
      }
    }

    return providers;
  }

  /**
   * 获取所有已注册的provider
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.factories.keys());
  }
}

// 导出单例注册表
export const modelRegistry = new DefaultModelRegistry();
