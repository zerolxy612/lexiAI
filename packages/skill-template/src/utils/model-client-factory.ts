import { ChatOpenAI, OpenAIChatInput } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HKGAIClientFactory } from './hkgai-client';

/**
 * 模型客户端工厂
 * 根据模型provider创建对应的客户端
 */
export class ModelClientFactory {
  private hkgaiClientFactory: HKGAIClientFactory;
  private baseHeaders: Record<string, string>;

  constructor(referrer = 'https://lexihk.com', title = 'LexiHK') {
    this.hkgaiClientFactory = new HKGAIClientFactory();
    this.baseHeaders = {
      'HTTP-Referer': referrer,
      'X-Title': title,
    };
  }

  /**
   * 创建模型客户端
   * @param modelName 模型名称
   * @param provider 模型提供商
   * @param params 其他参数
   * @returns 适合的模型客户端实例
   */
  public createModelClient(
    modelName: string,
    provider: string,
    params?: Partial<OpenAIChatInput>,
  ): BaseChatModel {
    // 获取API密钥
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

    console.log(
      `[ModelClientFactory] Creating client for model: ${modelName}, provider: ${provider}`,
    );

    // 检查是否是HKGAI模型
    if (this.hkgaiClientFactory.isHKGAIModel(modelName)) {
      console.log(`[ModelClientFactory] Using HKGAI client for ${modelName}`);
      return this.hkgaiClientFactory.getChatModel(modelName, params);
    }

    // 使用OpenRouter作为通用入口点
    if (process.env.OPENROUTER_API_KEY) {
      console.log(`[ModelClientFactory] Using OpenRouter for ${modelName}`);
      return new ChatOpenAI({
        model: modelName,
        apiKey,
        configuration: {
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: this.baseHeaders,
        },
        ...params,
      });
    }

    // 根据provider创建对应的客户端
    switch (provider.toLowerCase()) {
      case 'deepseek':
        console.log(
          `[ModelClientFactory] Using OpenAI-compatible client for DeepSeek ${modelName}`,
        );
        return new ChatOpenAI({
          model: modelName,
          apiKey,
          configuration: {
            baseURL: 'https://api.deepseek.com',
            defaultHeaders: this.baseHeaders,
          },
          ...params,
        });

      case 'anthropic':
      case 'openai':
      case 'google':
      case 'meta-llama':
      case 'mistral':
      case 'qwen':
      case 'xai':
      default:
        console.log(
          `[ModelClientFactory] Using OpenAI-compatible client for ${modelName} (provider: ${provider || 'unknown'})`,
        );
        // 默认使用OpenAI兼容接口
        return new ChatOpenAI({
          model: modelName,
          apiKey,
          ...params,
        });
    }
  }
}
