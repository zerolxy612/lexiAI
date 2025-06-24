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

  // Stage configurations for three-stage deep research
  private readonly stageConfigs: StageConfig[] = [
    {
      name: 'Primary Authorities Search',
      querySuffix: '初级法律权威检索',
      description: 'Search for legally binding primary authorities like statutes and case law.',
    },
    {
      name: 'Secondary Sources Analysis',
      querySuffix: '次级法律权威分析',
      description: 'Analyze secondary sources like law reviews for context and interpretation.',
    },
    {
      name: 'Synthesis and Final Report',
      querySuffix: '非法律资料与综合分析',
      description: 'Synthesize all findings with supplemental sources into a final report.',
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
   * Intelligently select the best model based on query content.
   * For Deep Research, we now force the use of the RAG model.
   * @param query - The user's query (used for logging)
   * @returns The RAG model name
   */
  private selectModelForQuery(query: string): string {
    // The dynamic model selection has been removed to ensure Deep Research always uses the RAG model.
    this.logger.log(`Forcing RAG model for Deep Research query: "${query.substring(0, 50)}..."`);
    return 'hkgai/rag';
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
          this.logger.error(
            `[Stage ${stage}] Google search failed catastrophically: ${searchError.message}`,
            searchError.stack,
          );
          // Stop the process and inform the frontend immediately
          const errorEvent = this.createErrorEvent(
            `Stage ${stage} (${stageName}) failed: Google Search returned an error - ${searchError.message}`,
          );
          subject.next(errorEvent);
          subject.complete(); // End the stream
          return; // Stop further processing
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
          : this.buildSystemPrompt(searchResults, enhancedQuery, stage);

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
  private buildSystemPrompt(searchResults: SearchResult[], query: string, stage: number): string {
    const resultsText =
      searchResults?.length > 0
        ? searchResults
            .map((r) => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`)
            .join('\n\n')
        : 'No search results found.';

    // Stage 0: Primary Authorities
    if (stage === 0) {
      return `You are an AI legal research assistant specializing in identifying primary legal authorities. Your task is to analyze the provided web search results and extract legally binding information relevant to the user's query.

**User Query:** ${query}

**Search Results:**
${resultsText}

**Instructions:**
1.  **Focus exclusively on Primary Authorities:** From the search results, identify and list statutes (成文法), case law (判例法), regulations (行政法规), treaties (条约), and other legally binding documents.
2.  **Be Precise:** For each authority, provide its title, citation (if available), and a brief snippet explaining its relevance to the query.
3.  **Organize the Output:** Group the findings by type (e.g., Statutes, Case Law, Regulations).
4.  **Ignore Other Sources:** Do not include secondary sources (like law reviews, articles) or non-legal materials in this stage.
5.  **Language:** Respond in the same language as the user's query.

Please begin your analysis.`;
    }

    // Stage 1: Secondary Sources
    if (stage === 1) {
      return `You are an AI legal research assistant. In this stage, your focus is on identifying Secondary Sources that provide context and analysis for legal issues. These sources are not legally binding but are crucial for understanding the law.

**User Query:** ${query}

**Search Results:**
${resultsText}

**Instructions:**
1.  **Focus on Secondary Sources:** Identify and summarize materials like law review articles (法律评论文章), legal journals (法律期刊), treatises (法律专著), practice guides (实务指南), and legal commentary from the search results.
2.  **Explain Relevance:** For each source, explain how it helps to understand, interpret, or locate primary legal authorities related to the user's query.
3.  **Summarize Key Arguments:** Briefly describe the main points or arguments presented in each secondary source.
4.  **Do Not Include:** Do not list primary authorities (statutes, cases) or non-legal materials.
5.  **Language:** Respond in the same language as the user's query.

Please proceed with your analysis of secondary sources.`;
    }

    // Fallback for any other stage, though it shouldn't be reached with the current logic.
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

    return `You are an expert-level AI legal analyst. Your final task is to synthesize all research findings into a structured and comprehensive legal research memo. You will integrate the previously identified Primary and Secondary Authorities with new supplemental information, following established legal research standards.

**User's Original Legal Issue:** ${query}

**Context from Previous Research Stages:**
${previousSummaries} 

**Current Task: Analysis of Non-Legal/Supplemental Sources**
First, analyze the latest search results provided below. These may contain non-legal or supplemental information (非法律或辅助性资料) such as news reports, expert opinions, or investigative findings that can provide factual context.

**Latest Search Results (Supplemental Sources):**
${resultsText}

**Final Instruction: Synthesize and Generate a Comprehensive Research Memo**
Your main task is to create a final report that follows this standard legal research methodology:

1.  **Re-state Legal Issue and Goal:** Begin by clearly stating the core legal issue (法律问题) from the user's query and the research objective.
2.  **Applicable Jurisdiction:** Based on the information gathered, identify the likely applicable jurisdiction (司法管辖区).
3.  **Synthesize Authorities:**
    *   **Primary Authorities:** Present the binding legal authorities you found. Distinguish between mandatory (强制性) and persuasive (劝说性) authority. For case law, note its precedential value and verify its current validity (i.e., it's "good law"), if possible from the context.
    *   **Secondary Authorities:** Explain how the secondary sources clarify the legal landscape and interpret the primary authorities.
4.  **Integrate Supplemental Facts:** Weave in relevant facts from the non-legal/supplemental sources to provide context or support legal arguments.
5.  **Analysis and Conclusion:** Combine all information to form a coherent analysis. Structure your arguments and conclude with a well-supported legal opinion or research summary that directly addresses the user's original question.
6.  **Update and Verification Warning:** Conclude the memo with a disclaimer advising that legal standards are dynamic and all cited authorities should be independently verified for their current status.

Produce a well-organized, insightful, and actionable report in the same language as the user's query.`;
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
