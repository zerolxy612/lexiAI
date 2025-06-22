# HKGAI配置与前端交互流程

## 1. 项目架构概述

LexiAI项目使用HKGAI大模型作为主要的AI交互引擎，通过Dify API接口调用服务。整个系统采用基于环境变量的配置方式，而不是完全依赖数据库配置。虽然数据库中也有相应的模型配置信息，但实际的API调用主要通过环境变量中定义的API密钥和基础URL来执行。

## 2. HKGAI模型种类

系统支持以下HKGAI模型类型：

1. **HKGAI Search Entry** (`hkgai-searchentry` / `hkgai/searchentry`)：
   - 主要用于搜索入口功能
   - API密钥: `app-mYHumURK2S010ZonuvzeX1Ad`

2. **HKGAI Missing Info** (`hkgai-missinginfo` / `hkgai/missinginfo`)：
   - 用于处理缺失信息和补充内容
   - API密钥: `app-cWHko7usG7aP8ZsAnSeglYc3`
   - 默认模型

3. **HKGAI Timeline** (`hkgai-timeline` / `hkgai/timeline`)：
   - 用于时间线生成功能
   - API密钥: `app-R9k11qz64Cd86NCsw2ojZVLC`

4. **HKGAI General** (`hkgai-general` / `hkgai/general`)：
   - 用于一般问答和对话
   - API密钥: `app-5PTDowg5Dn2MSEhG5n3FBWXs`

## 3. 配置机制详解

### 3.1 环境变量配置

系统使用以下环境变量配置HKGAI模型：

```
HKGAI_BASE_URL=https://dify.hkgai.net
HKGAI_API_KEY=app-cWHko7usG7aP8ZsAnSeglYc3 (全局默认密钥)
HKGAI_SEARCHENTRY_API_KEY=app-mYHumURK2S010ZonuvzeX1Ad
HKGAI_MISSINGINFO_API_KEY=app-cWHko7usG7aP8ZsAnSeglYc3
HKGAI_TIMELINE_API_KEY=app-R9k11qz64Cd86NCsw2ojZVLC
HKGAI_GENERAL_API_KEY=app-5PTDowg5Dn2MSEhG5n3FBWXs
```

这些配置在`packages/providers/src/llm/simple-hkgai-client.ts`和`packages/skill-template/src/utils/hkgai-client.ts`中被使用。

### 3.2 数据库配置

数据库中也存储了模型配置信息，主要通过以下SQL文件进行初始化：

- `deploy/model-providers/hkgai-provider.sql`: 定义HKGAI提供商
- `deploy/model-providers/hkgai-provider-items.sql`: 定义HKGAI提供商项目（具体模型）
- `deploy/model-providers/hkgai.sql`：另一个模型定义文件

但实际API调用主要依赖环境变量的配置，而不是数据库中的记录。数据库配置主要用于前端界面展示和选择。

## 4. HKGAI客户端实现

### 4.1 SimpleHKGAIClient

位于`packages/providers/src/llm/simple-hkgai-client.ts`，是一个简化的客户端实现：

```typescript
export class SimpleHKGAIClient {
  private baseUrl: string;
  private apiKeys: Record<string, string>;

  constructor() {
    this.baseUrl = process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net';
    this.apiKeys = {
      'hkgai-searchentry': process.env.HKGAI_SEARCHENTRY_API_KEY || 'app-mYHumURK2S010ZonuvzeX1Ad',
      'hkgai-missinginfo': process.env.HKGAI_MISSINGINFO_API_KEY || 'app-cWHko7usG7aP8ZsAnSeglYc3',
      'hkgai-timeline': process.env.HKGAI_TIMELINE_API_KEY || 'app-R9k11qz64Cd86NCsw2ojZVLC',
      'hkgai-general': process.env.HKGAI_GENERAL_API_KEY || 'app-5PTDowg5Dn2MSEhG5n3FBWXs',
    };
  }

  async call(modelName: string, query: string): Promise<string> {
    const apiKey = this.getApiKeyForModel(modelName);
    // 使用fetch API调用HKGAI服务
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
    // 处理响应...
  }
}
```

### 4.2 DifyChatModel

位于`packages/skill-template/src/utils/hkgai-client.ts`和`packages/providers/src/llm/index.ts`，是一个与LangChain兼容的模型类，继承自`BaseChatModel`：

```typescript
export class DifyChatModel extends BaseChatModel {
  modelName: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  tier: string;

  constructor(options: {/* ... */}) {
    super({});
    this.modelName = options.modelName;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.temperature = options.temperature ?? 0.7;
    this.tier = options.tier ?? 't2';
  }

  async _generate(messages: BaseMessage[], options?: any): Promise<ChatResult> {
    // 提取查询内容
    const { query, inputs } = this._extractQueryAndInputs(messages, options);
    
    // 调用Dify API
    const response = await fetch(`${this.baseUrl}/v1/chat-messages`, {
      method: 'POST',
      headers: {/* ... */},
      body: JSON.stringify({
        inputs: inputs,
        query: query.trim(),
        user: 'user-1',
        stream: true,
      }),
    });
    
    // 处理响应...
  }

  async *_streamResponseChunks(/*...*/): AsyncGenerator<ChatGenerationChunk> {
    // 流式响应实现
  }
}
```

### 4.3 HKGAI适配器

在`packages/providers/src/adapters/hkgai-adapter.ts`中，提供了一个专用于HKGAI模型的适配器，实现了统一的模型接口：

```typescript
export class HKGAIModelAdapter implements ModelAdapter {
  readonly modelName: string;
  readonly provider: string = 'hkgai';
  readonly tier: string;

  constructor(config: ModelConfig) {
    this.modelName = config.modelName;
    this.tier = config.tier || 't2';
  }

  async call(query: string, options?: any): Promise<ModelResponse> {
    const content = await simpleHKGAIClient.call(this.modelName, query);
    // 返回标准化的响应...
  }

  async *stream(query: string, options?: any): AsyncGenerator<StreamChunk, void, unknown> {
    // 流式响应实现...
  }
}
```

## 5. 前端交互流程

### 5.1 模型选择组件

在前端，通过`ModelSelector`组件（位于`packages/ai-workspace-common/src/components/canvas/launchpad/chat-actions/model-selector.tsx`）提供模型选择功能：

1. 组件初始化时从后端获取可用的模型列表
2. 用户可以从下拉菜单中选择不同的模型
3. 选择后的模型信息会被存储在状态中并用于后续请求

### 5.2 默认模型初始化

系统会在用户登录后初始化默认模型，优先级如下：

1. 用户个人配置的默认模型
2. 如果没有配置，则使用`hkgai-general`作为通用对话的默认模型

```typescript
// 从 packages/ai-workspace-common/src/hooks/use-initialize-default-model.ts
const defaultModelInfo: ModelInfo = {
  name: 'hkgai-general',
  label: 'HKGAI General',
  provider: 'hkgai',
  providerItemId: 'hkgai-general-item',
  tier: 't2',
  contextLimit: 8000,
  maxOutput: 4000,
  capabilities: {},
  isDefault: true,
};
```

### 5.3 特定节点类型的模型选择

系统会根据不同类型的节点自动选择合适的模型：

- 对于缺失信息节点：使用`hkgai-missinginfo`
- 对于搜索相关节点：使用`hkgai-searchentry`
- 对于时间线节点：使用`hkgai-timeline`
- 对于一般对话：使用`hkgai-general`

### 5.4 发送请求到后端

当用户与前端交互（如发送消息）时：

1. 前端组件收集用户输入和上下文信息
2. 根据当前选择的模型构造请求
3. 将请求发送到后端API
4. 后端API（例如`commonQnA`技能）使用HKGAI客户端发送请求到HKGAI服务
5. 接收响应并返回给前端
6. 前端更新UI显示结果

## 6. API调用示例

以下是一个从前端到后端再到HKGAI服务的完整调用流程示例：

1. 用户在底部聊天框输入消息：
```typescript
// 从 packages/ai-workspace-common/src/components/canvas/index.tsx
const handleBottomChatSend = useCallback(
  async (messageText: string) => {
    // ...
    // 使用hkgai-general模型为底部聊天
    const modelInfo = {
      name: 'hkgai-general',
      label: 'HKGAI General',
      provider: 'hkgai',
      providerItemId: 'hkgai-general-item',
      tier: 't2',
      contextLimit: 8000,
      maxOutput: 4000,
      capabilities: {},
      isDefault: true,
    };

    // 调用action处理用户消息
    invokeAction({
      resultId,
      query: messageText,
      selectedSkill: { name: 'commonQnA' },
      modelInfo,
      // ...
    });
    // ...
  }
);
```

2. 后端处理请求并使用HKGAI客户端：
```typescript
// 在后端服务中
const chatModel = new DifyChatModel({
  modelName: 'gpt-3.5-turbo', // Dify使用标准模型名称
  apiKey: 'app-5PTDowg5Dn2MSEhG5n3FBWXs', // HKGAI General API Key
  baseUrl: 'https://dify.hkgai.net',
  temperature: 0.7,
});

const response = await chatModel.call(query);
```

3. HKGAI客户端发送HTTP请求到Dify API：
```typescript
const response = await fetch(`https://dify.hkgai.net/v1/chat-messages`, {
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
    response_mode: 'blocking', // 或 'streaming'
    conversation_id: '',
    user: 'user-refly',
  }),
});
```

## 7. 总结

HKGAI的集成采用了以下关键特点：

1. **基于环境变量的配置**：通过环境变量设置API密钥和基础URL，而非完全依赖数据库配置
2. **多模型支持**：支持多个专用模型（SearchEntry、MissingInfo、Timeline、General）
3. **基于LangChain的集成**：使用兼容LangChain的`DifyChatModel`实现
4. **统一的适配器模式**：通过`HKGAIModelAdapter`提供统一接口
5. **前端模型选择**：提供用户友好的界面选择不同模型
6. **节点类型自动匹配**：根据不同功能节点自动选择适合的模型

这种设计使系统能够灵活地使用HKGAI的不同模型能力，同时保持代码的一致性和可维护性。 