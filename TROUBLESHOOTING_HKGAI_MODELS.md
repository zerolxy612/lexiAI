# HKGAI模型配置故障排除指南

## 概述

本文档记录了在配置HKGAI模型时可能遇到的常见问题及其解决方案，特别是"API key not configured for model"错误的完整排查和修复流程。

## 问题描述

### 典型错误表现

```
Error: API key not configured for model: hkgai/searchentry
Error: API key not configured for model: hkgai/general
Error: API key not configured for model: hkgai/rag
```

### 错误发生位置

错误通常发生在以下调用链中：
```
EnhancedHKGAIChatModel constructor -> getChatModel -> SkillEngine.chatModel -> Agent initialization
```

## 常见原因分析

### 1. 环境变量名称大小写错误

**问题**：`.env`文件中的环境变量名称大小写不一致

**错误示例**：
```bash
# 错误 - 首字母小写
hKGAI_CONTRACT_API_KEY=app-xxxxx
hKGAI_CASE_API_KEY=app-xxxxx
hKGAI_CODE_API_KEY=app-xxxxx

# 正确 - 全部大写
HKGAI_CONTRACT_API_KEY=app-xxxxx
HKGAI_CASE_API_KEY=app-xxxxx
HKGAI_CODE_API_KEY=app-xxxxx
```

**检查方法**：
```bash
# 检查当前环境变量
cat .env | grep -i hkgai

# 验证环境变量是否正确加载
export $(cat .env | grep -v '^#' | xargs) && env | grep HKGAI
```

### 2. API服务器未正确加载环境变量文件

**问题**：nodemon配置中的环境变量文件路径不正确

**错误配置**：
```json
{
  "exec": "node --env-file=.env -r ts-node/register -r tsconfig-paths/register src/main.ts"
}
```

**正确配置**：
```json
{
  "exec": "node --env-file=../../.env -r ts-node/register -r tsconfig-paths/register src/main.ts"
}
```

**原因**：API服务器在`apps/api`目录下运行，需要相对路径指向根目录的`.env`文件

### 3. 新配置系统与环境变量不匹配

**问题**：新的配置系统期望特定格式的环境变量名称

**配置系统期望的环境变量**：
```bash
HKGAI_GENERAL_API_KEY=app-xxxxx
HKGAI_SEARCHENTRY_API_KEY=app-xxxxx
HKGAI_RAG_API_KEY=app-xxxxx
HKGAI_CONTRACT_API_KEY=app-xxxxx
HKGAI_MISSINGINFO_API_KEY=app-xxxxx
HKGAI_TIMELINE_API_KEY=app-xxxxx
HKGAI_CASE_SEARCH_API_KEY=app-xxxxx
HKGAI_CODE_SEARCH_API_KEY=app-xxxxx
HKGAI_API_KEY=app-xxxxx  # 全局fallback密钥
```

## 完整解决方案

### 步骤1：检查和修复环境变量名称

1. **检查当前环境变量**：
```bash
cat .env | grep -i hkgai
```

2. **修复大小写错误**：
```bash
sed -i.bak 's/hKGAI_CONTRACT_API_KEY/HKGAI_CONTRACT_API_KEY/g' .env
sed -i.bak 's/hKGAI_CASE_API_KEY/HKGAI_CASE_API_KEY/g' .env
sed -i.bak 's/hKGAI_CODE_API_KEY/HKGAI_CODE_API_KEY/g' .env
```

3. **验证修复结果**：
```bash
cat .env | grep -E "HKGAI.*API_KEY"
```

### 步骤2：修复nodemon配置

1. **编辑`apps/api/nodemon.json`**：
```json
{
  "watch": [
    "src/modules",
    "src/server",
    "../../packages/openapi-schema",
    "../../packages/common-types",
    "../../packages/skill-template",
    "../../packages/utils"
  ],
  "ext": "ts",
  "ignore": ["src/**/*.spec.ts"],
  "exec": "prisma format && prisma generate && node --env-file=../../.env -r ts-node/register -r tsconfig-paths/register src/main.ts"
}
```

**关键修改**：`--env-file=.env` → `--env-file=../../.env`

### 步骤3：彻底重启API服务器

1. **杀掉所有相关进程**：
```bash
pkill -f "pnpm.*api.*dev"
pkill -f "nodemon"
pkill -f "ts-node.*main.ts"
lsof -ti:5800,5801 | xargs kill -9 2>/dev/null
```

2. **重新启动API服务器**：
```bash
cd apps/api && pnpm dev
```

### 步骤4：验证修复结果

1. **创建验证脚本**：
```javascript
#!/usr/bin/env node
// test-env-validation.js

const expectedEnvVars = [
  'HKGAI_RAG_API_KEY',
  'HKGAI_CONTRACT_API_KEY',
  'HKGAI_GENERAL_API_KEY',
  'HKGAI_SEARCHENTRY_API_KEY',
  'HKGAI_MISSINGINFO_API_KEY',
  'HKGAI_TIMELINE_API_KEY',
  'HKGAI_CASE_SEARCH_API_KEY',
  'HKGAI_CODE_SEARCH_API_KEY',
  'HKGAI_API_KEY'
];

console.log('🔍 Validating HKGAI environment variables...\n');

let allGood = true;
let foundKeys = 0;

expectedEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  const status = value ? '✅' : '❌';
  const displayValue = value ? `${value.substring(0, 8)}...` : 'NOT SET';
  
  console.log(`${status} ${envVar}: ${displayValue}`);
  
  if (value) {
    foundKeys++;
  } else if (envVar !== 'HKGAI_API_KEY') {
    allGood = false;
  }
});

console.log(`\n📊 Summary: ${foundKeys}/${expectedEnvVars.length} environment variables configured`);
console.log(allGood || process.env.HKGAI_API_KEY ? '✅ Configuration valid' : '❌ Configuration incomplete');
```

2. **运行验证**：
```bash
# 使用验证脚本（推荐）
./scripts/validate-hkgai-env.sh

# 或者手动验证
export $(cat .env | grep -v '^#' | xargs) && node test-env-validation.js
```

## 预防措施

### 1. 环境变量命名规范

- 始终使用**全大写**的环境变量名称
- 遵循`HKGAI_{MODEL_NAME}_API_KEY`的命名模式
- 在添加新模型时，更新配置系统和环境变量

### 2. 开发环境设置检查清单

- [ ] 确认`.env`文件在项目根目录
- [ ] 验证所有HKGAI环境变量名称大小写正确
- [ ] 确认`apps/api/nodemon.json`中的环境变量文件路径正确
- [ ] 重启API服务器后验证环境变量加载

### 3. 调试工具

**快速验证脚本**：
```bash
# 运行完整的环境变量和配置验证
./scripts/validate-hkgai-env.sh
```

**快速环境变量检查**：
```bash
# 创建alias方便使用
alias check-hkgai-env='export $(cat .env | grep -v "^#" | xargs) && env | grep HKGAI | sort'
```

**API服务器环境变量调试**：
在`apps/api/src/modules/config/app.config.ts`中添加调试输出：
```typescript
console.log('🔧 HKGAI Environment Variables:');
console.log('HKGAI_API_KEY:', process.env.HKGAI_API_KEY ? 'SET' : 'NOT SET');
console.log('HKGAI_GENERAL_API_KEY:', process.env.HKGAI_GENERAL_API_KEY ? 'SET' : 'NOT SET');
// ... 其他变量
```

## 相关文件

- **环境变量配置**：`.env`
- **API服务器配置**：`apps/api/nodemon.json`
- **模型配置系统**：`packages/providers/src/config/model-configs.ts`
- **增强HKGAI客户端**：`packages/providers/src/llm/enhanced-hkgai-chat-model.ts`
- **模型配置指南**：`MODEL_CONFIGURATION_GUIDE.md`

## 常见错误模式

### 错误模式1：环境变量存在但API服务器读取不到

**症状**：
- `cat .env | grep HKGAI`显示变量存在
- API服务器日志显示"API key not configured"

**原因**：nodemon配置中环境变量文件路径错误

**解决**：修复`apps/api/nodemon.json`中的路径

### 错误模式2：部分模型工作，部分不工作

**症状**：
- 某些HKGAI模型正常工作
- 其他模型报"API key not configured"

**原因**：环境变量名称大小写不一致

**解决**：统一所有环境变量名称为大写

### 错误模式3：修改环境变量后仍然报错

**症状**：
- 修改了`.env`文件
- API服务器仍然报相同错误

**原因**：API服务器进程没有重启，仍在使用旧的环境变量

**解决**：彻底杀掉进程并重启

## 总结

这个问题的核心在于**环境变量配置的一致性**：

1. **命名一致性**：环境变量名称必须与配置系统期望的完全匹配
2. **路径一致性**：nodemon配置中的环境变量文件路径必须正确
3. **进程一致性**：修改环境变量后必须重启API服务器进程

通过遵循本文档的检查清单和解决步骤，可以避免类似问题的重复发生，节省宝贵的开发时间。 