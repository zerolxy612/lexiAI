import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LLMModelConfig } from '@refly/openapi-schema';
import { EnhancedChatOpenAI } from './openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatFireworks } from '@langchain/community/chat_models/fireworks';
import { BaseProvider } from '../types';
import { OpenAIBaseInput } from '@langchain/openai';
import { simpleHKGAIClient } from './simple-hkgai-client';
import { AIMessage, BaseMessage, AIMessageChunk } from '@langchain/core/messages';
import { ChatResult, ChatGeneration, ChatGenerationChunk } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';

/**
 * A unified ChatModel for all HKGAI providers.
 * It handles the logic of switching between RAG and normal models,
 * and supports both streaming and non-streaming modes.
 */
export class HKGAIChatModel extends BaseChatModel {
  modelName: string;
  temperature: number;
  streaming: boolean;

  constructor(options: {
    modelName: string;
    temperature?: number;
    streaming?: boolean;
  }) {
    super({});
    this.modelName = options.modelName;
    this.temperature = options.temperature ?? 0.7;
    this.streaming = options.streaming ?? false;
  }

  _llmType() {
    return 'hkgai';
  }

  private _extractQueryFromMessages(messages: BaseMessage[]): string {
    if (!messages || messages.length === 0) {
      return '';
    }
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content;

    if (typeof content === 'string') {
      return content;
    }

    // It's a complex message (array of parts), find the text part.
    for (const part of content) {
      if (part.type === 'text') {
        return part.text;
      }
    }

    return ''; // No text part found
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    if (this.streaming) {
      const stream = this._stream(messages, options, runManager);
      const chunks: ChatGenerationChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      if (chunks.length === 0) {
        return {
          generations: [],
          llmOutput: {},
        };
      }

      const aggregated = new ChatGenerationChunk({
        text: chunks.map((chunk) => chunk.text).join(''),
        message: new AIMessageChunk({
          content: chunks.map((chunk) => chunk.message.content).join(''),
          additional_kwargs: {},
        }),
      });

      return {
        generations: [
          {
            text: aggregated.text,
            message: new AIMessage(aggregated.message.content as string),
          },
        ],
        llmOutput: {},
      };
    } else {
      return this._call(messages, options, runManager);
    }
  }

  async *_stream(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const query = this._extractQueryFromMessages(messages);
    const stream = await simpleHKGAIClient.stream(this.modelName, query, {
      temperature: this.temperature,
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last, possibly incomplete line

      for (const line of lines) {
        if (line.trim().startsWith('data:')) {
          const jsonStr = line.trim().substring(5).trim();
          if (jsonStr === '[DONE]') {
            continue;
          }
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              const chunk = new ChatGenerationChunk({
                text: delta,
                message: new AIMessageChunk({ content: delta }),
              });
              yield chunk;
              void runManager?.handleLLMNewToken(delta);
            }
          } catch (e) {
            console.error(`[HKGAIChatModel] Error parsing stream chunk: "${jsonStr}"`, e);
          }
        }
      }
    }
  }

  async _call(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const query = this._extractQueryFromMessages(messages);
    const content = await simpleHKGAIClient.call(this.modelName, query, {
      temperature: this.temperature,
    });

    if (content === 'No output in the non-streaming mode') {
      console.warn(
        `[HKGAIChatModel] Received 'No output' message from API for model ${this.modelName}. This might indicate an issue with the non-streaming endpoint.`,
      );
    }

    void runManager?.handleLLMNewToken(content);

    return {
      generations: [
        {
          text: content,
          message: new AIMessage(content),
        },
      ],
      llmOutput: {},
    };
  }
}

export const getChatModel = (
  provider: BaseProvider,
  config: LLMModelConfig,
  params?: Partial<OpenAIBaseInput> & { streaming?: boolean },
): BaseChatModel => {
  switch (provider?.providerKey) {
    case 'openai':
      return new EnhancedChatOpenAI({
        model: config.modelId,
        apiKey: provider.apiKey,
        streaming: params?.streaming ?? false,
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
      // For RAG models, streaming is required by the API.
      const isRagModel = (config.modelId || '').toLowerCase().includes('rag');
      return new HKGAIChatModel({
        modelName: config.modelId,
        temperature: params?.temperature ?? 0.7,
        streaming: isRagModel || (params?.streaming ?? false),
      });
    default:
      throw new Error(`Unsupported provider: ${provider?.providerKey}`);
  }
};

export { BaseChatModel };
