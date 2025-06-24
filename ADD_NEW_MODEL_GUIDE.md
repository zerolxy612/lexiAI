# 添加新模型配置流程指南

本指南详细说明如何在LexiAI系统中安全地添加新的AI模型，确保不影响现有模型的正常运行。

## 📋 前置条件检查

在开始之前，请确保：

1. ✅ 已获得新模型的API密钥和端点信息
2. ✅ 了解模型的请求格式（OpenAI、Dify、HKGAI等）
3. ✅ 确认模型是否支持流式输出
4. ✅ 有测试环境可用于验证

## 🔄 完整添加流程

### 第一步：更新模型配置定义

编辑 `packages/providers/src/config/model-configs.ts`，添加新模型配置：

```typescript
// 添加新的模型配置
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // ... 现有配置保持不变 ...
  
  // 新增：法律合同审核模型
  'hkgai/contract': {
    modelName: 'hkgai/contract',
    provider: 'hkgai',
    requestFormat: 'dify',
    baseUrl: 'https://api.dify.ai/v1',
    endpoint: '/chat-messages',
    apiKeyEnvVar: 'HKGAI_CONTRACT_API_KEY',
    streamingRequired: false, // 根据实际需求设置
    defaultHeaders: {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lexihk.com',
      'X-Title': 'LexiHK',
    },
    capabilities: {
      chat: true,
      completion: true,
      streaming: true,
    },
    contextLimit: 8000,
    maxOutput: 4000,
  },
  
  // 新增：深度研究模型（如果需要）
  'hkgai/deepresearch': {
    modelName: 'hkgai/deepresearch',
    provider: 'hkgai',
    requestFormat: 'hkgai',
    baseUrl: 'https://dify.hkgai.net',
    endpoint: '/v1/chat-messages',
    apiKeyEnvVar: 'HKGAI_DEEPRESEARCH_API_KEY',
    streamingRequired: true, // 深度研究通常需要流式输出
    defaultHeaders: {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lexihk.com',
      'X-Title': 'LexiHK',
    },
    capabilities: {
      chat: true,
      completion: true,
      streaming: true,
      search: true, // 支持搜索功能
    },
    contextLimit: 16000,
    maxOutput: 8000,
  },
};
```

### 第二步：添加环境变量

在根目录的 `.env` 文件中添加新模型的API密钥：

```bash
# 新增：法律合同审核模型
HKGAI_CONTRACT_API_KEY=app-6KYmzKxZCLvoKMMh3VnrgFMs

# 新增：深度研究模型（示例）
HKGAI_DEEPRESEARCH_API_KEY=your-deepresearch-api-key-here
```

**⚠️ 重要提示：**
- 使用正确的大小写格式（全大写）
- 确保API密钥有效且有权限
- 不要修改现有模型的环境变量

### 第三步：更新数据库配置（可选）

如果需要在前端界面显示新模型，需要更新数据库配置：

1. 创建新的SQL文件 `deploy/model-providers/new-model.sql`：

```sql
-- 添加新的模型提供商项目
INSERT INTO provider_items (
  id, 
  provider_id, 
  name, 
  model_name, 
  model_type, 
  encrypted_config, 
  is_default, 
  created_at, 
  updated_at
) VALUES (
  'hkgai-contract-item',
  'hkgai-provider-id', -- 使用现有的HKGAI提供商ID
  'HKGAI Contract',
  'hkgai/contract',
  'llm',
  '{}', -- 空配置，实际配置通过环境变量
  false,
  datetime('now'),
  datetime('now')
);
```

2. 运行SQL更新：

```bash
# 在开发环境中执行
sqlite3 apps/api/prisma/dev.db < deploy/model-providers/new-model.sql
```

### 第四步：验证配置

使用我们的验证脚本检查配置：

```bash
# 运行环境变量验证
./scripts/validate-hkgai-env.sh

# 检查特定模型配置
cd packages/providers && node -e "
const { MODEL_CONFIGS } = require('./src/config/model-configs.ts');
console.log('New model config:', MODEL_CONFIGS['hkgai/contract']);
"
```

### 第五步：测试新模型

创建测试脚本验证新模型：

```bash
# 创建测试文件
cat > test-new-model.js << 'EOF'
const { EnhancedHKGAIChatModel } = require('./packages/providers/src/llm/enhanced-hkgai-chat-model.ts');

async function testNewModel() {
  try {
    console.log('🧪 Testing new model: hkgai/contract');
    
    const model = new EnhancedHKGAIChatModel({
      modelName: 'hkgai/contract',
      temperature: 0.7,
    });
    
    const response = await model.call('测试消息：请简单介绍一下你的功能');
    console.log('✅ Model response:', response);
    
  } catch (error) {
    console.error('❌ Model test failed:', error.message);
    process.exit(1);
  }
}

testNewModel();
EOF

# 运行测试
node test-new-model.js
```

### 第六步：重启服务

按正确顺序重启服务，确保配置生效：

```bash
# 1. 停止所有相关进程
pkill -f "pnpm.*api.*dev" && pkill -f "nodemon" && pkill -f "ts-node.*main.ts"
lsof -ti:5800,5801 | xargs kill -9 2>/dev/null || true

# 2. 清理缓存
cd apps/api && rm -rf node_modules/.cache

# 3. 重新启动API服务
cd apps/api && pnpm dev

# 4. 等待服务启动完成（观察日志无错误）
```

### 第七步：前端集成（如需要）

如果新模型需要特殊的前端界面，更新相关组件：

1. **更新模型选择器**（如果需要在界面中显示）：
```typescript
// packages/ai-workspace-common/src/components/canvas/launchpad/chat-actions/model-selector.tsx
// 添加新模型的显示逻辑
```

2. **创建专用组件**（如法律文档审核面板）：
```typescript
// packages/ai-workspace-common/src/components/legal-review/legal-review-panel.tsx
// 类似于 deep-research-panel.tsx 的实现
```

## 🛡️ 安全保障措施

### 1. 隔离配置
- ✅ 每个模型有独立的配置对象
- ✅ 独立的环境变量
- ✅ 独立的API密钥
- ✅ 修改一个模型不影响其他模型

### 2. 向后兼容
- ✅ 不修改现有模型的配置
- ✅ 不更改现有的环境变量名
- ✅ 保持现有API接口不变

### 3. 错误隔离
- ✅ 新模型配置错误不影响现有模型
- ✅ 详细的错误日志和调试信息
- ✅ 优雅的降级处理

## 🔍 验证检查清单

添加新模型后，请逐项检查：

- [ ] 新模型配置已添加到 `MODEL_CONFIGS`
- [ ] 环境变量已正确设置（大小写、格式）
- [ ] 验证脚本通过
- [ ] 新模型可以正常调用
- [ ] 现有模型仍然正常工作
- [ ] API服务启动无错误
- [ ] 前端界面正常显示（如适用）
- [ ] 所有测试通过

## 🚨 常见问题和解决方案

### 问题1：API密钥未找到
```
Error: API key not configured for model: hkgai/newmodel
```

**解决方案：**
1. 检查 `.env` 文件中环境变量名是否正确
2. 确认环境变量值不为空
3. 重启API服务器以加载新环境变量

### 问题2：模型配置未生效
```
Error: Model configuration not found: hkgai/newmodel
```

**解决方案：**
1. 确认已在 `MODEL_CONFIGS` 中添加配置
2. 检查模型名称拼写是否正确
3. 重新构建和重启服务

### 问题3：请求格式错误
```
Error: Invalid request format for model
```

**解决方案：**
1. 确认 `requestFormat` 设置正确（openai/dify/hkgai）
2. 检查 `baseUrl` 和 `endpoint` 是否匹配
3. 验证API密钥是否有权限访问该端点

## 📝 最佳实践

1. **渐进式添加**：先在开发环境测试，再部署到生产环境
2. **配置验证**：每次添加新模型后都运行完整的验证流程
3. **文档更新**：及时更新相关文档和配置指南
4. **监控日志**：密切关注API服务器日志，及时发现问题
5. **备份配置**：在修改前备份重要配置文件

## 🔄 回滚方案

如果新模型配置出现问题，可以快速回滚：

```bash
# 1. 从配置中移除新模型
git checkout -- packages/providers/src/config/model-configs.ts

# 2. 移除环境变量（或注释掉）
# 编辑 .env 文件

# 3. 重启服务
cd apps/api && pnpm dev

# 4. 验证现有模型正常工作
./scripts/validate-hkgai-env.sh
```

通过遵循这个流程，你可以安全地添加新模型而不影响现有系统的稳定性。 