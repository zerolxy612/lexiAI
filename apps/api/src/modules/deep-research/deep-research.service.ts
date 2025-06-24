import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject, Observable } from 'rxjs';
import { GoogleSearchService, SearchResult } from './google-search.service';
import { DeepResearchRequestDto } from './dto/deep-research-request.dto';
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

  // Keywords for intelligent model selection
  private readonly legalKeywords = [
    '法律',
    '法规',
    '条例',
    '判决',
    '案例',
    '诉讼',
    '合同',
    '协议',
    '法院',
    '律师',
    '法条',
    '司法',
    '法务',
    '法理',
    '判例',
    '起诉',
    '辩护',
    '仲裁',
    '调解',
    'legal',
    'law',
    'case',
    'court',
    'contract',
    'lawsuit',
    'attorney',
    'judge',
  ];

  private readonly codeKeywords = [
    '代码',
    '编程',
    '程序',
    '开发',
    '算法',
    '函数',
    '类',
    '方法',
    '变量',
    '数据库',
    '前端',
    '后端',
    'API',
    'bug',
    '调试',
    '测试',
    '框架',
    '库',
    '编译',
    '部署',
    'code',
    'programming',
    'development',
    'algorithm',
    'function',
    'class',
    'method',
    'variable',
    'database',
    'frontend',
    'backend',
    'debug',
    'test',
    'framework',
  ];

  // Stage configurations for three-stage deep research
  private readonly stageConfigs: StageConfig[] = [
    {
      name: 'Basic Analysis',
      querySuffix: '基础分析',
      description: 'Provide core answers and fundamental analysis',
    },
    {
      name: 'Extended Analysis',
      querySuffix: '拓展分析',
      description: 'Offer comprehensive background and related information',
    },
    {
      name: 'Deep Analysis',
      querySuffix: '深度剖析',
      description: 'Analyze complex relationships and potential impacts',
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly googleSearchService: GoogleSearchService,
    private readonly hkgaiClientFactory: HKGAIClientFactory,
  ) {
    this.logger.log('DeepResearchService initialized');
    this.logger.log(`Using intelligent model selection for deep research analysis`);
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
   * Intelligently select the best model based on query content
   * @param query - The user's query
   * @returns The selected model name
   */
  private selectModelForQuery(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Check for legal-related keywords
    const hasLegalKeywords = this.legalKeywords.some((keyword) =>
      lowerQuery.includes(keyword.toLowerCase()),
    );

    // Check for code-related keywords
    const hasCodeKeywords = this.codeKeywords.some((keyword) =>
      lowerQuery.includes(keyword.toLowerCase()),
    );

    let selectedModel = 'RAG'; // Default model

    if (hasLegalKeywords && !hasCodeKeywords) {
      selectedModel = 'CaseSearch';
      this.logger.log(`Selected CaseSearch model for legal query: "${query.substring(0, 50)}..."`);
    } else if (hasCodeKeywords && !hasLegalKeywords) {
      selectedModel = 'CodeSearch';
      this.logger.log(`Selected CodeSearch model for coding query: "${query.substring(0, 50)}..."`);
    } else if (hasLegalKeywords && hasCodeKeywords) {
      // If query has both legal and code keywords, prefer CaseSearch
      selectedModel = 'CaseSearch';
      this.logger.log(
        `Selected CaseSearch model for mixed legal/code query: "${query.substring(0, 50)}..."`,
      );
    } else {
      this.logger.log(
        `Selected default RAG model for general query: "${query.substring(0, 50)}..."`,
      );
    }

    return selectedModel;
  }

  /**
   * Generate streaming deep research response for a single stage
   * This is the main entry point, now processing one stage per call.
   */
  generateStream(request: DeepResearchRequestDto): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.logger.log(`Starting generateStream for query: "${request.query}"`);
    this.processAllStages(request, subject).catch((error) => {
      this.logger.error(`Unhandled error in processAllStages: ${error.message}`, error.stack);
      const errorEvent = this.createErrorEvent(
        `Critical error during processing: ${error.message}`,
      );
      subject.next(errorEvent);
      subject.complete();
    });
    this.logger.log(`Returning observable from generateStream.`);
    return subject.asObservable();
  }

  /**
   * Process all stages of research in a loop
   * @param request - Original request
   * @param subject - RxJS subject for streaming SSE events
   */
  private async processAllStages(request: DeepResearchRequestDto, subject: Subject<MessageEvent>) {
    const { query, messages } = request;
    const allStagesAiContent: string[] = [];

    this.logger.log(`>>>>> ENTERING processAllStages for query: "${query}"`);

    for (let stage = 0; stage < this.stageConfigs.length; stage++) {
      const stageConfig = this.stageConfigs[stage];
      const stageName = stageConfig.name;

      this.logger.log(`[Stage ${stage}] Processing: ${stageName}`);

      try {
        subject.next(
          this.createEvent('stage_start', {
            type: 'stage_start',
            stage,
            stageName,
          }),
        );

        const enhancedQuery = this.buildSearchQuery(query, stage);
        this.logger.debug(`[Stage ${stage}] Built enhanced search query: "${enhancedQuery}"`);
        let searchResults: SearchResult[] = [];

        try {
          searchResults = await this.googleSearchService.search(enhancedQuery);
          this.logger.debug(
            `[Stage ${stage}] googleSearchService returned ${
              searchResults.length
            } results. First result: ${JSON.stringify(searchResults[0])}`,
          );
        } catch (searchError) {
          this.logger.warn(
            `[Stage ${stage}] Google search failed, continuing without search results: ${searchError.message}`,
          );
          // Proceed without search results
        }

        const searchCompleteEventData = {
          type: 'search_complete',
          stage,
          stageData: {
            stage,
            stageName,
            searchQuery: enhancedQuery,
            searchResults,
            aiContent: '',
            timestamp: new Date().toISOString(),
          },
        };
        this.logger.debug(
          `[Stage ${stage}] Sending 'search_complete' event with data: ${JSON.stringify(
            searchCompleteEventData,
            null,
            2,
          )}`,
        );
        subject.next(this.createEvent('search_complete', searchCompleteEventData));

        const isFinalStage = stage === this.stageConfigs.length - 1;
        const systemPrompt = isFinalStage
          ? this.buildFinalStagePrompt(searchResults, enhancedQuery, allStagesAiContent)
          : this.buildSystemPrompt(searchResults, enhancedQuery);

        this.logger.log(`[Stage ${stage}] Preparing to call AI model...`);

        const selectedModel = this.selectModelForQuery(query);
        const aiContent = await this.callAIModelWithStreaming(
          systemPrompt,
          query,
          messages || [],
          subject,
          stage,
          selectedModel,
        );

        allStagesAiContent.push(aiContent);

        subject.next(
          this.createEvent('stage_complete', {
            type: 'stage_complete',
            stage, // send stage number in the event
            stageData: {
              stage,
              stageName,
              searchQuery: enhancedQuery,
              searchResults,
              aiContent,
              timestamp: new Date().toISOString(),
            },
          }),
        );
        this.logger.log(`[Stage ${stage}] Completed: ${stageName}`);
      } catch (error) {
        this.logger.error(`[Stage ${stage}] CRITICAL ERROR in stage:`, error.stack);
        const errorMessage = `Stage ${stage} (${stageName}) failed: ${error.message}`;
        subject.next(this.createErrorEvent(errorMessage));
        // We stop further processing if one stage fails
        subject.complete();
        this.logger.error(`<<<<< ERRORED and STOPPED processAllStages at stage ${stage}`);
        return;
      }
    }

    // After all stages are complete
    subject.next(this.createEvent('complete', { type: 'complete' }));
    subject.complete();
    this.logger.log(`<<<<< COMPLETED processAllStages for query: "${query}"`);
  }

  /**
   * Build search query with stage-specific suffix
   * Core logic from Spring Boot ChatService
   */
  private buildSearchQuery(originalQuery: string, stage: number): string {
    this.logger.log(`Building search query for stage ${stage}`);
    const stageConfig = this.stageConfigs[stage];
    if (stageConfig) {
      return `${originalQuery} ${stageConfig.querySuffix}`;
    }
    return originalQuery;
  }

  /**
   * Build system prompt with search results
   * Based on Spring Boot buildSystemMessage method
   */
  private buildSystemPrompt(searchResults: SearchResult[], query: string): string {
    const resultsText =
      searchResults?.length > 0
        ? searchResults
            .map((r) => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`)
            .join('\n\n')
        : 'No search results found.';

    return `You are a professional AI assistant. Please answer the user's question based on the following web search results.
Search Query: ${query}
Search Results:
${resultsText}

Please provide an accurate and detailed answer in the same language as the user's query.`;
  }

  private buildFinalStagePrompt(
    searchResults: SearchResult[],
    query: string,
    previousStagesContent: string[],
  ): string {
    const resultsText =
      searchResults?.length > 0
        ? searchResults
            .map((r) => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`)
            .join('\n\n')
        : 'No search results found.';

    const previousSummaries =
      previousStagesContent.length > 0
        ? previousStagesContent
            .map(
              (content, index) => `
---
## Summary from Stage ${index + 1} (${this.stageConfigs[index].name})
${content}
---
`,
            )
            .join('\n')
        : 'No previous analysis available.';

    return `You are an expert-level AI research analyst. Your final task is to synthesize information from multiple research stages into a single, comprehensive, and well-structured report.

### Primary Task: Deep Analysis
First, based on the LATEST search results provided below, perform a deep analysis of the user's query.
- User Query for this stage: "${query}"
- Latest Search Results:
${resultsText}

### Context: Summaries from Previous Stages
Next, carefully review the summaries from the previous research stages. This context is crucial for your final report.
${previousSummaries}

### Final Instruction: Synthesize and Generate Comprehensive Report
Your most important task is to integrate everything. Combine your deep analysis from the latest search results with the context from the previous summaries. Generate a final, insightful, and coherent report. The report should be well-organized, easy to read, and directly address the user's original question in depth, providing a holistic view of the topic. Ensure your output is in the same language as the user's query.`;
  }

  /**
   * Call AI model with streaming response
   * @param systemPrompt - Enhanced system prompt with search results
   * @param query - Main search query
   * @param messages - Previous conversation messages
   * @param subject - RxJS subject for streaming SSE events
   * @param stage - The current stage number
   * @param modelName - The selected model name (RAG, CaseSearch, or CodeSearch)
   * @returns Complete AI response content
   */
  private callAIModelWithStreaming(
    systemPrompt: string,
    query: string,
    messages: any[],
    subject: Subject<MessageEvent>,
    stage: number,
    modelName: string = 'RAG',
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let fullContent = '';
      try {
        let finalMessages = messages;
        if (!finalMessages || finalMessages.length === 0) {
          this.logger.warn(
            `[Stage ${stage}] The 'messages' array is empty. Using the main 'query' as the user message.`,
          );
          finalMessages = [{ role: 'user', content: query }];
        }

        const enhancedMessages = [{ role: 'system', content: systemPrompt }, ...finalMessages];

        this.logger.debug(
          `[Stage ${stage}] Final messages being sent to AI: ${JSON.stringify(enhancedMessages)}`,
        );

        this.logger.log(`[Stage ${stage}] Using model: ${modelName} for AI completion`);
        const responseStream = await this.hkgaiClientFactory.createChatCompletion(
          modelName,
          enhancedMessages,
          { stream: true },
        );

        // Determine if this is a Dify model (CaseSearch or CodeSearch)
        const isDifyModel = modelName === 'CaseSearch' || modelName === 'CodeSearch';

        for await (const chunk of responseStream) {
          const lines = chunk
            .toString('utf8')
            .split('\n')
            .filter((line) => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(5).trim();

              if (dataStr === '[DONE]') {
                this.logger.log(`[Stage ${stage}] AI response stream finished.`);
                resolve(fullContent);
                return;
              }

              try {
                const parsedData = JSON.parse(dataStr);
                let delta = '';

                if (isDifyModel) {
                  // Handle Dify format
                  this.logger.debug(`[Stage ${stage}] Processing Dify event: ${parsedData.event}`);

                  if (parsedData.event === 'message' && parsedData.answer) {
                    // Complete message response
                    delta = parsedData.answer;
                    this.logger.log(
                      `[Stage ${stage}] Dify message event - answer length: ${delta.length}, content preview: "${delta.substring(0, 50)}..."`,
                    );
                  } else if (parsedData.event === 'message_stream' && parsedData.content) {
                    // Streaming message content
                    delta = parsedData.content;
                    this.logger.log(
                      `[Stage ${stage}] Dify message_stream - content length: ${delta.length}, content: "${delta}"`,
                    );
                  } else if (parsedData.event === 'agent_message' && parsedData.answer) {
                    // Agent message response
                    delta = parsedData.answer;
                    this.logger.log(
                      `[Stage ${stage}] Dify agent_message - answer length: ${delta.length}, content preview: "${delta.substring(0, 50)}..."`,
                    );
                  } else if (parsedData.event === 'node_finished') {
                    // Node finished event - extract content from outputs
                    if (parsedData.data?.outputs?.text) {
                      delta = parsedData.data.outputs.text;
                      this.logger.log(
                        `[Stage ${stage}] Dify node_finished - text output length: ${delta.length}, content preview: "${delta.substring(0, 100)}..."`,
                      );
                    } else if (parsedData.data?.outputs?.answer) {
                      delta = parsedData.data.outputs.answer;
                      this.logger.log(
                        `[Stage ${stage}] Dify node_finished - answer output length: ${delta.length}, content preview: "${delta.substring(0, 100)}..."`,
                      );
                    } else {
                      this.logger.debug(
                        `[Stage ${stage}] Dify node_finished - no text/answer output found, data: ${JSON.stringify(parsedData.data?.outputs || {})}`,
                      );
                    }
                  } else if (parsedData.event === 'workflow_finished') {
                    // Workflow finished event - extract content and end stream
                    if (parsedData.data?.outputs?.text) {
                      delta = parsedData.data.outputs.text;
                      this.logger.log(
                        `[Stage ${stage}] Dify workflow_finished - text output length: ${delta.length}, content preview: "${delta.substring(0, 100)}..."`,
                      );
                    } else if (parsedData.data?.outputs?.answer) {
                      delta = parsedData.data.outputs.answer;
                      this.logger.log(
                        `[Stage ${stage}] Dify workflow_finished - answer output length: ${delta.length}, content preview: "${delta.substring(0, 100)}..."`,
                      );
                    }
                    // Add the final content and end the stream
                    if (delta) {
                      fullContent += delta;
                      subject.next(
                        this.createEvent('ai_response', {
                          type: 'ai_response',
                          stage,
                          content: delta,
                        }),
                      );
                    }
                    this.logger.log(
                      `[Stage ${stage}] Dify workflow finished. Total content length: ${fullContent.length}`,
                    );
                    resolve(fullContent);
                    return;
                  } else if (parsedData.event === 'message_end') {
                    // End of message
                    this.logger.log(
                      `[Stage ${stage}] Dify message stream ended. Total content length: ${fullContent.length}`,
                    );
                    resolve(fullContent);
                    return;
                  }
                } else {
                  // Handle OpenAI format (RAG model)
                  delta = parsedData.choices?.[0]?.delta?.content || '';
                }

                if (delta) {
                  // Don't stream thinking blocks
                  if (
                    delta.includes(this.thinkingStartFlag) ||
                    delta.includes(this.thinkingEndFlag)
                  ) {
                    continue;
                  }

                  // Ensure we only stream actual text content, not stringified JSON objects
                  if (typeof delta === 'string') {
                    // Check if the string is not a JSON object
                    let isJsonObject = false;
                    try {
                      JSON.parse(delta);
                      isJsonObject = true;
                    } catch (e) {
                      // Not a JSON object, which is what we want
                    }

                    if (!isJsonObject) {
                      fullContent += delta;
                      this.logger.log(
                        `[Stage ${stage}] Sending AI content to frontend: "${delta}" (length: ${delta.length})`,
                      );
                      subject.next(
                        this.createEvent('ai_response', {
                          type: 'ai_response',
                          stage,
                          content: delta,
                        }),
                      );
                    } else {
                      this.logger.warn(
                        `[Stage ${stage}] Skipping JSON object delta: ${delta.substring(0, 100)}`,
                      );
                    }
                  }
                }
              } catch (e) {
                // Only log as warning for now, as Dify sends many metadata events
                this.logger.warn(
                  `[Stage ${stage}] Failed to parse AI stream data chunk: ${dataStr.substring(0, 200)}...`,
                );
              }
            }
          }
        }
        this.logger.log(`[Stage ${stage}] Completed consuming AI stream.`);
        resolve(fullContent);
      } catch (error) {
        this.logger.error(
          `[Stage ${stage}] Error in callAIModelWithStreaming: ${error.message}`,
          error.stack,
        );
        reject(error);
      }
    });
  }

  private getStageName(stage: number): string {
    if (stage >= 0 && stage < this.stageConfigs.length) {
      return this.stageConfigs[stage].name;
    }
    return 'Unknown Stage';
  }

  private createEvent(type: string, data: any): MessageEvent {
    return {
      data: JSON.stringify({ ...data, type }),
    } as MessageEvent;
  }

  private createErrorEvent(message: string): MessageEvent {
    return {
      data: JSON.stringify({ type: 'error', error: message }),
    } as MessageEvent;
  }
}
