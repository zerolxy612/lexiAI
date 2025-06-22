import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * HKGAI模型定义
 */
export enum HKGAIModelName {
  SEARCH_ENTRY = 'SearchEntry',
  MISSING_INFO = 'MissingInfo',
  TIMELINE = 'Timeline',
  GENERAL = 'General',
  RAG = 'RAG',
}

/**
 * 用于创建和管理HKGAI模型API客户端的工厂类
 */
@Injectable()
export class HKGAIClientFactory {
  private clients: Map<string, AxiosInstance> = new Map();
  private baseUrl: string;
  private ragBaseUrl: string;
  private modelApiKeys: Record<string, string>;
  private readonly logger = new Logger(HKGAIClientFactory.name);

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('credentials.hkgai.baseUrl');
    this.ragBaseUrl = this.configService.get('credentials.hkgai.ragBaseUrl');

    // 获取模型API密钥配置
    this.modelApiKeys = {
      [HKGAIModelName.SEARCH_ENTRY]: this.configService.get('credentials.hkgai.searchEntryKey'),
      [HKGAIModelName.MISSING_INFO]: this.configService.get('credentials.hkgai.missingInfoKey'),
      [HKGAIModelName.TIMELINE]: this.configService.get('credentials.hkgai.timelineKey'),
      [HKGAIModelName.GENERAL]:
        this.configService.get('credentials.hkgai.generalKey') || 'app-5PTDowg5Dn2MSEhG5n3FBWXs',
      [HKGAIModelName.RAG]:
        this.configService.get('credentials.hkgai.ragKey') ||
        'sk-UgDQCBR58Fg66sb480Ff7f4003A740D8B7DcD97f3566BbAc',
    };

    this.logger.log(`HKGAI Client Factory initialized with base URL: ${this.baseUrl}`);
    this.logger.log(`Available models: ${Object.keys(this.modelApiKeys).join(', ')}`);
  }

  /**
   * 将模型ID映射到枚举值
   */
  private mapModelIdToEnum(modelId: string): string {
    const mapping = {
      'hkgai-searchentry': HKGAIModelName.SEARCH_ENTRY,
      'hkgai-missinginfo': HKGAIModelName.MISSING_INFO,
      'hkgai-timeline': HKGAIModelName.TIMELINE,
      'hkgai-general': HKGAIModelName.GENERAL,
      'hkgai-rag': HKGAIModelName.RAG,
      // Also support direct enum values
      [HKGAIModelName.SEARCH_ENTRY]: HKGAIModelName.SEARCH_ENTRY,
      [HKGAIModelName.MISSING_INFO]: HKGAIModelName.MISSING_INFO,
      [HKGAIModelName.TIMELINE]: HKGAIModelName.TIMELINE,
      [HKGAIModelName.GENERAL]: HKGAIModelName.GENERAL,
      [HKGAIModelName.RAG]: HKGAIModelName.RAG,
    };

    return mapping[modelId] || modelId;
  }

  /**
   * 获取指定模型的API客户端
   * @param modelName 模型名称
   * @returns Axios实例
   */
  getClient(modelName: string): AxiosInstance {
    // Map model ID to enum value
    const enumModelName = this.mapModelIdToEnum(modelName);

    // 检查是否已有此模型的客户端
    if (this.clients.has(enumModelName)) {
      return this.clients.get(enumModelName);
    }

    // 获取该模型的API密钥
    const apiKey = this.modelApiKeys[enumModelName];
    if (!apiKey) {
      this.logger.error(
        `No API key configured for HKGAI model: ${modelName} (mapped to: ${enumModelName})`,
      );
      this.logger.error(`Available models: ${Object.keys(this.modelApiKeys).join(', ')}`);
      throw new Error(`No API key configured for HKGAI model: ${modelName}`);
    }

    const isRagModel = enumModelName === HKGAIModelName.RAG;
    const baseURL = isRagModel ? this.ragBaseUrl : this.baseUrl;

    // 创建新的Axios客户端
    const client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // 缓存客户端实例
    this.clients.set(enumModelName, client);
    this.logger.log(`Created client for model: ${modelName} (mapped to: ${enumModelName})`);

    return client;
  }

  /**
   * 调用HKGAI API进行聊天完成
   * @param modelName 模型名称
   * @param messages 消息列表
   * @param options 其他选项
   * @returns API响应
   */
  async createChatCompletion(
    modelName: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      stream?: boolean;
      [key: string]: any;
    },
  ) {
    // Map model ID to enum value
    const enumModelName = this.mapModelIdToEnum(modelName);
    const client = this.getClient(modelName);
    const isRagModel = enumModelName === HKGAIModelName.RAG;
    const requestBaseUrl = isRagModel ? this.ragBaseUrl : this.baseUrl;

    try {
      // For RAG model, use different API format
      const endpoint = isRagModel ? '/v1/chat/completions' : '/v1/chat-messages';

      const requestBody = isRagModel
        ? {
            model: 'Lexihk-RAG', // RAG model uses specific model name
            messages,
            temperature: options?.temperature || 0.7,
            stream: options?.stream || false,
            max_tokens: options?.max_tokens || 4000,
            ...options,
          }
        : {
            inputs: {},
            query: messages[messages.length - 1]?.content || '',
            response_mode: options?.stream ? 'streaming' : 'blocking',
            conversation_id: '',
            user: 'user-refly',
          };

      this.logger.debug(
        `Calling ${modelName} (mapped to: ${enumModelName}) with endpoint: ${client.defaults.baseURL}${endpoint}`,
      );
      this.logger.debug(`Request body:`, JSON.stringify(requestBody, null, 2));

      const response = await client.post(endpoint, requestBody, {
        responseType: options?.stream ? 'stream' : 'json',
      });

      // If streaming, the response data is the stream itself.
      // If not, it's the JSON body.
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling HKGAI API for model ${modelName}: ${error.message}`);
      this.logger.error(`Base URL: ${requestBaseUrl}, Model: ${modelName}`);
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response data:`, error.response.data);
      }
      throw error;
    }
  }
}
