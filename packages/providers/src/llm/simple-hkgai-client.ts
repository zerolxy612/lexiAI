/**
 * 简化的HKGAI客户端 - 直接使用环境变量配置，不依赖数据库
 */
export class SimpleHKGAIClient {
  private baseUrl: string;
  private ragBaseUrl: string;
  private apiKeys: Record<string, string>;
  private lastUsage: any = null;

  constructor() {
    this.baseUrl = process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net';
    this.ragBaseUrl = process.env.HKGAI_RAG_BASE_URL || 'https://ragpipeline.hkgai.asia';
    this.apiKeys = {
      'hkgai-searchentry': process.env.HKGAI_SEARCHENTRY_API_KEY || 'app-mYHumURK2S010ZonuvzeX1Ad',
      'hkgai-missinginfo': process.env.HKGAI_MISSINGINFO_API_KEY || 'app-cWHko7usG7aP8ZsAnSeglYc3',
      'hkgai-timeline': process.env.HKGAI_TIMELINE_API_KEY || 'app-R9k11qz64Cd86NCsw2ojZVLC',
      'hkgai-general': process.env.HKGAI_GENERAL_API_KEY || 'app-5PTDowg5Dn2MSEhG5n3FBWXs',
      'hkgai-rag':
        process.env.HKGAI_RAG_API_KEY ||
        process.env.HKGAI_API_KEY ||
        'sk-UgDQCBR58Fg66sb480Ff7f4003A740D8B7DcD97f3566BbAc',
    };
  }

  private isRagModel(modelName: string): boolean {
    return (modelName || '').toLowerCase().includes('rag');
  }

  /**
   * 根据模型名称获取对应的API Key
   */
  private getApiKeyForModel(modelName: string): string {
    const lowerModelName = (modelName || '').toLowerCase();

    if (lowerModelName.includes('searchentry')) {
      return this.apiKeys['hkgai-searchentry'];
    } else if (lowerModelName.includes('missinginfo')) {
      return this.apiKeys['hkgai-missinginfo'];
    } else if (lowerModelName.includes('timeline')) {
      return this.apiKeys['hkgai-timeline'];
    } else if (lowerModelName.includes('general')) {
      return this.apiKeys['hkgai-general'];
    } else if (this.isRagModel(lowerModelName)) {
      return this.apiKeys['hkgai-rag'];
    } else {
      // 默认使用missinginfo的API Key
      return this.apiKeys['hkgai-missinginfo'];
    }
  }

  /**
   * 调用HKGAI API (非流式)
   */
  async call(
    modelName: string,
    query: string,
    options?: { temperature?: number },
  ): Promise<string> {
    // Critical safety check: RAG models are streaming-only and must not use this method.
    if (this.isRagModel(modelName)) {
      console.error(
        `[SimpleHKGAIClient] CRITICAL: The RAG model '${modelName}' was incorrectly called in non-streaming mode. This indicates a logic error in the calling code. RAG models must use the .stream() method.`,
      );
      throw new Error(`RAG model '${modelName}' cannot be called in non-streaming mode.`);
    }

    const apiKey = this.getApiKeyForModel(modelName);

    if (!apiKey) {
      throw new Error(`API key for model ${modelName} not configured`);
    }

    this.lastUsage = null;

    try {
      const isRag = this.isRagModel(modelName);
      const baseUrl = isRag ? this.ragBaseUrl : this.baseUrl;
      const endpoint = isRag ? '/v1/chat/completions' : '/v1/chat-messages';
      const fullUrl = `${baseUrl}${endpoint}`;

      const requestBody = isRag
        ? {
            model: 'Lexihk-RAG',
            messages: [{ role: 'user', content: query }],
            stream: false, // Explicitly non-streaming
            temperature: options?.temperature ?? 0.7,
          }
        : {
            inputs: {},
            query,
            response_mode: 'blocking',
            conversation_id: '',
            user: 'user-refly',
            temperature: options?.temperature ?? 0.7,
          };

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://lexihk.com',
          'X-Title': 'LexiHK',
        },
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

      const answer = isRag ? data.choices[0]?.message?.content || '' : data.answer || '';
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
    options?: { temperature?: number },
  ): Promise<ReadableStream<Uint8Array>> {
    const apiKey = this.getApiKeyForModel(modelName);
    if (!apiKey) {
      throw new Error(`API key for model ${modelName} not configured`);
    }

    const isRag = this.isRagModel(modelName);
    const baseUrl = isRag ? this.ragBaseUrl : this.baseUrl;
    const endpoint = isRag ? '/v1/chat/completions' : '/v1/chat-messages';
    const fullUrl = `${baseUrl}${endpoint}`;

    const requestBody = isRag
      ? {
          model: 'Lexihk-RAG',
          messages: [{ role: 'user', content: query }],
          stream: true,
          temperature: options?.temperature ?? 0.7,
        }
      : {
          inputs: {},
          query,
          response_mode: 'streaming',
          conversation_id: '',
          user: 'user-refly',
          temperature: options?.temperature ?? 0.7,
        };

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://lexihk.com',
        'X-Title': 'LexiHK',
      },
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
