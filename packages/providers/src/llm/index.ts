import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LLMModelConfig } from '@refly/openapi-schema';
import { EnhancedChatOpenAI } from './openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatFireworks } from '@langchain/community/chat_models/fireworks';
import { BaseProvider } from '../types';

export const getChatModel = (
  provider: BaseProvider,
  config: LLMModelConfig,
  params: any,
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
        baseUrl: provider.baseUrl,
        ...params,
      });
    case 'fireworks':
      return new ChatFireworks({
        model: config.modelId,
        apiKey: provider.apiKey,
        ...params,
      });
    default:
      throw new Error(`Unsupported provider: ${provider?.providerKey}`);
  }
};

export { BaseChatModel };
