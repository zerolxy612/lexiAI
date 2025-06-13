import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LLMModelConfig } from '@refly/openapi-schema';
import { EnhancedChatOpenAI } from './openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatFireworks } from '@langchain/community/chat_models/fireworks';
import { BaseProvider } from '../types';
import { OpenAIBaseInput } from '@langchain/openai';
import { simpleHKGAIClient } from './simple-hkgai-client';
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatResult, ChatGeneration } from '@langchain/core/outputs';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';

// Import HKGAI DifyChatModel
export class DifyChatModel extends BaseChatModel {
  modelName: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  tier: string;

  constructor(options: {
    modelName: string;
    apiKey: string;
    baseUrl: string;
    temperature?: number;
    tier?: string;
  }) {
    super({});
    this.modelName = options.modelName;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.temperature = options.temperature ?? 0.7;
    this.tier = options.tier ?? 't2';
  }

  _llmType() {
    return 'dify-chat';
  }

  _identifyingParams() {
    return {
      model_name: this.modelName,
      model: this.modelName,
      provider: 'hkgai',
      tier: this.tier,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    };
  }

  async _generate(
    messages: BaseMessage[],
    options?: any,
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    try {
      console.log(`[DifyChatModel] 开始生成回答，模型: ${this.modelName}`);

      // 提取查询内容
      const query = this._extractQueryFromMessages(messages);

      // 使用简化的HKGAI客户端
      const content = await simpleHKGAIClient.call(this.modelName, query);

      console.log(`[DifyChatModel] 成功生成回答: ${content.substring(0, 100)}...`);

      // 模拟流式输出
      const chunks = this._splitIntoChunks(content);
      console.log(`[DifyChatModel] 获取到完整回答，开始模拟流式输出`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLast = i === chunks.length - 1;

        // 触发流式事件
        if (runManager?.handleLLMNewToken) {
          await runManager.handleLLMNewToken(chunk, {
            prompt: 0,
            completion: i,
          });
        }

        // 添加小延迟模拟真实流式响应
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      console.log(`[DifyChatModel] 流式输出完成，共发送 ${chunks.length} 个块`);

      // 创建正确的AIMessage实例
      const message = new AIMessage({
        content: content,
        additional_kwargs: {},
      });

      // 返回符合ChatResult接口的结果
      const generation: ChatGeneration = {
        text: content,
        message: message,
        generationInfo: {
          model: this.modelName,
          provider: 'hkgai',
          finishReason: 'stop',
        },
      };

      return {
        generations: [generation],
        llmOutput: {
          model: this.modelName,
          provider: 'hkgai',
        },
      };
    } catch (error) {
      console.error(`[DifyChatModel] 生成回答失败:`, error);
      throw error;
    }
  }

  private _extractQueryFromMessages(messages: BaseMessage[]): string {
    // 从消息中提取最后一个用户消息
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message._getType() === 'human') {
        return message.content as string;
      }
    }
    return '';
  }

  _splitIntoChunks(text: string, chunkSize = 50): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

export const getChatModel = (
  provider: BaseProvider,
  config: LLMModelConfig,
  params?: Partial<OpenAIBaseInput>,
): BaseChatModel => {
  switch (provider?.providerKey) {
    case 'openai':
      return new EnhancedChatOpenAI({
        model: config.modelId,
        apiKey: provider.apiKey,
        configuration: {
          baseURL: provider.baseUrl,
        },
        ...params,
        include_reasoning: config?.capabilities?.reasoning,
      });
    case 'ollama':
      return new ChatOllama({
        model: config.modelId,
        baseUrl: provider.baseUrl?.replace(/\/v1\/?$/, ''),
        ...params,
      });
    case 'fireworks':
      return new ChatFireworks({
        model: config.modelId,
        apiKey: provider.apiKey,
        ...params,
      });
    case 'hkgai':
      // Use specialized DifyChatModel for HKGAI models
      return new DifyChatModel({
        modelName: config.modelId,
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl || 'https://dify.hkgai.net',
        temperature: params?.temperature ?? 0.7,
        tier: 't2',
      });
    default:
      throw new Error(`Unsupported provider: ${provider?.providerKey}`);
  }
};

export { BaseChatModel };
