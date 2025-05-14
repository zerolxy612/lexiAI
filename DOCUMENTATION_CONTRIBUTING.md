# Refly.AI 文档贡献指南

欢迎您为 Refly.AI 文档做出贡献！您的贡献将帮助我们构建更完善、更易用的文档，让更多用户了解和使用 Refly。

本指南将帮助您了解如何为 Refly.AI 文档项目贡献内容。

## 贡献前的准备

在开始贡献之前，请确保您已经完成以下准备工作：

1.  **阅读许可协议和行为准则**:
    *   请阅读项目的 [License and Contributor Agreement](./LICENSE)。
    *   请遵守社区的 [code of conduct](./.github/CODE_OF_CONDUCT.md)。
2.  **安装必备工具**:
    *   **Git**: 用于版本控制。
    *   **Node.js**: 版本 16 或更高。推荐使用 [nvm](https://github.com/nvm-sh/nvm) 进行安装和管理。
    *   **pnpm**: 版本 8.15.8 或更高。可以通过 npm 安装 (`npm install -g pnpm`) 或使用 Corepack (`corepack enable`)。
3.  **Fork 仓库**: 在 GitHub 上 Fork Refly.AI 的主仓库 (`refly-ai/refly`) 到您的个人账户。文档相关的修改通常在主仓库的 `docs/` 目录下进行。
4.  **克隆仓库**: 将您 Fork 的仓库克隆到本地。
    ```bash
    git clone git@github.com:<您的 GitHub 用户名>/refly.git
    cd refly
    ```

## 本地开发环境搭建

为了方便您预览文档修改效果，建议搭建本地开发环境：

1.  **进入文档目录**:
    ```bash
    cd docs
    ```
2.  **安装依赖**: 在 `docs/` 目录下运行 pnpm 安装依赖。
    ```bash
    pnpm install
    ```
3.  **启动开发服务器**: 运行开发脚本启动文档站点。
    ```bash
    pnpm dev
    ```
    开发服务器启动后，您可以在浏览器中访问本地地址（通常是 `http://localhost:5173`）预览文档。

## 文档结构概览

Refly.AI 文档使用 VitePress 构建，主要结构如下：

*   `docs/`: 文档根目录。
*   `docs/index.md`: 文档站点主页。
*   `docs/README.md`: 文档仓库的概览和本地开发说明。
*   `docs/.vitepress/`: VitePress 配置文件目录，包含导航、侧边栏等配置。
*   `docs/public/`: 静态资源目录（图片、图标等）。
*   `docs/en/`: 英文文档目录（如果英文文档不在根目录）。
*   `docs/zh/`: 中文文档目录。
*   其他子目录（如 `cloud/`, `community-version/`, `scenarios/`）对应不同的文档章节。

## 如何贡献文档内容

贡献文档主要包括创建或修改 Markdown 文件以及更新导航配置。

1.  **创建或修改 Markdown 文件**:
    *   根据您要添加或修改的内容，在 `docs/` 目录下找到或创建相应的 `.md` 文件。
    *   遵循 Markdown 语法编写内容。
    *   如果需要添加图片，请将图片文件放在 `docs/public/images/` 目录下，并在 Markdown 文件中使用相对路径引用，例如 `![图片描述](/images/your-image.webp)`。
    *   如果您的贡献是多语言翻译，请在对应的语言目录下进行修改（例如，中文内容在 `docs/zh/` 下）。
2.  **更新导航配置**:
    *   文档站点的导航菜单和侧边栏通常在 `.vitepress/config.js` 文件中配置。
    *   如果您添加了新的页面或章节，您可能需要在 `.vitepress/config.js` 中修改 `themeConfig.nav`（顶部导航）或 `themeConfig.sidebar`（侧边栏导航）配置项，添加指向您新文件的链接，以便用户能够通过导航找到您的内容。
    *   请参考 VitePress 的官方文档了解更多关于导航和侧边栏配置的细节。

## 提交您的贡献

当您完成文档修改并希望提交时：

1.  **检查修改**: 在本地开发服务器中预览您的修改，确保显示正常且内容准确。
2.  **提交更改**: 使用 Git 提交您的修改。
    ```bash
    git add .
    git commit -m "feat: add documentation for new feature" # 编写清晰的提交信息
    ```
3.  **推送到您的 Fork 仓库**:
    ```bash
    git push origin <您的分支名称>
    ```
4.  **创建 Pull Request**: 在 GitHub 上访问您的 Fork 仓库页面，创建 Pull Request 到 Refly.AI 主仓库的 `main` 分支。
5.  **参与评审**: 项目维护者将对您的 Pull Request 进行评审。请关注评审意见，并根据需要进行修改。

## 获取帮助

如果您在贡献过程中遇到任何问题，可以通过以下途径寻求帮助：

*   加入 Refly 的 [Discord 社区](https://discord.gg/bWjffrb89h)。
*   在 [GitHub Discussions](https://github.com/refly-ai/refly/discussions) 中提问。
*   查阅 [Refly 文档](https://docs.refly.ai)。

感谢您对 Refly.AI 文档的贡献！