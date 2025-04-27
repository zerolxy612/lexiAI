import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { SystemMessage, AIMessage } from '@langchain/core/messages';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Artifact,
  InputMode,
  ArtifactType,
  CanvasNodeData,
  CanvasNodeType,
  CanvasNode,
} from '@refly/openapi-schema';
import { GraphState } from '../scheduler/types';
import { genImageID } from '@refly/utils';

// 扩展GraphState接口以包含gen_id属性
interface ImageGenerationState extends GraphState {
  gen_id?: string;
}

/**
 * Image Generation Skill
 *
 * Generates images based on text prompts using external API services
 */
export class ImageGeneration extends BaseSkill {
  name = 'imageGeneration';
  displayName = {
    en: 'Image Generation',
    'zh-CN': '图像生成',
  };

  icon: Icon = { type: 'emoji', value: '🖼️' };

  // 多语言支持的进度消息模板
  private progressMessages = {
    queueing: {
      en: 'ID: `{taskId}`\nQueuing...',
      'zh-CN': 'ID: `{taskId}`\n排队中...',
    },
    generating: {
      en: 'Generating...',
      'zh-CN': '生成中...',
    },
    progress: {
      en: 'Progress {percentage}%',
      'zh-CN': '进度 {percentage}%',
    },
    complete: {
      en: 'Generation completed ✅',
      'zh-CN': '生成完成 ✅',
    },
    genId: {
      en: 'gen_id: `{genId}`',
      'zh-CN': 'gen_id: `{genId}`',
    },
  };

  // 创建进度条辅助方法
  private createProgressBar(percentage: number): string {
    const filledCount = Math.floor(percentage / 10);
    const emptyCount = 10 - filledCount;
    const filled = '█'.repeat(filledCount);
    const empty = '░'.repeat(emptyCount);
    return `[${filled}${empty}] ${percentage}%`;
  }

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'apiUrl',
        inputMode: 'input' as InputMode,
        defaultValue: 'https://api.tu-zi.com/v1/chat/completions',
        labelDict: {
          en: 'API URL',
          'zh-CN': 'API 地址',
        },
        descriptionDict: {
          en: 'The API endpoint for image generation',
          'zh-CN': '图像生成API接口地址',
        },
      },
      {
        key: 'apiKey',
        inputMode: 'input' as InputMode,
        defaultValue: '',
        inputProps: {
          // @ts-ignore - 使用密码类型的输入框
          passwordType: true,
        },
        labelDict: {
          en: 'API Key',
          'zh-CN': 'API 密钥',
        },
        descriptionDict: {
          en: 'Your API key for the image generation service.',
          'zh-CN': '图像生成服务的API密钥',
        },
      },
      {
        key: 'imageRatio',
        inputMode: 'select' as InputMode,
        defaultValue: '1:1',
        labelDict: {
          en: 'Image Ratio',
          'zh-CN': '图像比例',
        },
        descriptionDict: {
          en: 'The aspect ratio of generated images',
          'zh-CN': '生成图像的宽高比',
        },
        options: [
          {
            value: '1:1',
            labelDict: { en: '1:1 (Square)', 'zh-CN': '1:1 (正方形)' },
          },
          {
            value: '16:9',
            labelDict: { en: '16:9 (Landscape)', 'zh-CN': '16:9 (横向)' },
          },
          {
            value: '9:16',
            labelDict: { en: '9:16 (Portrait)', 'zh-CN': '9:16 (纵向)' },
          },
        ],
      },
      {
        key: 'model',
        inputMode: 'select' as InputMode,
        defaultValue: 'gpt-4o-image-vip',
        labelDict: {
          en: 'Model',
          'zh-CN': '模型',
        },
        descriptionDict: {
          en: 'The model to use for image generation',
          'zh-CN': '用于图像生成的模型',
        },
        options: [
          {
            value: 'gpt-4o-image-vip',
            labelDict: { en: 'GPT-4o-image-vip', 'zh-CN': 'GPT-4o-image-vip' },
          },
          {
            value: 'gpt-4o-image',
            labelDict: { en: 'GPT-4o-image', 'zh-CN': 'GPT-4o-image' },
          },
          {
            value: 'custom',
            labelDict: { en: 'Custom model', 'zh-CN': '自定义模型' },
          },
        ],
      },
      {
        key: 'customModel',
        inputMode: 'input' as InputMode,
        defaultValue: '',
        labelDict: {
          en: 'Custom Model Name',
          'zh-CN': '自定义模型名称',
        },
        descriptionDict: {
          en: 'Enter custom model name (only used when "Custom model" is selected)',
          'zh-CN': '输入自定义模型名称（仅当选择"自定义模型"时使用）',
        },
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = '根据文本提示使用AI模型生成图像';

  // 添加详细的用法说明
  helpText = {
    en: `
    # Image Generation
    
    Generate images based on text prompts.
    
    ## Creating a New Image
    - Simply enter your prompt in the text field
    - Choose the image ratio and model

    ## Editing an Existing Image
    - Enter your modification prompt in the text field
    - Input the gen_id from a previously generated image
    - The system will modify the existing image based on your new prompt

    Example of editing: "Add a red hat to the cat"
    `,
    'zh-CN': `
    # 图像生成
    
    根据文本提示生成图像。
    
    ## 创建新图像
    - 在文本框中输入您的提示词
    - 选择图像比例和模型

    ## 修改已有图像
    - 在文本框中输入您的修改提示词
    - 在"生成ID"框中输入之前生成图像的gen_id
    - 系统将根据您的新提示词修改现有图像

    修改示例："给猫咪添加一顶红帽子"
    `,
  };

  schema = z.object({
    query: z.string().describe('The prompt for image generation'),
    gen_id: z.string().optional().describe('The ID of a previously generated image to edit'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  async generateImage(
    state: ImageGenerationState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> {
    const { query, gen_id: stateGenId } = state;
    const { tplConfig } = config.configurable;

    if (!query) {
      throw new Error('A prompt is required for image generation');
    }

    // Extract configuration values with defaults
    const apiUrl = tplConfig?.apiUrl?.value ?? 'https://api.tu-zi.com/v1/chat/completions';
    const apiKey = tplConfig?.apiKey?.value ?? '';
    const ratio = tplConfig?.imageRatio?.value ?? '1:1';
    let model = tplConfig?.model?.value ?? 'gpt-4o-image-vip';

    // 如果选择了自定义模型，则使用自定义模型名称
    if (model === 'custom' && tplConfig?.customModel?.value) {
      model = tplConfig.customModel.value;
    }

    // 使用state中的gen_id
    const gen_id = stateGenId || '';

    if (!apiKey) {
      throw new Error('API key is required for image generation');
    }

    config.metadata.step = { name: 'generateImage' };

    // 定义变量以便在catch块中可以访问
    let progressInterval: NodeJS.Timeout | undefined;
    const progressHistory: string[] = [];
    let taskId = '';

    try {
      // Log the generation attempt
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'image.generating',
            titleArgs: {
              prompt: query,
            },
          },
        },
        config,
      );

      // Prepare the first message with proper JSON format
      const jsonConfig = {
        prompt: query,
        ratio: ratio,
      };

      // If gen_id is provided, add it to the JSON config for image editing
      const finalConfig = gen_id ? { ...jsonConfig, gen_id } : jsonConfig;

      // Create the message with proper formatting for the API
      const messages = [
        {
          role: 'user',
          content: `\`\`\`\n${JSON.stringify(finalConfig, null, 2)}\n\`\`\``,
        },
      ];

      // Add gen_id if provided for image editing
      const requestBody = {
        stream: true, // Use streaming for more responsive feedback
        model: model,
        messages: messages,
      };

      // Setup headers
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };

      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'image.api.request',
            titleArgs: {
              url: apiUrl,
            },
          },
        },
        config,
      );

      // Make the API request
      const response = await fetch(apiUrl as string, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 添加更详细的错误信息
        const errorMessage = `图像生成失败: ${response.status} - ${errorText}`;
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: 'image.api.error',
              titleArgs: {
                status: response.status.toString(),
                error: errorText,
              },
            },
          },
          config,
        );
        throw new Error(errorMessage);
      }

      // Process the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        const errorMessage = '无法读取响应流';
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: 'image.stream.error',
              titleArgs: { error: errorMessage },
            },
          },
          config,
        );
        throw new Error(errorMessage);
      }

      let imageUrl = '';
      let genId = '';
      let fullResponse = '';

      // Stream reading logic with timeout
      const decoder = new TextDecoder();
      let done = false;

      // Set a timeout for reading the stream
      const timeout = 6000000; // 6000 seconds timeout
      const startTime = Date.now();

      // 添加进度反馈
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'image.stream.processing',
            titleArgs: { prompt: query },
          },
        },
        config,
      );

      // 生成任务ID
      taskId = `task_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;

      // 发送排队消息
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: '排队中',
            titleArgs: { taskId },
          },
        },
        config,
      );

      // 进度追踪
      let lastProgressPercentage = 0;
      const _progressUpdateCount = 0;
      // 定义更细致的进度检查点，类似API示例中的进度格式
      const progressCheckpoints = [
        { time: 2, percentage: 0, message: '排队中' },
        { time: 5, percentage: 5, message: '生成中' },
        { time: 8, percentage: 14, message: `进度 14% ${this.createProgressBar(14)}` },
        { time: 13, percentage: 23, message: `进度 23% ${this.createProgressBar(23)}` },
        { time: 18, percentage: 39, message: `进度 39% ${this.createProgressBar(39)}` },
        { time: 25, percentage: 48, message: `进度 48% ${this.createProgressBar(48)}` },
        { time: 32, percentage: 56, message: `进度 56% ${this.createProgressBar(56)}` },
        { time: 39, percentage: 64, message: `进度 64% ${this.createProgressBar(64)}` },
        { time: 45, percentage: 74, message: `进度 74% ${this.createProgressBar(74)}` },
        { time: 52, percentage: 83, message: `进度 83% ${this.createProgressBar(83)}` },
        { time: 58, percentage: 95, message: `进度 95% ${this.createProgressBar(95)}` },
      ];

      // 收集进度信息用于最终显示
      progressHistory.push(`ID: \`${taskId}\``);
      progressHistory.push('排队中.');

      // 为定时更新进度设置间隔
      progressInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

        // 根据已经过的时间找到合适的进度检查点
        for (const checkpoint of progressCheckpoints) {
          if (elapsedSeconds >= checkpoint.time && lastProgressPercentage < checkpoint.percentage) {
            lastProgressPercentage = checkpoint.percentage;

            // 发出进度事件
            const progressBar = this.createProgressBar(checkpoint.percentage);
            this.emitEvent(
              {
                event: 'log',
                log: {
                  key: checkpoint.message,
                  titleArgs: {
                    percentage: checkpoint.percentage.toString(),
                    message: `${checkpoint.message}`,
                    progressBar: progressBar,
                    taskId,
                  },
                },
              },
              config,
            );

            // 添加进度到历史记录
            progressHistory.push(checkpoint.message);

            break;
          }
        }

        // 如果已经找到了图片URL，则停止进度更新
        if (imageUrl) {
          clearInterval(progressInterval);
        }
      }, 1000); // 每秒检查一次进度

      while (!done && Date.now() - startTime < timeout) {
        const result = await reader.read();
        done = result.done;

        if (!done && result.value) {
          const chunk = decoder.decode(result.value, { stream: true });
          fullResponse += chunk;

          // 尝试从响应中提取进度信息 - 保留原有的逻辑作为备份
          const progressMatch = chunk.match(/进度\s*(\d+)%/);
          if (progressMatch?.[1]) {
            const currentProgress = Number.parseInt(progressMatch[1], 10);
            if (currentProgress > lastProgressPercentage) {
              lastProgressPercentage = currentProgress;

              const progressMessage = `进度 ${currentProgress}% ${this.createProgressBar(currentProgress)}`;
              // 记录实际API返回的进度
              progressHistory.push(progressMessage);

              this.emitEvent(
                {
                  event: 'log',
                  log: {
                    key: progressMessage,
                    titleArgs: {
                      percentage: currentProgress.toString(),
                      message: progressMessage,
                      taskId,
                    },
                  },
                },
                config,
              );
            }
          }

          // Try to extract image URL and gen_id from accumulated response
          const urlMatch = fullResponse.match(/!\[.*?\]\((https:\/\/.*?)\)/);
          if (urlMatch?.[1] && !imageUrl) {
            imageUrl = urlMatch[1];
            console.log('Found image URL:', imageUrl);
            // 记录完成状态
            const completeMessage = '生成完成 ✅';
            progressHistory.push(completeMessage);

            this.emitEvent(
              {
                event: 'log',
                log: {
                  key: 'image.url.found',
                  titleArgs: { url: imageUrl },
                },
              },
              config,
            );

            // 当找到图片URL时，发送100%完成的进度
            this.emitEvent(
              {
                event: 'log',
                log: {
                  key: completeMessage,
                  titleArgs: {
                    taskId,
                    elapsedTime: Math.floor((Date.now() - startTime) / 1000).toString(),
                  },
                },
              },
              config,
            );

            // 优化提取gen_id的正则表达式，匹配API响应中可能的gen_id格式
            const genIdMatch =
              fullResponse.match(/gen_id:\s*[`'"]([^`'"]+)[`'"]/i) ||
              fullResponse.match(/gen_id[`'":\s]+([a-zA-Z0-9_]+)/i) ||
              fullResponse.match(/[`'"]gen_id[`'"]\s*:\s*[`'"]([^`'"]+)[`'"]/i);

            if (genIdMatch?.[1] && !genId) {
              genId = genIdMatch[1];

              // 确保gen_id格式正确，应该是以gen_开头的字符串
              if (!genId.startsWith('gen_')) {
                genId = `gen_${genId}`;
              }

              console.log('Found gen_id:', genId);
              // 记录gen_id信息
              const genIdMessage = `图像ID(gen_id): \`${genId}\``;
              progressHistory.push(genIdMessage);

              this.emitEvent(
                {
                  event: 'log',
                  log: {
                    key: genIdMessage,
                    titleArgs: { genId: genId },
                  },
                },
                config,
              );

              // 额外打印出完整响应的一部分，便于调试
              console.log(
                'Response excerpt for gen_id debugging:',
                fullResponse.length > 500
                  ? fullResponse.substring(fullResponse.length - 500)
                  : fullResponse,
              );
            }
          }

          // 尝试更进一步查找gen_id，如果还没找到
          if (!genId) {
            // 使用更多正则表达式模式尝试匹配gen_id
            const genIdPatterns = [
              /gen_id: `(.*?)`/,
              /gen_id:\s*`(.*?)`/,
              /gen_id:\s*["'`](.*?)["'`]/,
              /gen_id\s*[:=]\s*["'`](.*?)["'`]/,
              /["'`](gen_[\w\d]+)["'`]/,
              /> gen_id: `([^`]+)`/,
              /gen_id[^a-zA-Z0-9_]+(gen_[a-zA-Z0-9_]+)/i,
            ];

            for (const pattern of genIdPatterns) {
              const match = fullResponse.match(pattern);
              if (match?.[1]) {
                genId = match[1];
                console.log('Found gen_id with alternative pattern:', genId);

                // 记录gen_id信息
                const genIdMessage = `图像ID(gen_id): \`${genId}\``;
                progressHistory.push(genIdMessage);

                this.emitEvent(
                  {
                    event: 'log',
                    log: {
                      key: genIdMessage,
                      titleArgs: { genId: genId },
                    },
                  },
                  config,
                );

                // 打印找到gen_id的上下文
                const matchIndex = fullResponse.indexOf(match[0]);
                const contextStart = Math.max(0, matchIndex - 50);
                const contextEnd = Math.min(fullResponse.length, matchIndex + match[0].length + 50);
                console.log('gen_id context:', fullResponse.substring(contextStart, contextEnd));

                break;
              }
            }
          }

          // If we have both URL and gen_id, we can stop reading
          if (imageUrl && genId) {
            break;
          }
        }
      }

      // 清理定时器以防内存泄漏
      clearInterval(progressInterval);

      // 检查是否超时
      if (Date.now() - startTime >= timeout) {
        const errorMessage = '处理响应超时，请稍后重试';
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: 'image.timeout',
              titleArgs: { timeout: (timeout / 1000).toString() },
            },
          },
          config,
        );
        throw new Error(errorMessage);
      }

      // If we couldn't find the image URL or gen_id in the response
      if (!imageUrl) {
        // 尝试使用多种正则表达式模式
        const alternativeUrlPatterns = [
          /!\[.*?\]\((https:\/\/.*?)\)/,
          /(https:\/\/.*?\.(?:png|jpg|jpeg|gif|webp))/i,
          /"url":\s*"(https:\/\/.*?)"/,
        ];

        for (const pattern of alternativeUrlPatterns) {
          const match = fullResponse.match(pattern);
          if (match?.[1]) {
            imageUrl = match[1];
            this.emitEvent(
              {
                event: 'log',
                log: {
                  key: 'image.url.found.alternative',
                  titleArgs: { url: imageUrl },
                },
              },
              config,
            );
            break;
          }
        }

        if (!imageUrl) {
          const errorMessage = '无法从响应中提取图像URL';
          this.emitEvent(
            {
              event: 'log',
              log: {
                key: 'image.url.missing',
                titleArgs: { responseLength: fullResponse.length.toString() },
              },
            },
            config,
          );
          throw new Error(errorMessage);
        }
      }

      // Create artifact for the image
      const imageTitle = `生成图像: ${query.substring(0, 30)}${query.length > 30 ? '...' : ''}`;
      const imageId = genImageID();
      const storageKey = `${imageId}-${Date.now()}`;

      const artifact: Artifact = {
        entityId: imageId,
        type: 'document' as ArtifactType,
        title: imageTitle,
        content: '',
        status: 'finish',
        metadata: {
          url: imageUrl,
          prompt: query,
          gen_id: genId || 'unknown',
          model: model,
          ratio: ratio,
          mimeType: 'image/png',
        },
      };

      // Emit the artifact event which will be handled by the system
      this.emitEvent(
        {
          event: 'artifact',
          artifact,
        },
        config,
      );

      // 通知用户图像成功创建
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: '图像成品已创建',
            titleArgs: { title: imageTitle },
          },
        },
        config,
      );

      // 准备节点标题，加入gen_id简短版本便于识别
      let nodeTitle = imageTitle;
      if (genId) {
        const shortGenId = `${genId.substring(0, 10)}...`;
        nodeTitle = `${imageTitle} [ID:${shortGenId}]`;
      }

      // 准备节点数据 - 按照ImageNodeMeta的要求设置
      const nodeData: CanvasNodeData = {
        title: nodeTitle,
        entityId: imageId,
        metadata: {
          imageUrl: imageUrl, // 必需的字段
          imageType: 'png', // 必需的字段
          storageKey: storageKey, // 必需的字段
          showBorder: true,
          showTitle: true,
          sizeMode: 'adaptive',
          prompt: query,
          gen_id: genId || 'unknown',
          model: model,
          ratio: ratio,
          originalWidth: 400, // 添加默认宽度
          style: {}, // 添加空样式对象
          copyableGenId: genId || 'unknown', // 添加一个特殊字段，标记为可复制的ID
        },
      };

      // 创建完整的Canvas节点
      const canvasNode: CanvasNode = {
        type: 'image' as CanvasNodeType,
        data: nodeData,
      };

      // 记录尝试创建节点
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: '创建图像节点',
            titleArgs: { entityId: imageId },
          },
        },
        config,
      );

      // Emit an event to create a new image node in the canvas
      this.emitEvent(
        {
          event: 'create_node',
          node: canvasNode,
        },
        config,
      );

      // 记录节点创建已完成
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: '图像节点已创建',
            titleArgs: { entityId: imageId },
          },
        },
        config,
      );

      // 创建一个特殊的复制ID事件，方便用户复制gen_id
      // 仅在确实找到了gen_id时才显示
      if (genId && genId !== 'unknown') {
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: '✅ 图像ID',
              titleArgs: { genId: genId },
            },
          },
          config,
        );

        // 显示可复制的gen_id，独立一行并添加提示
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: `\`${genId}\` (点击可复制)`,
              titleArgs: { genId: genId },
            },
          },
          config,
        );
      } else {
        // 如果未找到gen_id，提示用户
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: '⚠️ 未能提取出图像ID，但图像已成功生成',
              titleArgs: {},
            },
          },
          config,
        );
      }

      // Try to create an AI message with multimodal content
      try {
        // 创建包含进度信息的内容
        const progressInfo = `${progressHistory.join('\n')}\n\n`;

        // 仅在找到有效的gen_id时才显示gen_id部分
        const genIdSection =
          genId && genId !== 'unknown'
            ? `
-----------------------------
📋 **可复制的图像ID：**
\`${genId}\`
-----------------------------
`
            : '';

        // Create an AI message with the image content
        const aiMessage = new AIMessage({
          content: [
            {
              type: 'text',
              text: progressInfo,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: `\n\n**生成的图像**\n\n提示词: ${query}\n\n${genId && genId !== 'unknown' ? `图像ID: \`${genId}\`` : ''}\n\n您可以${genId && genId !== 'unknown' ? '复制上方带反引号的图像ID(gen_id)，在"生成ID"字段中填入此ID并提供新的提示词来修改此图像' : '在生成图像后获取图像ID用于后续编辑'}。\n\n${genIdSection}\n\n注意: 如果图像未显示在画板中，请检查网络连接或刷新页面。`,
            },
          ],
        });

        return { messages: [aiMessage] };
      } catch (error) {
        console.error('Error creating AI message with image:', error);
        // Fallback to system message if AI message creation fails
        const progressInfo = `${progressHistory.join('\n')}\n\n`;

        // 在最后再次强调gen_id，方便用户复制
        const genIdInfo =
          genId && genId !== 'unknown' ? `\n\n复制这个ID来编辑图像：\n\`${genId}\`` : '';

        // 添加一个特殊的gen_id部分
        const genIdSection =
          genId && genId !== 'unknown'
            ? `
-----------------------------
📋 **可复制的图像ID：**
\`${genId}\`
-----------------------------
`
            : '';

        return {
          messages: [
            new SystemMessage(
              `${progressInfo}![${imageTitle}](${imageUrl})\n\n${genId && genId !== 'unknown' ? `生成的图像ID: \`${genId}\`` : ''}${genIdInfo}\n\n提示词: ${query}\n\n您可以${genId && genId !== 'unknown' ? '复制上方带反引号的图像ID(gen_id)，在"生成ID"字段中填入此ID并提供新的提示词来修改此图像' : '在生成图像后获取图像ID用于后续编辑'}。\n\n${genIdSection}\n\n注意: 如果图像未显示在画板中，请检查网络连接或刷新页面。`,
            ),
          ],
        };
      }
    } catch (error) {
      console.error('Image generation error:', error);

      // 清理可能存在的定时器
      if (typeof progressInterval !== 'undefined') {
        clearInterval(progressInterval);
      }

      // 添加错误信息到进度历史
      if (typeof progressHistory !== 'undefined') {
        progressHistory.push(`生成失败 ❌: ${error.message}`);
      }

      // Handle errors
      this.emitEvent(
        {
          event: 'error',
          error: error.message || 'Unknown error during image generation',
        },
        config,
      );

      return {
        messages: [
          new SystemMessage(
            `${progressHistory ? `${progressHistory.join('\n')}\n\n` : ''}图像生成错误: ${error.message}\n\n可能的解决方法:\n1. 检查API密钥是否有效\n2. 确认网络连接正常\n3. 简化提示词\n4. 检查API服务是否可用`,
          ),
        ],
      };
    }
  }

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('generateImage', this.generateImage.bind(this))
      .addEdge(START, 'generateImage')
      .addEdge('generateImage', END);

    return workflow.compile();
  }
}
