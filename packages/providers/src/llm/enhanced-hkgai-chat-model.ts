import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, AIMessageChunk } from '@langchain/core/messages';
import { ChatResult, ChatGeneration, ChatGenerationChunk } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { getModelConfig, getModelApiKey, ModelConfig } from '../config/model-configs';

/**
 * Enhanced HKGAI Chat Model that uses the configuration system
 * to handle different model types with their specific requirements
 */
export class EnhancedHKGAIChatModel extends BaseChatModel {
  modelName: string;
  temperature: number;
  streaming: boolean;
  private config: ModelConfig;
  private apiKey: string;

  constructor(options: {
    modelName: string;
    temperature?: number;
    streaming?: boolean;
  }) {
    super({});
    this.modelName = options.modelName;
    this.temperature = options.temperature ?? 0.7;

    // Get model configuration
    const config = getModelConfig(options.modelName);
    if (!config) {
      throw new Error(`Model configuration not found for: ${options.modelName}`);
    }
    this.config = config;

    // Get API key
    const apiKey = getModelApiKey(options.modelName);
    if (!apiKey) {
      throw new Error(`API key not configured for model: ${options.modelName}`);
    }
    this.apiKey = apiKey;

    // Determine streaming mode
    if (config.requiresStreaming) {
      this.streaming = true; // Force streaming for models that require it
    } else {
      this.streaming = options.streaming ?? false;
    }

    console.log(`[EnhancedHKGAIChatModel] Initialized ${options.modelName}:`, {
      baseUrl: config.baseUrl,
      endpoint: config.endpoint,
      streaming: this.streaming,
      requiresStreaming: config.requiresStreaming,
      requestFormat: config.requestFormat,
    });
  }

  _llmType(): string {
    return 'enhanced-hkgai';
  }

  /**
   * Extract query from messages
   */
  private extractQuery(messages: BaseMessage[]): string {
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.content?.toString() || '';
  }

  /**
   * Build request body based on model configuration
   */
  private buildRequestBody(query: string, streaming: boolean): any {
    const { requestFormat, isContractModel } = this.config;

    switch (requestFormat) {
      case 'openai':
        return {
          model: this.modelName,
          messages: [{ role: 'user', content: query }],
          stream: streaming,
          temperature: this.temperature,
        };

      case 'dify':
        return {
          inputs: isContractModel ? { doc: [] } : {},
          query,
          response_mode: streaming ? 'streaming' : 'blocking',
          user: 'user-refly',
          conversation_id: '',
          temperature: this.temperature,
          ...(isContractModel && { model: 'contract' }),
        };

      case 'hkgai':
      default:
        return {
          inputs: {},
          query,
          response_mode: streaming ? 'streaming' : 'blocking',
          user: 'user-refly',
          conversation_id: '',
          temperature: this.temperature,
        };
    }
  }

  /**
   * Build request headers
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://lexihk.com',
      'X-Title': 'LexiHK',
    };
  }

  /**
   * Get full API URL
   */
  private getApiUrl(): string {
    return `${this.config.baseUrl}${this.config.endpoint}`;
  }

  /**
   * Parse response based on model configuration
   */
  private parseResponse(data: any): string {
    const { responseFormat } = this.config;

    switch (responseFormat) {
      case 'openai':
        return data.choices?.[0]?.message?.content || '';

      case 'dify':
      case 'hkgai':
      default:
        return data.answer || '';
    }
  }

  /**
   * Non-streaming call
   */
  async _generate(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    // Safety check: prevent non-streaming calls for models that require streaming
    if (this.config.requiresStreaming) {
      throw new Error(
        `Model ${this.modelName} requires streaming mode. Use stream() method instead.`,
      );
    }

    const query = this.extractQuery(messages);
    const requestBody = this.buildRequestBody(query, false);
    const headers = this.buildHeaders();
    const url = this.getApiUrl();

    console.log(`[EnhancedHKGAIChatModel] Non-streaming request to ${url}`);
    console.log(`[EnhancedHKGAIChatModel] Request body:`, JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EnhancedHKGAIChatModel] API call failed:`, errorText);
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[EnhancedHKGAIChatModel] Response:`, JSON.stringify(data, null, 2));

      const content = this.parseResponse(data);
      const message = new AIMessage(content);

      return {
        generations: [
          {
            message,
            text: content,
          } as ChatGeneration,
        ],
      };
    } catch (error) {
      console.error(`[EnhancedHKGAIChatModel] Error:`, error);
      throw error;
    }
  }

  /**
   * Streaming call
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const query = this.extractQuery(messages);
    const requestBody = this.buildRequestBody(query, true);
    const headers = this.buildHeaders();
    const url = this.getApiUrl();

    console.log(`[EnhancedHKGAIChatModel] Streaming request to ${url}`);
    console.log(`[EnhancedHKGAIChatModel] Request body:`, JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EnhancedHKGAIChatModel] Streaming API call failed:`, errorText);
        throw new Error(`Streaming API call failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            let eventData: any;

            // Parse different streaming formats
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6).trim();
              if (dataStr === '[DONE]') break;
              if (dataStr) {
                eventData = JSON.parse(dataStr);
              }
            } else if (line.includes(': ')) {
              // Handle Server-Sent Events format
              const [eventType, eventDataStr] = line.split(': ', 2);
              if (eventType === 'data' && eventDataStr) {
                eventData = JSON.parse(eventDataStr);
              }
            }

            if (!eventData) continue;

            // Extract content based on response format
            let content = '';
            const { responseFormat } = this.config;

            switch (responseFormat) {
              case 'openai':
                content = eventData.choices?.[0]?.delta?.content || '';
                break;

              case 'dify':
              case 'hkgai':
              default:
                if (eventData.event === 'message' && eventData.answer) {
                  content = eventData.answer;
                }
                break;
            }

            if (content) {
              const chunk = new ChatGenerationChunk({
                message: new AIMessageChunk({ content }),
                text: content,
              });

              yield chunk;
              await runManager?.handleLLMNewToken(content);
            }
          } catch (parseError) {
            console.warn(`[EnhancedHKGAIChatModel] Failed to parse line:`, line, parseError);
            continue;
          }
        }
      }
    } catch (error) {
      console.error(`[EnhancedHKGAIChatModel] Streaming error:`, error);
      throw error;
    }
  }
}
