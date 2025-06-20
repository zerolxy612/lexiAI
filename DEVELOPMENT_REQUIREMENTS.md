# Refly 二次开发需求文档

## 📋 项目概述

本文档记录 Refly 项目的二次开发需求、技术分析思路以及代码质量原则，确保开发过程的规范性和可追溯性。

## 🚀 项目启动步骤

### 第一步：启动 Docker 服务
**在项目根目录** `/Users/longxiangyu/LexiHk/lexiAI` **执行：**

```bash
# 进入 docker 配置目录
cd deploy/docker

# 启动数据库和中间件服务
docker-compose -f docker-compose.yml -f docker-compose.middleware.yml up -d
```

### 第二步：安装依赖（如果还没安装过）
**回到项目根目录** `/Users/longxiangyu/LexiHk/lexiAI` **执行：**

```bash
# 回到根目录
cd ../..

# 安装所有依赖
pnpm install
```

### 第三步：启动后端 API
**在项目根目录** `/Users/longxiangyu/LexiHk/lexiAI` **执行：**

```bash
# 启动后端 API
pnpm run dev --filter=@refly/api
```

或者进入API目录启动：
```bash
# 进入 API 目录
cd apps/api

# 启动开发服务器
pnpm dev
```ƒƒ

### 第四步：启动前端
**新开一个终端窗口，在项目根目录** `/Users/longxiangyu/LexiHk/lexiAI` **执行：**

```bash
# 启动前端开发服务器
pnpm run dev --filter=@refly/web
```

或者进入web目录启动：
```bash
# 进入 web 目录
cd apps/web

# 启动开发服务器
pnpm dev
```

### 验证启动是否成功

1. **检查 Docker 容器**：
```bash
docker ps
```
应该看到数据库等服务在运行

2. **检查后端 API**：
浏览器访问 `http://localhost:3000` 或查看终端输出的端口

3. **检查前端应用**：
浏览器访问 `http://localhost:5173` 或查看终端输出的端口

### 启动顺序总结

```
项目根目录 /Users/longxiangyu/LexiHk/lexiAI
├── 1. cd deploy/docker && docker-compose up -d
├── 2. cd ../../ && pnpm install
├── 3. pnpm run dev --filter=@refly/api
└── 4. pnpm run dev --filter=@refly/web（新终端窗口）
```

**注意事项**：
- 必须按顺序启动：Docker → 后端 API → 前端
- 后端 API 需要连接数据库，数据库在 Docker 容器中运行
- 前端需要调用后端 API 获取用户信息、进行认证等
- 启动成功后，修改的功能（如语言切换、账户按钮）才能正常工作

## 🎯 开发原则

### 代码质量原则
1. **可维护性优先**: 所有修改都应考虑后续维护成本
2. **配置驱动**: 通过配置文件或环境变量控制功能开关，避免硬编码
3. **向后兼容**: 新功能不应破坏现有功能
4. **模块化设计**: 功能模块独立，降低耦合度
5. **文档完整**: 重大修改需要更新相关文档

### 技术规范
- 遵循 TypeScript 严格模式
- 使用 ESLint + Prettier 保证代码风格统一
- 组件采用函数式组件 + Hooks
- 状态管理使用 Zustand + React Query
- 样式使用 Tailwind CSS + 语义化类名
- 国际化支持中英双语

## 📝 需求列表

### 需求 #001: 修改首页为登录注册页面

**需求描述**: 
将项目首页从当前的营销展示页面改为直接显示登录注册页面

**当前行为**:
- 访问根路径 `/` 时，未登录用户看到营销首页（包含产品介绍、功能展示等）
- 已登录用户自动重定向到 `/canvas/empty`

**期望行为**:
- 访问根路径 `/` 时，未登录用户直接看到登录注册页面
- 已登录用户行为保持不变，重定向到工作区

**影响范围**:
- 路由配置 (`apps/web/src/routes/index.tsx`)
- 首页重定向逻辑 (`packages/ai-workspace-common/src/components/home-redirect/index.tsx`)
- 可能需要保留营销页面的访问路径

**技术分析**:

1. **核心修改点**:
   - `HomeRedirect` 组件逻辑需要调整
   - 需要决定营销页面的新路径（如 `/landing` 或 `/about`）

2. **实现方案**:
   - 方案A: 直接修改 `HomeRedirect` 组件，未登录时显示登录页面
   - 方案B: 添加配置项控制首页行为，保持灵活性
   - **推荐方案B**: 通过环境变量控制，便于后续调整

3. **代码变更预估**:
   - 修改文件: 2-3 个
   - 新增配置: 1 个环境变量
   - 测试范围: 登录流程、路由跳转

**道德/合规考虑**:
- ✅ 不涉及数据隐私问题
- ✅ 不影响用户数据安全
- ✅ 符合用户体验改进目标
- ⚠️ 需考虑SEO影响（营销页面对搜索引擎的可见性）

**优先级**: 高
**预估工时**: 0.5 天
**状态**: 已完成

### 需求 #013: 搜索组件历史记录显示问题修复

**需求描述**: 
修复侧边栏搜索框点击弹出搜索组件时，第一次能显示历史记录，但第二次及之后显示历史为空的问题

**问题现象**:
- 第一次打开搜索模态框：能正常显示历史记录
- 关闭搜索模态框后再次打开：历史记录显示为空
- 需要刷新页面才能重新看到历史记录

**根本原因**:
`BigSearchModal`组件中每次关闭搜索模态框时都会调用`resetState()`，清空所有搜索结果数据，包括历史记录缓存

**解决方案**:
采用方案一（优化resetState逻辑）- 区分UI状态重置和完全重置：
- 在search store中新增`resetUIState()`方法，只重置UI相关状态
- 创建`defaultUIState`常量，定义需要重置的UI状态范围
- 修改`BigSearchModal`使用`resetUIState()`替代`resetState()`
- 保留搜索结果缓存，提升用户体验

**技术实现**:
1. **新增resetUIState方法**: 只重置`pages`和`noCategoryBigSearchRes`等UI状态
2. **保留搜索结果数据**: `canvases`、`resources`、`documents`、`searchedCanvases`等
3. **向后兼容**: 保留`resetState()`方法用于需要完全重置的场景
4. **添加详细注释**: 说明修复原因和实现方式

**修改文件**:
- `packages/ai-workspace-common/src/stores/search.ts` - 新增resetUIState方法
- `packages/ai-workspace-common/src/components/search/modal.tsx` - 使用新的重置方法

**测试验证**: 
- ✅ 通过biome代码检查，确保代码质量
- ✅ 最小化修改范围，降低引入新问题的风险
- ✅ 保持向后兼容性

**维护性考虑**:
- 清晰的方法命名和注释，便于后续维护
- 避免重复API调用，提升性能
- 最小化修改，只解决核心问题

**优先级**: 中
**预估工时**: 0.3 天
**状态**: 已完成

**实现详情**:
1. ✅ 创建独立的登录页面组件 (`apps/web/src/pages/auth/index.tsx`)
2. ✅ 修改 `HomeRedirect` 组件支持配置驱动行为
3. ✅ 添加新路由配置:
   - `/auth` - 独立登录注册页面
   - `/landing` - 原营销页面的新路径
   - `/` - 根据配置显示登录页面或营销页面
4. ✅ 添加环境变量 `VITE_HOMEPAGE_SHOW_AUTH` 控制首页行为

**使用方法**:
- 设置环境变量 `VITE_HOMEPAGE_SHOW_AUTH=true` 启用登录首页
- 设置环境变量 `VITE_HOMEPAGE_SHOW_AUTH=false` 或不设置保持原有行为
- 访问 `/landing` 可直接查看营销页面
- 访问 `/auth` 可直接进入登录页面

### 需求 #002: 修改登录后首页左侧边栏样式

**需求描述**: 
修改用户登录后进入的首页（/canvas/empty）左侧边栏的视觉设计，主要包括logo替换、搜索框样式调整以及整体布局优化

**当前行为**:
- 侧边栏顶部显示 Refly logo + GitHub星标按钮
- 搜索框为简单的边框样式，带有⌘K快捷键提示
- 整体采用白色背景 + 灰色边框的设计

**期望行为**:
- 替换为新的 LexiHK logo：左侧方形深色图标 + "LexiHK"文字（其中K为绿色）
- 移除 GitHub 星标按钮，采用更简洁的logo布局
- 搜索框保持现有功能，可能需要微调样式以配合新的视觉风格
- 整体布局和间距保持一致，主要是品牌标识的替换

**影响范围**:
- `packages/ai-workspace-common/src/components/sider/layout.tsx` - 主要侧边栏布局组件
- `packages/ai-workspace-common/src/components/search-quick-open-btn/index.tsx` - 搜索框组件
- 可能需要新增logo资源文件
- CSS样式调整

**技术分析**:

1. **核心修改点**:
   - `SiderLogo` 组件: 替换logo图片和布局样式
   - `SearchQuickOpenBtn` 组件: 调整搜索框的视觉设计
   - 整体侧边栏容器样式调整

2. **实现方案**:
   - 方案A: 直接修改现有组件样式
   - 方案B: 创建新的样式变体，通过配置控制
   - **推荐方案A**: 直接替换，符合品牌升级需求

3. **详细变更点**:
   - Logo区域: 
     - 更换logo图片资源
     - 调整logo和文字的布局方式
     - 可能移除或重新设计GitHub星标按钮
   - 搜索框区域:
     - 修改边框样式和颜色
     - 调整内边距和圆角
     - 优化图标和文字的对齐方式
     - 重新设计hover效果
   - 整体布局:
     - 调整各区域间距
     - 可能需要调整侧边栏宽度
     - 优化色彩搭配

4. **具体设计要求**（基于效果图分析）:
   - Logo替换：
     - 左侧：方形深色图标（需要提供SVG或PNG素材）
     - 右侧：文字"LexiHK"，其中"Lexi"为深色，"K"为绿色
     - 移除GitHub星标按钮
   - 搜索框保持现有样式和功能
   - 整体布局间距保持一致
   - 需要确认：logo图标的具体素材文件

**道德/合规考虑**:
- ✅ 纯视觉样式修改，不涉及功能变更
- ✅ 不影响用户数据和隐私
- ✅ 符合品牌升级和用户体验改进目标
- ⚠️ 需确保新设计符合无障碍访问标准

**优先级**: 中
**预估工时**: 0.5-1 天（取决于设计复杂度）
**状态**: 已完成

**前置条件**:
- ✅ 已获取设计效果图对比
- ✅ 找到LexiHK logo文件 (`apps/web/src/assets/Lexihk-dark.png`)
- ✅ 找到书本图标文件 (`apps/web/src/assets/Vector.png`)
- ✅ 找到add.png图标文件 (`apps/web/src/assets/add.png`)

**实现详情**:
1. ✅ 修改 `SiderLogo` 组件，替换为 LexiHK logo
2. ✅ 移除 GitHub 星标按钮和相关逻辑
3. ✅ 将折叠按钮图标替换为书本图标 (Vector.png)
4. ✅ 调整书本图标位置至 LexiHK logo 左侧
5. ✅ 修改收缩状态下的展开按钮也使用书本图标
6. ✅ 确保侧边栏收缩后用户仍能通过书本图标重新展开
7. ✅ 修改搜索框样式：背景色改为#f1f5f8，移除所有图标，文字改为"The landlord does not return the deposit"
8. ✅ **新增创建画布快捷按钮**：在侧边栏右上角添加add.png图标，与LexiHK logo处于同一水平线，点击后创建新画布

**阶段二：功能增强 - 创建画布快捷按钮**:

**技术实现要点**:
- **位置布局**: 使用`justify-between`将logo区域和add按钮分别放在左右两侧
- **图标样式**: add.png图标尺寸4x4，与书本图标保持一致
- **功能复用**: 集成现有的`useCreateCanvas` hook，支持防抖和状态管理
- **用户体验**: 
  - 支持loading状态显示
  - 事件冒泡阻止，避免触发logo点击导航
  - 与其他按钮保持一致的hover效果
  - 创建成功后自动导航到新画布

**代码结构**:
```typescript
// SiderLogo组件增强
const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas();

// 布局结构
<div className="flex items-center justify-between p-3">
  <div className="flex items-center gap-2">
    {/* 书本图标 + LexiHK logo */}
  </div>
  {/* 新增：创建画布按钮 */}
  <Button
    icon={<img src={AddIcon} alt="Create new canvas" className="h-4 w-4" />}
    onClick={(e) => {
      e.stopPropagation();
      debouncedCreateCanvas();
    }}
    loading={createCanvasLoading}
  />
</div>
```

**修改的文件**:
- `packages/ai-workspace-common/src/components/sider/layout.tsx` - 主要侧边栏组件
- `apps/web/src/pages/canvas/index.tsx` - 画布页面收缩状态按钮
- `packages/ai-workspace-common/src/components/project/no-canvas/index.tsx` - 项目页面收缩状态按钮
- `packages/ai-workspace-common/src/components/search-quick-open-btn/index.tsx` - 搜索框组件样式修改

**测试要点**:
- 各种屏幕尺寸下的显示效果
- 深色模式的适配
- 搜索功能的正常工作
- 响应式布局的兼容性

### 需求 #003: 侧边栏宽度增加和内容简化

**需求描述**: 
增加侧边栏宽度并简化内容结构，为将来的对话记录功能预留空间

**当前行为**:
- 侧边栏宽度220px，内容包括首页/画布/知识库等全部菜单项
- 包含账号信息、订阅提示等底部内容

**期望行为**:
- 侧边栏宽度增加到300px
- 保留：书本图标 + LexiHK logo + 搜索框
- 隐藏：所有菜单项和底部内容（暂时注释，将来移到其他位置）
- 预留空间用于将来的对话记录功能（类似ChatGPT侧边栏）

**影响范围**:
- `packages/ai-workspace-common/src/components/sider/layout.tsx` - 主要侧边栏组件
- `apps/web/src/components/layout/index.tsx` - 主布局宽度计算

**技术分析**:

1. **宽度调整**:
   - 侧边栏宽度：220px → 300px
   - 主内容区域宽度：calc(100% - 200px - 16px) → calc(100% - 300px - 16px)

2. **内容简化**:
   - 注释掉所有菜单相关代码（首页、画布、知识库等）
   - 注释掉底部用户信息和订阅提示
   - 添加对话记录占位区域

3. **未来扩展预留**:
   - 在搜索框下方添加flex-1容器
   - 临时显示占位提示文字
   - 保持代码结构便于后续开发

**道德/合规考虑**:
- ✅ 纯UI结构调整，不影响用户数据
- ✅ 暂时隐藏功能，不删除代码
- ✅ 为用户体验改进做准备

**优先级**: 中
**预估工时**: 0.5天
**状态**: 已完成

**实现详情**:
1. ✅ 调整侧边栏宽度从220px到300px
2. ✅ 更新主布局的宽度计算
3. ✅ 注释掉所有菜单项和底部内容
4. ✅ 添加对话记录占位区域
5. ✅ 保持代码注释便于后续恢复

**修改的文件**:
- `packages/ai-workspace-common/src/components/sider/layout.tsx` - 侧边栏主组件
- `apps/web/src/components/layout/index.tsx` - 主布局宽度调整

**测试要点**:
- 侧边栏宽度变化后的响应式效果
- 主内容区域布局适配
- 折叠/展开功能正常工作
- 深色模式适配

### 需求 #004: 实现侧边栏对话/画布历史记录功能

**需求描述**: 
在左侧侧边栏实现类似ChatGPT的对话历史功能，用户创建对话/画布时自动保存记录并显示在侧边栏中

**当前行为**:
- 侧边栏只显示占位符文本"💬 Conversation history will appear here"
- 用户无法查看历史对话/画布记录
- 缺少快速导航到已有对话的功能

**期望行为**:
- 显示最近的对话/画布历史记录列表
- 每个记录显示用户问的问题或总结性内容作为标题
- 超出字数限制时使用省略号截断
- 按时间倒序排列（最新的在上面）
- 点击记录可以快速跳转到对应的对话/画布
- 高亮显示当前正在查看的记录
- 区分画布（🎨图标）和对话（💬图标）类型

**影响范围**:
- 新增组件：`packages/ai-workspace-common/src/components/sider/conversation-history.tsx`
- 修改文件：`packages/ai-workspace-common/src/components/sider/layout.tsx`
- 使用现有状态管理：`useSiderStoreShallow`, `useCanvasStore`

**技术分析**:

1. **数据来源**:
   - `canvasList`: 从侧边栏store获取画布列表数据
   - `linearThreadMessages`: 从画布store获取对话消息数据
   - 合并并去重两个数据源

2. **核心功能**:
   ```typescript
   // 数据处理逻辑
   - extractTitleFromContent(): 提取用户问题或生成摘要
   - truncateText(): 文字截断处理（40字符限制）
   - 按更新时间排序: sort by updatedAt DESC
   ```

3. **UI设计**:
   - 使用Tailwind CSS实现响应式布局
   - 绿色主题配色与项目保持一致
   - hover效果和选中状态高亮
   - 图标区分：IconCanvas（画布）+ IconThreadHistory（对话）

4. **性能优化**:
   - 使用React.memo包装组件
   - useMemo缓存计算结果
   - 避免不必要的重新渲染

**实现详情**:

1. **ConversationHistory组件特性**:
   ```typescript
   - 空状态处理：无记录时显示友好提示
   - 响应式滚动：overflow-y-auto支持长列表
   - 双图标系统：区分画布和对话类型
   - 日期显示：显示最后更新时间
   - 路径跳转：正确的URL路由处理
   ```

2. **集成到侧边栏**:
   - 替换原有占位符区域
   - 保持300px侧边栏宽度
   - 与搜索框和Logo协调布局

3. **数据流设计**:
   ```
   Zustand Store -> ConversationHistory -> UI Render
   ├── canvasList (SiderStore)
   ├── linearThreadMessages (CanvasStore)  
   └── 合并 + 排序 + 去重处理
   ```

**技术难点解决**:

1. **标题提取逻辑**:
   - 优先使用用户的首次提问内容
   - 降级到项目名称（非"Untitled"）
   - 最终降级到类型默认名称

2. **数据去重处理**:
   - 避免Canvas和LinearThread数据重复
   - 使用Set数据结构进行ID过滤

3. **图标统一性**:
   - 使用项目已有图标系统
   - IconCanvas: TfiBlackboard
   - IconThreadHistory: RiChatHistoryLine

**测试要点**:
- ✅ 空状态显示正确
- ✅ 创建新画布后自动出现在历史中
- ✅ 点击历史记录正确跳转
- ✅ 长标题正确截断显示
- ✅ 当前页面高亮状态正确
- ✅ 深色模式适配正常
- ✅ 响应式布局在不同屏幕尺寸下正常

**道德/合规考虑**:
- ✅ 不涉及额外数据存储
- ✅ 使用现有数据结构
- ✅ 不影响用户隐私
- ✅ 提升用户体验

**优先级**: 高
**预估工时**: 1 天
**状态**: ✅ 已完成

**使用效果**:
- 用户可以在侧边栏看到所有历史对话和画布
- 快速导航提升工作效率
- 清晰的视觉层次和交互反馈
- 与整体设计风格保持一致

### 需求 #005: 修复MCP功能（优先级：高）

**需求描述**: 
修复McpSelectorPanel组件错误，恢复MCP（Model Context Protocol）功能

**问题背景**:
- MCP是扩展AI能力的重要协议，允许AI调用外部工具和服务
- 用户明确表示后续一定需要使用MCP功能
- 当前`useListMcpServersSuspense` hook导致组件崩溃

**影响范围**:
- `packages/ai-workspace-common/src/components/canvas/launchpad/mcp-selector-panel/index.tsx`
- MCP相关的hook和查询逻辑
- 可能涉及Suspense边界配置

**技术分析**:
1. **根本原因**: Suspense hook可能缺少正确的Suspense边界或查询配置问题
2. **修复方向**:
   - 检查`useListMcpServersSuspense`的实现
   - 确保组件被正确的Suspense边界包裹
   - 修复查询参数或错误处理逻辑
   - 测试MCP服务器连接和工具加载

**优先级**: 高（用户强需求）
**预估工时**: 1-2天
**状态**: 待开始

**前置条件**:
- 先完成需求#004的底部输入框功能
- 确保基础画布功能稳定

**实现进度**:
- ✅ **第一阶段**: 自动画布创建逻辑
  - 修改 `apps/web/src/pages/canvas/index.tsx`
  - 当用户访问 `/canvas/empty` 时自动创建新画布
  - 显示加载状态："`Creating your canvas...`"
  - 保留原有 FrontPage 代码以备后用
  - 实现无感知跳转到新创建的画布页面
  - **问题修复**: 暂时禁用 McpSelectorPanel 组件中的 suspense hook，避免渲染错误
- 🔄 **待完成**: 底部简洁输入框设计和集成

**技术问题记录**:
- **⚠️ McpSelectorPanel 组件错误**: `useListMcpServersSuspense` hook 导致组件崩溃
  - 临时解决方案: 注释掉 suspense hook，使用空数据
  - 文件: `packages/ai-workspace-common/src/components/canvas/launchpad/mcp-selector-panel/index.tsx`
  - **状态**: 🔴 需要修复 - 用户确认后续一定要用MCP功能
  
**MCP（Model Context Protocol）重要性**:
- **功能定位**: 扩展AI助手能力的核心协议，允许连接外部工具和服务
- **主要用途**:
  - 实时数据访问（天气、股价、新闻等）
  - 文件系统操作（读写文件、数据处理）
  - 第三方服务集成（API调用、数据库查询）
  - 计算工具和代码执行
- **影响范围**: 
  - ✅ 基础AI对话功能不受影响
  - ❌ 实时数据查询功能受限
  - ❌ 外部工具调用功能不可用
  - ❌ 复杂文件处理功能受限

### 需求 #006: 完善语言切换功能

**需求描述**: 
修复侧边栏组件中的硬编码文本问题，确保所有界面文本都能正确响应语言切换功能

**当前行为**:
- ✅ 项目已有完整的i18n基础设施（react-i18next + 多语言文件）
- ✅ 右上角已有语言切换按钮，功能正常（位于账户信息旁边）
- ❌ 左侧侧边栏中的部分文本硬编码为英文，不响应语言切换
- ❌ 搜索框占位文本："The landlord does not return the deposit" 
- ❌ 对话历史空状态文本使用了错误的翻译函数调用方式

**期望行为**:
- 右上角语言切换功能保持不变
- 左侧侧边栏中所有文本都能正确响应语言切换
- 搜索框占位文本应该使用合适的中英文翻译
- 对话历史组件的空状态文本应该正确翻译

**影响范围**:
- `packages/ai-workspace-common/src/components/search-quick-open-btn/index.tsx` - 搜索框硬编码文本
- `packages/ai-workspace-common/src/components/sider/conversation-history.tsx` - 对话历史翻译问题
- 可能需要在翻译文件中添加缺失的翻译键

**技术分析**:

1. **已确认的问题**:
   - **搜索框硬编码**: `"The landlord does not return the deposit"` 需要使用翻译函数
   - **对话历史翻译错误**: `t('sider.history.empty.title', 'No conversations yet')` 使用了错误的语法
   - **翻译键缺失**: 相关翻译键可能在翻译文件中不存在

2. **修复方案**:
   ```typescript
   // 搜索框修复
   - <span>The landlord does not return the deposit</span>
   + <span>{t('search.placeholder')}</span>
   
   // 对话历史修复  
   - <div>{t('sider.history.empty.title', 'No conversations yet')}</div>
   + <div>{t('sider.history.empty.title')}</div>
   ```

3. **需要添加的翻译键**:
   ```typescript
   // 英文翻译文件
   search: {
     placeholder: 'Search everything...'
   },
   sider: {
     history: {
       empty: {
         title: 'No conversations yet'
       }
     }
   }
   
   // 中文翻译文件  
   search: {
     placeholder: '搜索任何内容...'
   },
   sider: {
     history: {
       empty: {
         title: '暂无对话记录'
       }
     }
   }
   ```

**实现详情**:
1. ✅ **添加翻译键**: 在 `packages/i18n/src/en-US/ui.ts` 和 `packages/i18n/src/zh-Hans/ui.ts` 中添加了新的翻译键
2. ✅ **修复搜索框**: 
   - 添加 `useTranslation` hook 导入
   - 将硬编码文本替换为 `{placeholder || t('search.placeholder')}`
   - 支持 prop 传入的自定义占位文本或使用默认翻译
3. ✅ **修复对话历史**: 
   - 移除错误的翻译函数语法，使用正确的 `t('sider.history.empty.title')`
   - 确保空状态文本正确响应语言切换

**修改的文件**:
- `packages/i18n/src/en-US/ui.ts` - 添加英文翻译键
- `packages/i18n/src/zh-Hans/ui.ts` - 添加中文翻译键  
- `packages/ai-workspace-common/src/components/search-quick-open-btn/index.tsx` - 修复搜索框硬编码文本
- `packages/ai-workspace-common/src/components/sider/conversation-history.tsx` - 修复翻译函数调用

**测试要点**:
- ✅ 语言切换功能的响应性测试
- ✅ 搜索框占位文本正确翻译
- ✅ 对话历史空状态文本正确翻译
- ✅ 不同语言下的UI布局适配正常

**实现步骤**:
1. 修复搜索框组件的硬编码文本
2. 修复对话历史组件的翻译函数调用
3. 在翻译文件中添加缺失的翻译键
4. 测试语言切换功能的响应性

**道德/合规考虑**:
- ✅ 提升用户体验，支持多语言用户
- ✅ 不涉及用户数据隐私问题
- ✅ 符合国际化最佳实践

**优先级**: 中（用户体验改进，修复现有功能缺陷）
**预估工时**: 0.5天
**状态**: ✅ 已完成

### 需求 #007: 改进翻译文件组织结构

**需求描述**: 
重构当前的单一巨大翻译文件，采用模块化的翻译文件组织方式，提升可维护性和团队协作效率

**当前问题**:
- ❌ 单一巨大文件：`ui.ts` 文件超过2800行，难以维护
- ❌ 查找困难：在巨大文件中搜索特定翻译键效率低
- ❌ 团队协作问题：多人同时修改同一文件容易产生冲突
- ❌ 加载性能：加载所有翻译内容，无法按需加载
- ❌ 逻辑混乱：各种功能的翻译混在一起，缺乏清晰结构

**期望目标**:
- 按功能模块拆分翻译文件，提升可维护性
- 保持现有功能完全兼容，不破坏用户体验
- 建立清晰的翻译文件组织规范
- 为将来的按需加载和性能优化打基础

**影响范围**:
- `packages/i18n/src/en-US/ui.ts` - 拆分为多个模块文件
- `packages/i18n/src/zh-Hans/ui.ts` - 对应拆分
- 可能需要修改翻译加载逻辑

**实施方案**:

**阶段一：内部重组织（立即执行）**
1. **保持单文件结构**，但内部按逻辑重新分组：
   ```typescript
   // 新的内部结构
   const translations = {
     // 1. 通用组件和全局内容
     common: { ... },
     language: 'English',
     productName: 'Refly',
     
     // 2. 认证相关
     auth: {
       login: { ... },
       register: { ... },
       verification: { ... }
     },
     
     // 3. 侧边栏和导航
     sider: {
       menu: { ... },
       history: { ... },
       search: { ... }
     },
     
     // 4. 画布相关
     canvas: {
       toolbar: { ... },
       nodes: { ... },
       actions: { ... }
     },
     
     // 5. 设置和配置
     settings: {
       account: { ... },
       language: { ... },
       subscription: { ... }
     },
     
     // 6. 项目和知识库
     project: { ... },
     knowledgeLibrary: { ... },
     
     // 7. 技能和模板
     skill: { ... },
     template: { ... }
   };
   ```

**阶段二：文件拆分（下一迭代）**
2. **拆分为独立文件**：
   ```
   packages/i18n/src/
   ├── en-US/
   │   ├── index.ts           # 汇总导出
   │   ├── common.ts          # 通用翻译
   │   ├── auth.ts            # 认证模块
   │   ├── sider.ts           # 侧边栏
   │   ├── canvas.ts          # 画布功能
   │   ├── settings.ts        # 设置页面
   │   ├── project.ts         # 项目管理
   │   ├── knowledge.ts       # 知识库
   │   ├── skill.ts           # 技能功能
   │   └── template.ts        # 模板功能
   └── zh-Hans/
       ├── index.ts
       ├── common.ts
       ├── auth.ts
       └── ...
   ```

3. **兼容性处理**：
   ```typescript
   // packages/i18n/src/en-US/index.ts
   import common from './common';
   import auth from './auth';
   import sider from './sider';
   // ... 其他模块
   
   // 保持原有的扁平结构，确保现有代码不受影响
   export default {
     ...common,
     auth,
     sider,
     canvas,
     settings,
     project,
     knowledgeLibrary,
     skill,
     template,
     // 保持向后兼容
     language: common.language,
     productName: common.productName
   };
   ```

**阶段三：按需加载优化（未来规划）**
4. **实现动态加载**：
   ```typescript
   // 支持按模块动态加载
   const loadTranslationModule = async (module: string, locale: string) => {
     return await import(`./src/${locale}/${module}.ts`);
   };
   ```

**拆分规则和原则**:

1. **按功能域拆分**：
   - `common.ts` - 通用按钮、消息、全局常量
   - `auth.ts` - 登录、注册、验证相关
   - `sider.ts` - 侧边栏、导航、菜单
   - `canvas.ts` - 画布、节点、工具栏
   - `settings.ts` - 设置页面、用户配置
   - `project.ts` - 项目管理、文件操作
   - `knowledge.ts` - 知识库、资源管理
   - `skill.ts` - 技能系统、执行记录
   - `template.ts` - 模板系统

2. **文件大小控制**：
   - 每个模块文件控制在200-500行以内
   - 超过500行的模块继续细分

3. **命名规范**：
   - 文件名使用kebab-case：`user-management.ts`
   - 翻译键保持原有的点分法：`auth.login.title`

**实施优先级**: 高（影响开发效率和团队协作）
**预估工时**: 1-1.5天
**状态**: 🔄 阶段一进行中 - 内部重组织

**实施进展**:

**阶段一进行中** (内部重组织):
- ✅ **添加分组注释**: 在 `packages/i18n/src/en-US/ui.ts` 和 `packages/i18n/src/zh-Hans/ui.ts` 中添加了清晰的功能分组注释
- ✅ **已完成的分组**:
  1. 全局基础设置和通用内容 (language, productName, welcomeMessage)
  2. 页面元数据和基础页面 (privacyPage, termsPage)  
  3. 通用组件和公共功能 (common 对象)
  4. 页面组件和页面功能 (pages 对象)
  5. 工作区和画布功能 (workspace 对象) - 英文版已完成
- ✅ **双语言支持**: 英文和中文翻译文件都已添加相应的分组注释
- ✅ **功能验证**: 项目仍能正常启动，语言切换功能正常
- 🔄 **进行中**: 继续为其他主要功能模块添加分组注释

**预期完成时间**: 今天内完成阶段一，明天开始阶段二文件拆分

**风险评估**:
- 🟢 **技术风险低** - 主要是文件组织调整，不涉及逻辑变更
- 🟡 **兼容性风险中等** - 需要确保现有翻译键路径不变
- 🟢 **回滚风险低** - 可以快速回滚到原有结构

**测试要点**:
- 所有页面的翻译显示正常
- 语言切换功能完全正常
- 新增翻译键的使用方式保持一致
- 构建和打包过程无错误

**长期收益**:
- 提升团队开发效率50%+
- 减少翻译文件冲突90%+
- 为国际化扩展打下良好基础
- 支持将来的性能优化需求

---

## 🔄 需求状态说明

- **待开始**: 需求已确认，等待开发
- **进行中**: 正在开发实现
- **待测试**: 开发完成，等待测试验证
- **已完成**: 测试通过，已部署
- **已取消**: 需求取消或废弃

## 📋 需求分析模板

每个新需求应包含以下信息：

### 基本信息
- **需求ID**: #XXX
- **需求标题**: 简洁描述
- **提出时间**: YYYY-MM-DD
- **优先级**: 高/中/低

### 需求详情
- **需求描述**: 详细说明期望实现的功能
- **当前行为**: 现有系统的行为表现
- **期望行为**: 修改后期望达到的效果
- **用户价值**: 此需求对用户的价值

### 技术分析
- **影响范围**: 列出可能受影响的模块/文件
- **技术方案**: 详细的实现方案
- **技术风险**: 可能遇到的技术难点
- **性能影响**: 对系统性能的影响评估

### 合规检查
- **数据隐私**: 是否涉及用户数据处理
- **安全风险**: 是否引入新的安全风险
- **法律合规**: 是否符合相关法律法规
- **商业道德**: 是否符合商业道德标准

### 项目管理
- **依赖关系**: 与其他需求的依赖关系
- **预估工时**: 开发时间预估
- **测试要求**: 测试范围和重点
- **发布计划**: 预期发布时间

## 🧪 测试指南

### 需求 #001 测试步骤

1. **默认行为测试** (营销首页):
   ```bash
   # 不设置环境变量或设置为 false
   VITE_HOMEPAGE_SHOW_AUTH=false pnpm dev
   # 访问 http://localhost:5173/ 应显示营销页面
   ```

2. **登录首页测试**:
   ```bash
   # 设置环境变量为 true
   VITE_HOMEPAGE_SHOW_AUTH=true pnpm dev
   # 访问 http://localhost:5173/ 应显示登录页面
   ```

3. **路由测试**:
   - 访问 `/auth` - 应始终显示登录页面
   - 访问 `/landing` - 应始终显示营销页面
   - 已登录用户访问 `/` - 应重定向到 `/canvas/empty`

4. **功能测试**:
   - 登录页面的注册/登录切换
   - OAuth 登录按钮（如果启用）
   - 邮箱登录表单验证
   - "返回首页"按钮功能

## 🚀 下一步行动

1. ✅ **需求 #001**: 首页修改已完成
2. **用户验收测试**: 确认新的登录首页用户体验
3. **性能测试**: 验证新组件的加载性能
4. **文档更新**: 更新部署文档中的环境变量说明

## 📚 相关文档

- [项目架构文档](./README.md)
- [贡献指南](./CONTRIBUTING.md)
- [部署文档](./docs/community-version/self-deploy/)

---

*文档创建时间: 2024-12-19*
*最后更新时间: 2024-12-19*

## 📈 开发进度总结

- **需求总数**: 12
- **已完成**: 8 
- **部分完成**: 1 (需求#010第一、二阶段已完成)
- **进行中**: 1 (需求#009调试中)
- **待开始**: 2
- **完成率**: 75%

## 📚 开发教训记录

### 教训 #001: CSS布局理解错误 (2024-12-19)

**错误行为**:
在修复登录页面logo与表单距离问题时，错误地认为调整容器高度(h-[80px] -> h-[120px] -> h-[60px] -> h-[40px])可以解决间距问题，并且在用户明确指出错误后仍然执迷不悟，继续在错误的方向上进行调整。

**根本问题**:
- **缺乏CSS基础理解**: 没有理解flex布局中`justify-center`的作用机制
- **忽略用户反馈**: 用户明确说"改变高度解决不了问题"，但仍然坚持错误方向
- **缺乏实际查看**: 没有要求查看实际效果，凭空臆测
- **教条主义**: 过分依赖理论知识，缺乏实践验证

**正确解决方案**:
问题的核心是flex容器的对齐方式，而不是高度设置：
- `justify-center`: 让内容在主轴上居中
- `justify-start`: 让内容从起始位置开始排列
- 需要在保持整体居中的同时，合理安排内部元素间距

**经验教训**:
1. **尊重用户反馈**: 当用户明确指出技术方向错误时，应立即停止并重新分析
2. **理解问题本质**: 在CSS布局问题中，要准确识别是spacing、positioning还是alignment问题
3. **要求查看实际效果**: 进行UI修改时应该要求查看截图或实际效果
4. **承认知识盲点**: 遇到不确定的问题时，应该诚实地承认并寻求帮助
5. **学习优秀代码**: 参考现有的优秀实现(如用户提供的参考代码)比自己重新发明要高效得多

**避免策略**:
- 在进行CSS修改前，先理解当前布局的工作原理
- 用户提出技术纠正时，优先考虑用户的观点
- 对于UI问题，主动要求查看实际效果
- 学会识别自己的知识边界

**适用范围**: 所有涉及CSS布局、用户界面调整的开发任务

### 修改记录 #004: 调整搜索框与Logo间距 (2024-12-19)

**修改描述**: 
增加搜索输入框与LexiHK logo行之间的距离，让搜索框向下移动一些

**修改范围**:
- `packages/ai-workspace-common/src/components/search-quick-open-btn/index.tsx`

**具体修改**:
- 搜索框外层容器添加上边距：`mb-3` → `mb-3 mt-4`
- 上边距 `mt-4` = 16px，增加了搜索框与上方logo区域的间距

**修改原因**:
- 用户觉得搜索框与logo贴得太近，影响视觉效果
- 增加间距可以让整体布局更加美观和易读

**技术细节**:
```diff
- <div {...divProps} className={classNames('mb-3', divProps.className)}>
+ <div {...divProps} className={classNames('mb-3 mt-4', divProps.className)}>
```

**测试要点**:
- 确认搜索框与logo之间有合适的间距
- 确认整体侧边栏布局仍然协调
- 确认深色模式下效果正常

**状态**: ✅ 已完成

### 修改记录 #005: 修复核心功能缺失问题 (2024-12-19)

**问题描述**: 
在需求#003简化侧边栏后，发现原有的核心功能（如 AskAI 和创建画布）无法使用，点击后出现白屏

**根本原因**:
- 在简化侧边栏时注释掉了过多关键代码
- 移除了 `useCreateCanvas` hook 和相关的状态管理
- 缺少必要的 URL 参数处理逻辑
- 用户配置文件和模态框状态管理被注释

**修复范围**:
- `packages/ai-workspace-common/src/components/sider/layout.tsx`

**具体修复**:
1. **恢复关键导入**:
   - 添加 `useLocation`, `useSearchParams`, `useEffect` 导入
   - 恢复 `useKnowledgeBaseStoreShallow` 导入

2. **恢复核心状态管理**:
   - 恢复 `userProfile` 状态
   - 恢复模态框状态：`setShowLibraryModal`, `setShowCanvasListModal` 等
   - 恢复数据加载：`isLoadingCanvas`, `isLoadingProjects`

3. **恢复核心功能**:
   - 恢复 `useCreateCanvas` hook
   - 恢复 URL 参数处理逻辑（openLibrary, openSettings）
   - 在简化的侧边栏中添加"创建画布"按钮

4. **保持简化的UI**:
   - 仍然隐藏复杂的菜单结构
   - 保留简洁的300px宽度侧边栏
   - 只显示核心功能：logo + 搜索 + 创建画布按钮

**技术要点**:
- 区分"UI简化"和"功能移除"的概念
- 保留所有核心业务逻辑，只隐藏UI展示
- 确保 ASK AI 和画布创建等关键流程正常工作

**测试要点**:
- 确认创建画布功能正常
- 确认 ASK AI 功能正常
- 确认 URL 参数跳转正常（如 ?openLibrary=true）
- 确认不再出现白屏问题

**教训总结**:
在进行UI简化时，需要谨慎区分：
- **可以注释的**: 纯UI展示组件
- **不能注释的**: 核心业务逻辑、状态管理、事件处理

**状态**: ✅ 已完成 

### 经验总结 #002: 图标组件导入规范 (2024-12-19)

**技术要点**:
- 项目统一使用 `@refly-packages/ai-workspace-common/components/common/icon` 
- 优先使用项目内置图标，避免引入新的图标库
- 图标命名规范：Icon + 功能名称（如 IconThreadHistory）

**最佳实践**:
1. 先查看现有图标：`packages/ai-workspace-common/src/components/common/icon.tsx`
2. 使用语义化的图标名称
3. 保持图标风格的一致性

---

*文档更新时间: 2024-12-19*

## 问题记录和解决方案

### 图片上传显示问题（2025-06-11）

**问题描述**：
上传图片后，画布中只能看到图片文件名（如 xxx.jpg），无法看到图片本身。

**问题分析**：
1. **响应数据结构处理错误**：在 `packages/ai-workspace-common/src/hooks/use-upload-image.ts` 中，错误地解构了上传响应数据
2. **图片URL路径错误**：生成的图片URL包含错误的 `/api` 前缀，导致404错误

**解决方案**：

#### 1. 修复响应数据解构（已修复）
```typescript
// 错误的处理方式
const { data, success } = result ?? {};

// 正确的处理方式  
if (result?.success && result?.data) {
  const nodeData = {
    // ...
    metadata: {
      imageUrl: result.data.url,
      storageKey: result.data.storageKey,
    },
  };
}
```

#### 2. 修复图片URL路径（已修复）
在 `packages/ai-workspace-common/src/components/canvas/nodes/image.tsx` 中：
```typescript
// 修复URL路径，移除错误的/api前缀
const imageUrl = useMemo(() => {
  if (!rawImageUrl) return '';
  
  // 移除错误的/api前缀
  if (rawImageUrl.startsWith('/api/v1/misc/static/')) {
    const cleanPath = rawImageUrl.replace('/api', '');
    return `${serverOrigin}${cleanPath}`;
  }
  
  // 其他路径处理...
}, [rawImageUrl]);
```

**根本原因**：
- API响应数据结构为嵌套结构：`{ data: { success: boolean, data: { url, storageKey } } }`
- 正确的静态文件路径应该是 `/v1/misc/static/:objectKey` 而不是 `/api/v1/misc/static/...`

**验证方法**：
1. 查看浏览器控制台，确认图片URL格式正确
2. 确认图片可以正常加载，没有404或CORS错误
3. 画布中能正常显示图片内容

---

### 文档上传中图片显示问题（2025-06-11）

**问题描述**：
上传包含图片的文件（如Word文档）后，文档内容能正常显示，但其中的图片无法显示。

**问题分析**：
1. **文档解析正常**：Pandoc解析器能够正确提取文档中的图片，并将其转换为Markdown格式
2. **图片上传正常**：从文档中提取的图片被正确上传到MinIO存储
3. **URL生成问题**：生成的图片URL路径可能不正确，导致前端无法正确访问

**解决方案**：

#### 修复Markdown组件中的图片URL处理（已修复）
在 `packages/ai-workspace-common/src/components/markdown/index.tsx` 中的 `MarkdownImage` 组件：

```typescript
// 添加图片URL修复逻辑
const fixedSrc = useMemo(() => {
  if (!src) return src;
  
  // If it's already a full URL, return as is
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  // If it's a relative URL starting with /v1, prepend server origin
  if (src.startsWith('/v1/')) {
    return `${serverOrigin}${src}`;
  }
  
  // If it's starting with /api/v1, remove the /api prefix and prepend server origin
  if (src.startsWith('/api/v1/')) {
    const cleanPath = src.replace('/api', '');
    return `${serverOrigin}${cleanPath}`;
  }
  
  // Return original src for other cases (like base64 data URLs)
  return src;
}, [src]);
```

**技术背景**：
- 文档解析流程：文件上传 → Pandoc解析 → 图片提取 → 图片上传到MinIO → 生成Markdown内容
- 图片URL生成：使用 `MiscService.generateFileURL()` 方法生成访问URL
- 前端渲染：通过 `MarkdownImage` 组件渲染文档中的图片

**验证方法**：
1. 上传包含图片的Word文档
2. 查看文档预览中的图片是否正常显示
3. 检查浏览器控制台，确认图片URL格式正确且能正常加载

---

### 需求 #008: 自定义空白画布右键菜单内容

**需求描述**: 
修改空白画布右键弹出菜单的展示内容，包括UI样式、文案内容以及交互逻辑的自定义

**当前行为**:
空白画布右键菜单包含以下内容：
- **创建类操作**:
  - Ask AI - 创建AI技能节点
  - Create Document - 创建文档节点
  - Create Memo - 创建备忘录节点
  - Create Code Artifact - 创建代码工件节点
  - Create Website - 创建网站节点
- **资源类操作**:
  - Add Resource - 添加现有资源（弹出搜索列表）
  - Add Document - 添加现有文档（弹出搜索列表）
  - Import Resource - 导入资源（打开模态框）
- **设置类操作**:
  - Toggle Launchpad - 切换AI启动面板
  - Toggle Edges - 切换连接线显示
  - Toggle Click Preview - 切换点击预览模式
  - Toggle Node Size Mode - 切换节点尺寸模式
  - Toggle Auto Layout - 切换自动布局
  - Toggle Hover Card - 切换悬停卡片

**期望行为**:
根据业务需求自定义菜单内容，包括：
- 修改菜单项的显示文案
- 调整菜单项的排列顺序
- 新增或删除特定菜单项
- 修改菜单项的图标和样式
- 自定义菜单项的交互逻辑

**技术分析**:

1. **核心组件位置**:
   - 主组件: `packages/ai-workspace-common/src/components/canvas/context-menu/index.tsx`
   - 触发逻辑: `packages/ai-workspace-common/src/components/canvas/index.tsx` 中的 `onPaneContextMenu` 函数

2. **菜单数据结构**:
   ```typescript
   interface MenuItem {
     key: string;              // 菜单项唯一标识
     icon?: React.ElementType; // 图标组件
     type: 'button' | 'divider' | 'popover'; // 菜单项类型
     title: string;            // 显示文案
     description?: string;     // 描述文本
     hoverContent?: HoverContent; // 悬停提示内容
     primary?: boolean;        // 是否为主要操作
     danger?: boolean;         // 是否为危险操作
     active?: boolean;         // 是否为激活状态
     domain?: SearchDomain;    // 搜索域（用于popover类型）
     showSearchList?: boolean; // 是否显示搜索列表
     setShowSearchList?: (show: boolean) => void; // 搜索列表控制函数
   }
   ```

3. **菜单项定义位置**:
   - 菜单项数组: `ContextMenu` 组件中的 `menuItems` 数组（约215-380行）
   - 事件处理: `handleMenuClick` 函数（约424-485行）

4. **国际化支持**:
   - 文案翻译: 使用 `useTranslation` hook，翻译键位于 `packages/i18n/src/` 目录
   - 主要翻译键前缀: `canvas.toolbar.*`, `canvas.contextMenu.*`

5. **样式定制**:
   - 菜单容器样式: 第558行开始的 `<div>` 元素
   - 菜单项样式: `renderButton` 函数中的按钮样式（约510-557行）
   - 分割线样式: `Divider` 组件的自定义样式

**修改文件清单**:

1. **主要修改文件**:
   - `packages/ai-workspace-common/src/components/canvas/context-menu/index.tsx`
     - 修改 `menuItems` 数组定义（215-380行）
     - 修改 `handleMenuClick` 事件处理函数（424-485行）
     - 调整 `renderButton` 样式函数（510-557行）

2. **翻译文件修改**:
   - `packages/i18n/src/en-US/ui.ts` - 英文翻译
   - `packages/i18n/src/zh-Hans/ui.ts` - 中文翻译
   - 涉及翻译键: `canvas.toolbar.*`, `canvas.contextMenu.*`

3. **图标资源**:
   - 图标定义: `packages/ai-workspace-common/src/components/common/icon.tsx`
   - 可能需要新增自定义图标

**具体修改步骤建议**:

1. **第一步: 菜单项配置**
   - 在 `menuItems` 数组中添加/删除/修改菜单项
   - 调整菜单项的 `key`, `title`, `icon`, `type` 等属性
   - 设置菜单项的分组（通过 `divider` 类型分组）

2. **第二步: 事件处理逻辑**
   - 在 `handleMenuClick` 函数中添加新菜单项的处理逻辑
   - 删除不需要的事件处理分支
   - 修改现有菜单项的行为逻辑

3. **第三步: 样式和文案**
   - 修改翻译文件中的文案内容
   - 调整菜单项按钮的样式
   - 优化菜单容器的尺寸和间距

4. **第四步: 测试验证**
   - 验证菜单项显示正确
   - 测试各菜单项的交互功能
   - 确认多语言支持正常

**注意事项**:
- 保持现有功能的向后兼容性
- 确保新增菜单项的国际化支持
- 注意菜单项的加载状态和错误处理
- 遵循现有的设计规范和交互模式

**优先级**: 中
**预估工时**: 1-2天（取决于修改复杂度）
**状态**: 待开始

**前置条件**:
- 确定具体的菜单项修改需求
- 准备新增菜单项的图标资源（如需要）
- 确认新功能的业务逻辑和交互流程

### 需求 #009: 修复节点右键菜单无反应问题（优先级：高）

**问题描述**: 
空白画布右键菜单正常工作，但节点右键菜单无任何反应，用户无法通过右键操作节点

**当前行为**:
- ✅ 空白画布右键：正常显示右键菜单（Ask AI、Create Document等）
- ❌ 节点右键：无任何反应，没有显示节点操作菜单
- ❌ 多选节点右键：无任何反应

**期望行为**:
- 空白画布右键：保持现有功能
- 节点右键：显示节点操作菜单（Ask AI、Preview、Delete、Add to Context等）
- 多选节点右键：显示批量操作菜单（Group、Delete、Add to Context等）

**问题分析**:

1. **可能的原因**:
   - 我之前修改了画布拖拽配置 `panOnDrag={true}`，可能干扰了节点事件
   - ReactFlow 配置中的事件处理顺序问题
   - 事件冒泡或传播被阻止
   - `onNodeContextMenu` 事件处理器配置问题

2. **相关组件**:
   - 触发逻辑: `packages/ai-workspace-common/src/components/canvas/index.tsx` 中的 `onNodeContextMenu`
   - 节点菜单: `packages/ai-workspace-common/src/components/canvas/node-context-menu/index.tsx`
   - 多选菜单: `packages/ai-workspace-common/src/components/canvas/selection-context-menu/index.tsx`

3. **调试信息**:
   - 已添加调试日志到 `onNodeContextMenu` 函数
   - 已添加 `contextMenu` 状态变化监控
   - 可通过浏览器控制台查看相关日志

**优先级**: 高（核心功能缺失）
**预估工时**: 0.5-1天
**状态**: 🔍 调试中

---

### 需求 #011: 修复侧边栏遮挡TopToolbar问题（优先级：高）

**问题描述**: 
侧边栏紧靠着的右侧区域（包含画布名称和操作图标）有时会被侧边栏遮挡，需要重新伸缩侧边栏才能正常显示。

**问题分析**:
1. **根本原因**: TopToolbar 和主布局使用了不一致的宽度计算
   - TopToolbar 展开时使用：`calc(100vw - 232px)`（基于旧的220px + 12px）
   - 主布局展开时使用：`calc(100% - 300px - 16px)`（基于新的300px + 16px）
   - 差值：316px - 232px = 84px，导致遮挡

2. **影响组件**:
   - `packages/ai-workspace-common/src/components/canvas/top-toolbar/index.tsx` - TopToolbar组件
   - `apps/web/src/components/layout/index.tsx` - 主布局组件
   - `packages/ai-workspace-common/src/components/sider/layout.tsx` - 侧边栏组件

**解决方案**:
采用统一的布局常量管理，确保所有组件使用一致的宽度计算。

**✅ 实施完成**:

1. **创建布局常量文件**:
   - 新建 `packages/ai-workspace-common/src/constants/layout.ts`
   - 定义统一的侧边栏尺寸常量：`SIDEBAR_WIDTH = 300px`, `SIDEBAR_MARGIN = 16px`
   - 提供标准化的宽度计算：`LAYOUT_WIDTHS.ABSOLUTE_EXPANDED = calc(100vw - 316px)`

2. **修复TopToolbar宽度计算**:
   ```typescript
   // 修改前
   className={collapse ? 'w-[calc(100vw-12px)]' : 'w-[calc(100vw-232px)]'}
   
   // 修改后
   className={collapse ? `w-[${LAYOUT_WIDTHS.ABSOLUTE_COLLAPSED}]` : `w-[${LAYOUT_WIDTHS.ABSOLUTE_EXPANDED}]`}
   ```

3. **统一主布局宽度计算**:
   ```typescript
   // 修改前
   width: showSider ? 'calc(100% - 300px - 16px)' : 'calc(100% - 16px)'
   
   // 修改后
   width: showSider ? LAYOUT_WIDTHS.MAIN_CONTENT_EXPANDED : `calc(100% - ${COLLAPSED_SIDEBAR_WIDTH}px)`
   ```

4. **更新侧边栏组件**:
   ```typescript
   // 修改前
   width={source === 'sider' ? (collapse ? 0 : 300) : 300}
   
   // 修改后
   width={source === 'sider' ? (collapse ? 0 : SIDEBAR_WIDTH) : SIDEBAR_WIDTH}
   ```

**修改文件清单**:
- ✅ `packages/ai-workspace-common/src/constants/layout.ts` - 新建布局常量文件
- ✅ `packages/ai-workspace-common/src/components/canvas/top-toolbar/index.tsx` - 修复宽度计算
- ✅ `apps/web/src/components/layout/index.tsx` - 统一主布局宽度
- ✅ `packages/ai-workspace-common/src/components/sider/layout.tsx` - 使用统一常量

**代码质量改进**:
- ✅ 添加详细的中英文注释说明问题和解决方案
- ✅ 提供使用示例和最佳实践
- ✅ 通过 biome 代码检查，无语法错误
- ✅ 修复未使用变量的 linting 警告

**测试验证**:
用户可以通过以下方式验证修复效果：
1. 刷新画布页面
2. 测试侧边栏的展开和收缩
3. 确认画布名称和操作图标区域不再被遮挡
4. 验证在不同屏幕尺寸下的表现

**优先级**: 高（影响核心用户体验）
**预估工时**: 0.5天
**状态**: ✅ 已完成

**维护性提升**:
- 建立了统一的布局常量管理机制
- 避免了硬编码的尺寸值分散在多个文件中
- 为未来的布局调整提供了标准化的修改入口
- 通过详细注释确保后续维护者能快速理解设计意图

---

### 需求 #012: 修复侧边栏历史对话显示问题（优先级：高）

**问题描述**: 
左侧侧边栏的搜索框下方没有展示预期的历史对话（画布），用户无法看到之前创建的画布列表。

**问题分析**:
1. **根本原因**: 在需求#003简化侧边栏时，过度简化导致数据加载逻辑被注释掉
   - `useHandleSiderData(true)` 调用被注释，导致 `canvasList` 始终为空
   - ConversationHistory 组件显示空状态，但翻译键存在

2. **影响组件**:
   - `packages/ai-workspace-common/src/components/sider/layout.tsx` - SiderLoggedIn组件
   - `packages/ai-workspace-common/src/components/sider/conversation-history.tsx` - ConversationHistory组件
   - `packages/i18n/src/zh-Hans/ui.ts` - 中文翻译
   - `packages/i18n/src/en-US/ui.ts` - 英文翻译

**解决方案**:
采用渐进式修复方案，只恢复必要的数据加载功能，保持其他简化状态。

**✅ 实施完成**:

1. **第一步：完善翻译键**:
   - ✅ 确认中文翻译：`sider.history.empty.title: '暂无对话记录'`
   - ✅ 确认英文翻译：`sider.history.empty.title: 'No conversations yet'`
   - ✅ 翻译键已存在，无需添加

2. **第二步：恢复数据加载逻辑**:
   ```typescript
   // 在 SiderLoggedIn 组件中添加
   // Essential data loading for conversation history
   useHandleSiderData(true);
   ```
   - ✅ 恢复 `useHandleSiderData(true)` 调用，确保画布数据加载
   - ✅ 保持其他简化功能不变（菜单项仍隐藏）
   - ✅ 避免影响全局功能

3. **第三步：代码质量保证**:
   - ✅ 通过 biome 代码检查，无语法错误
   - ✅ 修复未使用变量的 linting 警告
   - ✅ 保持代码可维护性

**技术实现细节**:

1. **数据流恢复**:
   ```
   useHandleSiderData(true) → 加载画布列表 → 更新 canvasList → ConversationHistory 显示数据
   ```

2. **组件状态**:
   - **ConversationHistory**: 从 `canvasList` 获取数据，显示历史画布
   - **SiderLoggedIn**: 恢复数据加载，保持UI简化
   - **其他组件**: 保持注释状态，不影响简化效果

3. **错误处理**:
   - 空状态显示：`t('sider.history.empty.title')`
   - 数据加载失败：由 `useHandleSiderData` 内部处理
   - 翻译缺失：已确认翻译键存在

**修改文件清单**:
- ✅ `packages/ai-workspace-common/src/components/sider/layout.tsx` - 恢复数据加载调用

**测试验证**:
用户可以通过以下方式验证修复效果：
1. 刷新页面，确保侧边栏正常显示
2. 创建新的画布，观察是否出现在历史对话列表中
3. 点击历史对话项，确认能正确跳转到对应画布
4. 验证空状态显示（如果没有历史画布）

**优先级**: 高（核心用户体验功能）
**预估工时**: 0.5天
**状态**: ✅ 已完成

**维护性考虑**:
- **渐进式修复**: 只恢复必要功能，避免影响其他简化
- **最小化修改**: 仅添加一行代码，降低引入新问题的风险
- **保持一致性**: 与现有代码风格和架构保持一致
- **清晰注释**: 说明修改目的，便于后续维护

**全局功能影响评估**:
- ✅ **无负面影响**: 只恢复数据加载，不改变UI结构
- ✅ **保持简化状态**: 菜单项、设置等仍保持隐藏
- ✅ **性能影响最小**: 数据加载是必要功能，无额外开销
- ✅ **向后兼容**: 不影响现有功能和用户习惯

### 需求 #010: 在右键菜单中添加Search选项并创建Search节点

**需求描述**: 
在空白画布右键菜单中增加一个新的"Search"选项，点击后在画布上创建一个search类型的节点，用户可以通过操作这个节点进行搜索相关的功能

**需求理解**:
1. **菜单扩展**: 在现有的右键菜单中添加一个新的菜单项"Search"
2. **节点创建**: 点击菜单项后，在鼠标右键位置创建一个search节点
3. **功能集成**: 创建的search节点应该具备搜索功能，用户可以进行后续操作

**当前行为**:
- 空白画布右键菜单包含：Ask AI、Create Document、Create Memo等选项
- 没有专门的搜索节点创建选项
- 搜索功能主要通过侧边栏搜索框或其他方式实现

**期望行为**:
- 右键菜单中新增"Search"选项，与其他创建类操作并列
- 点击"Search"后在画布上创建一个search节点
- search节点具备独立的搜索界面和功能
- 保持与现有节点类型的一致性和用户体验

**全局技术分析**:

#### 1. **架构层面考虑**
```
右键菜单扩展 → 节点类型定义 → 节点创建逻辑 → 节点功能实现
     ↓              ↓              ↓              ↓
  菜单配置        类型系统        创建工厂        组件实现
```

#### 2. **核心实现层面**

**A. 菜单配置层 (Menu Configuration)**
- **文件**: `packages/ai-workspace-common/src/components/canvas/context-menu/index.tsx`
- **修改点**: 
  - `menuItems` 数组中添加新的search菜单项
  - `handleMenuClick` 函数中添加search的事件处理
- **配置内容**:
  ```typescript
  {
    key: 'search',
    icon: IconSearch,  // 需要确定使用的图标
    type: 'button',
    title: t('canvas.toolbar.search'),
    description: t('canvas.toolbar.searchDescription'),
    primary: false,  // 根据重要性确定
  }
  ```

**B. 节点类型层 (Node Type System)**
- **选项1**: 创建全新的节点类型 `'search'`
- **选项2**: 复用现有节点类型（如skill节点）但配置为搜索功能
- **推荐**: 根据功能复杂度决定
  - 如果搜索功能简单，复用现有类型
  - 如果搜索功能复杂且独特，创建新类型

**C. 节点创建逻辑 (Node Creation Logic)**
- **创建函数**: 类似现有的 `createSkillNode`, `createDocumentNode`
- **节点数据结构**:
  ```typescript
  const searchNodeData = {
    id: generateNodeId(),
    type: 'search', // 或复用现有类型
    position: rightClickPosition,
    data: {
      title: 'Search',
      // 搜索相关的初始配置
      searchConfig: {
        // 搜索参数配置
      }
    }
  };
  ```

**D. 节点功能实现 (Node Functionality)**
- **UI组件**: 搜索节点的界面设计
- **搜索逻辑**: 集成现有的搜索API或创建新的搜索功能
- **交互设计**: 搜索输入、结果展示、结果操作等

#### 3. **技术决策点**

**决策1: 节点类型选择**
- **新建search节点类型**:
  - ✅ 功能独立，易于维护
  - ✅ 可以定制专门的UI和交互
  - ❌ 增加系统复杂度
  - ❌ 需要更多开发工作

- **复用现有节点类型**:
  - ✅ 开发工作量小
  - ✅ 保持系统一致性
  - ❌ 功能可能受限
  - ❌ 可能与现有功能产生混淆

**决策2: 搜索功能范围**
- **基础搜索**: 简单的关键词搜索
- **高级搜索**: 支持过滤、排序、多条件搜索
- **智能搜索**: 集成AI的语义搜索

**决策3: 搜索数据源**
- **画布内搜索**: 只搜索当前画布的节点内容
- **项目内搜索**: 搜索整个项目的内容
- **全局搜索**: 搜索用户的所有内容
- **外部搜索**: 集成网络搜索功能

#### 4. **实现步骤规划**

**阶段1: 基础菜单集成**
1. 在右键菜单中添加Search选项
2. 实现基础的节点创建逻辑
3. 创建简单的search节点UI

**阶段2: 搜索功能实现**
1. 确定搜索数据源和范围
2. 实现搜索逻辑和API集成
3. 设计搜索结果展示界面

**阶段3: 功能完善**
1. 添加高级搜索功能
2. 优化用户体验和性能
3. 添加搜索历史和保存功能

#### 5. **影响范围评估**

**核心修改文件**:
- `packages/ai-workspace-common/src/components/canvas/context-menu/index.tsx` - 菜单配置
- `packages/i18n/src/en-US/ui.ts` - 英文翻译
- `packages/i18n/src/zh-Hans/ui.ts` - 中文翻译
- 可能需要新建: search节点组件文件

**相关系统模块**:
- 节点类型系统
- 画布渲染系统
- 搜索API系统
- 状态管理系统

#### 6. **用户体验考虑**

**一致性原则**:
- 菜单项样式与现有选项保持一致
- 节点外观与现有节点风格统一
- 交互模式符合用户习惯

**功能发现性**:
- 清晰的菜单项命名和图标
- 合适的菜单项位置（与其他创建类操作分组）
- 提供hover提示说明功能

**性能考虑**:
- 搜索响应速度
- 大量搜索结果的渲染性能
- 搜索历史的存储和管理

#### 7. **技术风险评估**

**低风险**:
- 菜单项添加（成熟的扩展模式）
- 基础节点创建（有现成模板）

**中等风险**:
- 搜索功能集成（需要API对接）
- 新节点类型定义（如果选择新建类型）

**高风险**:
- 复杂搜索逻辑实现
- 大数据量搜索性能优化

**优先级**: 中（功能扩展，提升用户体验）
**预估工时**: 2-3天（取决于搜索功能复杂度）
**状态**: ✅ 第一阶段已完成 - 基础菜单集成和节点创建

**实现进度**:

**✅ 第一阶段：基础菜单集成和节点创建**
1. **菜单配置完成**：
   - 在右键菜单中添加了Search选项，位于"Create Code Artifact"下方
   - 使用IconSearch图标，与其他创建类操作保持一致的样式
   - 添加了hover提示，显示搜索功能的描述

2. **节点创建逻辑实现**：
   ```typescript
   const createSearchNode = (position: { x: number; y: number }) => {
     addNode(
       {
         type: 'skill',  // 复用skill节点类型
         data: {
           title: t('canvas.toolbar.search'),
           entityId: genSkillID(),
           metadata: {
             searchNode: true,      // 标识为搜索节点
             viewMode: 'search',    // 设置视图模式为搜索
           },
         },
         position,
       },
       [],
       true,
       true,
     );
   };
   ```

3. **事件处理集成**：
   - 在handleMenuClick函数中添加了search case
   - 点击Search菜单项后调用createSearchNode函数
   - 创建节点后自动关闭右键菜单

4. **国际化支持**：
   - 英文翻译：`search: 'Search'`, `searchDescription: 'Create a search node to search and find content'`
   - 中文翻译：`search: '搜索'`, `searchDescription: '创建一个搜索节点，用于搜索和查找内容'`

**技术决策**:
- **节点类型选择**：复用现有的'skill'类型，通过metadata.searchNode标识
- **标识方式**：使用metadata.viewMode = 'search'来区分搜索节点
- **集成方式**：与现有节点创建流程保持一致，使用相同的addNode函数

**修改的文件**:
- `packages/ai-workspace-common/src/components/canvas/context-menu/index.tsx` - 主要实现
- `packages/i18n/src/en-US/ui.ts` - 英文翻译
- `packages/i18n/src/zh-Hans/ui.ts` - 中文翻译

**测试方法**:
1. 在空白画布右键点击
2. 应能看到Search选项出现在Create Code Artifact下方
3. 点击Search选项应在画布上创建一个标题为"搜索"的节点
4. 节点应具有searchNode和viewMode标识

**🔄 待完成阶段**:
- **第二阶段**：搜索功能实现（搜索逻辑、API集成、结果展示）
- **第三阶段**：功能完善（高级搜索、用户体验优化、搜索历史）

**后续确认事项**:
1. **搜索节点的具体功能需求**：搜索什么内容？如何展示结果？
2. **搜索范围确定**：画布内、项目内还是全局搜索？
3. **UI设计要求**：搜索节点的界面设计和交互方式？

---

**✅ 第二阶段：简化搜索界面实现**
1. **创建SimpleSearchComponent组件**：
   - 设计简洁的搜索界面：搜索图标 + "Search"文本 + 搜索输入框
   - 使用IconSearch图标和简洁的布局设计
   - 集成ChatInput组件提供搜索输入功能

2. **修改skill节点渲染逻辑**：
   ```typescript
   // 在skill节点中根据metadata.searchNode条件渲染
   {metadata.searchNode ? (
     <SimpleSearchComponent
       query={localQuery}
       setQuery={setQuery}
       onSearch={handleSendMessage}
       readonly={readonly}
     />
   ) : (
     <ChatPanel ... /> // 原有的复杂界面
   )}
   ```

3. **类型系统完善**：
   - 在SkillNodeMeta中添加searchNode和viewMode属性
   - 确保类型安全和代码提示支持

4. **界面设计特点**：
   - 顶部：搜索图标 + "Search"标题，带有分割线
   - 底部：简洁的搜索输入框，支持回车搜索
   - 移除了Ask AI节点的复杂功能（技能选择、模型配置、上下文管理等）
   - 保持与项目整体设计风格的一致性

**修改的文件**:
- `packages/ai-workspace-common/src/components/canvas/nodes/skill.tsx` - 添加SimpleSearchComponent和条件渲染
- `packages/ai-workspace-common/src/components/canvas/nodes/shared/types.ts` - 扩展SkillNodeMeta类型

**测试要点**:
- ✅ 右键菜单中Search选项正常显示
- ✅ 点击Search创建的节点显示简化界面
- ✅ 搜索节点界面包含：图标、标题、输入框
- ✅ 搜索节点与Ask AI节点界面明显区分
- ✅ 类型检查通过，无TypeScript错误

**🔄 待完成阶段**:
- **第三阶段**：搜索功能实现（搜索逻辑、API集成、结果展示）
- **第四阶段**：功能完善（高级搜索、用户体验优化、搜索历史）

---

### 修改记录 #006: Missing information头部文案字体调整 (2024-12-19)

**需求描述**: 
针对missinginfo节点创建的对话界面顶部"Missing information"文案，将字体大小适当调整加大，提升用户视觉识别度

**具体修改**:
将头部文案字体从 `text-base` (16px) 调整为 `text-lg` (18px)

**修改位置**:
- **文件**: `packages/ai-workspace-common/src/components/canvas/node-preview/node-preview-header.tsx`
- **组件**: `NodePreviewHeader` 组件中的 `Missing Information` 头部区域
- **具体代码行**: 第69行，Missing information文案的样式设置

**修改内容**:
```typescript
// 修改前
<div className="font-bold text-black dark:text-white text-base">
  Missing information
</div>

// 修改后  
<div className="font-bold text-black dark:text-white text-lg">
  Missing information
</div>
```

**技术背景**:
- **触发条件**: 只有当节点类型为 `skillResponse` 且满足missinginfo相关条件时才显示
- **识别逻辑**: 检查 `selectedSkill.name` 或 `modelInfo.name` 是否包含 `'missinginfo'` 关键词
- **显示位置**: 对话界面的最顶部，在标题栏之前，作为整个预览面板的第一个元素

**布局结构**:
```
NodePreview
├── Missing information (text-lg, 18px) ← 此次修改位置
├── NodePreviewHeader (带图标和标题的头部)
└── EnhancedSkillResponse (主要内容)
    ├── threadContentComponent (对话历史)
    └── chatPanelComponent (输入区域)
```

**样式详情**:
- **字体大小**: `text-lg` (18px) 
- **字体粗细**: `font-bold` (700)
- **颜色**: `text-black dark:text-white` (深色模式自适应)
- **背景**: `bg-white dark:bg-gray-900` (深色模式自适应)
- **边距**: `px-4 py-3` (水平16px，垂直12px)
- **底部边框**: `border-b border-gray-100 dark:border-gray-700`

**验证方法**:
1. 创建一个missinginfo节点
2. 在节点中输入内容并提交
3. 查看右侧出现的对话界面顶部
4. 确认"Missing information"文案字体比之前更大更显著

**用户体验提升**:
- 提高了头部文案的视觉权重，用户更容易识别这是missinginfo相关的对话
- 保持了与整体设计风格的一致性
- 在深色模式下同样有良好的视觉效果

**状态**: ✅ 已完成

---

*文档更新时间: 2024-12-19*

### 修改记录 #007: Search entry头部文案添加 (2024-12-19)

**需求描述**: 
为search节点创建的对话界面顶部添加"Search entry"文案，与missinginfo节点的"Missing information"文案保持一致的样式和位置

**具体修改**:
在NodePreviewHeader组件中新增search节点识别逻辑，并显示"Search entry"头部文案

**修改位置**:
- **文件**: `packages/ai-workspace-common/src/components/canvas/node-preview/node-preview-header.tsx`
- **组件**: `NodePreviewHeader` 组件中的头部区域
- **具体代码行**: 第78-85行，新增search节点识别和头部显示逻辑

**修改内容**:
```typescript
// 新增search节点识别逻辑
const isSearchResponse =
  node.type === 'skillResponse' &&
  (node.data?.metadata?.searchNode === true ||
    node.data?.metadata?.viewMode === 'search' ||
    node.data?.metadata?.selectedSkill?.name?.includes('searchentry') ||
    node.data?.metadata?.modelInfo?.name === 'hkgai-searchentry' ||
    node.data?.metadata?.modelInfo?.label?.includes('Search Entry'));

// 新增Search Entry头部显示
{isSearchResponse && (
  <div className="bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
    <div className="font-bold text-black dark:text-white text-lg">Search entry</div>
  </div>
)}
```

**技术背景**:
- **触发条件**: 节点类型为 `skillResponse` 且满足search相关条件时显示
- **识别逻辑**: 检查以下任一条件：
  - `metadata.searchNode === true` - 搜索节点标识
  - `metadata.viewMode === 'search'` - 搜索视图模式
  - `selectedSkill.name` 包含 `'searchentry'` 关键词
  - `modelInfo.name === 'hkgai-searchentry'` - 搜索专用模型
  - `modelInfo.label` 包含 `'Search Entry'` 关键词
- **显示位置**: 对话界面的最顶部，与Missing information文案并列显示

**search节点创建特征**:
根据需求#010的实现，search节点具有以下metadata特征：
- `searchNode: true` - 标识为搜索节点
- `viewMode: 'search'` - 设置视图模式为搜索
- `modelInfo.name: 'hkgai-searchentry'` - 使用专用搜索模型
- `modelInfo.label: 'HKGAI Search Entry'` - 模型标签

**布局结构**:
```
NodePreview
├── Missing information (仅missinginfo节点显示)
├── Search entry (仅search节点显示) ← 此次新增
├── NodePreviewHeader (带图标和标题的头部)
└── EnhancedSkillResponse (主要内容)
    ├── threadContentComponent (对话历史)
    └── chatPanelComponent (输入区域)
```

**样式详情**:
- **字体大小**: `text-lg` (18px) - 与Missing information保持一致
- **字体粗细**: `font-bold` (700)
- **颜色**: `text-black dark:text-white` (深色模式自适应)
- **背景**: `bg-white dark:bg-gray-900` (深色模式自适应)
- **边距**: `px-4 py-3` (水平16px，垂直12px)
- **底部边框**: `border-b border-gray-100 dark:border-gray-700`

**验证方法**:
1. 在空白画布右键点击，选择"Search"选项
2. 创建search节点后，在节点中输入内容并提交
3. 查看右侧出现的对话界面顶部
4. 确认显示"Search entry"文案，字体大小与Missing information一致

**互斥显示逻辑**:
- missinginfo节点：显示"Missing information"
- search节点：显示"Search entry"  
- 其他节点：不显示额外头部文案
- 两种文案不会同时显示（通过不同的识别条件确保互斥）

**用户体验提升**:
- 用户可以清晰区分不同类型的AI对话界面
- 保持了与missinginfo节点一致的视觉设计
- 提高了search功能的识别度和专业感

**状态**: ✅ 已完成

---

*文档更新时间: 2024-12-19*

### 修改记录 #008: Search节点双界面切换功能实现 (2024-12-19)

**需求描述**: 
为search entry对话面板实现双界面切换功能：保留现有对话界面，新增历史对话选择界面，通过切换按钮在两个界面间切换

**具体修改**:
在EnhancedSkillResponse组件中为search节点添加状态管理和双界面切换逻辑

**修改位置**:
- **主要文件**: `packages/ai-workspace-common/src/components/canvas/node-preview/skill-response/enhanced-skill-response.tsx`
- **类型文件**: `packages/ai-workspace-common/src/components/canvas/nodes/shared/types.ts`

**技术实现**:

#### 1. **类型扩展**
```typescript
// 在ResponseNodeMeta中添加search节点支持
export type ResponseNodeMeta = {
  // ... 现有属性
  searchNode?: boolean;  // 搜索节点标识
  viewMode?: string;     // 视图模式支持
};
```

#### 2. **组件状态管理**
```typescript
// 搜索节点识别逻辑
const isSearchNode = useMemo(() => {
  return node.data?.metadata?.searchNode === true ||
         node.data?.metadata?.viewMode === 'search' ||
         node.data?.metadata?.selectedSkill?.name?.includes('searchentry') ||
         node.data?.metadata?.modelInfo?.name === 'hkgai-searchentry' ||
         node.data?.metadata?.modelInfo?.label?.includes('Search Entry');
}, [node.data?.metadata]);

// 界面切换状态（仅search节点）
const [searchViewMode, setSearchViewMode] = useState<'conversation' | 'history'>('conversation');
```

#### 3. **历史选择界面组件**
```typescript
// 占位组件：SearchHistorySelection
const SearchHistorySelection = memo(({ onBack }: { onBack: () => void }) => {
  return (
    <div className="flex flex-col h-full w-full">
      {/* 带返回按钮的头部 */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Back to conversation
        </Button>
      </div>
      
      {/* 历史选择内容区域 - 占位设计 */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="text-center text-gray-500">
          <HistoryOutlined className="text-4xl mb-4" />
          <h3 className="text-lg font-medium mb-2">Search History</h3>
          <p className="text-sm">
            Historical conversation selection interface will be implemented here.
            <br />
            This is a placeholder for the detailed design.
          </p>
        </div>
      </div>
    </div>
  );
});
```

#### 4. **条件渲染逻辑**
```typescript
// 历史选择界面渲染
if (isSearchNode && searchViewMode === 'history') {
  return <SearchHistorySelection onBack={handleBackToConversation} />;
}

// 正常对话界面渲染（默认）
return (
  <div className="flex flex-col h-full w-full">
    {/* 搜索切换按钮 - 仅search节点显示 */}
    {isSearchNode && (
      <div className="flex justify-end p-2 border-b">
        <Button 
          type="text" 
          size="small" 
          icon={<HistoryOutlined />} 
          onClick={handleToggleToHistory}
        >
          Search History
        </Button>
      </div>
    )}
    
    {/* 现有对话内容 */}
    {threadContentComponent}
    {chatPanelComponent}
  </div>
);
```

**功能特性**:

#### **双界面模式**:
- **界面A**: 对话界面（conversation）- 现有功能完全保留
- **界面B**: 历史选择界面（history）- 新增功能，当前为占位设计

#### **切换机制**:
- **进入历史界面**: 点击右上角"Search History"按钮
- **返回对话界面**: 点击历史界面的"Back to conversation"按钮
- **默认状态**: 总是从对话界面开始

#### **节点识别**:
只有search节点会显示切换按钮和支持双界面，其他节点保持原有行为不变

**UI设计**:

#### **切换按钮位置**:
- 位于对话内容区域的右上角
- 使用HistoryOutlined图标和"Search History"文案
- 小尺寸按钮，不占用过多空间

#### **历史选择界面**:
- 全屏占位设计，完全替代对话界面
- 顶部带有返回按钮的导航栏
- 中央显示占位内容和说明文字
- 为后续详细设计预留完整空间

**技术特点**:

#### **状态隔离**:
- 切换状态只影响search节点，不影响其他节点类型
- 使用useMemo优化节点识别性能
- 状态变化不会影响现有对话数据

#### **向后兼容**:
- 现有对话功能完全保留
- 非search节点行为完全不变
- 新增功能采用渐进式增强设计

#### **扩展性**:
- 占位组件为后续详细设计预留接口
- 状态管理支持更多界面模式扩展
- 组件结构便于后续功能迭代

**验证方法**:
1. 创建search节点并提交内容，进入对话界面
2. 确认右上角显示"Search History"按钮
3. 点击按钮，界面切换到历史选择占位页面
4. 点击"Back to conversation"按钮，返回对话界面
5. 验证非search节点不显示切换按钮

**后续开发**:
- 当前为基础框架实现，历史选择界面为占位设计
- 等待详细设计确认后，将实现具体的历史对话选择功能
- 可能包括：历史列表、搜索过滤、快速跳转等功能

**状态**: ✅ 基础框架已完成，等待详细设计

---

*文档更新时间: 2024-12-19*

### 修改记录 #009: Search历史界面搜索功能实现 (2024-12-19)

**需求描述**: 
根据设计稿要求，将SearchHistorySelection组件从占位设计改为实际的搜索界面，删除"Search History"标题和图标，替换为搜索输入框和筛选功能

**具体修改**:
完全重构SearchHistorySelection组件的内容区域，实现搜索界面设计

**修改位置**:
- **文件**: `packages/ai-workspace-common/src/components/canvas/node-preview/skill-response/enhanced-skill-response.tsx`
- **组件**: `SearchHistorySelection` 组件内容区域

**界面变更对比**:

#### **修改前（占位设计）**:
```typescript
// 中央占位内容
<div className="text-center text-gray-500">
  <HistoryOutlined className="text-4xl mb-4" />
  <h3 className="text-lg font-medium mb-2">Search History</h3>
  <p className="text-sm">
    Historical conversation selection interface will be implemented here.
    This is a placeholder for the detailed design.
  </p>
</div>
```

#### **修改后（实际搜索界面）**:
```typescript
// 搜索输入框
<div className="mb-4">
  <Input
    placeholder="Please enter the bill or clause you want to query"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full"
    size="large"
    allowClear
  />
</div>

// 筛选按钮组
<div className="flex gap-3 mb-6">
  <Button className="rounded-full border-gray-300">All Cases ▼</Button>
  <Button className="rounded-full border-gray-300">Any Date ▼</Button>
  <Button className="rounded-full border-gray-300">All States & Federal ▼</Button>
</div>

// 搜索结果区域
<div className="space-y-4">
  {searchQuery ? (
    <div>Search results for "{searchQuery}" will be displayed here.</div>
  ) : (
    <div>Enter a search query to find historical cases.</div>
  )}
</div>
```

**实现的功能**:

#### 1. **搜索输入框**
- **占位文字**: "Please enter the bill or clause you want to query"
- **功能特性**: 
  - 大尺寸输入框 (`size="large"`)
  - 支持清除按钮 (`allowClear`)
  - 实时状态管理 (`searchQuery` state)
  - 全宽度显示 (`className="w-full"`)

#### 2. **筛选按钮组**
- **三个筛选按钮**:
  - "All Cases" - 案例类型筛选
  - "Any Date" - 日期范围筛选  
  - "All States & Federal" - 地区范围筛选
- **样式特点**:
  - 圆角按钮设计 (`rounded-full`)
  - 灰色边框 (`border-gray-300`)
  - 下拉箭头指示 (`▼`)
  - 按钮间距 (`gap-3`)

#### 3. **搜索结果区域**
- **动态显示逻辑**:
  - 有搜索内容时：显示 "Search results for 'xxx' will be displayed here."
  - 无搜索内容时：显示 "Enter a search query to find historical cases."
- **预留扩展空间**: `space-y-4` 为后续搜索结果列表预留样式

#### 4. **状态管理**
```typescript
const [searchQuery, setSearchQuery] = useState('');
```
- 管理搜索输入框的内容
- 支持实时更新和条件渲染

**UI布局结构**:
```
SearchHistorySelection
├── Header (Back to conversation 按钮)
└── Content Area
    ├── Search Input (搜索输入框)
    ├── Filter Buttons (筛选按钮组)
    └── Results Area (搜索结果区域)
```

**设计还原度**:
- ✅ 删除了原有的"Search History"标题和图标
- ✅ 添加了搜索输入框，占位文字完全匹配设计稿
- ✅ 实现了三个筛选按钮，样式接近设计稿
- ✅ 预留了搜索结果显示区域
- ✅ 保持了顶部返回按钮的功能

**技术特点**:
- **响应式设计**: 支持深色模式适配
- **状态驱动**: 根据搜索内容动态显示提示信息
- **组件化**: 便于后续功能扩展和样式调整
- **用户友好**: 提供清除按钮和实时反馈

**验证方法**:
1. 进入search节点的历史界面
2. 确认搜索输入框显示正确的占位文字
3. 测试输入功能和清除按钮
4. 确认三个筛选按钮正确显示
5. 验证搜索内容变化时的动态提示

**后续开发**:
- 筛选按钮的下拉菜单功能
- 实际的搜索结果列表渲染
- 搜索API集成和数据获取
- 搜索结果的交互和选择功能

**状态**: ✅ 搜索界面基础实现完成

---

*文档更新时间: 2024-12-19*

## 📍 核心组件代码位置映射

为提高开发效率，避免重复搜索组件位置，特记录节点对话系统的核心组件位置和代码结构。

### 🎯 节点对话系统架构概览

```
节点点击 → NodePreview → 类型判断 → 对应的PreviewComponent
                            ├── EnhancedSkillResponse (skillResponse节点)
                            ├── ResourceNodePreview (resource节点)  
                            ├── DocumentNodePreview (document节点)
                            ├── SkillNodePreview (skill节点)
                            └── 其他节点类型...
```

### 📁 主要组件文件位置

#### 1. **节点预览核心组件**

**NodePreview 入口组件**
- **文件**: `packages/ai-workspace-common/src/components/canvas/node-preview/index.tsx`
- **核心功能**: 
  - 第39-91行: `PreviewComponent` - 根据节点类型分发到对应预览组件
  - 第136-367行: `DraggableNodePreview` - 可拖拽的节点预览容器
- **类型分发逻辑** (第47-66行):
  ```typescript
  switch (node.type) {
    case 'skillResponse': return <EnhancedSkillResponse />;
    case 'resource': return <ResourceNodePreview />;
    case 'skill': return <SkillNodePreview />;
    // ... 其他类型
  }
  ```

**NodePreviewHeader 头部组件**
- **文件**: `packages/ai-workspace-common/src/components/canvas/node-preview/node-preview-header.tsx`
- **核心功能**:
  - 第138-425行: 主要组件逻辑
  - 第406-415行: `isMissingInfoResponse` - Missing information判断逻辑
  - 第416-425行: `isSearchResponse` - Search entry判断逻辑
- **头部文案显示** (第69-85行):
  ```typescript
  {isMissingInfoResponse && (
    <div className="font-bold text-black dark:text-white text-lg">
      Missing information
    </div>
  )}
  {isSearchResponse && (
    <div className="font-bold text-black dark:text-white text-lg">
      Search entry
    </div>
  )}
  ```

#### 2. **对话系统核心组件**

**EnhancedSkillResponse 对话核心**
- **文件**: `packages/ai-workspace-common/src/components/canvas/node-preview/skill-response/enhanced-skill-response.tsx`
- **组件结构**:
  - 第37-103行: `SearchHistorySelection` - 搜索历史界面组件
  - 第120-566行: `EnhancedSkillResponse` - 主要对话组件
- **关键代码段**:
  - 第128-137行: `isSearchNode` - 搜索节点识别逻辑
  - 第457-504行: `chatPanelComponent` - ChatPanel组件实例化
  - 第506-508行: `threadContentComponent` - LinearThreadContent组件实例化
  - 第518-529行: 搜索历史界面条件渲染
  - 第531-566行: 正常对话界面渲染

**LinearThreadContent 对话历史**
- **文件**: `packages/ai-workspace-common/src/components/canvas/refly-pilot/linear-thread.tsx`
- **核心功能**:
  - 第60-124行: `LinearThreadContent` - 对话消息列表渲染
  - 第85-123行: 消息列表渲染逻辑，使用 `SkillResponseNodePreview` 渲染每条消息

**ChatPanel 输入面板**
- **文件**: `packages/ai-workspace-common/src/components/canvas/launchpad/chat-panel.tsx`
- **组件结构**:
  - 第41-79行: `PremiumBanner` - 付费横幅组件
  - 第89-513行: `ChatPanel` - 主要聊天面板组件
- **关键模块**:
  - 导入的子组件: `SelectedSkillHeader`, `ContextManager`, `ConfigManager`, `ChatActions`, `ChatInput`
  - 第200-316行: `handleSendMessage` - 发送消息处理逻辑

#### 3. **节点内嵌对话组件**

**Skill节点内嵌对话**
- **文件**: `packages/ai-workspace-common/src/components/canvas/nodes/skill.tsx`
- **核心组件**:
  - 第46-118行: `SimpleSearchComponent` - 简化的搜索/缺失信息界面
  - 第544-595行: 条件渲染逻辑
- **界面切换逻辑** (第560-595行):
  ```typescript
  {metadata.searchNode || metadata.missingInfoNode ? (
    <SimpleSearchComponent 
      nodeType={metadata.missingInfoNode ? 'missingInfo' : 'search'}
    />
  ) : (
    <ChatPanel mode="node" />
  )}
  ```

### 🔧 关键数据流和状态管理

#### 1. **消息数据流**
```
用户输入 → handleSendMessage → LinearThreadMessage → EnhancedSkillResponse → LinearThreadContent
```

#### 2. **搜索节点识别逻辑**
搜索节点通过以下任一条件识别：
- `metadata.searchNode === true`
- `metadata.viewMode === 'search'`
- `selectedSkill.name.includes('searchentry')`
- `modelInfo.name === 'hkgai-searchentry'`
- `modelInfo.label.includes('Search Entry')`

#### 3. **界面切换状态管理**
搜索节点支持双界面切换：
- `searchViewMode: 'conversation' | 'history'`
- 对话界面 (默认): 显示 `threadContentComponent` + `chatPanelComponent`
- 历史界面: 显示 `SearchHistorySelection`

### 🎨 UI组件层次结构

```
EnhancedSkillResponse (对话容器)
├── SearchHistorySelection (搜索历史界面)
│   ├── 搜索输入框
│   ├── 筛选按钮组
│   └── 搜索结果区域
└── 正常对话界面
    ├── Search History切换按钮 (仅搜索节点)
    ├── LinearThreadContent (对话历史)
    │   └── SkillResponseNodePreview[] (消息列表)
    └── ChatPanel (输入面板)
        ├── SelectedSkillHeader (技能头部)
        ├── ContextManager (上下文管理)
        ├── ConfigManager (配置管理)
        ├── ChatActions (操作按钮)
        └── ChatInput (输入框)
```

### 🔍 常用修改场景的定位指南

#### **修改节点头部文案**
- **位置**: `packages/ai-workspace-common/src/components/canvas/node-preview/node-preview-header.tsx`
- **代码段**: 第69-85行的条件渲染区域

#### **修改对话界面布局**
- **位置**: `packages/ai-workspace-common/src/components/canvas/node-preview/skill-response/enhanced-skill-response.tsx`
- **代码段**: 第531-566行的正常对话界面渲染

#### **修改搜索历史界面**
- **位置**: `packages/ai-workspace-common/src/components/canvas/node-preview/skill-response/enhanced-skill-response.tsx`
- **代码段**: 第37-103行的 `SearchHistorySelection` 组件

#### **修改节点内嵌对话**
- **位置**: `packages/ai-workspace-common/src/components/canvas/nodes/skill.tsx`
- **代码段**: 第46-118行的 `SimpleSearchComponent`

#### **修改发送消息逻辑**
- **位置**: `packages/ai-workspace-common/src/components/canvas/node-preview/skill-response/enhanced-skill-response.tsx`
- **代码段**: 第321-386行的 `handleSendMessage` 函数

### 📝 组件依赖关系

```
EnhancedSkillResponse
├── depends on: LinearThreadContent, ChatPanel
├── manages: messages[], searchViewMode
└── renders: threadContentComponent, chatPanelComponent

LinearThreadContent  
├── depends on: SkillResponseNodePreview
├── manages: message list rendering
└── renders: conversation history

ChatPanel
├── depends on: ChatInput, ContextManager, ConfigManager
├── manages: input state, context, config
└── renders: input interface

SimpleSearchComponent
├── depends on: ChatInput
├── manages: simplified search/missingInfo interface  
└── renders: minimal input for special nodes
```

---

*代码位置映射更新时间: 2024-12-19*

### 修改记录 #010: 底部输入框发送消息后对话组件默认全屏显示 (2024-12-19)

**需求描述**: 
针对主页底部AI搜索框，当用户输入内容并发送后，出现的AI对话组件默认以全屏模式显示（之前默认不是全屏）

**技术实现**:
采用方案一 - 利用现有URL参数机制，在底部聊天发送消息后自动设置 `isMaximized=true` 参数

**修改位置**:
- **文件**: `packages/ai-workspace-common/src/components/canvas/index.tsx`
- **函数**: `handleBottomChatSend` - 底部聊天发送处理函数

**具体修改**:

#### 1. **添加必要导入**
```typescript
import { useSearchParams } from 'react-router-dom';
```

#### 2. **在Flow组件中添加searchParams hook**
```typescript
const Flow = memo(({ canvasId }: { canvasId: string }) => {
  // ... 现有代码
  const [searchParams, setSearchParams] = useSearchParams();
  // ... 其他代码
});
```

#### 3. **在handleBottomChatSend函数中添加全屏设置**
```typescript
// 在addNode调用后添加
// Set maximized state for bottom chat responses
setSearchParams(prev => {
  const newParams = new URLSearchParams(prev);
  newParams.set('previewId', resultId);
  newParams.set('isMaximized', 'true');
  return newParams;
});
```

#### 4. **更新依赖数组**
```typescript
[invokeAction, canvasId, addNode, isLogin, setSearchParams]
```

**工作原理**:

#### **现有机制复用**:
- NodePreview组件已有完善的URL参数处理逻辑
- `isMaximized` 参数被NodePreview组件识别并应用全屏状态
- `previewId` 参数确保对话组件自动显示

#### **执行流程**:
```
用户在底部输入框发送消息
↓
handleBottomChatSend 创建skillResponse节点
↓
设置URL参数: previewId=resultId & isMaximized=true
↓
NodePreview组件读取URL参数并应用全屏状态
↓
对话组件以全屏模式显示
```

#### **技术特点**:
- **零侵入性**: 不修改NodePreview组件，完全利用现有机制
- **代码最小化**: 只添加了5行核心代码
- **全局一致性**: 与其他全屏操作使用相同的URL参数机制
- **状态同步**: URL参数确保全屏状态在页面刷新后保持

**验证方法**:
1. 在主页底部输入框输入内容并发送
2. 观察右侧出现的对话组件是否默认为全屏状态
3. 检查URL是否包含 `isMaximized=true` 参数
4. 确认可以通过控制按钮正常切换全屏/非全屏状态

**用户体验提升**:
- 底部输入框发送的消息默认以全屏显示，提供更好的对话体验
- 与用户期望一致：从底部发起的对话应该获得更多屏幕空间
- 保持与其他全屏操作的一致性

**兼容性考虑**:
- 不影响其他节点的默认显示状态
- 不影响右键创建节点的行为
- 不影响现有的全屏控制功能

**状态**: ✅ 已完成

---

*文档更新时间: 2024-12-19*

#### **问题修复记录 (2024-12-19)**

**问题**: 初始实现后，底部输入框发送消息时对话组件仍然在右侧显示，需要手动点击全屏按钮。

**根本原因**: 
1. NodePreview组件只在初始化时读取URL参数，没有监听参数变化
2. URL参数设置时机与节点创建存在时序问题

**修复方案**:

1. **在NodePreview组件中添加URL参数监听**:
```typescript
// 监听URL参数变化并更新最大化状态
useEffect(() => {
  const isMaximizedFromUrl = searchParams.get('isMaximized') === 'true';
  const previewIdFromUrl = searchParams.get('previewId');
  
  // 只对匹配的节点应用最大化状态
  if (!previewIdFromUrl || previewIdFromUrl === node.data?.entityId || previewIdFromUrl === node.id) {
    setIsMaximized(isMaximizedFromUrl);
  }
}, [searchParams, node.data?.entityId, node.id]);
```

2. **调整URL参数设置时机**:
```typescript
// 添加100ms延迟确保节点创建完成
setTimeout(() => {
  setSearchParams(prev => {
    const newParams = new URLSearchParams(prev);
    newParams.set('previewId', resultId);
    newParams.set('isMaximized', 'true');
    return newParams;
  });
}, 100);
```

**修复文件**:
- `packages/ai-workspace-common/src/components/canvas/node-preview/index.tsx` - 添加URL参数监听
- `packages/ai-workspace-common/src/components/canvas/index.tsx` - 调整参数设置时机

**验证要点**:
- 底部输入框发送消息后对话组件默认全屏显示
- URL包含正确的previewId和isMaximized参数
- 不影响其他节点的显示状态

**状态**: ✅ 已完成修复

### 修改记录 #011: AskLexiPlus按钮点击时ReflyPilot默认全屏展开 (2024-12-19)

**需求描述**: 
实现点击主页空白画布上的AskLexiPlus文本时，ReflyPilot组件默认以全屏模式展开，提供更好的AI对话体验

**技术实现**:
采用URL参数机制，通过`reflyPilotMaximized`参数控制ReflyPilot组件的初始最大化状态

**修改文件**:

#### 1. **EmptyGuide组件** (`packages/ai-workspace-common/src/components/canvas/empty-guide/index.tsx`)
- **添加URL参数支持**: 导入`useSearchParams` hook
- **创建专用点击处理**: `handleAskLexiPlusClick`函数
- **设置全屏参数**: 显示ReflyPilot时自动设置`reflyPilotMaximized=true`

#### 2. **ThreadContainer组件** (`packages/ai-workspace-common/src/components/canvas/refly-pilot/thread-container.tsx`)
- **URL参数初始化**: 从`reflyPilotMaximized`参数读取初始最大化状态
- **动态监听变化**: useEffect监听URL参数变化并同步状态
- **完整状态管理**: 所有操作（最大化/最小化/关闭/ESC键）都同步更新URL参数

**技术特点**:

#### **状态同步机制**:
```typescript
// 用户点击流程
EmptyGuide.handleAskLexiPlusClick() 
  → setSearchParams({reflyPilotMaximized: 'true'}) 
  → ThreadContainer.useEffect监听URL变化 
  → setIsMaximized(true)
```

#### **完整的生命周期管理**:
- **初始化**: 从URL参数读取初始状态
- **用户操作**: 最大化/最小化按钮同步更新URL
- **键盘操作**: ESC键退出全屏并清除URL参数
- **关闭清理**: 关闭ReflyPilot时清除所有相关参数

#### **调试支持**:
- 添加控制台日志：`🎯 [ReflyPilot] URL parameter changed`
- 记录状态变化过程，便于问题排查

**用户体验提升**:
- **即时全屏**: 点击AskLexiPlus后ReflyPilot立即以全屏模式打开
- **状态持久**: 页面刷新后保持全屏状态
- **完整控制**: 支持手动切换全屏/非全屏状态
- **键盘友好**: ESC键快速退出全屏
- **自动清理**: 关闭时自动清除URL参数

**验证方法**:
1. 在空白画布点击"AskLexiPlus"按钮，确认ReflyPilot以全屏模式打开
2. 检查URL是否包含`reflyPilotMaximized=true`参数
3. 测试最大化/最小化按钮功能
4. 验证ESC键退出全屏功能
5. 确认关闭ReflyPilot时URL参数被清除

**与现有功能的一致性**:
- 使用与底部聊天输入框相同的URL参数机制
- 保持与NodePreview组件类似的状态管理模式
- 遵循项目现有的交互设计规范

**状态**: ✅ 已完成

---

*文档更新时间: 2024-12-19*

### 修改记录 #012: ReflyPilot默认模型从hkgai-searchentry改为hkgai-general (2024-12-19)

**需求描述**: 
将ReflyPilot页面的默认模型从`hkgai-searchentry`更换为`hkgai-general`，使其与askai节点使用的1-for-general模型保持一致

**技术背景**:
- **当前问题**: ReflyPilot组件使用`hkgai-searchentry`模型作为默认
- **用户需求**: 希望ReflyPilot使用与askai节点相同的`hkgai-general`模型
- **模型对应关系**: `hkgai-general` = askai节点的1-for-general模型

**🔍 问题根本原因**:
1. **数据流不匹配**: ChatPanel使用`chatStore.selectedModel`，但`useInitializeDefaultModel`只设置了`skillSelectedModel`
2. **默认值问题**: `selectedModel`的默认值为`null`，导致ReflyPilot没有获得正确的默认模型
3. **模型字段分离**: 系统中存在两个独立的模型字段：
   - `skillSelectedModel`: 用于skill节点
   - `selectedModel`: 用于ChatPanel（包括ReflyPilot）

**技术实现路径**:
```
ReflyPilot → LaunchPad → ChatPanel → useChatStore.selectedModel ← useInitializeDefaultModel
```

**✅ 修复方案**:

#### **useInitializeDefaultModel Hook** (`packages/ai-workspace-common/src/hooks/use-initialize-default-model.ts`)
- **核心修复**: 同时设置`selectedModel`和`skillSelectedModel`两个字段
- **模型配置更新**:
  ```typescript
  // 修改前：只设置skillSelectedModel
  setSkillSelectedModel(modelInfo);
  
  // 修改后：同时设置两个模型字段
  if (!skillSelectedModel) {
    setSkillSelectedModel(modelInfo);  // 用于skill节点
  }
  if (!selectedModel) {
    setSelectedModel(modelInfo);       // 用于ChatPanel(ReflyPilot)
  }
  ```

- **条件判断优化**:
  ```typescript
  // 修改前：只检查skillSelectedModel
  if (!isLogin || skillSelectedModel) return;
  
  // 修改后：检查两个模型字段
  if (!isLogin || (skillSelectedModel && selectedModel)) return;
  ```

**影响范围**:
1. **ReflyPilot对话**: 现在使用hkgai-general模型进行AI对话
2. **ChatPanel组件**: 所有ChatPanel实例都使用正确的默认模型
3. **Skill节点**: 保持原有的skillSelectedModel设置不变
4. **模型一致性**: ReflyPilot与askai节点现在使用相同的底层模型

**验证方法**:
1. 清除浏览器localStorage中的chat-storage数据
2. 刷新页面重新登录
3. 点击主页的"AskLexiPlus"按钮打开ReflyPilot
4. 检查模型选择器是否显示"HKGAI General"而不是"HKGAI Search Entry"
5. 发送测试消息，确认使用正确的模型API

**向后兼容性**:
- ✅ 现有用户的手动模型选择不受影响
- ✅ 其他节点类型的默认模型保持不变
- ✅ 只影响未设置模型的用户的默认初始化
- ✅ 两个模型字段独立管理，不会相互干扰

**技术教训**:
- **数据流追踪**: 在复杂组件系统中，需要准确追踪数据的完整流向
- **字段语义**: 不同的模型字段有不同的使用场景，需要明确其职责
- **状态初始化**: 全局状态的初始化需要考虑所有使用场景

**相关模型配置**:
- **数据库配置**: `deploy/model-providers/hkgai.sql`
- **API密钥**: `HKGAI_GENERAL_API_KEY = app-5PTDowg5Dn2MSEhG5n3FBWXs`
- **模型标识**: `hkgai-general-item` (providerItemId)

**状态**: ✅ 已完成修复

### 需求 #014: 三段检索功能实现（优先级：高，长期迭代）

**需求描述**: 
从另一个chatbot项目迁移"三段检索"功能，实现渐进式AI分析，用户输入问题后自动执行三段分析并实时展示结果

**功能概述**:
三段检索是一个智能分析系统，通过三个渐进式的AI分析阶段，为用户提供从基础到深度的全面问题解答：

1. **第一段：基础分析** - 快速回答核心问题
2. **第二段：拓展分析** - 提供更全面的背景和相关信息  
3. **第三段：深度剖析** - 深入分析复杂关系和潜在影响

**UI设计规格**:
```
┌─────────────────────────────────────────────┐
│ [问题标题] [下载] [复制] [关闭]              │
├─────────────────────────────────────────────┤
│ 📊 步骤进度展示                            │ 
│ ├── ✅ 基础分析 (已完成)                   │
│ ├── 🔄 拓展分析 (进行中)                   │
│ └── ⏳ 深度剖析 (等待中)                   │
├─────────────────────────────────────────────┤
│ 📝 第一段：基础分析                        │
│ [AI生成内容实时显示]                       │
│ 🔗 [搜索来源链接1] [链接2] [链接3]         │
├─────────────────────────────────────────────┤
│ 📈 第二段：拓展分析                        │
│ [AI生成内容实时显示]                       │  
│ 🔗 [搜索来源链接1] [链接2] [链接3]         │
├─────────────────────────────────────────────┤
│ 🔍 第三段：深度剖析                        │
│ [AI生成内容实时显示]                       │
│ 🔗 [搜索来源链接1] [链接2] [链接3]         │
└─────────────────────────────────────────────┘
```

**交互流程分析**（基于截图）:

#### **实际交互流程**:
```
用户在ReflyPilot输入问题 
→ 方式1: 点击输入框下方的deep_a.png图标 ⭐️ 已实现
→ 方式2: AI回答后点击"Start Research"按钮 ⭐️ 待实现
→ 右侧展开三段检索界面
→ 自动执行三段分析 + 网站搜索
→ 实时显示分析结果和搜索链接
```

**实现进度**:

#### **✅ 第一里程碑: 基础入口实现（已完成）**
1. **deep_a.png图标集成**:
   - ✅ 导入图标资源：`import deepAnalysisIcon from '/src/assets/deep_a.png'`
   - ✅ 添加到ChatPanel输入框下方左侧
   - ✅ 只在ReflyPilot模式下显示（`embeddedMode`条件）
   - ✅ 实现hover效果和点击事件

2. **UI实现细节**:
   ```typescript
   // Add Deep Analysis action only in ReflyPilot mode
   ...(embeddedMode ? [{
     icon: (
       <img 
         src={deepAnalysisIcon} 
         alt="Deep Analysis" 
         className="w-4 h-4 opacity-70 hover:opacity-100 transition-opacity duration-200"
       />
     ),
     title: 'Deep Analysis - Three-stage retrieval',
     onClick: () => {
       console.log('🎯 Deep Analysis triggered from customActions!');
       // TODO: Implement three-stage analysis modal
     },
   }] : []),
   ```

3. **位置和样式优化**:
   - **位置**: ChatActions右侧图标组中，与MCP工具和魔法棒图标并列
   - **大小**: 16x16px (w-4 h-4) - 与其他功能图标保持一致
   - **交互**: hover效果，opacity从70%到100%
   - **集成方式**: 通过customActions数组动态添加，保持代码整洁
   - **限制**: 只在ReflyPilot（embeddedMode）中显示

#### **🔄 第二里程碑: 界面框架搭建（进行中）**
1. 🔄 实现ThreadContainer的左右分栏布局
2. 🔄 创建ThreeStageAnalysisPanel基础组件
3. 🔄 实现右侧面板的展开/收起动画
4. 🔄 添加"Start Research"按钮到AI回答后

#### **⏳ 第三里程碑: 功能集成（待开始）**
1. 🔄 集成AI三段分析逻辑
2. 🔄 集成网站搜索API  
3. 🔄 实现实时内容更新
4. 🔄 实现下载和复制功能

#### **⏳ 第四里程碑: 完善和优化（待开始）**
1. 🔄 用户体验优化
2. 🔄 错误处理和边界情况
3. 🔄 性能优化和测试

**修改文件记录**:
- ✅ `packages/ai-workspace-common/src/components/canvas/launchpad/chat-panel.tsx` - 添加deep_a.png图标入口

**验证方法**:
1. 在ReflyPilot中查看输入框下方是否显示deep_a.png图标
2. 验证图标的hover效果和点击事件
3. 确认只在ReflyPilot模式下显示，其他地方不显示
4. 检查浏览器控制台是否输出"🎯 Deep Analysis triggered!"

**技术要点**:
- **条件渲染**: 使用`embeddedMode`确保只在ReflyPilot中显示
- **资源导入**: 使用Vite的静态资源导入方式
- **样式设计**: Tailwind CSS + 深色模式支持
- **交互设计**: hover状态 + 点击事件

**下一步开发**:
1. 实现三段检索面板的基础框架
2. 添加左右分栏布局到ThreadContainer
3. 创建ThreeStageAnalysisPanel组件
4. 实现面板展开/收起动画

### 📊 Spring Boot后端逻辑分析与NestJS迁移方案

#### **🔍 Spring Boot核心逻辑解析**

基于用户提供的Spring Boot代码，三段检索的核心流程如下：

**1. API入口 (ChatController.java)**：
```java
@PostMapping(value = "/v1/chat/generations/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ChatGenerationResponse> generateStream(@RequestBody ChatGenerationRequest chatGenerationRequest) {
    chatGenerationRequest.setCurrentUserId(SecurityUserUtils.getCurrentUserId());
    return chatService.generateStream(chatGenerationRequest);
}
```

**2. 核心业务逻辑 (ChatService.java)**：
```java
public Flux<ChatGenerationResponse> generateStream(ChatGenerationRequest chatGenerationRequest) {
    return Mono.just(chatGenerationRequest)
        .flatMap(request -> {
            if (Boolean.TRUE.equals(request.getSearch())) {
                // 1. 构建搜索查询（关键：根据阶段添加后缀）
                String query = request.getMessage().getText();
                if (request.getPreGenerationRequired() != null) {
                    if (request.getPreGenerationRequired() == 1) {
                        query = query + "，拓展";        // 第二段
                    } else if (request.getPreGenerationRequired() == 2) {
                        query = query + "，深度剖析";     // 第三段
                    }
                }
                
                // 2. 调用Google搜索API
                GoogleCustomSearchRequest googleRequest = new GoogleCustomSearchRequest();
                googleRequest.setKey(googleCustomSearchKey);
                googleRequest.setCx(googleCustomSearchCx);
                googleRequest.setQ(query);
                Search search = toSearch(googleCustomSearchClient.customSearch(googleRequest));
                
                // 3. 构建增强System Prompt
                SystemMessage systemMessage = buildSystemMessage(search);
                List<Message> messages = new ArrayList<>();
                messages.add(systemMessage);
                messages.addAll(request.getMessages());
                
                // 4. 调用AI模型并返回流
                Prompt prompt = new Prompt(messages, lasOpenAiChatOptions);
                return openAiChatModel.stream(prompt)
                    .map(response -> toChatGenerationResponse(response, search, request.getPreGenerationRequired()));
            }
            // 不搜索时直接调用AI
            return openAiChatModel.stream(new Prompt(request.getMessages(), lasOpenAiChatOptions))
                .map(response -> toChatGenerationResponse(response, null, request.getPreGenerationRequired()));
        })
        .flatMapMany(Function.identity());
}
```

**3. System Prompt构建 (buildSystemMessage)**：
```java
private SystemMessage buildSystemMessage(Search search) {
    StringBuilder builder = new StringBuilder();
    builder.append("你是一个专业的AI助手。请基于以下网络搜索结果回答用户问题。\n\n");
    builder.append("搜索查询: ").append(search.getQuery()).append("\n");
    builder.append("搜索结果:\n");
    
    for (Result result : search.getResults()) {
        builder.append("标题: ").append(result.getTitle()).append("\n");
        builder.append("链接: ").append(result.getLink()).append("\n");
        builder.append("摘要: ").append(result.getSnippet()).append("\n\n");
    }
    
    builder.append("请基于以上搜索结果，用").append(language).append("提供准确、详细的回答。");
    return new SystemMessage(builder.toString());
}
```

#### **🎯 关键数据流程**

```
用户输入问题
    ↓
根据阶段添加查询后缀 (preGenerationRequired: 0→无后缀, 1→"，拓展", 2→"，深度剖析")
    ↓
调用Google Custom Search API
    ↓
将搜索结果格式化为System Prompt
    ↓
将System Prompt + 用户消息发送给AI模型
    ↓
流式返回AI响应 (包含<think>标签和搜索结果元数据)
```

#### **🔧 NestJS实现方案**

**1. 创建DeepResearch模块**：
```
apps/api/src/modules/deep-research/
├── deep-research.module.ts
├── deep-research.controller.ts
├── deep-research.service.ts
├── google-search.service.ts
└── dto/
    ├── deep-research-request.dto.ts
    └── deep-research-response.dto.ts
```

**2. API控制器 (deep-research.controller.ts)**：
```typescript
@Controller('api/v1/deep-research')
export class DeepResearchController {
  constructor(private readonly deepResearchService: DeepResearchService) {}

  @Post('stream')
  @Sse()
  async generateStream(@Body() request: DeepResearchRequestDto): Promise<Observable<MessageEvent>> {
    return this.deepResearchService.generateStream(request);
  }
}
```

**3. 核心业务逻辑 (deep-research.service.ts)**：
```typescript
@Injectable()
export class DeepResearchService {
  constructor(
    private readonly googleSearchService: GoogleSearchService,
    private readonly hkgaiClientFactory: HKGAIClientFactory,
  ) {}

  async generateStream(request: DeepResearchRequestDto): Promise<Observable<MessageEvent>> {
    return new Observable(observer => {
      this.processStages(request, observer);
    });
  }

  private async processStages(request: DeepResearchRequestDto, observer: Observer<MessageEvent>) {
    // 三段检索的核心逻辑
    for (let stage = 0; stage < 3; stage++) {
      try {
        // 1. 构建搜索查询
        const enhancedQuery = this.buildSearchQuery(request.query, stage);
        
        // 2. 调用Google搜索
        const searchResults = await this.googleSearchService.search(enhancedQuery);
        
        // 3. 构建System Prompt
        const systemPrompt = this.buildSystemPrompt(searchResults, enhancedQuery);
        
        // 4. 调用AI模型并流式返回
        const aiResponse = await this.callAIModel(systemPrompt, request.messages);
        
        // 5. 发送到前端
        observer.next({
          data: JSON.stringify({
            stage,
            searchResults,
            aiResponse,
            type: 'stage_complete'
          })
        });
        
      } catch (error) {
        observer.error(error);
        return;
      }
    }
    observer.complete();
  }

  private buildSearchQuery(originalQuery: string, stage: number): string {
    switch (stage) {
      case 0: return originalQuery;                    // 基础分析
      case 1: return `${originalQuery}，拓展`;         // 拓展分析  
      case 2: return `${originalQuery}，深度剖析`;     // 深度剖析
      default: return originalQuery;
    }
  }

  private buildSystemPrompt(searchResults: SearchResult[], query: string): string {
    const builder = [];
    builder.push('你是一个专业的AI助手。请基于以下网络搜索结果回答用户问题。\n\n');
    builder.push(`搜索查询: ${query}\n`);
    builder.push('搜索结果:\n');
    
    searchResults.forEach(result => {
      builder.push(`标题: ${result.title}\n`);
      builder.push(`链接: ${result.link}\n`);
      builder.push(`摘要: ${result.snippet}\n\n`);
    });
    
    builder.push('请基于以上搜索结果，提供准确、详细的回答。');
    return builder.join('');
  }
}
```

**4. Google搜索服务 (google-search.service.ts)**：
```typescript
@Injectable()
export class GoogleSearchService {
  private readonly apiKey = process.env.LAS_SEARCH_GOOGLE_KEY;
  private readonly searchEngineId = process.env.LAS_SEARCH_GOOGLE_CX;

  async search(query: string): Promise<SearchResult[]> {
    const url = `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.searchEngineId}&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.items?.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
    })) || [];
  }
}
```

**5. 数据传输对象 (deep-research-request.dto.ts)**：
```typescript
export class DeepResearchRequestDto {
  @IsString()
  query: string;

  @IsArray()
  @IsOptional()
  messages?: any[];

  @IsNumber()
  @IsOptional()
  preGenerationRequired?: number; // 0, 1, 2 对应三个阶段

  @IsBoolean()
  @IsOptional()
  search?: boolean = true;
}
```

#### **🔧 环境配置**

**apps/api/.env**：
```bash
# Google Custom Search API
LAS_SEARCH_GOOGLE_KEY="AIzaSyB5SdGp54KIIsKEs7z_MHcsIF7MVXeLCjI"
LAS_SEARCH_GOOGLE_CX="e67e12fe38d0148fc"

# AI思维链配置
LAS_OPENAI_CHAT_RESPONSE_THINKING_START_FLAG="<think>"
LAS_OPENAI_CHAT_RESPONSE_THINKING_END_FLAG="</think>"

# LexiHK RAG服务 (如果需要)
LEXIHK_RAG_BASE_URL="http://your-rag-service-url"
LEXIHK_RAG_API_KEY="your-rag-service-api-key"
```

#### **🎯 关键技术决策**

1. **模型选择**：
   - 复用现有的 `hkgai-general` 模型
   - 或者新增 `lexihk-rag` 模型配置指向自建RAG服务

2. **流式响应**：
   - 使用NestJS的 `@Sse()` 装饰器实现Server-Sent Events
   - 每个阶段完成后向前端发送结构化数据

3. **搜索集成**：
   - 直接集成Google Custom Search API
   - 后续可扩展支持其他搜索引擎

4. **错误处理**：
   - 搜索失败时降级到普通AI回答
   - API限额超出时的备用方案

#### **📋 实现优先级**

**第一阶段**：
1. ✅ 创建DeepResearch模块基础框架 - **已完成**
2. ✅ 实现Google搜索服务 - **已完成** 
3. ✅ 创建流式API端点 - **已完成**

**第二阶段**：
1. ✅ 集成现有AI模型 - **已完成**
2. ✅ 实现三段检索核心逻辑 - **已完成**
3. ✅ 添加System Prompt构建 - **已完成**

**第三阶段**：
1. 🔄 前端流式数据解析
2. 🔄 UI组件实时更新
3. 🔄 错误处理和用户体验优化

#### **💡 技术优势**

1. **架构一致性**：与现有NestJS项目完全兼容
2. **模型复用**：利用现有Provider体系
3. **流式性能**：真正的实时响应
4. **可扩展性**：支持更多搜索源和AI模型
5. **安全性**：API密钥安全存储在后端

---

**优先级**: 高（长期迭代功能）
**预估工时**: 7-10天（分4个里程碑）
**状态**: 🔄 第一里程碑已完成，准备开始后端实现

### 🎉 后端实现完成总结

**✅ 已完成：NestJS三段检索后端系统**

我们成功将Spring Boot的三段检索逻辑完整迁移到了NestJS架构中，实现了以下核心组件：

#### **1. 完整的模块架构**
```
apps/api/src/modules/deep-research/
├── deep-research.module.ts          # 模块配置 ✅
├── deep-research.controller.ts      # API控制器 ✅
├── deep-research.service.ts         # 核心业务逻辑 ✅
├── google-search.service.ts         # Google搜索服务 ✅
└── dto/
    ├── deep-research-request.dto.ts # 请求DTO ✅
    └── deep-research-response.dto.ts # 响应DTO ✅
```

#### **2. 核心API端点**
- **POST** `/api/v1/deep-research/stream` - 三段检索流式API ✅
- **POST** `/api/v1/deep-research/health` - 服务健康检查 ✅
- **身份验证**: 集成JWT认证，使用`@LoginedUser()`装饰器 ✅
- **文档化**: 完整的Swagger/OpenAPI文档 ✅

#### **3. 三段检索核心逻辑**
```typescript
// 完全基于Spring Boot逻辑实现
Stage 0: 原始查询 → "人工智能的发展历史"
Stage 1: 拓展查询 → "人工智能的发展历史，拓展" 
Stage 2: 深度查询 → "人工智能的发展历史，深度剖析"
```

#### **4. Google搜索集成**
- **配置**: 支持API Key和搜索引擎ID配置 ✅
- **错误处理**: 完善的错误处理和降级机制 ✅
- **结果处理**: 自动清理和格式化搜索结果 ✅
- **性能优化**: 支持批量搜索和缓存 ✅

#### **5. AI模型集成**
- **模型复用**: 集成现有的`hkgai-general`模型 ✅
- **Prompt构建**: 完整复制Spring Boot的System Prompt逻辑 ✅
- **流式响应**: 使用NestJS的SSE支持实时响应 ✅
- **思维链**: 支持`<think></think>`标签解析 ✅

#### **6. 数据流和事件**
```typescript
// 实时事件流
'stage_start' → 'search_complete' → 'ai_response' → 'stage_complete' → 'complete'
```

#### **7. 环境配置需求**
```bash
# 需要在 apps/api/.env 中添加：
LAS_SEARCH_GOOGLE_KEY="AIzaSyB5SdGp54KIIsKEs7z_MHcsIF7MVXeLCjI"
LAS_SEARCH_GOOGLE_CX="e67e12fe38d0148fc"
LAS_OPENAI_CHAT_RESPONSE_THINKING_START_FLAG="<think>"
LAS_OPENAI_CHAT_RESPONSE_THINKING_END_FLAG="</think>"
```

#### **8. 测试和质量保证**
- ✅ TypeScript编译通过，无类型错误
- ✅ 与现有NestJS架构完美融合
- ✅ 遵循项目的代码规范和最佳实践
- ✅ 完整的错误处理和日志记录

**下一步**: 开始前端集成，实现三段检索UI组件和流式数据处理

---

**优先级**: 高（长期迭代功能）
**预估工时**: 7-10天（分4个里程碑）
**状态**: ✅ 第一、二阶段后端实现已完成，开始第三阶段前端集成



chatbot项目三段检索的前端组件



目前你写的测试代码不符合实际需要 必要的话可以先全部删除 然后重新创建 
最显要的就是点击测试按钮后不应该出现三段检索进度这一整块东西 都要删除 应该像之前的chat一样正常输出信息 所有内容都放到查询详情的button的逻辑里去
核心组件 - DeepResearch.tsx
import { motion } from 'framer-motion'
import {
  CopyOutlinedHover,
  CloseOutlinedHover,
  DownloadOutlinedHover
} from '@/style/iconHover'
import { GlobalOutlined } from '@ant-design/icons'
import { message, Spin, Steps, Divider, Tooltip } from 'antd'
import { useTranslation } from '@/hooks/useTranslation'
import { useModelStore } from '@/store/globalStore'
import { useState, useEffect, useRef, useCallback } from 'react'
import MarkdownContent from './MarkdownContent'
import Logo from './Logo'
import { html2Pdf } from '@/utils/html2Pdf'
import { formatTime } from '@/utils/time'
import { requestEventStream, streamResponse } from '@/utils/stream'
import { useAILoadingStore } from '@/store/globalStore'
import ThoughtProcess from './ThoughtProcess'

export default function DeepResearch() {
  const { t, language } = useTranslation()
  const { isDeepShow, setIsDeepShow, deepShowContent } = useModelStore()
  
  // 三段检索的状态管理
  const [streamingAnswer, setStreamingAnswer] = useState('')
  const [streamingAnswer2, setStreamingAnswer2] = useState('')
  const [streamingAnswer3, setStreamingAnswer3] = useState('')
  
  const [searchResults, setSearchResults] = useState<
    { title: string; link: string; snippet: string }[]
  >([])
  const [searchResults2, setSearchResults2] = useState<
    { title: string; link: string; snippet: string }[]
  >([])
  const [searchResults3, setSearchResults3] = useState<
    { title: string; link: string; snippet: string }[]
  >([])
  
  const [showSearch, setShowSearch] = useState(false)
  const [showSearch2, setShowSearch2] = useState(false)
  const [showSearch3, setShowSearch3] = useState(false)
  
  const [showLoad, setShowLoad] = useState(false)
  const { setIsLoading } = useAILoadingStore()
  const contentContainerRef = useRef<HTMLDivElement>(null)

  // 第一段：基础分析
  const getAiAnswer = useCallback(async () => {
    if (!deepShowContent) return
    setIsLoading(true)
    setShowLoad(true)
    
    // 重置所有状态
    resetAllStates()
    
    try {
      const response = await requestEventStream({
        isSearch: true,
        languageTag: language,
        message: {
          type: 'user',
          text: deepShowContent, // 原始问题，不添加后缀
          metadata: { chatDialogId: '' }
        },
        model: 'HKGAI-V1',
        preGenerationRequired: 0, // 第一段
        persistentStrategy: 0,
        searchStrategy: 1
      })

      let answer = ''
      for await (const { streamContent, searchResultsStream } of streamResponse(response)) {
        if (searchResultsStream && searchResults.length === 0) {
          setSearchResults(searchResultsStream ?? [])
        }

        if (streamContent) {
          setShowLoad(false)
          answer += streamContent
          setStreamingAnswer(answer)
        }
      }
      
      setIsLoading(false)
      setShowSearch(true)
      scrollToBottom()
      
      // 自动执行第二段
      getAiAnswer2()
    } catch (error) {
      console.log('error', error)
      setIsLoading(false)
    }
  }, [deepShowContent, setIsLoading, language])
  
  // 第二段：拓展分析
  const getAiAnswer2 = async () => {
    setIsLoading(true)
    
    const expand = {
      EN: '，Expand',
      TC: '，拓展', 
      SC: '，拓展'
    }
    
    try {
      const response = await requestEventStream({
        isSearch: true,
        languageTag: language,
        message: {
          type: 'user',
          text: deepShowContent + expand[language], // 添加"拓展"后缀
          metadata: { chatDialogId: '' }
        },
        model: 'HKGAI-V1',
        preGenerationRequired: 1, // 第二段
        persistentStrategy: 0,
        searchStrategy: 1
      })

      let answer = ''
      for await (const { streamContent, searchResultsStream } of streamResponse(response)) {
        if (searchResultsStream && searchResults2.length === 0) {
          setSearchResults2(searchResultsStream ?? [])
        }

        if (streamContent) {
          answer += streamContent
          setStreamingAnswer2(answer)
        }
      }
      
      setIsLoading(false)
      setShowSearch2(true)
      scrollToBottom()
      
      // 自动执行第三段
      getAiAnswer3()
    } catch (error) {
      console.log('error', error)
      setIsLoading(false)
    }
  }

  // 第三段：深度剖析
  const getAiAnswer3 = async () => {
    setIsLoading(true)
    
    const analysis = {
      EN: '，In-depth Analysis',
      TC: '，深度剖析',
      SC: '，深度剖析'
    }
    
    try {
      const response = await requestEventStream({
        isSearch: true,
        languageTag: language,
        message: {
          type: 'user',
          text: deepShowContent + analysis[language], // 添加"深度剖析"后缀
          metadata: { chatDialogId: '' }
        },
        model: 'HKGAI-V1',
        preGenerationRequired: 2, // 第三段
        persistentStrategy: 0,
        searchStrategy: 1
      })

      let answer = ''
      for await (const { streamContent, searchResultsStream } of streamResponse(response)) {
        if (searchResultsStream && searchResults3.length === 0) {
          setSearchResults3(searchResultsStream ?? [])
        }

        if (streamContent) {
          answer += streamContent
          setStreamingAnswer3(answer)
        }
      }
      
      setIsLoading(false)
      setShowSearch3(true)
      scrollToBottom()
    } catch (error) {
      console.log('error', error)
      setIsLoading(false)
    }
  }

  // 重置所有状态
  const resetAllStates = () => {
    setShowSearch(false)
    setShowSearch2(false)
    setShowSearch3(false)
    setStreamingAnswer('')
    setStreamingAnswer2('')
    setStreamingAnswer3('')
    setSearchResults([])
    setSearchResults2([])
    setSearchResults3([])
  }

  // 滚动到底部
  const scrollToBottom = () => {
    const container = contentContainerRef.current
    if (!container) return
    setTimeout(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }, 100)
  }

  // 复制功能
  const copyText = async (textToCopy: string | null | undefined) => {
    if (!textToCopy) return
    try {
      await navigator.clipboard.writeText(textToCopy)
      message.success(t('common.copySuccess'))
    } catch (err) {
      message.error(t('common.copyFail'))
    }
  }

  // 自动启动三段检索
  useEffect(() => {
    if (isDeepShow && deepShowContent) {
      getAiAnswer()
    }
  }, [isDeepShow, deepShowContent, getAiAnswer])

  // 自动滚动效果
  useEffect(() => {
    const container = contentContainerRef.current
    if (!container) return

    const animationFrame = requestAnimationFrame(() => {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100

      if (isNearBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        })
      }
    })

    return () => cancelAnimationFrame(animationFrame)
  }, [streamingAnswer, streamingAnswer2, streamingAnswer3])

  if (!isDeepShow) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full h-full p-[20px] bg-[#EDF2F8] pt-[66px]"
    >
      <div className="rounded-[10px] w-full h-full bg-[#FCFAFE] shadow-sm border border-solid border-[#EAE6F2] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="relative">
          <div className="font-bold text-sm text-center text-[#222] font-['Satoshi'] p-[10px]">
            {deepShowContent}
          </div>
          <div className="absolute right-[0px] top-[10px]">
            <DownloadOutlinedHover
              className="mx-2"
              onClick={() => {
                // PDF下载功能
                html2Pdf(contentContainerRef.current, formatTime('YYYYMMDD'))
              }}
            />
            <CopyOutlinedHover
              className="mx-1"
              onClick={() =>
                copyText(`${streamingAnswer}\n${streamingAnswer2}\n${streamingAnswer3}`)
              }
            />
            <CloseOutlinedHover
              className="ml-1 mr-3"
              onClick={() => {
                setIsLoading(false)
                setIsDeepShow(false)
              }}
            />
          </div>
        </div>
        
        <Divider style={{ margin: '10px 0', borderColor: '#DEDDDF' }} />
        
        {/* 内容区域 */}
        <div
          ref={contentContainerRef}
          className="h-[calc(100%-50px)] overflow-y-auto min-h-[200px] p-4"
        >
          {/* 加载状态 */}
          {showLoad && (
            <div className="min-h-[200px] flex justify-center items-center">
              <Spin />
            </div>
          )}
          
          {/* 三段检索结果展示 */}
          {streamingAnswer && (
            <div>
              <Steps
                direction="vertical"
                items={[
                  {
                    title: '基础分析',
                    status: 'finish',
                    description: (
                      <MarkdownContent
                        content={streamingAnswer}
                        className="text-gray-800 word-break"
                      />
                    ),
                    icon: (
                      <img
                        src="/assets/ai_avatar.png"
                        className="w-[30px] h-[30px]"
                      />
                    )
                  }
                ]}
              />
              
              {/* 第一段搜索结果 */}
              {searchResults.length > 0 && showSearch && (
                <SearchResultsDisplay results={searchResults} />
              )}

              {/* 第二段内容 */}
              {streamingAnswer2 && (
                <Steps
                  direction="vertical"
                  items={[
                    {
                      title: '拓展分析',
                      status: 'finish',
                      description: (
                        <MarkdownContent
                          content={streamingAnswer2}
                          className="text-gray-800 word-break"
                        />
                      ),
                      icon: (
                        <img
                          src="/assets/ai_avatar.png"
                          className="w-[30px] h-[30px]"
                        />
                      )
                    }
                  ]}
                />
              )}
              
              {/* 第二段搜索结果 */}
              {searchResults2.length > 0 && showSearch2 && (
                <SearchResultsDisplay results={searchResults2} />
              )}

              {/* 第三段内容 */}
              {streamingAnswer3 && (
                <Steps
                  direction="vertical"
                  items={[
                    {
                      title: '深度剖析',
                      status: 'finish',
                      description: (
                        <MarkdownContent
                          content={streamingAnswer3}
                          className="text-gray-800 word-break"
                        />
                      ),
                      icon: (
                        <img
                          src="/assets/ai_avatar.png"
                          className="w-[30px] h-[30px]"
                        />
                      )
                    }
                  ]}
                />
              )}
              
              {/* 第三段搜索结果 */}
              {searchResults3.length > 0 && showSearch3 && (
                <SearchResultsDisplay results={searchResults3} />
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// 搜索结果展示组件
const SearchResultsDisplay = ({ results }: { 
  results: { title: string; link: string; snippet: string }[] 
}) => (
  <Steps
    direction="vertical"
    items={[
      {
        title: (
          <span className="font-medium text-gray-900">
            Researching websites
          </span>
        ),
        status: 'finish',
        description: (
          <div className="flex flex-wrap gap-3">
            {results.map((item, index) => (
              <Tooltip key={index} title={item.snippet}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center w-[22%] gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full shadow-sm transition-colors rounded-[10px] border border-[#EAE6F2] bg-white shadow-[0px_2px_6px_0px_rgba(25,29,40,0.06)]"
                >
                  <GlobalOutlined />
                  <span className="text-gray-800 font-medium truncate">
                    {item.link}
                  </span>
                </a>
              </Tooltip>
            ))}
          </div>
        ),
        icon: <GlobalOutlined />
      }
    ]}
  />
)

式处理工具 - utils/stream.ts
const baseURL = {
  global: import.meta.env.VITE_BASE_API
}

let currentController: AbortController | null = null

// 请求事件流
async function requestEventStream(
  data: Record<string, unknown>,
  url: string = '/ai/v1/chat/generations/stream'
) {
  const tokenStorage = localStorage.getItem('token-storage')

  if (tokenStorage) {
    try {
      // 如果有旧的控制器，先中止它
      if (currentController) {
        currentController.abort()
      }
      
      // 创建新的 AbortController
      currentController = new AbortController()
      const signal = currentController.signal
      
      const token = JSON.parse(tokenStorage)?.state?.token
      const stream = await fetch(`${baseURL.global}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(data),
        signal
      })
      
      if (!stream.ok) {
        throw new Error('Network response was not ok')
      }
      
      return stream
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Request was aborted')
      } else {
        console.log('error', error)
      }
    }
  }
}

// 处理流式响应
async function* streamResponse(response: Response | undefined) {
  if (!response) return
  const decoder = new TextDecoder()
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No reader available')
  }

  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.trim() === '') continue
        if (line.startsWith('data:')) {
          try {
            const json = JSON.parse(line.slice(5))
            if (json?.results?.[0]?.metadata?.finishReason === 'STOP') return
            
            const streamContent = json?.results?.[0]?.output?.text
            const searchResultsStream = json?.metadata?.search?.results
            
            if (streamContent || searchResultsStream) {
              yield {
                streamContent,
                searchResultsStream
              }
            }
          } catch (e) {
            console.error('Error parsing chunk:', e)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// 中止当前请求
async function abortCurrentRequest(): Promise<boolean> {
  if (currentController) {
    const controller = currentController
    currentController = null
    
    try {
      controller.abort()
      return true
    } catch (error) {
      console.log('Abort error (handled):', error)
      return true
    }
  }
  
  return false
}

export { requestEventStream, streamResponse, abortCurrentRequest }




===
启用三段检索的方法
// 在任何组件中触发三段检索
import { useModelStore } from '@/store/globalStore'

const SomeComponent = () => {
  const { setIsDeepShow, setDeepShowContent } = useModelStore()
  
  const handleDeepResearch = (question: string) => {
    setDeepShowContent(question)  // 设置要研究的问题
    setIsDeepShow(true)          // 显示深度研究界面
  }
  
  return (
    <button onClick={() => handleDeepResearch("用户的问题")}>
      开始深度研究
    </button>
  )
}



全局样式 - src/index.css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply m-0 antialiased text-gray-900 dark:text-gray-100 font-['Inter'] bg-gray-50 dark:bg-gray-900;
  }
}

/* 三段检索专用样式 */
.word-break {
    word-break: break-word;
}

/* 自定义按钮样式 */
.custom-button {
    background-color: #7765E9 !important;
    color: #FFFFFF !important;
    border-color: #7765E9 !important;
}
  
.custom-button:hover {
    background-color: #7765E9e6 !important;
    border-color: #7765E9e6 !important;
}

.custom-text-button {
    color: #7765E9 !important;
}

.custom-text-button:hover {
    color: #7765E9e6 !important;
}

/* Ant Design Steps 组件样式定制 */
:where(.css-dev-only-do-not-override-142vneq).ant-steps .ant-steps-item-finish.ant-steps-item-custom .ant-steps-item-icon >.ant-steps-icon {
    color: #7765E9;
}

:where(.css-dev-only-do-not-override-142vneq).ant-steps .ant-steps-item-finish>.ant-steps-item-container>.ant-steps-item-tail::after {
    background-color: #7765E9;
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 3px;
    transition: background 0.3s;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(0,0,0,0.3);
}

@layer components {
  .chat-container {
    @apply max-h-[calc(100vh-12rem)] overflow-y-auto scroll-smooth scrollbar-custom;
    scroll-behavior: smooth;
  }

  .message-bubble {
    @apply rounded-2xl bg-white dark:bg-gray-800 shadow-sm
           border border-gray-100 dark:border-gray-700/50
           backdrop-blur-sm;
  }

  .input-field {
    @apply w-full p-4 rounded-2xl
           bg-white dark:bg-gray-800
           border border-gray-200 dark:border-gray-700
           text-gray-800 dark:text-gray-200
           shadow-sm backdrop-blur-sm
           focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
           transition-shadow duration-200;
  }

  .prose {
    @apply text-sm leading-relaxed;
  }

  .scrollbar-custom {
    scrollbar-width: thin;
    scrollbar-color: rgba(0,0,0,0.2) transparent;
  }

  .scrollbar-custom::-webkit-scrollbar {
    @apply w-1.5;
  }

  .scrollbar-custom::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb {
    @apply bg-gray-300/50 dark:bg-gray-700/50 rounded-full 
           hover:bg-gray-400/50 dark:hover:bg-gray-600/50 
           transition-colors;
  }
}


专用样式组件
搜索结果展示样式
const SearchResultsDisplay = ({ results }: { 
  results: { title: string; link: string; snippet: string }[] 
}) => (
  <Steps
    direction="vertical"
    items={[
      {
        title: (
          <span className="font-medium text-gray-900">
            Researching websites
          </span>
        ),
        status: 'finish',
        description: (
          <div className="flex flex-wrap gap-3">
            {results.map((item, index) => (
              <Tooltip key={index} title={item.snippet}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center w-[22%] gap-2 px-4 py-2 
                           bg-gray-50 hover:bg-gray-100 
                           rounded-[10px] border border-[#EAE6F2] 
                           bg-white shadow-[0px_2px_6px_0px_rgba(25,29,40,0.06)]
                           transition-colors duration-200
                           hover:shadow-md"
                >
                  <GlobalOutlined className="text-blue-500" />
                  <span className="text-gray-800 font-medium truncate">
                    {item.link}
                  </span>
                </a>
              </Tooltip>
            ))}
          </div>
        ),
        icon: <GlobalOutlined className="text-blue-500" />
      }
    ]}
  />
)

动画和过渡效果
Framer Motion 动画配置

import { motion } from 'framer-motion'

const animationConfig = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: "easeOut" }
}

// 在组件中使用
<motion.div
  initial={animationConfig.initial}
  animate={animationConfig.animate}
  exit={animationConfig.exit}
  transition={animationConfig.transition}
  className={containerClasses}
>
  {/* 内容 */}
</motion.div>


这些代码你可以做参考 不一定全部照搬 要按照我们项目目前的实际代码配置去做