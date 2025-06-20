import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';
import { GoogleSearchService } from './google-search.service';
import { DeepResearchRequestDto } from './dto/deep-research-request.dto';
import {
  DeepResearchResponseDto,
  SearchResultDto,
  DeepResearchStageDto,
} from './dto/deep-research-response.dto';
import { HKGAIClientFactory } from '../../utils/llm/hkgai-client-factory';

interface StageConfig {
  name: string;
  querySuffix: string;
  description: string;
}

@Injectable()
export class DeepResearchService {
  private readonly logger = new Logger(DeepResearchService.name);
  private readonly thinkingStartFlag: string;
  private readonly thinkingEndFlag: string;

  // Three-stage configuration based on Spring Boot logic
  private readonly stageConfigs: StageConfig[] = [
    {
      name: '基础分析',
      querySuffix: '',
      description: 'Initial analysis of the topic',
    },
    {
      name: '拓展分析',
      querySuffix: '，拓展',
      description: 'Extended analysis with broader context',
    },
    {
      name: '深度剖析',
      querySuffix: '，深度剖析',
      description: 'Deep dive analysis with comprehensive insights',
    },
  ];

  constructor(
    private readonly googleSearchService: GoogleSearchService,
    private readonly configService: ConfigService,
    private readonly hkgaiClientFactory: HKGAIClientFactory,
  ) {
    this.thinkingStartFlag = this.configService.get<string>(
      'LAS_OPENAI_CHAT_RESPONSE_THINKING_START_FLAG',
      '<think>',
    );
    this.thinkingEndFlag = this.configService.get<string>(
      'LAS_OPENAI_CHAT_RESPONSE_THINKING_END_FLAG',
      '</think>',
    );
  }

  /**
   * Generate streaming deep research response
   * This is the main entry point for three-stage retrieval
   */
  generateStream(request: DeepResearchRequestDto): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    // Execute the three-stage process asynchronously
    this.processThreeStages(request, subject).catch((error) => {
      this.logger.error('Error in three-stage processing:', error);
      subject.next(this.createErrorEvent(error.message || 'Unknown error occurred'));
      subject.complete();
    });

    return subject.asObservable();
  }

  /**
   * Core method: Process all three stages of deep research
   * Based on Spring Boot ChatService.generateStream logic
   */
  private async processThreeStages(
    request: DeepResearchRequestDto,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    try {
      this.logger.log(`Starting three-stage deep research for query: "${request.query}"`);

      // Process each stage sequentially
      for (let stage = 0; stage < 3; stage++) {
        await this.processStage(request, stage, subject);
      }

      // Send completion event
      subject.next(
        this.createEvent('complete', {
          type: 'complete',
          progress: {
            currentStage: 3,
            totalStages: 3,
            percentage: 100,
          },
        }),
      );

      subject.complete();
      this.logger.log('Three-stage deep research completed successfully');
    } catch (error) {
      this.logger.error('Error in three-stage processing:', error);
      subject.next(this.createErrorEvent(error.message));
      subject.complete();
    }
  }

  /**
   * Process a single stage of research
   * @param request - Original request
   * @param stage - Current stage (0, 1, 2)
   * @param subject - RxJS subject for streaming
   */
  private async processStage(
    request: DeepResearchRequestDto,
    stage: number,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    const stageConfig = this.stageConfigs[stage];
    const timestamp = new Date();

    this.logger.log(`Processing stage ${stage}: ${stageConfig.name}`);

    // Send stage start event
    subject.next(
      this.createEvent('stage_start', {
        type: 'stage_start',
        progress: {
          currentStage: stage,
          totalStages: 3,
          percentage: Math.round((stage / 3) * 100),
        },
        stageData: {
          stage,
          stageName: stageConfig.name,
          searchQuery: '',
          searchResults: [],
          aiContent: '',
          timestamp,
        },
      }),
    );

    try {
      // Step 1: Build enhanced search query (key logic from Spring Boot)
      const enhancedQuery = this.buildSearchQuery(request.query, stage);

      // Step 2: Perform Google search
      let searchResults: SearchResultDto[] = [];
      if (request.search !== false) {
        this.logger.debug(`Searching with enhanced query: "${enhancedQuery}"`);
        searchResults = await this.googleSearchService.search(enhancedQuery, {
          num: 8, // Get more results for better context
          language: 'zh-CN',
        });

        // Send search complete event
        subject.next(
          this.createEvent('search_complete', {
            type: 'search_complete',
            stageData: {
              stage,
              stageName: stageConfig.name,
              searchQuery: enhancedQuery,
              searchResults,
              aiContent: '',
              timestamp,
            },
          }),
        );
      }

      // Step 3: Build system prompt with search results
      const systemPrompt = this.buildSystemPrompt(searchResults, enhancedQuery);

      // Step 4: Call AI model and stream response
      const aiContent = await this.callAIModelWithStreaming(
        systemPrompt,
        request.messages || [],
        subject,
        stage,
      );

      // Step 5: Send stage complete event
      const stageData: DeepResearchStageDto = {
        stage,
        stageName: stageConfig.name,
        searchQuery: enhancedQuery,
        searchResults,
        aiContent,
        timestamp,
      };

      subject.next(
        this.createEvent('stage_complete', {
          type: 'stage_complete',
          stageData,
          progress: {
            currentStage: stage + 1,
            totalStages: 3,
            percentage: Math.round(((stage + 1) / 3) * 100),
          },
        }),
      );

      this.logger.log(`Stage ${stage} completed successfully`);
    } catch (error) {
      this.logger.error(`Error in stage ${stage}:`, error);

      // Try to continue with next stage even if current stage fails
      subject.next(
        this.createEvent('stage_complete', {
          type: 'stage_complete',
          error: `Stage ${stage} failed: ${error.message}`,
          stageData: {
            stage,
            stageName: stageConfig.name,
            searchQuery: '',
            searchResults: [],
            aiContent: `Error in stage ${stage}: ${error.message}`,
            timestamp,
          },
        }),
      );
    }
  }

  /**
   * Build search query with stage-specific suffix
   * Core logic from Spring Boot ChatService
   */
  private buildSearchQuery(originalQuery: string, stage: number): string {
    const stageConfig = this.stageConfigs[stage];
    return originalQuery + stageConfig.querySuffix;
  }

  /**
   * Build system prompt with search results
   * Based on Spring Boot buildSystemMessage method
   */
  private buildSystemPrompt(searchResults: SearchResultDto[], query: string): string {
    if (!searchResults || searchResults.length === 0) {
      return '你是一个专业的AI助手，请根据你的知识回答用户问题。';
    }

    const builder: string[] = [];

    builder.push('你是一个专业的AI助手。请基于以下网络搜索结果回答用户问题。\n\n');
    builder.push(`搜索查询: ${query}\n`);
    builder.push('搜索结果:\n');

    searchResults.forEach((result, index) => {
      builder.push(`${index + 1}. 标题: ${result.title}\n`);
      builder.push(`   链接: ${result.link}\n`);
      builder.push(`   摘要: ${result.snippet}\n\n`);
    });

    builder.push(
      '请基于以上搜索结果，用中文提供准确、详细的回答。如果搜索结果不足以回答问题，请说明并提供你的专业建议。\n\n',
    );
    builder.push('重要说明：\n');
    builder.push('1. 请将你的思考过程放在 <think></think> 标签中\n');
    builder.push('2. 在思考过程中可以引用搜索结果的链接\n');
    builder.push('3. 最终回答应该综合分析所有相关信息\n');

    return builder.join('');
  }

  /**
   * Call AI model with streaming response
   * @param systemPrompt - Enhanced system prompt with search results
   * @param messages - Previous conversation messages
   * @param subject - RxJS subject for streaming
   * @param stage - Current stage number
   * @returns Complete AI response content
   */
  private async callAIModelWithStreaming(
    systemPrompt: string,
    messages: any[],
    subject: Subject<MessageEvent>,
    stage: number,
  ): Promise<string> {
    try {
      // Prepare messages with system prompt
      const enhancedMessages = [{ role: 'system', content: systemPrompt }, ...messages];

      // Call HKGAI API using the General model
      const response = await this.hkgaiClientFactory.createChatCompletion(
        'General', // Use the General model from HKGAIModelName enum
        enhancedMessages,
        {
          temperature: 0.7,
          stream: false, // For now, disable streaming
        },
      );

      // Extract content from HKGAI response
      let content = '';
      try {
        if (response && response.choices && response.choices[0] && response.choices[0].message) {
          content = response.choices[0].message.content || '';
        } else if (typeof response === 'string') {
          content = response;
        } else {
          content = 'AI model returned empty response';
          this.logger.warn('Unexpected response format from HKGAI:', response);
        }
      } catch (parseError) {
        this.logger.warn('Failed to parse AI response, using fallback:', parseError);
        content = 'Response parsing failed';
      }

      // Send AI response event
      subject.next(
        this.createEvent('ai_response', {
          type: 'ai_response',
          content,
          progress: {
            currentStage: stage,
            totalStages: 3,
            percentage: Math.round(((stage + 0.8) / 3) * 100),
          },
        }),
      );

      return content;
    } catch (error) {
      this.logger.error('Error calling AI model:', error);
      throw new Error(`AI model call failed: ${error.message}`);
    }
  }

  /**
   * Create a Server-Sent Event
   */
  private createEvent(type: string, data: any): MessageEvent {
    return {
      data: JSON.stringify(data),
      type,
    } as MessageEvent;
  }

  /**
   * Create an error event
   */
  private createErrorEvent(message: string): MessageEvent {
    return this.createEvent('error', {
      type: 'error',
      error: message,
    });
  }

  /**
   * Health check for the service
   */
  async getHealthStatus(): Promise<{
    googleSearch: boolean;
    aiModel: boolean;
    configuration: boolean;
  }> {
    const googleSearchHealth = await this.googleSearchService.testConnection();

    // Test AI model connection
    let aiModelHealth = false;
    try {
      // Test if we can get a client for the General model
      const client = this.hkgaiClientFactory.getClient('General');
      aiModelHealth = !!client;
    } catch (error) {
      this.logger.warn('AI model health check failed:', error);
    }

    const configurationHealth = !!(
      this.configService.get('LAS_SEARCH_GOOGLE_KEY') &&
      this.configService.get('LAS_SEARCH_GOOGLE_CX')
    );

    return {
      googleSearch: googleSearchHealth,
      aiModel: aiModelHealth,
      configuration: configurationHealth,
    };
  }
}
