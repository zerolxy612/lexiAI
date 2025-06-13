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
}

/**
 * 用于创建和管理HKGAI模型API客户端的工厂类
 */
@Injectable()
export class HKGAIClientFactory {
  private clients: Map<string, AxiosInstance> = new Map();
  private baseUrl: string;
  private modelApiKeys: Record<string, string>;
  private readonly logger = new Logger(HKGAIClientFactory.name);

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('credentials.hkgai.baseUrl');

    // 获取模型API密钥配置
    this.modelApiKeys = {
      [HKGAIModelName.SEARCH_ENTRY]: this.configService.get('credentials.hkgai.searchEntryKey'),
      [HKGAIModelName.MISSING_INFO]: this.configService.get('credentials.hkgai.missingInfoKey'),
      [HKGAIModelName.TIMELINE]: this.configService.get('credentials.hkgai.timelineKey'),
      [HKGAIModelName.GENERAL]:
        this.configService.get('credentials.hkgai.generalKey') || 'app-5PTDowg5Dn2MSEhG5n3FBWXs',
    };

    this.logger.log(`HKGAI Client Factory initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * 获取指定模型的API客户端
   * @param modelName 模型名称
   * @returns Axios实例
   */
  getClient(modelName: string): AxiosInstance {
    // 检查是否已有此模型的客户端
    if (this.clients.has(modelName)) {
      return this.clients.get(modelName);
    }

    // 获取该模型的API密钥
    const apiKey = this.modelApiKeys[modelName];
    if (!apiKey) {
      throw new Error(`No API key configured for HKGAI model: ${modelName}`);
    }

    // 创建新的Axios客户端
    const client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // 缓存客户端实例
    this.clients.set(modelName, client);
    this.logger.log(`Created client for model: ${modelName}`);

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
    const client = this.getClient(modelName);

    try {
      const response = await client.post('/chat/completions', {
        app_id: this.modelApiKeys[modelName], // 使用模型对应的密钥作为app_id
        messages,
        // 可选参数
        temperature: options?.temperature || 0.7,
        stream: options?.stream || false,
        ...options,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Error calling HKGAI API for model ${modelName}: ${error.message}`);
      throw error;
    }
  }
}
