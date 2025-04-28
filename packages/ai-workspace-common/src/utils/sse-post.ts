import { InvokeSkillRequest, SkillEvent } from '@refly/openapi-schema';
import { extractBaseResp } from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ConnectionError, AuthenticationExpiredError } from '@refly/errors';
import { refreshToken } from './auth';
import { isDesktop, serverOrigin } from './env';
import { scrollToBottom } from '@refly-packages/ai-workspace-common/utils/ui';
import throttle from 'lodash.throttle';

// 使用 lodash.throttle 创建节流版本的滚动函数
const throttledScrollToBottom = throttle(() => {
  // 使用 requestAnimationFrame 确保在最佳时机执行滚动
  window.requestAnimationFrame(() => {
    scrollToBottom();
  });
}, 300); // 每300ms最多执行一次

const makeSSERequest = async (
  payload: InvokeSkillRequest,
  controller: AbortController,
  isRetry = false,
): Promise<Response> => {
  const response = await fetch(`${serverOrigin}/v1/skill/streamInvoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: isDesktop() ? 'omit' : 'include',
    signal: controller.signal,
    body: JSON.stringify(payload),
  });

  if (response.status === 401 && !isRetry) {
    try {
      await refreshToken();
      return makeSSERequest(payload, controller, true);
    } catch (error) {
      if (error instanceof AuthenticationExpiredError) {
        throw error;
      }
      throw new ConnectionError(error);
    }
  }

  return response;
};

export const ssePost = async ({
  controller,
  payload,
  onSkillLog,
  onSkillStart,
  onSkillStream,
  onSkillEnd,
  onSkillArtifact,
  onSkillStructedData,
  onSkillCreateNode,
  onSkillTokenUsage,
  onSkillError,
  onCompleted,
}: {
  controller: AbortController;
  payload: InvokeSkillRequest;
  onStart: () => void;
  onSkillLog: (event: SkillEvent) => void;
  onSkillStart: (event: SkillEvent) => void;
  onSkillStream: (event: SkillEvent) => void;
  onSkillEnd: (event: SkillEvent) => void;
  onSkillStructedData: (event: SkillEvent) => void;
  onSkillCreateNode: (event: SkillEvent) => void;
  onSkillArtifact: (event: SkillEvent) => void;
  onSkillTokenUsage?: (event: SkillEvent) => void;
  onSkillError?: (event: SkillEvent) => void;
  onCompleted?: (val?: boolean) => void;
}) => {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const response = await makeSSERequest(payload, controller);

    const baseResp = await extractBaseResp(response, { success: true });
    if (!baseResp.success) {
      onSkillError?.({ error: baseResp, event: 'error' });
      return;
    }

    reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let isSkillFirstMessage = true;
    let bufferStr = '';

    // Batch processing variables
    let batchedEvents: SkillEvent[] = [];
    let processingBatch = false;
    const BATCH_SIZE = 15; // Increased from 5 to 15 for better performance
    const BATCH_INTERVAL = 150; // Increased from 100ms to 150ms to reduce update frequency
    let lastProcessTime = 0;
    const THROTTLE_TIMEOUT = 50; // Minimum time between processing batches

    // Process batched events with improved throttling
    const processBatch = () => {
      if (batchedEvents.length === 0 || processingBatch) return;

      const now = performance.now();
      if (now - lastProcessTime < THROTTLE_TIMEOUT && batchedEvents.length < BATCH_SIZE * 2) {
        return; // Skip processing if throttled and not too many events
      }

      processingBatch = true;
      lastProcessTime = now;

      // Process all events in the current batch
      const eventsToProcess = [...batchedEvents];
      batchedEvents = [];

      // Group events by type to optimize processing
      const eventsByType: Record<string, SkillEvent[]> = {};

      for (const event of eventsToProcess) {
        const eventType = event?.event || 'unknown';
        if (!eventsByType[eventType]) {
          eventsByType[eventType] = [];
        }
        eventsByType[eventType].push(event);
      }

      // Process events by type to optimize handler calls
      if (eventsByType.start?.length) {
        for (const event of eventsByType.start) {
          if (isSkillFirstMessage) {
            onSkillStart(event);
          }
        }
      }

      if (eventsByType.log?.length) {
        for (const event of eventsByType.log) {
          onSkillLog(event);
        }
      }

      if (eventsByType.stream?.length) {
        for (const event of eventsByType.stream) {
          onSkillStream(event);
        }
      }

      if (eventsByType.artifact?.length) {
        for (const event of eventsByType.artifact) {
          onSkillArtifact(event);
        }
      }

      if (eventsByType.structured_data?.length) {
        for (const event of eventsByType.structured_data) {
          onSkillStructedData(event);
        }
      }

      if (eventsByType.create_node?.length) {
        for (const event of eventsByType.create_node) {
          onSkillCreateNode(event);
        }
      }

      if (eventsByType.token_usage?.length) {
        for (const event of eventsByType.token_usage) {
          onSkillTokenUsage?.(event);
        }
      }

      if (eventsByType.end?.length) {
        for (const event of eventsByType.end) {
          onSkillEnd(event);
          isSkillFirstMessage = true;
        }
      }

      if (eventsByType.error?.length) {
        for (const event of eventsByType.error) {
          onSkillError?.(event);
        }
      }

      // 使用节流版本的滚动函数，在每个批处理后调用
      if (eventsToProcess.length > 0) {
        throttledScrollToBottom();
      }

      processingBatch = false;
    };

    // Use requestAnimationFrame with debouncing for smoother UI updates
    let batchTimer: number | null = null;
    let animationFrameId: number | null = null;

    const scheduleBatchProcessing = () => {
      if (batchTimer) {
        return; // Already scheduled
      }

      batchTimer = window.setTimeout(() => {
        if (animationFrameId) {
          window.cancelAnimationFrame(animationFrameId);
        }

        animationFrameId = window.requestAnimationFrame(() => {
          processBatch();
          batchTimer = null;
          animationFrameId = null;

          if (batchedEvents.length > 0) {
            scheduleBatchProcessing();
          }
        });
      }, BATCH_INTERVAL);
    };

    const read = async () => {
      let hasError = false;
      try {
        if (!reader) {
          throw new Error('Reader is not initialized');
        }
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining events
          processBatch();
          onCompleted?.();
          // Final scroll to bottom
          scrollToBottom();
          return;
        }

        bufferStr += decoder.decode(value, { stream: true });
        const lines = bufferStr.split('\n');
        let skillEvent: SkillEvent;

        try {
          for (const message of lines ?? []) {
            if (message.startsWith('data: ')) {
              try {
                skillEvent = JSON.parse(message.substring(6)) as SkillEvent;
                batchedEvents.push(skillEvent);
              } catch (err) {
                console.log('Parse error:', {
                  message: message.substring(6),
                  error: err,
                });
              }

              // Prioritize critical events
              if (skillEvent?.event === 'error' || skillEvent?.event === 'end') {
                // Process immediately for critical events
                if (!batchTimer && !processingBatch) {
                  scheduleBatchProcessing();
                }
              } else if (batchedEvents.length >= BATCH_SIZE) {
                // Process when batch is full
                scheduleBatchProcessing();
              } else if (batchedEvents.length === 1) {
                // Start the batch timer if this is the first event in a new batch
                scheduleBatchProcessing();
              }
            }
          }

          bufferStr = lines[lines.length - 1];
        } catch (err) {
          onSkillError(err);
          onCompleted?.(true);
          hasError = true;
          return;
        }

        if (!hasError) {
          await read();
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('Read operation aborted');
          return;
        }
      }
    };

    await read();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Fetch aborted');
    } else {
      console.error('Fetch error:', error);
      onSkillError?.({
        error: {
          success: false,
          errCode: new ConnectionError(error).code,
        },
        event: 'error',
      });
    }
  } finally {
    // Clean up resources
    if (reader) {
      try {
        await reader.cancel();
      } catch (cancelError) {
        console.error('Error cancelling reader:', cancelError);
      }
      reader.releaseLock();
    }
  }
};
