import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LLMModelConfig } from '@refly/openapi-schema';
import { EnhancedChatOpenAI } from './openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatFireworks } from '@langchain/community/chat_models/fireworks';
import { BaseProvider } from '../types';
import { OpenAIBaseInput } from '@langchain/openai';

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

  _llmType(): string {
    return 'dify';
  }

  _identifyingParams() {
    return {
      model_name: this.modelName,
      provider: 'hkgai',
      tier: this.tier,
    };
  }

  /** @ignore */
  async _generate(messages: any[], _options?: any): Promise<any> {
    try {
      const query = this._extractQueryFromMessages(messages);

      const response = await fetch(`${this.baseUrl}/v1/chat-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://lexihk.com',
          'X-Title': 'LexiHK',
        },
        body: JSON.stringify({
          inputs: {},
          query,
          response_mode: 'blocking',
          conversation_id: '',
          user: 'user-0',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const data = await response.json();
      let content = data?.answer || '';

      if (!content) {
        content = `我收到了您的问题: "${query}"，但我暂时无法提供具体回答。请稍后再试。`;
      }

      const { AIMessage } = await import('@langchain/core/messages');
      const generation = {
        text: content,
        message: new AIMessage(content),
      };

      return { generations: [generation] };
    } catch (error) {
      console.error('[DifyChatModel] Error:', error.message);
      throw error;
    }
  }

  private _extractQueryFromMessages(messages: any[]): string {
    // Import HumanMessage at the top level
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      // Check message type using duck typing since we can't import HumanMessage synchronously
      if (message && message.constructor && message.constructor.name === 'HumanMessage') {
        return message.content as string;
      }
      // Also check for content directly if it's a human message object
      if (message && typeof message.content === 'string' && message.role !== 'assistant') {
        return message.content;
      }
    }
    return '';
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
