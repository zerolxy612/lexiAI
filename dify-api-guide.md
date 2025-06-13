# Dify API 配置和测试指南

## 1. 查看现有Dify API配置

### 当前已配置的模型
根据您的项目配置，已有以下3个HKGAI模型：

| 模型名称 | API Key | 用途 | 数据库ID |
|---------|---------|------|----------|
| `hkgai-searchentry` | `app-mYHumURK2S010ZonuvzeX1Ad` | 搜索入口 | `hkgai-searchentry-item` |
| `hkgai-missinginfo` | `app-cWHko7usG7aP8ZsAnSeglYc3` | 缺失信息补充 | `hkgai-missinginfo-item` |
| `hkgai-timeline` | `app-R9k11qz64Cd86NCsw2ojZVLC` | 时间线 | `hkgai-timeline-item` |

### 基础配置
- **Dify API 基础URL**: `https://dify.hkgai.net`
- **API 格式**: OpenAI 兼容格式
- **认证方式**: Bearer Token (使用 app-xxx 格式的密钥)

## 2. 如何查看Dify API信息

### 2.1 通过Dify控制台查看
1. 登录Dify控制台: `https://dify.hkgai.net`
2. 选择相应的应用
3. 在应用设置中查看API密钥和配置

### 2.2 通过API测试确认
创建测试文件来验证API是否正常工作：

```javascript
// test-dify-api.js
async function testDifyAPI() {
  const apiKey = 'app-mYHumURK2S010ZonuvzeX1Ad'; // 替换为实际API密钥
  const baseUrl = 'https://dify.hkgai.net';
  
  try {
    const response = await fetch(`${baseUrl}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: '你好',
        response_mode: 'blocking',
        conversation_id: '',
        user: 'test-user'
      })
    });
    
    const result = await response.json();
    console.log('API响应:', result);
  } catch (error) {
    console.error('API调用失败:', error);
  }
}
```

## 3. 添加新模型的步骤

### 3.1 获取新模型信息
您需要从Dify提供方获取：
- **模型名称**: 例如 `hkgai-newmodel`
- **API密钥**: 格式为 `app-xxxxxxxxxx`
- **模型用途**: 描述这个模型的功能
- **参数限制**: 上下文长度、最大输出等

### 3.2 环境变量配置
在 `.env` 文件中添加：
```env
HKGAI_NEWMODEL_API_KEY=app-xxxxxxxxxx
```

### 3.3 数据库配置
需要在两个SQL文件中添加配置：

**deploy/model-providers/hkgai.sql**
```sql
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    ('hkgai-newmodel', 'HKGAI New Model', 'hkgai', 't2', 't', 'f', 8000, 4000, '{}');
```

**deploy/model-providers/hkgai-provider-items.sql**
```sql
INSERT INTO refly.provider_items (provider_id, item_id, category, name, enabled, config, tier, "order")
VALUES 
    ('hkgai-global', 'hkgai-newmodel-item', 'llm', 'HKGAI New Model', true, '{"modelId": "hkgai-newmodel", "contextLimit": 8000, "maxOutput": 4000, "capabilities": {}}', 't2', 4);
```

### 3.4 代码配置更新
在 `apps/api/src/utils/models/hkgai-client.ts` 中添加：

```typescript
// 在 constructor 中的 this.models 对象中添加
'hkgai-newmodel': {
  modelName: 'gpt-3.5-turbo',
  apiKey: process.env.HKGAI_NEWMODEL_API_KEY || globalApiKey,
},
```

在 `apps/api/src/utils/llm/hkgai-client-factory.ts` 中添加：

```typescript
// 在 HKGAIModelName 枚举中添加
NEW_MODEL = 'NewModel',

// 在 modelApiKeys 中添加
[HKGAIModelName.NEW_MODEL]: this.configService.get('credentials.hkgai.newModelKey'),
```

## 4. 测试新模型

### 4.1 单独测试API
```javascript
// test-new-model.js
async function testNewModel() {
  const response = await fetch('http://localhost:5800/v1/skill/invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { query: '测试新模型' },
      target: {},
      context: { resources: [], documents: [], codeArtifacts: [] },
      tplConfig: {},
      runtimeConfig: {},
      skillId: 'commonQnA',
      modelItemId: 'hkgai-newmodel-item', // 使用新模型
    })
  });
  
  const result = await response.text();
  console.log('新模型响应:', result);
}
```

### 4.2 在右键菜单中测试
修改 `packages/ai-workspace-common/src/components/canvas/context-menu/index.tsx` 中的默认模型设置，将其指向新模型进行测试。

## 5. 常见问题排查

### 5.1 API密钥错误
- 确认API密钥格式正确 (app-xxxxxxxxxx)
- 检查环境变量是否正确设置
- 验证API密钥在Dify控制台中是否有效

### 5.2 API调用失败
- 检查网络连接到 `https://dify.hkgai.net`
- 确认API端点路径正确
- 查看服务器日志获取详细错误信息

### 5.3 模型不可用
- 确认模型在数据库中正确配置
- 检查模型是否启用 (`enabled: true`)
- 验证模型适配器是否支持新模型

## 6. 下一步

请提供您想要添加的新模型的以下信息：
1. 模型名称和用途
2. Dify API密钥
3. 模型参数限制（如果有特殊要求）
4. 是否需要在UI中单独显示

我将帮您完成完整的配置和代码更新。 