import { Logger } from '@nestjs/common';
import { simpleHKGAIClient, SimpleHKGAIClient } from '@refly/providers/src/llm/simple-hkgai-client';
import { ProviderService } from '../provider/provider.service';
import { SkillRunnableConfig } from '@refly/skill-template';

type InvokeParams = {
  skillName: string;
  query: string;
  documentContent?: string;
  model: {
    name: string;
    // ... other properties
  };
};
/**
 * HKGAI模型适配器
 * 用于支持HKGAI模型的特殊处理需求
 */
export class HKGAIAdapter {
  private logger = new Logger('HKGAIAdapter');
  private providerService: ProviderService;
  private simpleHKGAIClient: SimpleHKGAIClient;

  constructor(providerService: ProviderService) {
    this.providerService = providerService;
    this.simpleHKGAIClient = new SimpleHKGAIClient();
  }

  async invoke(params: InvokeParams, config: SkillRunnableConfig) {
    const { query, model, documentContent } = params;
    const modelName = model.name;

    this.logger.log(`Using HKGAI model: ${modelName}`);
    if (documentContent) {
      this.logger.log(`Document content provided: ${documentContent.length} characters`);
    }

    const modelConfig = config.configurable?.modelConfigMap?.chat;
    const temperature = (modelConfig as any)?.parameters?.temperature ?? 0.7;

    return this.simpleHKGAIClient.stream(modelName, query, {
      temperature,
      documentContent,
    });
  }

  /**
   * 检查给定的模型名称是否是HKGAI模型
   * @param modelName 模型名称
   * @returns 是否为HKGAI模型
   */
  public static isHKGAIModel(modelName: string): boolean {
    const lowerModelName = (modelName || '').toLowerCase();
    return (
      lowerModelName.includes('hkgai') ||
      lowerModelName.includes('lexihk') ||
      lowerModelName.includes('lexi-hk') ||
      lowerModelName.includes('hk-gai') ||
      lowerModelName.includes('gpt-4') // 简化判断，可根据实际需求调整
    );
  }

  /**
   * 获取HKGAI模型类型
   * @param modelName 模型名称
   * @returns 模型类型
   */
  public static getHKGAIModelType(modelName: string): string {
    const lowerModelName = (modelName || '').toLowerCase();

    // 优先检查HKGAI特定模型类型
    if (lowerModelName.includes('missinginfo')) {
      return 'missinginfo';
    } else if (lowerModelName.includes('searchentry')) {
      return 'searchentry';
    } else if (lowerModelName.includes('timeline')) {
      return 'timeline';
    } else if (lowerModelName.includes('contract')) {
      return 'contract';
    } else if (lowerModelName.includes('gpt-4')) {
      return 'gpt-4';
    } else if (lowerModelName.includes('claude')) {
      return 'claude';
    } else if (lowerModelName.includes('glm') || lowerModelName.includes('chatglm')) {
      return 'chatglm';
    } else {
      return 'hkgai'; // 默认类型
    }
  }

  /**
   * 获取默认错误消息
   * @param modelType 模型类型
   * @returns 适合该模型类型的默认错误消息
   */
  public static getDefaultErrorMessage(modelType: string): string {
    switch (modelType) {
      case 'gpt-4':
        return '很抱歉，我无法完成您的请求。请尝试重新提问或者换一种表述方式。';
      case 'claude':
        return '抱歉，我在处理您的请求时遇到了问题。请尝试简化您的问题或稍后再试。';
      case 'chatglm':
        return '对不起，我遇到了一些技术问题。请尝试重新提问或联系技术支持。';
      default:
        return '很抱歉，无法生成回复。请重新提问或调整您的问题描述，使其更加具体和清晰。';
    }
  }

  /**
   * 从复杂内容结构中提取可用的文本内容
   * @param content 任意内容结构
   * @returns 提取的文本内容
   */
  public static extractContent(content: any): string {
    // 处理不同类型的输入
    if (typeof content === 'string') {
      return content;
    }

    // 处理数组格式
    if (Array.isArray(content)) {
      if (content.length === 0) return '';

      // 尝试提取数组中的第一个元素
      const firstItem = content[0];

      if (typeof firstItem === 'string') {
        return firstItem;
      } else if (typeof firstItem === 'object' && firstItem !== null) {
        // 尝试从对象中提取常见的内容字段
        if (firstItem.content) return String(firstItem.content);
        if (firstItem.text) return String(firstItem.text);
        if (firstItem.answer) return String(firstItem.answer);
        if (firstItem.message) return String(firstItem.message);

        // 最后尝试将整个对象转换为字符串
        try {
          return JSON.stringify(firstItem);
        } catch (e) {
          return '';
        }
      }

      // 如果无法提取有效内容，尝试将整个数组连接为字符串
      try {
        return content
          .map((item) =>
            typeof item === 'string'
              ? item
              : typeof item === 'object' && item !== null
                ? item.content || item.text || item.answer || JSON.stringify(item)
                : String(item),
          )
          .join('');
      } catch (e) {
        return '';
      }
    }

    // 处理对象格式
    if (typeof content === 'object' && content !== null) {
      // 检查常见的内容字段
      if (content.answer) return String(content.answer);
      if (content.content) return String(content.content);
      if (content.text) return String(content.text);
      if (content.message && typeof content.message === 'string') return content.message;

      // 尝试将整个对象转换为字符串
      try {
        return JSON.stringify(content);
      } catch (e) {
        return '';
      }
    }

    // 其他类型尝试转换为字符串
    return String(content || '');
  }

  /**
   * 处理HKGAI模型的输出
   * 根据不同的模型类型，对输出进行特殊处理
   */
  static processOutput(
    modelName: string,
    content: string | any[] | null | undefined,
    reasoningContent: string | null = null,
  ): { content: string; reasoningContent?: string } {
    try {
      // 处理内容为null/undefined的情况
      if (!content) {
        return {
          content: HKGAIAdapter.getDefaultErrorMessage(HKGAIAdapter.getHKGAIModelType(modelName)),
        };
      }

      // 提取实际内容
      let contentStr = '';

      // 根据内容类型进行处理
      if (typeof content === 'string') {
        contentStr = content;
      } else {
        // 使用增强的内容提取函数
        contentStr = HKGAIAdapter.extractContent(content);
      }

      // 检查内容是否为空
      if (!contentStr || contentStr.trim() === '') {
        return {
          content: HKGAIAdapter.getDefaultErrorMessage(HKGAIAdapter.getHKGAIModelType(modelName)),
        };
      }

      const modelType = HKGAIAdapter.getHKGAIModelType(modelName);

      // 针对特定模型类型进行处理
      switch (modelType) {
        case 'timeline':
          return HKGAIAdapter.processTimelineResponse(contentStr, reasoningContent);
        case 'searchentry':
          return HKGAIAdapter.processSearchResponse(contentStr, reasoningContent);
        case 'missinginfo':
          return HKGAIAdapter.processMissingInfoResponse(contentStr, reasoningContent);
        case 'contract':
          return HKGAIAdapter.processContractResponse(contentStr, reasoningContent);
        default:
          return { content: contentStr, reasoningContent };
      }
    } catch (error) {
      console.error(`HKGAI响应处理错误:`, error);
      return {
        content: HKGAIAdapter.getDefaultErrorMessage(HKGAIAdapter.getHKGAIModelType(modelName)),
      };
    }
  }

  private static processTimelineResponse(
    content: string,
    reasoningContent: string | null,
  ): { content: string; reasoningContent?: string } {
    // Timeline模型可能返回特殊格式，如果以"texttimeline"开头，需要格式化
    if (content.startsWith('texttimeline')) {
      try {
        const lines = content.split('\n');
        let markdown = '# 时间线分析\n\n';

        for (const line of lines) {
          if (line.trim().startsWith('title ')) {
            markdown += `## ${line.replace('title ', '')}\n\n`;
          } else if (line.includes(' : ')) {
            const [time, event] = line.split(' : ');
            markdown += `- **${time.trim()}**: ${event.trim()}\n`;
          }
        }

        return { content: markdown, reasoningContent };
      } catch (e) {
        console.error('Timeline格式转换失败:', e);
      }
    }

    return { content, reasoningContent };
  }

  private static processSearchResponse(
    content: string,
    reasoningContent: string | null,
  ): { content: string; reasoningContent?: string } {
    // 处理搜索模型输出，通常不需要特殊处理
    return { content, reasoningContent };
  }

  private static processMissingInfoResponse(
    content: string,
    reasoningContent: string | null,
  ): { content: string; reasoningContent?: string } {
    // 处理缺失信息模型输出，通常不需要特殊处理
    return { content, reasoningContent };
  }

  private static processContractResponse(
    content: string,
    reasoningContent: string | null,
  ): { content: string; reasoningContent?: string } {
    // 处理合同审查模型输出，通常不需要特殊处理
    return { content, reasoningContent };
  }
}
