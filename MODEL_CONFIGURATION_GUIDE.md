# 模型配置系统指南

## 概述

这个新的模型配置系统解决了之前"修改一个模型就影响其他模型"的问题。每个模型现在都有自己独立的配置，包括API端点、流式支持、请求格式等。

## 核心特性

### 1. 独立配置
- 每个模型都有独立的配置项
- 修改一个模型不会影响其他模型
- 支持不同的API端点和格式

### 2. 自动流式检测
- 自动检测哪些模型需要强制流式输出（如RAG模型）
- 防止错误的非流式调用

### 3. 统一接口
- 所有模型都使用相同的调用接口
- 内部自动处理不同的请求/响应格式

## 配置文件结构

配置文件位于：`packages/providers/src/config/model-configs.ts`

```typescript
export interface ModelConfig {
  modelId: string;                    // 模型ID
  providerKey: string;               // 提供商键
  baseUrl: string;                   // API基础URL
  endpoint: string;                  // API端点
  supportsStreaming: boolean;        // 是否支持流式
  requiresStreaming: boolean;        // 是否必须流式
  requestFormat: 'openai' | 'dify' | 'hkgai';  // 请求格式
  responseFormat: 'openai' | 'dify' | 'hkgai'; // 响应格式
  isRagModel: boolean;               // 是否为RAG模型
  isContractModel: boolean;          // 是否为合同模型
  defaultTemperature: number;        // 默认温度
  apiKeyEnvVar: string;             // API密钥环境变量名
}
```

## 当前支持的模型

### RAG模型
- **模型ID**: `hkgai/rag`
- **特点**: 必须使用流式输出，使用OpenAI格式
- **API端点**: `https://ragpipeline.hkgai.asia/v1/chat/completions`

### 合同审查模型
- **模型ID**: `hkgai/contract`
- **特点**: 支持流式和非流式，使用Dify格式
- **API端点**: `https://api.dify.ai/v1/chat-messages`

### 通用HKGAI模型
- **模型ID**: `hkgai/general`, `hkgai/searchentry`, `hkgai/missinginfo`, 等
- **特点**: 支持流式和非流式，使用HKGAI格式
- **API端点**: `https://dify.hkgai.net/v1/chat-messages`

## 环境变量配置

### 必需的环境变量

```bash
# RAG模型
HKGAI_RAG_API_KEY=your_rag_api_key

# 合同模型
HKGAI_CONTRACT_API_KEY=your_contract_api_key

# 通用模型
HKGAI_GENERAL_API_KEY=your_general_api_key
HKGAI_SEARCHENTRY_API_KEY=your_searchentry_api_key
HKGAI_MISSINGINFO_API_KEY=your_missinginfo_api_key
HKGAI_TIMELINE_API_KEY=your_timeline_api_key
HKGAI_CASE_SEARCH_API_KEY=your_case_search_api_key
HKGAI_CODE_SEARCH_API_KEY=your_code_search_api_key
```

### 可选的环境变量

```bash
# 备用API密钥（当特定模型的密钥未设置时使用）
HKGAI_API_KEY=your_fallback_api_key

# 自定义基础URL
HKGAI_BASE_URL=https://dify.hkgai.net
HKGAI_RAG_BASE_URL=https://ragpipeline.hkgai.asia
```

## 验证配置

运行验证脚本来检查配置：

```bash
cd packages/providers
npm run validate-env
```

或者：

```bash
npx ts-node src/scripts/validate-env.ts
```

## 添加新模型

### 1. 在配置文件中添加模型

编辑 `packages/providers/src/config/model-configs.ts`：

```typescript
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // ... 现有配置 ...
  
  // 新模型
  'hkgai/new-model': {
    modelId: 'hkgai/new-model',
    providerKey: 'hkgai',
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
    endpoint: '/v1/chat-messages',
    supportsStreaming: true,
    requiresStreaming: false,
    requestFormat: 'hkgai',
    responseFormat: 'hkgai',
    isRagModel: false,
    isContractModel: false,
    defaultTemperature: 0.7,
    apiKeyEnvVar: 'HKGAI_NEW_MODEL_API_KEY',
  },
};
```

### 2. 添加环境变量

在 `.env` 文件中添加：

```bash
HKGAI_NEW_MODEL_API_KEY=your_new_model_api_key
```

### 3. 验证配置

运行验证脚本确保配置正确：

```bash
npm run validate-env
```

## 故障排除

### 常见错误诊断

如果遇到 **"API key not configured for model"** 错误或其他HKGAI模型配置问题，请参考：

📖 **[HKGAI模型配置故障排除指南](./TROUBLESHOOTING_HKGAI_MODELS.md)**

该文档包含了完整的问题诊断流程、解决方案和预防措施，特别针对：
- 环境变量配置问题
- API服务器环境变量加载问题  
- 模型配置系统问题

### E3001错误
如果遇到 `[E3001] Model provider error` 错误：

1. **检查API密钥**：确保相关的环境变量已设置
2. **检查网络连接**：确保能访问相应的API端点
3. **检查模型配置**：确保模型ID在配置文件中存在
4. **查看日志**：检查控制台输出的详细错误信息

### 流式输出问题
如果遇到流式输出相关问题：

1. **RAG模型**：必须使用流式模式，不能使用非流式调用
2. **其他模型**：可以选择流式或非流式模式
3. **检查配置**：确保 `requiresStreaming` 和 `supportsStreaming` 设置正确

### 添加调试日志

在模型调用时会自动输出详细的调试信息，包括：
- 请求URL和头部
- 请求体内容
- 响应状态和内容

## 迁移指南

### 从旧系统迁移

1. **不需要修改现有代码**：新系统向后兼容
2. **更新环境变量**：按照上面的格式设置环境变量
3. **运行验证**：使用验证脚本检查配置
4. **测试模型**：逐个测试每个模型确保正常工作

### 常见迁移问题

1. **API密钥未设置**：确保所有必需的环境变量都已设置
2. **URL配置错误**：检查基础URL是否正确
3. **流式配置冲突**：确保RAG模型使用流式模式

## 最佳实践

1. **使用验证脚本**：定期运行验证脚本检查配置
2. **环境变量管理**：使用 `.env` 文件管理环境变量
3. **错误处理**：检查日志输出了解详细错误信息
4. **测试新模型**：添加新模型后先进行小规模测试
5. **文档更新**：添加新模型时更新相关文档

## 技术细节

### 请求格式差异

#### OpenAI格式 (RAG模型)
```json
{
  "model": "hkgai/rag",
  "messages": [{"role": "user", "content": "query"}],
  "stream": true
}
```

#### Dify格式 (合同模型)
```json
{
  "inputs": {"doc": []},
  "query": "query",
  "response_mode": "streaming",
  "user": "user-refly",
  "conversation_id": "",
  "model": "contract"
}
```

#### HKGAI格式 (通用模型)
```json
{
  "inputs": {},
  "query": "query",
  "response_mode": "streaming",
  "user": "user-refly",
  "conversation_id": ""
}
```

### 响应格式差异

#### OpenAI格式
```json
{
  "choices": [
    {
      "delta": {"content": "response"},
      "message": {"content": "response"}
    }
  ]
}
```

#### Dify/HKGAI格式
```json
{
  "event": "message",
  "answer": "response"
}
```

这个配置系统确保了每个模型都能按照其特定要求正确工作，同时提供了统一的接口供应用程序使用。 