import { OpenAIChatInput } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { AIMessage, BaseMessage, ChatMessageChunk, HumanMessage } from '@langchain/core/messages';
import { ChatResult, ChatGeneration, ChatGenerationChunk } from '@langchain/core/outputs';

/**
 * Interface for HKGAI model configuration including API key
 */
export interface HKGAIModelConfig {
  modelName: string;
  apiKey: string;
}

/**
 * 自定义的 Dify API 聊天模型类
 */
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
    this.tier = options.tier ?? 't2'; // 默认设置为't2' tier
  }

  _llmType(): string {
    return 'dify';
  }

  /**
   * 返回模型的识别参数，用于在日志和其他地方识别模型
   */
  _identifyingParams() {
    return {
      model_name: this.modelName,
      provider: 'hkgai',
      tier: this.tier,
    };
  }

  /** @ignore */
  async _generate(messages: BaseMessage[], _options?: any): Promise<ChatResult> {
    try {
      // 转换消息格式为 Dify 格式
      const query = this._extractQueryFromMessages(messages);

      console.log(`[DifyChatModel] Sending request to ${this.baseUrl}/v1/chat-messages`);
      console.log(`[DifyChatModel] Query: ${query}`);
      console.log(`[DifyChatModel] Full messages: ${JSON.stringify(messages)}`);

      // 调用 Dify API 使用 fetch 而不是 axios
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

      console.log(`[DifyChatModel] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DifyChatModel] Error response: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const data = await response.json();
      console.log(`[DifyChatModel] Response data: ${JSON.stringify(data)}`);

      // 解析响应
      let content = data?.answer || '';

      // 如果模型没有返回内容，则提供一个默认响应
      if (!content) {
        console.warn('[DifyChatModel] No content received from API, using fallback response');
        content = `我收到了您的问题: "${query}"，但我暂时无法提供具体回答。请稍后再试。`;
      }

      console.log(`[DifyChatModel] Extracted content: "${content.substring(0, 100)}..."`);

      const generation: ChatGeneration = {
        text: content,
        message: new AIMessage(content),
      };

      return {
        generations: [generation],
      };
    } catch (error) {
      console.error('[DifyChatModel] Error:', error.message);
      console.error('[DifyChatModel] Full error:', error);
      throw error;
    }
  }

  /**
   * 从消息数组中提取查询文本
   */
  private _extractQueryFromMessages(messages: BaseMessage[]): string {
    // 简单实现：取最后一条人类消息作为查询
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message instanceof HumanMessage) {
        return message.content as string;
      }
    }
    return '';
  }

  /** @ignore */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: any,
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const query = this._extractQueryFromMessages(messages);

    console.log(`[DifyChatModel] Streaming request to ${this.baseUrl}/v1/chat-messages`);
    console.log(`[DifyChatModel] Query: ${query}`);

    try {
      // 使用 streaming 模式调用 Dify API
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
          response_mode: 'streaming', // 使用流式模式
          conversation_id: '',
          user: 'user-0',
        }),
      });

      console.log(`[DifyChatModel] Streaming response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      console.log('[DifyChatModel] Got streaming response body, starting to read chunks');
      // 跟踪是否收到过内容
      let hasReceivedContent = false;
      let accumulatedContent = ''; // 用于累积多个message事件的内容

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[DifyChatModel] Stream reading complete');

          // 如果累积了内容但尚未发送，发送最后一批
          if (accumulatedContent.length > 0) {
            const messageChunk = new ChatMessageChunk({
              content: accumulatedContent,
              role: 'assistant',
            });

            const chunk = new ChatGenerationChunk({
              message: messageChunk,
              text: accumulatedContent,
            });

            console.log(
              `[DifyChatModel] Yielding final accumulated chunk: "${accumulatedContent.substring(0, 50)}..."`,
            );
            yield chunk;
            await runManager?.handleLLMNewToken(accumulatedContent);
            hasReceivedContent = true;
          }

          // 如果模型未返回任何内容，则手动生成一个响应
          if (!hasReceivedContent) {
            console.warn(
              '[DifyChatModel] No content chunks received, generating fallback response',
            );
            const fallbackText = `我收到了您的问题: "${query}"，但我暂时无法提供具体回答。请稍后再试。`;

            // 将回退响应分成几个块进行流式传输，模拟真实的流式输出
            const chunks = [
              fallbackText.substring(0, 10),
              fallbackText.substring(10, 20),
              fallbackText.substring(20, 40),
              fallbackText.substring(40),
            ];

            for (const chunk of chunks) {
              const messageChunk = new ChatMessageChunk({
                content: chunk,
                role: 'assistant',
              });

              const generationChunk = new ChatGenerationChunk({
                message: messageChunk,
                text: chunk,
              });

              console.log(`[DifyChatModel] Yielding fallback chunk: "${chunk}"`);
              yield generationChunk;
              await runManager?.handleLLMNewToken(chunk);

              // 添加一些延迟，模拟真实流式输出的节奏
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }

          break;
        }

        buffer += decoder.decode(value, { stream: true });
        chunkCount++;
        console.log(`[DifyChatModel] Received chunk #${chunkCount}, size: ${value.length} bytes`);

        // 处理 SSE 消息（可能有多行）
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一行（可能不完整）

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            // 解析 SSE 数据
            console.log(`[DifyChatModel] Processing SSE line: ${line.substring(0, 50)}...`);
            const data = JSON.parse(line.substring(6));
            console.log(`[DifyChatModel] Parsed SSE data event type: ${data.event}`);

            // 如果是 error 事件或最终事件，结束流
            if (data.event === 'error') {
              console.error('[DifyChatModel] Error from API:', data.error);
              break;
            }

            if (
              data.event === 'done' ||
              data.event === 'message_end' ||
              data.event === 'workflow_finished'
            ) {
              console.log('[DifyChatModel] Received done/end event');
              break;
            }

            // 处理特殊的message事件（HKGAI特有）
            if (data.event === 'message' && data.answer !== undefined) {
              const content = data.answer;
              if (content) {
                console.log(`[DifyChatModel] Received message chunk: "${content}"`);

                // 将内容累积到缓冲区
                accumulatedContent += content;
                hasReceivedContent = true;

                // 当累积足够大的内容块时(每50字符)才发送，减少小块传输
                if (accumulatedContent.length >= 50) {
                  const messageChunk = new ChatMessageChunk({
                    content: accumulatedContent,
                    role: 'assistant',
                  });

                  const chunk = new ChatGenerationChunk({
                    message: messageChunk,
                    text: accumulatedContent,
                  });

                  console.log(
                    `[DifyChatModel] Yielding accumulated chunk: "${accumulatedContent.substring(0, 50)}..."`,
                  );
                  yield chunk;
                  await runManager?.handleLLMNewToken(accumulatedContent);

                  // 清空累积缓冲区
                  accumulatedContent = '';
                }
              }
            }
            // 如果是常规消息块
            else if (data.answer) {
              hasReceivedContent = true;
              console.log(
                `[DifyChatModel] Received answer chunk: "${data.answer.substring(0, 50)}..."`,
              );
              const messageChunk = new ChatMessageChunk({
                content: data.answer,
                role: 'assistant',
              });

              // 创建 ChatGenerationChunk 而不是直接返回 ChatMessageChunk
              const chunk = new ChatGenerationChunk({
                message: messageChunk,
                text: data.answer,
              });

              console.log('[DifyChatModel] Yielding chunk to caller');
              yield chunk;

              // 可选：报告进度
              await runManager?.handleLLMNewToken(data.answer);
            } else {
              console.log(
                '[DifyChatModel] Received data without answer field:',
                JSON.stringify(data).substring(0, 100),
              );
            }
          } catch (e) {
            console.error('[DifyChatModel] Error parsing SSE data:', e);
            console.error('Line:', line);
          }
        }
      }
    } catch (error) {
      console.error('[DifyChatModel] Streaming error:', error.message);
      console.error('[DifyChatModel] Full error:', error);
      throw error;
    }
  }
}

/**
 * Client factory for HKGAI models
 * Creates chat models with appropriate configuration for each model
 */
export class HKGAIClientFactory {
  private baseUrl: string;
  private models: Record<string, HKGAIModelConfig>;

  /**
   * Initialize the HKGAI client factory
   */
  constructor() {
    this.baseUrl = process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net';

    // Define models and their respective API keys from environment variables
    // Use single API key for all models as fallback
    const globalApiKey = process.env.HKGAI_API_KEY || 'app-cWHko7usG7aP8ZsAnSeglYc3';

    this.models = {
      'hkgai-searchentry': {
        modelName: 'gpt-3.5-turbo', // Dify使用标准模型名称
        apiKey: process.env.HKGAI_SEARCHENTRY_API_KEY || globalApiKey,
      },
      'hkgai-missinginfo': {
        modelName: 'gpt-3.5-turbo', // Dify使用标准模型名称
        apiKey: process.env.HKGAI_MISSINGINFO_API_KEY || globalApiKey,
      },
      'hkgai-timeline': {
        modelName: 'gpt-3.5-turbo', // Dify使用标准模型名称
        apiKey: process.env.HKGAI_TIMELINE_API_KEY || globalApiKey,
      },
      // Add models with database format for compatibility
      'hkgai/searchentry': {
        modelName: 'gpt-3.5-turbo',
        apiKey: process.env.HKGAI_SEARCHENTRY_API_KEY || globalApiKey,
      },
      'hkgai/missinginfo': {
        modelName: 'gpt-3.5-turbo',
        apiKey: process.env.HKGAI_MISSINGINFO_API_KEY || globalApiKey,
      },
      'hkgai/timeline': {
        modelName: 'gpt-3.5-turbo',
        apiKey: process.env.HKGAI_TIMELINE_API_KEY || globalApiKey,
      },
    };

    // 验证API基础URL是否可用
    this.validateApiUrl();
  }

  /**
   * 验证API URL是否可访问
   */
  private async validateApiUrl() {
    // 跳过健康检查，直接认为API可用
    console.log(`[HKGAIClientFactory] Using API URL: ${this.baseUrl}`);
    console.log('[HKGAIClientFactory] Skipping API validation for Dify API');
  }

  /**
   * Get a ChatOpenAI instance for the specified HKGAI model
   * @param modelName - The name of the HKGAI model
   * @param params - Additional parameters for the ChatOpenAI instance
   * @returns BaseChatModel instance
   */
  public getChatModel(modelName: string, params?: Partial<OpenAIChatInput>): BaseChatModel {
    // Get model config
    const modelConfig = this.models[modelName];
    if (!modelConfig) {
      throw new Error(`HKGAI model ${modelName} not found`);
    }

    // Check for API key
    const apiKey = modelConfig.apiKey;
    if (!apiKey) {
      throw new Error(`API key for HKGAI model ${modelName} not found`);
    }

    console.log(`[HKGAIClientFactory] Creating chat model for ${modelName} using Dify API`);
    console.log(`[HKGAIClientFactory] Base URL: ${this.baseUrl}`);
    console.log(`[HKGAIClientFactory] API Key: ${apiKey.substring(0, 8)}...`);

    // Create and return custom Dify chat model instance
    return new DifyChatModel({
      modelName: modelConfig.modelName,
      apiKey,
      baseUrl: this.baseUrl,
      temperature: params?.temperature ?? 0.7,
      tier: 't2', // 设置为常量't2'，与数据库中的hkgai模型配置一致
    });
  }

  /**
   * Check if a model is a HKGAI model
   * @param modelName - The name of the model to check
   * @returns Boolean indicating if this is a HKGAI model
   */
  public isHKGAIModel(modelName: string): boolean {
    const lowerModelName = (modelName || '').toLowerCase();
    return (
      lowerModelName.includes('hkgai') ||
      lowerModelName.startsWith('hkgai/') ||
      lowerModelName.startsWith('hkgai-')
    );
  }

  /**
   * Get a list of available HKGAI models
   * @returns Array of model names
   */
  public getAvailableModels(): string[] {
    return Object.keys(this.models);
  }
}
