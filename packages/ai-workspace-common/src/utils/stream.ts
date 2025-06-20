// 类型定义
interface StreamRequestData {
  isSearch: boolean;
  languageTag: string;
  message: {
    type: 'user';
    text: string;
    metadata: { chatDialogId: string };
  };
  model: string;
  preGenerationRequired: number; // 0: 第一段, 1: 第二段, 2: 第三段
  persistentStrategy: number;
  searchStrategy: number;
}

interface StreamResponse {
  streamContent?: string;
  searchResultsStream?: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
}

let currentController: AbortController | null = null;

// 请求事件流
export async function requestEventStream(
  data: StreamRequestData,
  url: string = '/api/v1/deep-research/stream',
): Promise<Response | undefined> {
  try {
    // 如果有旧的控制器，先中止它
    if (currentController) {
      currentController.abort();
    }

    // 创建新的 AbortController
    currentController = new AbortController();
    const signal = currentController.signal;

    // 使用现有的客户端进行请求
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 这里会自动添加认证信息
      },
      body: JSON.stringify(data),
      signal,
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('Request was aborted');
    } else {
      console.log('error', error);
    }
    return undefined;
  }
}

// 处理流式响应
export async function* streamResponse(
  response: Response | undefined,
): AsyncGenerator<StreamResponse> {
  if (!response) return;

  const decoder = new TextDecoder();
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No reader available');
  }

  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data:')) {
          try {
            const json = JSON.parse(line.slice(5));

            // 检查是否结束
            if (json?.results?.[0]?.metadata?.finishReason === 'STOP') {
              return;
            }

            const streamContent = json?.results?.[0]?.output?.text;
            const searchResultsStream = json?.metadata?.search?.results;

            if (streamContent || searchResultsStream) {
              yield {
                streamContent,
                searchResultsStream,
              };
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// 中止当前请求
export async function abortCurrentRequest(): Promise<boolean> {
  if (currentController) {
    const controller = currentController;
    currentController = null;

    try {
      controller.abort();
      return true;
    } catch (error) {
      console.log('Abort error (handled):', error);
      return true;
    }
  }

  return false;
}

export type { StreamRequestData, StreamResponse };
