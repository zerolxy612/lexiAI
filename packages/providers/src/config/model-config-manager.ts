import { ModelConfig } from '../interfaces/model-adapter';

/**
 * 模型配置来源
 */
export enum ConfigSource {
  ENVIRONMENT = 'environment',
  DATABASE = 'database',
  HYBRID = 'hybrid',
}

/**
 * 配置提供者接口
 */
export interface ConfigProvider {
  getConfig(modelName: string): Promise<ModelConfig | null>;
  getAllConfigs(): Promise<ModelConfig[]>;
  setConfig(modelName: string, config: ModelConfig): Promise<void>;
  deleteConfig(modelName: string): Promise<void>;
}

/**
 * 环境变量配置提供者
 */
export class EnvironmentConfigProvider implements ConfigProvider {
  private envConfigs: Map<string, ModelConfig> = new Map();

  constructor() {
    this.loadFromEnvironment();
  }

  private loadFromEnvironment(): void {
    console.log('🔧 [ModelConfigManager] Loading configurations from environment...');

    // HKGAI模型配置
    const hkgaiBaseUrl = process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net';
    const hkgaiDifyBaseUrl = process.env.HKGAI_DIFY_BASE_URL || 'https://dify.hkgai.net';

    console.log('🔧 [ModelConfigManager] HKGAI Base URLs:');
    console.log('  - hkgaiBaseUrl:', hkgaiBaseUrl);
    console.log('  - hkgaiDifyBaseUrl:', hkgaiDifyBaseUrl);

    const hkgaiModels = [
      { name: 'hkgai/searchentry', apiKey: process.env.HKGAI_SEARCHENTRY_API_KEY },
      { name: 'hkgai/missinginfo', apiKey: process.env.HKGAI_MISSINGINFO_API_KEY },
      { name: 'hkgai/timeline', apiKey: process.env.HKGAI_TIMELINE_API_KEY },
      {
        name: 'hkgai/case-search',
        apiKey: process.env.HKGAI_CASE_SEARCH_API_KEY,
        baseUrl: hkgaiDifyBaseUrl,
      },
      {
        name: 'hkgai/code-search',
        apiKey: process.env.HKGAI_CODE_SEARCH_API_KEY,
        baseUrl: hkgaiDifyBaseUrl,
      },
    ];

    console.log('🔧 [ModelConfigManager] Processing HKGAI models:');
    for (const model of hkgaiModels) {
      console.log(
        `  - ${model.name}: API Key ${model.apiKey ? 'FOUND' : 'MISSING'} (${model.apiKey ? model.apiKey.substring(0, 10) + '...' : 'N/A'})`,
      );
      if (model.apiKey) {
        const config = {
          modelName: model.name,
          provider: 'hkgai',
          apiKey: model.apiKey,
          baseUrl: model.baseUrl || hkgaiBaseUrl,
          tier: 't2',
          temperature: 0.7,
        };
        this.envConfigs.set(model.name, config);
        console.log(`    ✅ Configured: ${model.name} -> ${config.baseUrl}`);
      } else {
        console.log(`    ❌ Skipped: ${model.name} (no API key)`);
      }
    }

    // OpenAI模型配置
    const openaiApiKey = process.env.OPENAI_API_KEY;
    console.log('🔧 [ModelConfigManager] OpenAI API Key:', openaiApiKey ? 'FOUND' : 'MISSING');
    if (openaiApiKey) {
      const openaiModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
      for (const modelName of openaiModels) {
        this.envConfigs.set(modelName, {
          modelName,
          provider: 'openai',
          apiKey: openaiApiKey,
          baseUrl: 'https://api.openai.com/v1',
          tier: 't2',
          temperature: 0.7,
        });
        console.log(`    ✅ Configured: ${modelName}`);
      }
    }

    console.log(
      `🔧 [ModelConfigManager] Loaded ${this.envConfigs.size} model configurations from environment`,
    );
    console.log('🔧 [ModelConfigManager] Available models:', Array.from(this.envConfigs.keys()));
  }

  async getConfig(modelName: string): Promise<ModelConfig | null> {
    return this.envConfigs.get(modelName) || null;
  }

  async getAllConfigs(): Promise<ModelConfig[]> {
    return Array.from(this.envConfigs.values());
  }

  async setConfig(modelName: string, config: ModelConfig): Promise<void> {
    this.envConfigs.set(modelName, config);
  }

  async deleteConfig(modelName: string): Promise<void> {
    this.envConfigs.delete(modelName);
  }
}

/**
 * 数据库配置提供者（占位符实现）
 */
export class DatabaseConfigProvider implements ConfigProvider {
  async getConfig(modelName: string): Promise<ModelConfig | null> {
    // TODO: 从数据库获取配置
    // 这里可以集成现有的provider服务
    return null;
  }

  async getAllConfigs(): Promise<ModelConfig[]> {
    // TODO: 从数据库获取所有配置
    return [];
  }

  async setConfig(modelName: string, config: ModelConfig): Promise<void> {
    // TODO: 保存配置到数据库
  }

  async deleteConfig(modelName: string): Promise<void> {
    // TODO: 从数据库删除配置
  }
}

/**
 * 混合配置提供者
 * 优先使用环境变量，回退到数据库
 */
export class HybridConfigProvider implements ConfigProvider {
  constructor(
    private envProvider: EnvironmentConfigProvider,
    private dbProvider: DatabaseConfigProvider,
  ) {}

  async getConfig(modelName: string): Promise<ModelConfig | null> {
    // 优先使用环境变量配置
    const envConfig = await this.envProvider.getConfig(modelName);
    if (envConfig) {
      return envConfig;
    }

    // 回退到数据库配置
    return await this.dbProvider.getConfig(modelName);
  }

  async getAllConfigs(): Promise<ModelConfig[]> {
    const envConfigs = await this.envProvider.getAllConfigs();
    const dbConfigs = await this.dbProvider.getAllConfigs();

    // 合并配置，环境变量优先
    const configMap = new Map<string, ModelConfig>();

    for (const config of dbConfigs) {
      configMap.set(config.modelName, config);
    }

    for (const config of envConfigs) {
      configMap.set(config.modelName, config);
    }

    return Array.from(configMap.values());
  }

  async setConfig(modelName: string, config: ModelConfig): Promise<void> {
    // 保存到数据库（环境变量配置不可修改）
    await this.dbProvider.setConfig(modelName, config);
  }

  async deleteConfig(modelName: string): Promise<void> {
    // 只能删除数据库配置
    await this.dbProvider.deleteConfig(modelName);
  }
}

/**
 * 模型配置管理器
 */
export class ModelConfigManager {
  private configProvider: ConfigProvider;

  constructor(source: ConfigSource = ConfigSource.HYBRID) {
    switch (source) {
      case ConfigSource.ENVIRONMENT:
        this.configProvider = new EnvironmentConfigProvider();
        break;
      case ConfigSource.DATABASE:
        this.configProvider = new DatabaseConfigProvider();
        break;
      case ConfigSource.HYBRID:
      default:
        this.configProvider = new HybridConfigProvider(
          new EnvironmentConfigProvider(),
          new DatabaseConfigProvider(),
        );
        break;
    }
  }

  async getModelConfig(modelName: string): Promise<ModelConfig | null> {
    return await this.configProvider.getConfig(modelName);
  }

  async getAllModelConfigs(): Promise<ModelConfig[]> {
    return await this.configProvider.getAllConfigs();
  }

  async setModelConfig(modelName: string, config: ModelConfig): Promise<void> {
    await this.configProvider.setConfig(modelName, config);
  }

  async deleteModelConfig(modelName: string): Promise<void> {
    await this.configProvider.deleteConfig(modelName);
  }

  /**
   * 检查模型配置是否存在
   */
  async hasModelConfig(modelName: string): Promise<boolean> {
    const config = await this.getModelConfig(modelName);
    return config !== null;
  }

  /**
   * 获取指定provider的所有模型配置
   */
  async getConfigsByProvider(provider: string): Promise<ModelConfig[]> {
    const allConfigs = await this.getAllModelConfigs();
    return allConfigs.filter((config) => config.provider === provider);
  }
}

// 导出单例配置管理器
export const modelConfigManager = new ModelConfigManager();
