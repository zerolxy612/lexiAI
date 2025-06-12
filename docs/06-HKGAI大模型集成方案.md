# HKGAI大模型集成方案

## 概述

本文档描述了LexiHK平台与公司自研HKGAI大模型的集成方案。通过Dify API实现与HKGAI服务的交互，支持智能内容生成、流式响应处理和多模型管理。

## 技术架构

### API基础信息

- **API端点**: `https://dify.hkgai.net`
- **协议**: HTTP REST API + Server-Sent Events (SSE)流式响应
- **认证方式**: Bearer Token认证
- **请求头要求**:
  - `Content-Type: application/json`
  - `Authorization: Bearer {apiKey}`
  - `HTTP-Referer: https://lexihk.com`
  - `X-Title: LexiHK`

### 核心组件架构

```
┌─────────────────────────────────────────────────────────────┐
│                      HKGAI集成架构                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  HKGAIAdapter   │  │ DifyChatModel    │  │ ClientFactory│ │
│  │     适配器       │  │    客户端        │  │   工厂类     │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
│           │                      │                    │     │
│           └──────────────────────┼────────────────────┘     │
│                                  │                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Dify API Service                           │ │
│  │          https://dify.hkgai.net                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件详解

### 1. HKGAIAdapter 适配器
**文件路径**: `apps/api/src/modules/skill/hkgai-adapter.ts`

**功能职责**:
- HKGAI模型的识别和验证
- 响应数据的智能提取和格式转换
- 针对不同模型类型的特殊处理逻辑
- 内容格式标准化处理

**核心方法**:
```typescript
class HKGAIAdapter {
  // 检测是否为HKGAI模型
  static isHKGAIModel(modelName: string): boolean
  
  // 提取和处理响应内容
  static extractContent(content: any): string
  
  // 格式化模型响应
  static formatResponse(rawResponse: any): ProcessedResponse
}
```

### 2. DifyChatModel 客户端
**文件路径**: `apps/api/src/utils/models/hkgai-client.ts`

**功能职责**:
- 基于LangChain的自定义聊天模型实现
- 支持阻塞式和流式两种响应模式
- 完整的错误处理和重试机制
- SSE流式数据解析和处理

**核心特性**:
- 继承LangChain ChatModel基类
- 支持流式和非流式两种调用模式
- 自动重试和容错处理
- 完整的类型定义支持

### 3. HKGAIClientFactory 工厂类
**文件路径**: `apps/api/src/utils/llm/hkgai-client-factory.ts`

**功能职责**:
- 管理多个HKGAI模型的API客户端实例
- 处理不同模型的API密钥配置
- 客户端实例的创建和缓存管理
- 统一的配置管理接口

**设计模式**:
- 工厂模式：统一创建不同类型的客户端
- 单例模式：缓存和重用客户端实例
- 配置管理：集中处理API密钥和参数

## 交互流程详解

### 1. 请求处理流程

```typescript
// Step 1: 模型识别
const isHKGAIModel = HKGAIAdapter.isHKGAIModel(modelName);
if (!isHKGAIModel) {
  throw new Error('Unsupported model type');
}

// Step 2: 构建请求体
const requestBody = {
  inputs: {},
  query: userQuery,
  response_mode: 'streaming', // 或 'blocking'
  conversation_id: conversationId || '',
  user: userId || 'user-1'
};

// Step 3: 发送HTTP请求
const response = await fetch(`${baseUrl}/v1/chat-messages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://lexihk.com',
    'X-Title': 'LexiHK'
  },
  body: JSON.stringify(requestBody)
});
```

### 2. 流式响应处理

```typescript
// SSE流处理实现
async function* handleStreamResponse(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) {
    throw new Error('Response body is not readable');
  }
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            
            if (data.event === 'message') {
              yield new ChatGenerationChunk({
                message: new ChatMessageChunk({
                  content: data.answer || '',
                  role: 'assistant'
                })
              });
            }
            
            if (data.event === 'message_end') {
              break;
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', parseError);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### 3. 内容提取与处理

```typescript
// HKGAIAdapter.extractContent() 智能内容提取
static extractContent(content: any): string {
  // 处理字符串类型
  if (typeof content === 'string') {
    return content;
  }
  
  // 处理数组类型
  if (Array.isArray(content)) {
    const firstItem = content[0];
    return firstItem?.content || firstItem?.text || '';
  }
  
  // 处理对象类型
  if (content && typeof content === 'object') {
    return content.answer || content.content || content.text || '';
  }
  
  // 兜底处理
  return String(content || '');
}
```

## 错误处理策略

### 1. 网络错误处理
- 自动重试机制（最多3次）
- 指数退避策略
- 超时处理和熔断保护

### 2. API错误处理
- HTTP状态码检查
- API错误响应解析
- 友好错误信息转换

### 3. 流式处理错误
- SSE连接中断恢复
- 数据解析错误容错
- 部分数据救援机制

## 环境配置

### 必需环境变量

```bash
# HKGAI API基础配置
HKGAI_BASE_URL=https://dify.hkgai.net
HKGAI_API_KEY=app-cWHko7usG7aP8ZsAnSeglYc3

# 各模型专用API密钥
HKGAI_SEARCHENTRY_API_KEY=app-xxxxxxxxxxxxx
HKGAI_MISSINGINFO_API_KEY=app-xxxxxxxxxxxxx  
HKGAI_TIMELINE_API_KEY=app-xxxxxxxxxxxxx
```

### 配置管理

```typescript
// 配置接口定义
interface HKGAIConfig {
  baseUrl: string;
  defaultApiKey: string;
  modelApiKeys: Record<string, string>;
  timeout: number;
  maxRetries: number;
}

// 配置获取函数
function getHKGAIConfig(): HKGAIConfig {
  return {
    baseUrl: process.env.HKGAI_BASE_URL || 'https://dify.hkgai.net',
    defaultApiKey: process.env.HKGAI_API_KEY || '',
    modelApiKeys: {
      'searchentry': process.env.HKGAI_SEARCHENTRY_API_KEY || '',
      'missinginfo': process.env.HKGAI_MISSINGINFO_API_KEY || '',
      'timeline': process.env.HKGAI_TIMELINE_API_KEY || ''
    },
    timeout: 30000,
    maxRetries: 3
  };
}
```

## 性能优化

### 1. 连接池管理
- HTTP连接复用
- Keep-Alive配置
- 连接超时优化

### 2. 缓存策略
- 客户端实例缓存
- 响应结果缓存（可选）
- 配置信息缓存

### 3. 流式优化
- 背压控制
- 内存使用优化
- 并发连接限制

## 监控和日志

### 1. 关键指标监控
- API调用成功率
- 响应时间分布
- 错误率统计
- 流式连接稳定性

### 2. 日志记录
- 请求/响应日志
- 错误详情记录
- 性能指标记录
- 调试信息输出

## 使用示例

### 基础使用

```typescript
import { HKGAIAdapter } from '@/modules/skill/hkgai-adapter';
import { DifyChatModel } from '@/utils/models/hkgai-client';
import { HKGAIClientFactory } from '@/utils/llm/hkgai-client-factory';

// 创建客户端
const client = HKGAIClientFactory.createClient('searchentry');

// 发送查询
const response = await client.invoke([
  new HumanMessage('请帮我搜索相关信息')
]);

// 处理响应
const content = HKGAIAdapter.extractContent(response.content);
console.log('AI回复:', content);
```

### 流式使用

```typescript
// 流式调用
const stream = await client.stream([
  new HumanMessage('请详细分析这个问题')
]);

// 处理流式响应
for await (const chunk of stream) {
  const content = HKGAIAdapter.extractContent(chunk.content);
  process.stdout.write(content);
}
```

## 部署注意事项

### 1. 安全配置
- API密钥安全存储
- 访问权限控制
- 请求频率限制

### 2. 可用性保障
- 健康检查接口
- 服务降级策略
- 故障转移机制

### 3. 版本兼容性
- API版本管理
- 向后兼容处理
- 平滑升级策略

## 故障排查

### 常见问题

1. **连接超时**
   - 检查网络连接
   - 验证API端点
   - 调整超时配置

2. **认证失败**
   - 检查API密钥
   - 验证请求头设置
   - 确认密钥权限

3. **响应解析错误**
   - 检查响应格式
   - 验证内容提取逻辑
   - 查看详细错误日志

### 调试方法

1. 启用详细日志
2. 使用网络抓包工具
3. 检查环境变量配置
4. 验证API接口状态

## 后续优化计划

### 短期优化
- [ ] 添加响应缓存机制
- [ ] 优化错误处理逻辑
- [ ] 完善监控指标

### 长期规划
- [ ] 支持更多模型类型
- [ ] 实现智能负载均衡
- [ ] 添加A/B测试支持

---

**文档版本**: v1.0  
**最后更新**: 2024年12月  
**维护人员**: 开发团队 