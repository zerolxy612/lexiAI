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
  CONTRACT = 'Contract',
  GENERAL = 'General',
  RAG = 'Rag',
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
    // For non-RAG models, continue using ConfigService for backward compatibility.
    this.baseUrl = this.configService.get('credentials.hkgai.baseUrl');
    this.modelApiKeys = {
      [HKGAIModelName.SEARCH_ENTRY]: this.configService.get('credentials.hkgai.searchEntryKey'),
      [HKGAIModelName.MISSING_INFO]: this.configService.get('credentials.hkgai.missingInfoKey'),
      [HKGAIModelName.TIMELINE]: this.configService.get('credentials.hkgai.timelineKey'),
      [HKGAIModelName.CONTRACT]: this.configService.get('credentials.hkgai.contractKey'),
      [HKGAIModelName.GENERAL]:
        this.configService.get('credentials.hkgai.generalKey') || 'app-5PTDowg5Dn2MSEhG5n3FBWXs',
      [HKGAIModelName.RAG]: this.configService.get('credentials.hkgai.ragKey'),
    };

    // --- Definitive Fix ---
    // For RAG, read directly from process.env to ensure correctness and bypass config mapping issues.
    // This aligns the code with the documented environment setup and fixes the migration gap.
    this.ragBaseUrl = process.env.HKGAI_BASE_URL || 'https://ragpipeline.hkgai.asia';
    this.modelApiKeys[HKGAIModelName.RAG] =
      process.env.HKGAI_API_KEY || 'sk-UgDQCBR58Fg66sb480Ff7f4003A740D8B7DcD97f3566BbAc';
    this.modelApiKeys[HKGAIModelName.CONTRACT] =
      this.configService.get('credentials.hkgai.contractKey') ||
      'sk-UgDQCBR58Fg66sb480Ff7f4003A740D8B7DcD97f3566BbAc';

    this.logger.log('HKGAI Client Factory initialized.');
    this.logger.log(`RAG Base URL (from env): ${this.ragBaseUrl}`);
    this.logger.log(
      `RAG API Key (from env): ${this.modelApiKeys[HKGAIModelName.RAG] ? 'Loaded' : 'NOT LOADED'}`,
    );
  }

  /**
   * 将模型ID映射到枚举值
   */
  private mapModelIdToEnum(modelId: string): string {
    const mapping = {
      'hkgai-searchentry': HKGAIModelName.SEARCH_ENTRY,
      'hkgai-missinginfo': HKGAIModelName.MISSING_INFO,
      'hkgai-timeline': HKGAIModelName.TIMELINE,
      'hkgai-contract': HKGAIModelName.CONTRACT,
      'hkgai-general': HKGAIModelName.GENERAL,
      'hkgai-rag': HKGAIModelName.RAG,
      // Support direct enum values and string variants
      [HKGAIModelName.SEARCH_ENTRY]: HKGAIModelName.SEARCH_ENTRY,
      [HKGAIModelName.MISSING_INFO]: HKGAIModelName.MISSING_INFO,
      [HKGAIModelName.TIMELINE]: HKGAIModelName.TIMELINE,
      [HKGAIModelName.CONTRACT]: HKGAIModelName.CONTRACT,
      [HKGAIModelName.GENERAL]: HKGAIModelName.GENERAL,
      // Support direct string 'RAG' mapping to the correct enum value
      RAG: HKGAIModelName.RAG,
      Rag: HKGAIModelName.RAG,
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
            temperature: options?.temperature ?? 0.7,
            stream: options?.stream ?? true, // Default to true for RAG
            max_tokens: options?.max_tokens ?? 4000,
          }
        : {
            inputs: {},
            query: messages[messages.length - 1]?.content ?? '',
            response_mode: options?.stream ? 'streaming' : 'blocking',
            conversation_id: '',
            user: 'user-refly',
            // Pass full message history for context, if available
            messages: messages.length > 1 ? messages.slice(0, -1) : [],
          };

      this.logger.log(
        `[createChatCompletion] Preparing to call ${modelName} at ${client.defaults.baseURL}${endpoint}`,
      );
      this.logger.debug(
        `[createChatCompletion] Request Body for ${modelName}:\n${JSON.stringify(requestBody, null, 2)}`,
      );

      const response = await client.post(endpoint, requestBody, {
        responseType: options?.stream ? 'stream' : 'json',
      });

      this.logger.log(`[createChatCompletion] Successfully initiated call for ${modelName}.`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `[createChatCompletion] ❌ FAILED to call HKGAI API for model ${modelName}.`,
      );
      this.logger.error(`[createChatCompletion] Error Message: ${error.message}`);

      if (axios.isAxiosError(error)) {
        this.logger.error(
          `[createChatCompletion] Request URL: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        );
        if (error.response) {
          this.logger.error(
            `[createChatCompletion] Response Status: ${error.response.status} ${error.response.statusText}`,
          );

          // --- Robust Error Stream Logging ---
          // The error response from a streaming API might itself be a stream.
          const responseData = error.response.data;
          if (responseData && typeof responseData.on === 'function') {
            this.logger.error(
              '[createChatCompletion] Error response is a stream. Reading for details...',
            );
            const errorBody = await new Promise((resolve) => {
              const chunks: any[] = [];
              responseData.on('data', (chunk: any) => chunks.push(chunk));
              responseData.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
              responseData.on('error', (err: Error) =>
                resolve(`Failed to read error stream: ${err.message}`),
              );
            });
            this.logger.error(`[createChatCompletion] STREAM-ERROR-BODY: ${errorBody}`);
          } else {
            this.logger.error(
              `[createChatCompletion] Response Body:\n${JSON.stringify(responseData, null, 2)}`,
            );
          }
        } else if (error.request) {
          this.logger.error('[createChatCompletion] No response received from server.');
        }
      }
      this.logger.error('[createChatCompletion] Full Error Stack:', error.stack);
      throw error;
    }
  }
}
