import { getModelConfig, getModelApiKey, modelRequiresStreaming } from '../config/model-configs';

/**
 * 简化的HKGAI客户端 - 使用新的配置系统
 */
export class SimpleHKGAIClient {
  private lastUsage: any = null;

  constructor() {
    // Configuration is now handled by the model-configs system
  }

  isRagModel(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.isRagModel ?? false;
  }

  isContractModel(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.isContractModel ?? false;
  }

  /**
   * 调用HKGAI API (非流式)
   */
  async call(
    modelName: string,
    query: string,
    options?: { temperature?: number; documentContent?: string },
  ): Promise<string> {
    // Critical safety check: RAG models are streaming-only and must not use this method.
    if (modelRequiresStreaming(modelName)) {
      console.error(
        `[SimpleHKGAIClient] CRITICAL: The model '${modelName}' requires streaming mode. This indicates a logic error in the calling code. This model must use the .stream() method.`,
      );
      throw new Error(`Model '${modelName}' cannot be called in non-streaming mode.`);
    }

    const config = getModelConfig(modelName);
    if (!config) {
      throw new Error(`Model configuration not found for: ${modelName}`);
    }

    const apiKey = getModelApiKey(modelName);
    if (!apiKey) {
      throw new Error(`API key for model ${modelName} not configured`);
    }

    this.lastUsage = null;

    try {
      const fullUrl = `${config.baseUrl}${config.endpoint}`;

      // For contract models, include document content in query if provided
      let finalQuery = query;
      if (config.isContractModel && options?.documentContent) {
        finalQuery = `请审查以下合同文档：\n\n${options.documentContent}\n\n用户问题：${query}`;
        console.log('[SimpleHKGAIClient.call] Contract mode: document content included in query');
      }

      let requestBody: any;
      switch (config.requestFormat) {
        case 'openai':
          requestBody = {
            model: modelName,
            messages: [{ role: 'user', content: finalQuery }],
            stream: false,
          };
          break;
        case 'dify':
          requestBody = {
            inputs: config.isContractModel ? { doc: [] } : {},
            query: finalQuery,
            response_mode: 'blocking',
            user: 'user-refly',
            conversation_id: '',
            ...(config.isContractModel && { model: 'contract' }),
          };
          break;
        case 'hkgai':
        default:
          requestBody = {
            inputs: {},
            query: finalQuery,
            response_mode: 'blocking',
            user: 'user-refly',
            conversation_id: '',
          };
          break;
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://lexihk.com',
        'X-Title': 'LexiHK',
      };

      console.log('[SimpleHKGAIClient.call] Requesting URL:', fullUrl);
      console.log(
        '[SimpleHKGAIClient.call] Requesting Headers:',
        JSON.stringify({
          ...headers,
          Authorization: `Bearer ${apiKey.substring(0, 4)}...`,
        }),
      );
      console.log(
        '[SimpleHKGAIClient.call] Requesting Body:',
        JSON.stringify(requestBody, null, 2),
      );

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log(`[SimpleHKGAIClient] 响应状态: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SimpleHKGAIClient] API调用失败: ${errorText}`);
        throw new Error(`HKGAI API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[SimpleHKGAIClient] 响应数据:`, JSON.stringify(data, null, 2));

      // 保存使用统计
      if (data.metadata?.usage) {
        this.lastUsage = data.metadata.usage;
      }

      let answer = '';
      switch (config.responseFormat) {
        case 'openai':
          answer = data.choices?.[0]?.message?.content || '';
          break;
        case 'dify':
        case 'hkgai':
        default:
          answer = data.answer || '';
          break;
      }

      if (!answer) {
        console.warn(`[SimpleHKGAIClient] 响应中没有answer字段，使用默认回复`);
        return `我收到了您的问题: "${query}"，但暂时无法提供具体回答。请稍后再试。`;
      }

      console.log(`[SimpleHKGAIClient] 成功获取回答: ${answer.substring(0, 100)}...`);
      return answer;
    } catch (error) {
      console.error(`[SimpleHKGAIClient] 调用失败:`, error);
      throw error;
    }
  }

  /**
   * 调用HKGAI API (流式)
   */
  async stream(
    modelName: string,
    query: string,
    options?: { temperature?: number; documentContent?: string },
  ): Promise<ReadableStream<Uint8Array>> {
    const config = getModelConfig(modelName);
    if (!config) {
      throw new Error(`Model configuration not found for: ${modelName}`);
    }

    const apiKey = getModelApiKey(modelName);
    if (!apiKey) {
      throw new Error(`API key for model ${modelName} not configured`);
    }

    const fullUrl = `${config.baseUrl}${config.endpoint}`;

    // For contract models, include document content in query if provided
    let finalQuery = query;
    if (config.isContractModel && options?.documentContent) {
      finalQuery = `请审查以下合同文档：\n\n${options.documentContent}\n\n用户问题：${query}`;
      console.log('[SimpleHKGAIClient.stream] Contract mode: document content included in query');
    }

    let requestBody: any;
    switch (config.requestFormat) {
      case 'openai':
        requestBody = {
          model: modelName,
          messages: [{ role: 'user', content: finalQuery }],
          stream: true,
        };
        break;
      case 'dify':
        requestBody = {
          inputs: config.isContractModel ? { doc: [] } : {},
          query: finalQuery,
          response_mode: 'streaming',
          conversation_id: '',
          user: 'user-refly',
          temperature: options?.temperature ?? config.defaultTemperature,
          ...(config.isContractModel && { model: 'contract' }),
        };
        break;
      case 'hkgai':
      default:
        requestBody = {
          inputs: {},
          query: finalQuery,
          response_mode: 'streaming',
          conversation_id: '',
          user: 'user-refly',
          temperature: options?.temperature ?? config.defaultTemperature,
        };
        break;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://lexihk.com',
      'X-Title': 'LexiHK',
    };

    console.log('[SimpleHKGAIClient.stream] Requesting URL:', fullUrl);
    console.log(
      '[SimpleHKGAIClient.stream] Requesting Headers:',
      JSON.stringify({
        ...headers,
        Authorization: `Bearer ${apiKey.substring(0, 4)}...`,
      }),
    );
    console.log(
      '[SimpleHKGAIClient.stream] Requesting Body:',
      JSON.stringify(requestBody, null, 2),
    );

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HKGAI stream API failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body;
  }

  getLastUsage(): any {
    return this.lastUsage;
  }
}

// 导出单例实例
export const simpleHKGAIClient = new SimpleHKGAIClient();
