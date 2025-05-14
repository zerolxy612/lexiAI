# Gitpod 快速部署

## 1. 简介
Gitpod 是一个基于云的开发环境，它允许你通过浏览器快速启动一个预配置好的开发环境。使用 Gitpod 部署 Refly 可以省去本地环境配置的麻烦，让你快速开始使用 Refly。通过 Gitpod 的一键部署功能，你可以轻松地在几分钟内拥有一个完整的 Refly 工作环境。

## 2. 前提条件
在开始使用 Gitpod 部署 Refly 之前，请确保你满足以下条件：
- **一个 GitHub 账号：** Gitpod 使用 GitHub 账号进行身份验证和仓库访问。
- **（可选）了解 Gitpod 的基本使用：** 虽然本文档会指导你完成部署过程，但对 Gitpod 有基本了解会帮助你更好地使用。

## 3. 部署步骤详解
按照以下步骤，在 Gitpod 中快速部署 Refly：

### 3.1 找到并点击 "Open in Gitpod" 按钮
通常，你可以在 Refly 的 GitHub 仓库的 README 文件中或 Refly 的官方网站上找到一个 "Open in Gitpod" 按钮。点击这个按钮将引导你进入 Gitpod 的设置页面。
![](/images/2025-05-14-15-39-51.png)

### 3.2 授权 Gitpod 访问 GitHub
如果你是第一次使用 Gitpod，系统会要求你授权 Gitpod 访问你的 GitHub 账号。请按照提示完成授权，以便 Gitpod 能够克隆 Refly 仓库并创建工作区。
![](/images/2025-05-14-15-40-28.png)

### 3.3 配置并创建 Gitpod 工作区
在 Gitpod 页面上，你会看到关于 Refly 仓库的信息。通常情况下，你无需修改默认设置。确认信息无误后，点击 "Continue" 或类似的按钮来创建 Gitpod 工作区。
![](/images/2025-05-14-15-40-55.png)

### 3.4 等待工作区准备和服务部署
解释 Gitpod 会自动拉取代码、配置环境，并根据 `.gitpod.yml` 文件执行部署任务。
![](/images/2025-05-14-15-41-24.png)
![](/images/2025-05-14-15-42-02.png)

根据 `.gitpod.yml` 文件，Gitpod 会执行以下 `init` 任务：
```bash
cd deploy/docker && cp ../../apps/api/.env.example .env && docker compose up -d
```
这个命令的作用是：
1. 进入 `deploy/docker` 目录。
2. 复制 `../../apps/api/.env.example` 文件并将其命名为 `.env` 到当前目录。这个文件包含了 Refly 服务运行所需的环境变量配置。
3. 使用 Docker Compose 以后台（`-d`）模式启动 `deploy/docker` 目录下 `docker-compose.yml` 文件中定义的所有服务，包括 api, redis, qdrant, db, minio, searxng, web 等。

你可以在 Gitpod 终端中看到服务启动的过程和日志输出。请耐心等待所有服务成功启动。
![](/images/2025-05-14-15-42-26.png)
![](/images/2025-05-14-15-42-40.png)
![](/images/2025-05-14-15-42-58.png)
### 3.5 访问及使用 Refly
当 `.gitpod.yml` 中定义的服务全部成功启动后，Refly 应用就可以访问了。根据 `.gitpod.yml` 文件中的 `ports` 配置，Gitpod 会暴露一些端口。其中，`5700` 端口被配置为 `onOpen: open-preview`，这意味着 Gitpod 会自动在你当前浏览器中打开一个预览窗口，显示运行在 `5700` 端口的 Refly API 服务。

你可以通过这个预览窗口或 Gitpod 提供的端口转发链接来访问 Refly 应用的 Web 界面。通常 Web 界面会通过 API 端口进行通信。

**初次使用 Refly：**

首次访问 Refly 应用时，你需要注册一个账户并登录。登录后，为了充分使用 Refly 的各项功能，你需要进行必要的个性化配置，包括：

- **配置供应商：** 接入外部 AI 服务和模型。
- **配置模型：** 管理不同类型的模型（LLM、嵌入模型、排序模型）。
- **配置解析器：** 设置网页搜索、URL 解析等功能。
- **配置默认模型：** 设置常用的默认模型。

详细的配置步骤和说明，请参考[个性化设置指南](../personalization.md)。

