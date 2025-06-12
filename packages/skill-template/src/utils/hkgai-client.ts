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
  debug: boolean;

  constructor(options: {
    modelName: string;
    apiKey: string;
    baseUrl: string;
    temperature?: number;
    tier?: string;
    debug?: boolean;
  }) {
    super({});
    this.modelName = options.modelName;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.temperature = options.temperature ?? 0.7;
    this.tier = options.tier ?? 't2'; // 默认设置为't2' tier
    this.debug = options.debug ?? false;
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

  /**
   * 打印日志（仅在debug模式下）
   */
  private log(...args: any[]) {
    if (this.debug) {
      console.log(...args);
    }
  }

  /**
   * 打印警告
   */
  private warn(...args: any[]) {
    console.warn(...args);
  }

  /**
   * 打印错误
   */
  private error(...args: any[]) {
    console.error(...args);
  }

  /**
   * 处理HKGAI响应
   */
  private processHKGAIResponse(data: any): string {
    this.log(`[DifyChatModel] 处理HKGAI响应:`, data);

    try {
      // 针对Dify API特殊的应答格式进行优化处理

      // 1. 检查event格式响应 (最常见的Dify返回格式)
      if (data && typeof data === 'object' && data.event === 'message') {
        console.error('[HKGAI处理] 检测到event:message格式响应');

        // 检查message属性
        if (data.message) {
          if (typeof data.message === 'string') {
            return data.message;
          } else if (typeof data.message === 'object' && data.message !== null) {
            // 检查常见的嵌套属性
            if (data.message.answer) return String(data.message.answer);
            if (data.message.content) return String(data.message.content);
            if (data.message.text) return String(data.message.text);

            // 如果都没找到，尝试将整个message序列化
            return JSON.stringify(data.message);
          }
        }

        // 检查answer属性（可能直接在事件对象上）
        if (data.answer) {
          return String(data.answer);
        }
      }

      // 2. 检查直接的answer属性 (第二常见的Dify返回格式)
      if (data && typeof data === 'object' && data.answer) {
        console.error('[HKGAI处理] 检测到answer格式响应');
        return String(data.answer);
      }

      // 3. 处理数组返回格式
      if (Array.isArray(data)) {
        console.error('[HKGAI处理] 检测到数组格式响应');

        // 空数组检查
        if (data.length === 0) {
          return '';
        }

        const firstItem = data[0];

        // 如果第一项是字符串，直接返回
        if (typeof firstItem === 'string') {
          return firstItem;
        }

        // 如果第一项是对象，尝试提取常见字段
        if (typeof firstItem === 'object' && firstItem !== null) {
          if (firstItem.answer) return String(firstItem.answer);
          if (firstItem.text) return String(firstItem.text);
          if (firstItem.content) return String(firstItem.content);

          // 如果没有常见字段，尝试整个对象序列化
          return JSON.stringify(firstItem);
        }

        // 如果都不是，把整个数组序列化
        return JSON.stringify(data);
      }

      // 4. 检查直接的文本或其他属性
      if (data && typeof data === 'object') {
        // 尝试常见的内容字段名
        const possibleFields = ['text', 'content', 'result', 'output', 'response', 'data', 'value'];

        for (const field of possibleFields) {
          if (data[field]) {
            console.error(`[HKGAI处理] 找到字段 ${field}`);
            return String(data[field]);
          }
        }
      }

      // 5. 如果数据本身是字符串
      if (typeof data === 'string') {
        return data;
      }

      // 6. 最后的尝试：序列化整个响应
      if (data) {
        return JSON.stringify(data);
      }

      console.error('[HKGAI处理] 无法提取有效内容');
      return '';
    } catch (e) {
      this.error(`[DifyChatModel] 处理响应时出错: ${e.message}`);
      return ''; // 出错时返回空字符串
    }
  }

  /**
   * 从消息数组中提取查询文本和输入参数
   */
  private _extractQueryAndInputs(
    messages: BaseMessage[],
    options?: any,
  ): { query: string; inputs: any } {
    let query = '';
    const inputs: Record<string, any> = {};

    // 提取查询内容
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message instanceof HumanMessage) {
        query = message.content as string;
        break;
      }
    }

    // 从options中提取inputs
    if (options?.additional_kwargs?.inputs) {
      Object.assign(inputs, options.additional_kwargs.inputs);
    }

    // 如果有图片内容，添加到inputs
    if (options?.images && options.images.length > 0) {
      inputs.images = options.images;
    }

    return { query, inputs };
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
  async _generate(messages: BaseMessage[], options?: any): Promise<ChatResult> {
    try {
      // 提取查询内容和输入参数
      const { query, inputs } = this._extractQueryAndInputs(messages, options);

      this.log(`[DifyChatModel] Sending request to ${this.baseUrl}/v1/chat-messages`);
      this.log(`[DifyChatModel] Query: ${query}`);
      this.log(`[DifyChatModel] Inputs: ${JSON.stringify(inputs)}`);

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
          inputs: inputs, // 使用提取的inputs参数
          query: query.trim(), // 直接使用原始查询，不做额外处理
          user: 'user-1', // 必需的user参数
          stream: true, // 启用流式响应
        }),
      });

      this.log(`[DifyChatModel] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.error(`[DifyChatModel] Error response: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const data = await response.json();
      this.log(`[DifyChatModel] Response data:`, data);

      // 处理响应
      let content = this.processHKGAIResponse(data);

      // 如果模型没有返回内容，则提供一个默认响应
      if (!content) {
        this.warn('[DifyChatModel] No content received from API, using fallback response');
        content = `我收到了您的问题: "${query}"，但我暂时无法提供具体回答。请稍后再试。`;
      }

      this.log(`[DifyChatModel] Extracted content: "${content.substring(0, 100)}..."`);

      const generation: ChatGeneration = {
        text: content,
        message: new AIMessage(content),
      };

      return {
        generations: [generation],
      };
    } catch (error) {
      this.error('[DifyChatModel] Error:', error.message);
      this.error('[DifyChatModel] Full error:', error);
      throw error;
    }
  }

  /**
   * 提取核心查询内容，去掉复杂的提示和指令
   */
  private extractCoreQuery(query: string): string {
    try {
      // 直接返回原始查询，不做任何处理
      return query.trim();
    } catch (e) {
      this.warn(`[DifyChatModel] Error extracting core query: ${e.message}`);
      return query; // 出错时返回原始查询
    }
  }

  /** @ignore */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const { query, inputs } = this._extractQueryAndInputs(messages, options);

    console.error('================= HKGAI诊断信息 =================');
    console.error(`模型名称: ${this.modelName}`);
    console.error(`API密钥: ${this.apiKey.substring(0, 8)}...`);
    console.error(`基础URL: ${this.baseUrl}`);
    console.error(`查询内容: ${query}`);
    console.error(`输入参数: ${JSON.stringify(inputs)}`);
    console.error('=================================================');

    this.log(`[DifyChatModel] Streaming request to ${this.baseUrl}/v1/chat-messages`);
    this.log(`[DifyChatModel] Query: ${query}`);

    // 设置超时控制 - 增加到4分30秒，保持与服务器侧超时设置一致
    const TIMEOUT_MS = 270000; // 4分30秒超时
    let timeoutId: NodeJS.Timeout | null = null;
    let hasYieldedContent = false;
    const modelName = this.modelName; // 记录模型名称用于错误消息

    // 创建超时Promise - 使用let而不是const使其可以重新赋值
    let timeoutPromise = new Promise<boolean>((resolve) => {
      timeoutId = setTimeout(() => {
        console.error('[DifyChatModel] API请求超时，使用备用响应');
        resolve(true);
      }, TIMEOUT_MS);
    });

    // 创建API请求的函数，方便重试
    const makeApiRequest = () => {
      console.error(`[HKGAI请求开始] 时间: ${new Date().toISOString()}, 模型: ${this.modelName}`);

      // 极简化的请求体结构
      const requestBody = {
        inputs: inputs, // 使用提取的inputs参数
        query: query.trim(), // 直接使用原始查询
        user: 'user-1', // 必需的user参数
        stream: true, // 启用流式响应
      };

      console.error(`[HKGAI请求] 请求体: ${JSON.stringify(requestBody)}`);

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://lexihk.com',
        'X-Title': 'LexiHK',
      };

      console.error(`[HKGAI请求] 请求头: ${JSON.stringify(headers)}`);

      return fetch(`${this.baseUrl}/v1/chat-messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
    };

    try {
      // 第一次尝试
      let responsePromise = makeApiRequest();

      // 等待响应或超时，先到者胜
      let raceResult = await Promise.race([responsePromise, timeoutPromise]);

      // 如果第一次尝试超时，尝试最后一次
      if (raceResult === true) {
        console.error('[HKGAI响应] 第一次请求超时，尝试最后一次');

        // 清除前一个超时计时器
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // 重置超时计时器
        timeoutPromise = new Promise<boolean>((resolve) => {
          timeoutId = setTimeout(() => {
            console.error('[DifyChatModel] 第二次API请求也超时，使用备用响应');
            resolve(true);
          }, TIMEOUT_MS);
        });

        // 再次尝试请求
        responsePromise = makeApiRequest();
        raceResult = await Promise.race([responsePromise, timeoutPromise]);
      }

      // 如果最终超时
      if (raceResult === true) {
        // 清除可能仍然运行的请求资源
        try {
          const controller = new AbortController();
          controller.abort();
        } catch (e) {
          // 忽略中止错误
        }

        console.error('[HKGAI响应] 所有请求尝试都超时，使用统一错误消息');

        // 使用简单明了的错误消息
        let fallbackText = '';
        if (modelName.includes('searchentry')) {
          fallbackText = '无法获取搜索结果，请稍后再试或提供更详细的查询。';
        } else if (modelName.includes('timeline')) {
          fallbackText = '无法生成时间线分析，请稍后再试。';
        } else if (modelName.includes('missinginfo')) {
          fallbackText = '无法完成缺失信息分析，请稍后再试。';
        } else {
          fallbackText = '服务暂时无法响应，请稍后再试。';
        }

        const messageChunk = new ChatMessageChunk({
          content: fallbackText,
          role: 'assistant',
        });

        const chunk = new ChatGenerationChunk({
          message: messageChunk,
          text: fallbackText,
        });

        yield chunk;
        await runManager?.handleLLMNewToken(fallbackText);
        hasYieldedContent = true;
        return;
      }

      // 如果超时处理器仍存在，清除它
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // 继续处理响应
      const response = raceResult as Response;
      console.error(`[HKGAI响应] 状态码: ${response.status}, 时间: ${new Date().toISOString()}`);

      // 记录原始响应头
      console.error('[HKGAI响应] 响应头:');
      response.headers.forEach((value, name) => {
        console.error(`${name}: ${value}`);
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HKGAI响应] 错误: ${errorText}`);

        // 提供一个默认响应，而不是抛出错误
        const fallbackText = `无法获取响应 (HTTP ${response.status})。请稍后再试。`;
        const messageChunk = new ChatMessageChunk({
          content: fallbackText,
          role: 'assistant',
        });
        const chunk = new ChatGenerationChunk({
          message: messageChunk,
          text: fallbackText,
        });

        yield chunk;
        await runManager?.handleLLMNewToken(fallbackText);
        hasYieldedContent = true;
        return;
      }

      // 直接尝试获取完整响应，而非流式处理
      try {
        const rawResponseText = await response.text();
        console.error(`[HKGAI响应] 成功接收数据，长度: ${rawResponseText.length}字节`);
        console.error(`[HKGAI响应] 原始响应内容: ${rawResponseText.substring(0, 200)}...`);

        if (!rawResponseText || rawResponseText.trim() === '') {
          throw new Error('Empty response');
        }

        // 尝试解析JSON
        const responseJson = JSON.parse(rawResponseText);
        console.error(`[HKGAI响应] 响应JSON对象类型: ${typeof responseJson}`);

        // 处理不同类型的响应格式
        let content = '';

        // 详细记录响应结构
        if (Array.isArray(responseJson)) {
          console.error(`[HKGAI响应] 数组格式，长度: ${responseJson.length}`);
          if (responseJson.length > 0) {
            console.error(`[HKGAI响应] 数组第一项类型: ${typeof responseJson[0]}`);
            console.error(
              `[HKGAI响应] 数组第一项内容: ${JSON.stringify(responseJson[0]).substring(0, 200)}...`,
            );
          }
          content = String(responseJson[0] || '');
        } else if (responseJson.answer) {
          console.error(`[HKGAI响应] 对象格式，answer字段类型: ${typeof responseJson.answer}`);
          console.error(
            `[HKGAI响应] answer字段内容: ${JSON.stringify(responseJson.answer).substring(
              0,
              200,
            )}...`,
          );
          content = String(responseJson.answer);
        } else {
          console.error('[HKGAI响应] 未找到标准字段，完整响应JSON:');
          console.error(JSON.stringify(responseJson, null, 2).substring(0, 500) + '...');

          // 尝试查找其他可能的内容字段
          const possibleFields = ['text', 'content', 'message', 'result', 'data', 'response'];
          for (const field of possibleFields) {
            if (responseJson[field]) {
              console.error(`[HKGAI响应] 找到可能的内容字段 ${field}`);
              content = String(responseJson[field]);
              break;
            }
          }

          // 如果没有找到任何有效字段，使用完整JSON
          if (!content) {
            content = JSON.stringify(responseJson);
          }
        }

        // 确保有内容
        if (!content || content.trim() === '') {
          throw new Error('No content extracted');
        }

        console.error(`[HKGAI响应] 最终提取的内容: ${content.substring(0, 200)}...`);

        // 发送内容
        const messageChunk = new ChatMessageChunk({
          content,
          role: 'assistant',
        });
        const chunk = new ChatGenerationChunk({
          message: messageChunk,
          text: content,
        });

        yield chunk;
        await runManager?.handleLLMNewToken(content);
        hasYieldedContent = true;
      } catch (e) {
        console.error(`[HKGAI响应] 处理响应失败: ${e.message}`);

        // 提供默认响应
        const fallbackText = `处理响应时出错。请稍后再试。`;
        const messageChunk = new ChatMessageChunk({
          content: fallbackText,
          role: 'assistant',
        });
        const chunk = new ChatGenerationChunk({
          message: messageChunk,
          text: fallbackText,
        });

        yield chunk;
        await runManager?.handleLLMNewToken(fallbackText);
        hasYieldedContent = true;
      }
    } catch (error) {
      console.error('[DifyChatModel] Streaming error:', error.message);
      console.error('[DifyChatModel] Full error:', error);

      // 如果超时处理器仍存在，清除它
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // 提供默认响应
      if (!hasYieldedContent) {
        const fallbackText = `发生错误，无法获取响应。请稍后再试。`;
        const messageChunk = new ChatMessageChunk({
          content: fallbackText,
          role: 'assistant',
        });
        const chunk = new ChatGenerationChunk({
          message: messageChunk,
          text: fallbackText,
        });

        console.error('[HKGAI响应] 请求出错，使用默认响应');
        yield chunk;
        await runManager?.handleLLMNewToken(fallbackText);
      }
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
  private debug: boolean;

  /**
   * Initialize the HKGAI client factory
   */
  constructor(options?: { debug?: boolean }) {
    this.baseUrl = process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net';
    this.debug = options?.debug ?? false;

    // Define models and their respective API keys from environment variables
    this.models = {
      'hkgai/searchentry': {
        modelName: 'gpt-3.5-turbo', // Dify使用标准模型名称
        apiKey: process.env.HKGAI_SEARCHENTRY_API_KEY || 'app-mYHumURK2S010ZonuvzeX1Ad',
      },
      'hkgai/missinginfo': {
        modelName: 'gpt-3.5-turbo', // Dify使用标准模型名称
        apiKey: process.env.HKGAI_MISSINGINFO_API_KEY || 'app-cWHko7usG7aP8ZsAnSeglYc3',
      },
      'hkgai/timeline': {
        modelName: 'gpt-3.5-turbo', // Dify使用标准模型名称
        apiKey: process.env.HKGAI_TIMELINE_API_KEY || 'app-R9k11qz64Cd86NCsw2ojZVLC',
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
    if (this.debug) {
      console.log(`[HKGAIClientFactory] Using API URL: ${this.baseUrl}`);
      console.log('[HKGAIClientFactory] Skipping API validation for Dify API');
    }
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

    if (this.debug) {
      console.log(`[HKGAIClientFactory] Creating chat model for ${modelName} using Dify API`);
      console.log(`[HKGAIClientFactory] Base URL: ${this.baseUrl}`);
      console.log(`[HKGAIClientFactory] API Key: ${apiKey.substring(0, 8)}...`);
    }

    // Create and return custom Dify chat model instance
    return new DifyChatModel({
      modelName: modelConfig.modelName,
      apiKey,
      baseUrl: this.baseUrl,
      temperature: params?.temperature ?? 0.7,
      tier: 't2', // 设置为常量't2'，与数据库中的hkgai模型配置一致
      debug: this.debug,
    });
  }

  /**
   * Check if a model is a HKGAI model
   * @param modelName - The name of the model to check
   * @returns Boolean indicating if this is a HKGAI model
   */
  public isHKGAIModel(modelName: string): boolean {
    return modelName?.startsWith('hkgai/') ?? false;
  }

  /**
   * Get a list of available HKGAI models
   * @returns Array of model names
   */
  public getAvailableModels(): string[] {
    return Object.keys(this.models);
  }
}
