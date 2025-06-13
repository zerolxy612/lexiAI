/**
 * 简化的HKGAI客户端 - 直接使用环境变量配置，不依赖数据库
 */
export class SimpleHKGAIClient {
  private baseUrl: string;
  private apiKeys: Record<string, string>;
  private lastUsage: any = null;

  constructor() {
    this.baseUrl = process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net';
    this.apiKeys = {
      'hkgai-searchentry': process.env.HKGAI_SEARCHENTRY_API_KEY || 'app-mYHumURK2S010ZonuvzeX1Ad',
      'hkgai-missinginfo': process.env.HKGAI_MISSINGINFO_API_KEY || 'app-cWHko7usG7aP8ZsAnSeglYc3',
      'hkgai-timeline': process.env.HKGAI_TIMELINE_API_KEY || 'app-R9k11qz64Cd86NCsw2ojZVLC',
    };
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
    } else {
      // 默认使用missinginfo的API Key
      return this.apiKeys['hkgai-missinginfo'];
    }
  }

  /**
   * 调用HKGAI API
   */
  async call(modelName: string, query: string): Promise<string> {
    const apiKey = this.getApiKeyForModel(modelName);

    if (!apiKey) {
      throw new Error(`API key for model ${modelName} not configured`);
    }

    // 重置使用统计
    this.lastUsage = null;

    try {
      console.log(`[SimpleHKGAIClient] 调用模型: ${modelName}`);
      console.log(`[SimpleHKGAIClient] 使用API Key: ${apiKey.substring(0, 10)}...`);
      console.log(`[SimpleHKGAIClient] Base URL: ${this.baseUrl}`);
      console.log(`[SimpleHKGAIClient] 查询内容: ${query}`);

      const response = await fetch(`${this.baseUrl}/v1/chat-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://lexihk.com',
          'X-Title': 'LexiHK',
        },
        body: JSON.stringify({
          inputs: {},
          query,
          response_mode: 'blocking',
          conversation_id: '',
          user: 'user-refly',
        }),
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

      const answer = data.answer || '';
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

  getLastUsage(): any {
    return this.lastUsage;
  }
}

// 导出单例实例
export const simpleHKGAIClient = new SimpleHKGAIClient();
