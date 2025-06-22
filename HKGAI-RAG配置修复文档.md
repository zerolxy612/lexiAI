# HKGAI-RAG模型配置修复文档

## 问题描述

在添加HKGAI的RAG模型后，前端与所有已有模型的交互都出现了`[E3001] Model provider error, please try again later`错误。问题发生在`reflyprofilo`组件中，即使回退到之前可用的分支也会出现同样的问题。

## 问题原因

经过详细分析，发现问题的主要原因是：

1. **配置冲突**：在`app.config.ts`中，HKGAI的baseUrl被错误地设置为RAG模型的URL（`https://ragpipeline.hkgai.asia`），而不是普通HKGAI模型应该使用的URL（`https://dify.hkgai.net`）。

2. **API端点差异**：
   - 普通HKGAI模型使用Dify API格式，应该调用`https://dify.hkgai.net/v1/chat-messages`端点
   - RAG模型使用OpenAI兼容API格式，应该调用`https://ragpipeline.hkgai.asia/v1/chat/completions`端点

3. **客户端创建问题**：在`HKGAIClientFactory`中，所有模型（包括普通模型和RAG模型）都使用同一个baseUrl创建客户端，导致普通HKGAI模型的请求被错误地发送到RAG模型的服务器。

4. **请求格式不匹配**：即使修改了endpoint路径，请求体的格式也不匹配，导致API调用失败。

## 修复方案

我们进行了以下修改来解决这个问题：

### 1. 修复app.config.ts中的baseUrl配置

```typescript
credentials: {
  hkgai: {
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net', // 修改为正确的普通模型URL
    ragBaseUrl: process.env.HKGAI_RAG_BASE_URL || 'https://ragpipeline.hkgai.asia', // 添加单独的RAG模型URL
    // ...其他配置
  }
}
```

### 2. 更新HKGAIClientFactory以使用正确的baseUrl

```typescript
@Injectable()
export class HKGAIClientFactory {
  private clients: Map<string, AxiosInstance> = new Map();
  private baseUrl: string;
  private ragBaseUrl: string; // 添加RAG专用的baseUrl
  // ...

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('credentials.hkgai.baseUrl');
    this.ragBaseUrl = this.configService.get('credentials.hkgai.ragBaseUrl'); // 从配置中获取RAG baseUrl
    // ...
  }

  getClient(modelName: string): AxiosInstance {
    // ...
    // 确定使用哪个baseURL
    const isRagModel = enumModelName === HKGAIModelName.RAG;
    const baseURL = isRagModel ? this.ragBaseUrl : this.baseUrl;
    
    // 创建新的Axios客户端
    const client = axios.create({
      baseURL, // 使用正确的baseURL
      // ...
    });
    // ...
  }
  
  async createChatCompletion(modelName: string, messages: Array<{ role: string; content: string }>, options?: any) {
    // ...
    const isRagModel = enumModelName === HKGAIModelName.RAG;
    // ...
    const endpoint = isRagModel ? '/v1/chat/completions' : '/v1/chat-messages'; // 修正API端点
    
    const requestBody = isRagModel
      ? {
          model: 'Lexihk-RAG',
          messages,
          // ... RAG模型的请求格式
        }
      : {
          inputs: {},
          query: messages[messages.length - 1]?.content || '',
          response_mode: options?.stream ? 'streaming' : 'blocking',
          // ... Dify模型的请求格式
        };
    // ...
  }
}
```

### 3. 更新SimpleHKGAIClient

```typescript
export class SimpleHKGAIClient {
  private baseUrl: string;
  private ragBaseUrl: string; // 添加RAG专用的baseUrl
  // ...

  constructor() {
    this.baseUrl = process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net';
    this.ragBaseUrl = process.env.HKGAI_RAG_BASE_URL || 'https://ragpipeline.hkgai.asia';
    // ...
  }
  
  async call(modelName: string, query: string): Promise<string> {
    // ...
    const isRag = this.isRagModel(modelName);
    const baseUrl = isRag ? this.ragBaseUrl : this.baseUrl; // 使用正确的baseUrl
    
    // 针对不同类型的模型使用不同的API调用方式
    if (isRag) {
      // RAG模型使用OpenAI格式的API
      response = await fetch(`${baseUrl}/v1/chat/completions`, {
        // ... RAG模型的请求格式
      });
    } else {
      // Dify模型使用Dify格式的API
      response = await fetch(`${baseUrl}/v1/chat-messages`, {
        // ... Dify模型的请求格式
      });
    }
    // ...
  }
}
```

### 4. 创建环境变量配置脚本

创建了`scripts/update-env-config.sh`脚本，用于正确配置环境变量：

```bash
#!/bin/bash
# ...
update_env_var "HKGAI_BASE_URL" "https://dify.hkgai.net" "普通HKGAI模型的基础URL"
update_env_var "HKGAI_RAG_BASE_URL" "https://ragpipeline.hkgai.asia" "RAG模型的基础URL"
# ...其他环境变量配置
```

## 验证方法

修复完成后，可以通过以下方法验证：

1. 运行环境变量配置脚本：`./scripts/update-env-config.sh`
2. 重启API服务：`docker-compose restart api` 或 `npm run dev`
3. 在前端尝试使用不同的模型（hkgai-general, hkgai-missinginfo, hkgai-rag等）进行对话
4. 检查API调用日志，确认请求被发送到正确的端点

## 注意事项

1. 确保环境变量中同时配置了`HKGAI_BASE_URL`和`HKGAI_RAG_BASE_URL`
2. RAG模型和普通HKGAI模型使用不同的API格式，不能互换
3. 如果需要禁用RAG模型，可以在数据库中将其设置为不可用：
   ```sql
   UPDATE refly.provider_items SET enabled = false WHERE item_id = 'hkgai-rag-item';
   ```

## 相关文件

- `apps/api/src/modules/config/app.config.ts`
- `apps/api/src/utils/llm/hkgai-client-factory.ts`
- `packages/providers/src/llm/simple-hkgai-client.ts`
- `scripts/update-env-config.sh`

## 配置说明

RAG模型与其他HKGAI模型配置不同：

| 特性 | 普通HKGAI模型 | RAG模型 |
|------|--------------|--------|
| API格式 | Dify API | OpenAI兼容API |
| 基础URL | https://dify.hkgai.net | https://ragpipeline.hkgai.asia |
| API路径 | /v1/chat-messages | /v1/chat/completions |
| API密钥格式 | app-xxx... | sk-xxx... |
| 模型名称参数 | 不需要 | "model": "Lexihk-RAG" |
| 响应格式 | Dify格式 | OpenAI格式 |

## 注意事项

1. RAG模型的API配置确保在环境变量中正确设置：
   - HKGAI_RAG_BASE_URL
   - HKGAI_RAG_API_KEY
   - HKGAI_RAG_MODEL_NAME

2. 默认使用通用HKGAI模型，避免启动时默认使用RAG模型

3. 必要时可以完全禁用RAG模型，先确保系统其他功能正常运行 