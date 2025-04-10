import * as Y from "yjs";
import * as fs from "fs";
import * as path from "path";
import { Injectable, Logger, Inject } from "@nestjs/common";
import { PrismaService } from "@/common/prisma.service";
import { MiscService } from "@/misc/misc.service";
import { CanvasService } from "@/canvas/canvas.service";
import { KnowledgeService } from "@/knowledge/knowledge.service";
import { ActionService } from "@/action/action.service";
import { MinioService } from "@/common/minio.service";
import { MINIO_INTERNAL } from "@/common/minio.service";
import pLimit from "p-limit";
import { streamToBuffer } from "@/utils";
import { User, EntityType, CanvasNode } from "@refly-packages/openapi-schema";
import { ShareNotFoundError } from "@refly-packages/errors";
import { CodeArtifactService } from "@/code-artifact/code-artifact.service";
import { ShareService } from "@/share/share.service";
import {
  CreatePageDto,
  UpdatePageDto,
  NodeRelationDto,
  CreatePageResult,
  PageDetailResult,
  UpdatePageResult,
  PublishPageResult,
  PageVersionResult,
  PageVersionsResult,
  SharePageResult,
  DeletePageResult,
  Page,
  PageNodeRelation,
  PageVersion,
} from "./pages.dto";
import { Prisma } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import { v4, v5 } from "uuid";

// 类型定义
interface ResolveUserResponse {
  uid: string;
  userInfo?: {
    name?: string;
  };
}

// 自定义PageNotFoundError错误类
class PageNotFoundError extends ShareNotFoundError {
  code = "E1010"; // 自定义错误代码，确保不与其他错误代码冲突
  messageDict = {
    en: "Page not found",
    "zh-CN": "页面不存在",
  };
}

// 生成唯一ID
const genPageId = (): string => `page-${createId()}`;
const genPageNodeRelationId = (): string => `pnr-${createId()}`;
const genPageVersionId = (): string => `pver-${createId()}`;

@Injectable()
export class PagesService {
  private logger = new Logger(PagesService.name);

  constructor(
    private prisma: PrismaService,
    private miscService: MiscService,
    private canvasService: CanvasService,
    private knowledgeService: KnowledgeService,
    private actionService: ActionService,
    private codeArtifactService: CodeArtifactService,
    private shareService: ShareService,
    @Inject(MINIO_INTERNAL) private minio: MinioService
  ) {}

  // 列出用户的所有Pages
  async listPages(
    user: User,
    page = 1,
    pageSize = 20
  ): Promise<{
    pages: Page[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const pages = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "uid" = ${user.uid} AND "deleted_at" IS NULL
      ORDER BY "updated_at" DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;

    const [count] = await this.prisma.$queryRaw<{ count: string }[]>`
      SELECT COUNT(*) as count FROM "pages"
      WHERE "uid" = ${user.uid} AND "deleted_at" IS NULL
    `;

    return {
      pages,
      total: Number(count.count),
      page,
      pageSize,
    };
  }

  // 创建Page
  async createPage(
    user: User | ResolveUserResponse,
    { title = "Untitled", description, content }: CreatePageDto
  ): Promise<CreatePageResult> {
    const { uid } = user as User;

    // 生成pageId
    const pageId = genPageId();
    const stateStorageKey = `pages/${uid}/${pageId}/state.update`;

    // 从content中提取canvasId和nodeIds
    const canvasId = content?.canvasId;
    const nodeIds = content?.nodeIds || [];

    if (!canvasId) {
      throw new Error("Missing canvasId in content");
    }

    if (!nodeIds.length) {
      throw new Error("No nodes selected");
    }

    // 从画布获取数据
    const canvasData = await this.canvasService.getCanvasRawData(
      user,
      canvasId
    );

    // 筛选指定的节点
    const selectedNodes = (canvasData.nodes as CanvasNode[]).filter((node) =>
      nodeIds.includes(node.data.entityId)
    );

    // 验证所有需要的节点都存在
    if (selectedNodes.length !== nodeIds.length) {
      throw new Error("Some selected nodes cannot be found");
    }

    // 创建新的Page记录
    const [page] = await this.prisma.$queryRaw<Page[]>`
      INSERT INTO "pages" ("page_id", "uid", "title", "state_storage_key", "status", "created_at", "updated_at")
      VALUES (${pageId}, ${uid}, ${title || "Untitled Page"}, ${stateStorageKey}, 'draft', NOW(), NOW())
      RETURNING *
    `;

    // 创建初始的Y.doc来存储页面状态
    const doc = new Y.Doc();
    doc.transact(() => {
      doc.getText("title").insert(0, page.title);
      doc.getArray("nodeIds").insert(0, nodeIds);
      doc.getMap("pageConfig").set("layout", "slides");
      doc.getMap("pageConfig").set("theme", "default");
    });

    // 上传Y.doc - 将Y.Doc转换为Uint8Array，再转为Buffer
    const state = Y.encodeStateAsUpdate(doc);
    await this.minio.client.putObject(stateStorageKey, Buffer.from(state));

    // 创建页面与节点的关联记录
    const nodeRelationsPromises = selectedNodes.map(async (node, index) => {
      const relationId = genPageNodeRelationId();
      const [relation] = await this.prisma.$queryRaw<PageNodeRelation[]>`
        INSERT INTO "page_node_relations" ("relation_id", "page_id", "node_id", "node_type", "entity_id", "order_index", "node_data", "created_at", "updated_at")
        VALUES (${relationId}, ${pageId}, ${node.data.entityId}, ${node.type}, ${node.data.entityId}, ${index}, ${JSON.stringify(node.data)}, NOW(), NOW())
        RETURNING *
      `;

      return relation;
    });

    const nodeRelations = await Promise.all(nodeRelationsPromises);

    return {
      page,
      nodeRelations,
    };
  }

  // 获取页面详情 - 编辑时使用
  async getPageDetail(
    user: User | ResolveUserResponse,
    pageId: string
  ): Promise<PageDetailResult> {
    const { uid } = user as User;

    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "uid" = ${uid}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // 获取页面的节点关联
    const nodeRelations = await this.prisma.$queryRaw<PageNodeRelation[]>`
      SELECT * FROM "page_node_relations"
      WHERE "page_id" = ${pageId}
      AND "deleted_at" IS NULL
      ORDER BY "order_index" ASC
    `;

    // 获取页面配置
    let pageConfig = {
      layout: "slides",
      theme: "light",
    };

    try {
      // 从存储服务读取页面状态
      if (page.state_storage_key) {
        const stateStream = await this.minio.client.getObject(
          page.state_storage_key
        );
        const stateBuffer = await streamToBuffer(stateStream);

        if (stateBuffer) {
          const update = new Uint8Array(stateBuffer);
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, update);

          const pageConfigMap = ydoc.getMap("pageConfig");

          if (pageConfigMap.size > 0) {
            pageConfig = {
              layout: (pageConfigMap.get("layout") as string) || "slides",
              theme: (pageConfigMap.get("theme") as string) || "light",
            };
          }
        }
      }
    } catch (error) {
      this.logger.error("Error reading page state:", error);
    }

    return {
      page,
      nodeRelations,
      pageConfig,
    };
  }

  // 更新页面 - 保存编辑状态
  async updatePage(
    user: User | ResolveUserResponse,
    pageId: string,
    param: UpdatePageDto
  ): Promise<UpdatePageResult> {
    const { uid } = user as User;
    const { title, nodeRelations, nodeRelationOrders, pageConfig } = param;

    // 检查页面是否存在
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "uid" = ${uid}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // 使用事务处理所有数据库操作
    return await this.prisma.$transaction(async (tx) => {
      // 开始更新操作
      let updatePage = page;

      // 如果有标题更新
      if (title !== undefined) {
        const [updated] = await tx.$queryRaw<Page[]>`
          UPDATE "pages"
          SET "title" = ${title}, "updated_at" = NOW()
          WHERE "page_id" = ${pageId}
          RETURNING *
        `;
        updatePage = updated;
      }

      // 如果仅是更新节点顺序
      let updatedRelations = undefined;
      if (nodeRelationOrders && nodeRelationOrders.length > 0) {
        this.logger.log("Updating node relation orders", nodeRelationOrders);

        // 获取当前页面的节点关联
        const existingRelations = await tx.$queryRaw<PageNodeRelation[]>`
          SELECT * FROM "page_node_relations"
          WHERE "page_id" = ${pageId}
          AND "deleted_at" IS NULL
        `;

        // 按relationId分组现有关系，方便查找
        const relationsByRelationId = existingRelations.reduce(
          (acc: Record<string, PageNodeRelation>, relation) => {
            acc[relation.relation_id] = relation;
            return acc;
          },
          {}
        );

        // 只更新节点顺序
        const updatedRelationsPromises = nodeRelationOrders.map(
          async (relation) => {
            const { relationId, orderIndex } = relation;

            // 检查是否存在此关联ID
            if (relationsByRelationId[relationId]) {
              // 仅更新顺序
              const [updated] = await tx.$queryRaw<PageNodeRelation[]>`
              UPDATE "page_node_relations"
              SET "order_index" = ${orderIndex}, "updated_at" = NOW()
              WHERE "relation_id" = ${relationId}
              RETURNING *
            `;
              return updated;
            }
            // 如果找不到关联ID，返回null
            return null;
          }
        );

        // 过滤掉null值
        const results = await Promise.all(updatedRelationsPromises);
        updatedRelations = results.filter(Boolean);
      }
      // 如果是完整的节点关联更新
      else if (nodeRelations && nodeRelations.length > 0) {
        // 获取当前页面的节点关联
        const existingRelations = await tx.$queryRaw<PageNodeRelation[]>`
          SELECT * FROM "page_node_relations"
          WHERE "page_id" = ${pageId}
          AND "deleted_at" IS NULL
        `;

        // 按节点ID分组现有关系，方便查找
        const relationsByNodeId = existingRelations.reduce(
          (acc: Record<string, PageNodeRelation>, relation) => {
            acc[relation.node_id] = relation;
            return acc;
          },
          {}
        );

        // 更新现有关系或创建新关系
        const updatedRelationsPromises = nodeRelations.map(
          async (relation, index) => {
            const {
              nodeId,
              nodeType,
              entityId,
              nodeData,
              orderIndex = index,
            } = relation;

            // 检查是否已有此节点关联
            if (relationsByNodeId[nodeId]) {
              // 更新现有关联
              const [updated] = await tx.$queryRaw<PageNodeRelation[]>`
              UPDATE "page_node_relations"
              SET 
                "node_type" = ${nodeType},
                "entity_id" = ${entityId},
                "order_index" = ${orderIndex},
                "node_data" = ${JSON.stringify(nodeData) || "{}"},
                "updated_at" = NOW()
              WHERE "relation_id" = ${relationsByNodeId[nodeId].relation_id}
              RETURNING *
            `;
              return updated;
            } else {
              // 创建新关联
              const relationId = genPageNodeRelationId();
              const nodeDataStr =
                typeof nodeData === "string"
                  ? nodeData
                  : JSON.stringify(nodeData || {});

              const [created] = await tx.$queryRaw<PageNodeRelation[]>`
              INSERT INTO "page_node_relations" (
                "relation_id", "page_id", "node_id", "node_type", "entity_id", 
                "order_index", "node_data", "created_at", "updated_at"
              )
              VALUES (
                ${relationId}, ${pageId}, ${nodeId}, ${nodeType}, ${entityId}, 
                ${orderIndex}, ${nodeDataStr}, NOW(), NOW()
              )
              RETURNING *
            `;
              return created;
            }
          }
        );

        updatedRelations = await Promise.all(updatedRelationsPromises);
      }

      // 在事务完成后处理非数据库操作（如更新页面状态文件）
      if (pageConfig) {
        try {
          // 读取现有状态文件
          let ydoc = new Y.Doc();

          if (page.state_storage_key) {
            try {
              const stateStream = await this.minio.client.getObject(
                page.state_storage_key
              );
              const stateBuffer = await streamToBuffer(stateStream);

              if (stateBuffer) {
                const update = new Uint8Array(stateBuffer);
                Y.applyUpdate(ydoc, update);
              }
            } catch (error) {
              // 如果文件不存在，使用新的Y.Doc()
              this.logger.error(
                "Error reading state file, creating new:",
                error
              );
              ydoc = new Y.Doc();
            }
          }

          // 更新pageConfig
          const pageConfigMap = ydoc.getMap("pageConfig");
          Object.entries(pageConfig).forEach(([key, value]) => {
            pageConfigMap.set(key, value);
          });

          // 保存更新后的状态
          const update = Y.encodeStateAsUpdate(ydoc);
          await this.minio.client.putObject(
            page.state_storage_key,
            Buffer.from(update)
          );
        } catch (error) {
          this.logger.error("Error saving page state:", error);
        }
      }

      return {
        page: updatePage,
        nodeRelations: updatedRelations,
      };
    });
  }

  // 发布页面 - 生成可分享的版本
  async publishPage(
    user: User | ResolveUserResponse,
    pageId: string
  ): Promise<PublishPageResult> {
    const { uid } = user as User;

    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "uid" = ${uid}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // 获取节点关联
    const nodeRelations = await this.prisma.$queryRaw<PageNodeRelation[]>`
      SELECT * FROM "page_node_relations"
      WHERE "page_id" = ${pageId}
      AND "deleted_at" IS NULL
      ORDER BY "order_index" ASC
    `;

    // 获取页面内容，这里假设是从state_storage_key中获取
    let content: any = { nodes: [] };
    let pageConfig = {
      layout: "slides",
      theme: "light",
    };

    try {
      // 从存储服务读取页面状态
      if (page.state_storage_key) {
        const stateStream = await this.minio.client.getObject(
          page.state_storage_key
        );
        const stateBuffer = await streamToBuffer(stateStream);

        if (stateBuffer) {
          const update = new Uint8Array(stateBuffer);
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, update);

          // 获取pageConfig
          const pageConfigMap = ydoc.getMap("pageConfig");
          pageConfig = {
            layout: (pageConfigMap.get("layout") as string) || "slides",
            theme: (pageConfigMap.get("theme") as string) || "light",
          };
        }
      }

      // 构建内容对象
      content = {
        pageConfig,
        nodes: await Promise.all(
          nodeRelations.map(async (relation) => {
            let nodeData = {};
            try {
              nodeData = relation.node_data
                ? typeof relation.node_data === "string"
                  ? JSON.parse(relation.node_data)
                  : relation.node_data
                : {};
            } catch (error) {
              this.logger.error("Error parsing node data:", error);
            }

            // 为代码节点添加代码内容
            if (relation.node_type === "code_artifact") {
              try {
                const codeArtifact =
                  await this.codeArtifactService.getCodeArtifactDetail(
                    user,
                    relation.entity_id
                  );
                if (codeArtifact) {
                  return {
                    relationId: relation.relation_id,
                    nodeId: relation.node_id,
                    nodeType: relation.node_type,
                    entityId: relation.entity_id,
                    orderIndex: relation.order_index,
                    nodeData: {
                      ...nodeData,
                      code: codeArtifact.content,
                      language: codeArtifact.language,
                    },
                  };
                }
              } catch (error) {
                this.logger.error("Error getting code artifact:", error);
              }
            }

            // 为知识节点添加知识内容
            if (relation.node_type === "knowledge") {
              try {
                const knowledge = await this.knowledgeService.getResourceDetail(
                  user,
                  { resourceId: relation.entity_id }
                );
                if (knowledge) {
                  return {
                    relationId: relation.relation_id,
                    nodeId: relation.node_id,
                    nodeType: relation.node_type,
                    entityId: relation.entity_id,
                    orderIndex: relation.order_index,
                    nodeData: {
                      ...nodeData,
                      title: knowledge.title,
                      content: knowledge.content,
                    },
                  };
                }
              } catch (error) {
                this.logger.error("Error getting knowledge:", error);
              }
            }

            return {
              relationId: relation.relation_id,
              nodeId: relation.node_id,
              nodeType: relation.node_type,
              entityId: relation.entity_id,
              orderIndex: relation.order_index,
              nodeData,
            };
          })
        ),
      };
    } catch (error) {
      this.logger.error("Error building page content:", error);
    }

    // 获取最新版本号
    const [latestVersion] = await this.prisma.$queryRaw<
      { max_version: number }[]
    >`
      SELECT COALESCE(MAX(version), 0) as max_version FROM "page_versions"
      WHERE "page_id" = ${pageId}
    `;

    const nextVersion = latestVersion.max_version + 1;
    const contentStorageKey = `pages/${page.uid}/${pageId}/versions/${nextVersion}.json`;

    // 保存内容到存储
    const contentString = JSON.stringify(content);
    await this.minio.client.putObject(
      contentStorageKey,
      Buffer.from(contentString)
    );

    // 保存最新版本
    const pageVersionId = genPageVersionId();
    const [version] = await this.prisma.$queryRaw<PageVersion[]>`
      INSERT INTO "page_versions" (
        "version_id", "page_id", "version", "title", "cover_storage_key", "content_storage_key", "created_at"
      )
      VALUES (
        ${pageVersionId}, ${pageId}, ${nextVersion}, ${page.title}, ${page.cover_storage_key}, ${contentStorageKey}, NOW()
      )
      RETURNING *
    `;

    // 更新页面状态为已发布
    const [updatedPage] = await this.prisma.$queryRaw<Page[]>`
      UPDATE "pages"
      SET "status" = 'published', "updated_at" = NOW()
      WHERE "page_id" = ${pageId}
      RETURNING *
    `;

    return {
      page: updatedPage,
      version,
    };
  }

  // 获取页面版本 - 可以指定版本，不指定则获取最新版本
  async getPageVersion(
    pageId: string,
    version?: number
  ): Promise<PageVersionResult> {
    // 获取页面信息
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // 获取版本信息
    let versionQuery;
    if (version) {
      versionQuery = this.prisma.$queryRaw<PageVersion[]>`
        SELECT * FROM "page_versions"
        WHERE "page_id" = ${pageId}
        AND "version" = ${version}
        ORDER BY "created_at" DESC
        LIMIT 1
      `;
    } else {
      versionQuery = this.prisma.$queryRaw<PageVersion[]>`
        SELECT * FROM "page_versions"
        WHERE "page_id" = ${pageId}
        ORDER BY "version" DESC
        LIMIT 1
      `;
    }

    const [pageVersion] = await versionQuery;

    if (!pageVersion) {
      throw new ShareNotFoundError();
    }

    // 获取版本内容
    let content: any = null;

    try {
      if (pageVersion.content_storage_key) {
        const contentStream = await this.minio.client.getObject(
          pageVersion.content_storage_key
        );
        const contentBuffer = await streamToBuffer(contentStream);

        if (contentBuffer) {
          content = JSON.parse(contentBuffer.toString());
        }
      }
    } catch (error) {
      this.logger.error("Error reading version content:", error);
      content = { error: "Failed to read content" };
    }

    return {
      page,
      version: pageVersion,
      content,
    };
  }

  // 获取页面的所有版本
  async getPageVersions(pageId: string): Promise<PageVersionsResult> {
    // 获取页面信息
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // 获取所有版本
    const versions = await this.prisma.$queryRaw<PageVersion[]>`
      SELECT * FROM "page_versions"
      WHERE "page_id" = ${pageId}
      ORDER BY "version" DESC
    `;

    return {
      page,
      versions,
    };
  }

  // 分享页面 - 创建公开分享链接
  async sharePage(
    user: User | ResolveUserResponse,
    pageId: string
  ): Promise<SharePageResult> {
    const { uid } = user as User;

    // 检查页面是否存在
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "uid" = ${uid}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // 使用ShareService创建分享
    const shareRecord = await this.shareService.createShare(user as User, {
      entityId: pageId,
      entityType: "page" as EntityType,
      title: page.title,
      allowDuplication: false, // 默认不允许复制
    });

    return {
      pageId,
      shareId: shareRecord.shareId,
      shareUrl: `${process.env.FRONTEND_URL || "https://refly.ai"}/share/pages/${shareRecord.shareId}`,
    };
  }

  // 获取分享页面内容
  async getSharedPage(shareId: string, currentUser?: User) {
    // 使用ShareService获取分享记录
    const shareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        shareId,
        entityType: "page" as EntityType,
        deletedAt: null,
      },
    });

    if (!shareRecord) {
      throw new ShareNotFoundError();
    }

    // 获取分享内容
    const sharedContent = await this.shareService.getSharedData(
      shareRecord.storageKey
    );

    // 确定当前用户是否为所有者
    const isOwner = currentUser && currentUser.uid === shareRecord.uid;

    // 解析额外数据
    let extraData = {};
    if (shareRecord.extraData) {
      try {
        extraData = JSON.parse(shareRecord.extraData);
      } catch (e) {
        this.logger.error("Error parsing extraData:", e);
      }
    }

    // 返回分享内容
    return {
      page: sharedContent.page,
      content: sharedContent.content,
      nodeRelations: sharedContent.nodeRelations,
      pageConfig: sharedContent.pageConfig,
      shareInfo: {
        title: shareRecord.title,
        allowDuplication: shareRecord.allowDuplication,
        description: (extraData as any)?.description,
        sharedAt: shareRecord.createdAt,
        updatedAt: shareRecord.updatedAt,
      },
      isOwner,
    };
  }

  // 删除页面
  async deletePage(
    user: User | ResolveUserResponse,
    pageId: string
  ): Promise<DeletePageResult> {
    const { uid } = user as User;

    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "uid" = ${uid}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // 软删除页面
    await this.prisma.$queryRaw`
      UPDATE "pages"
      SET "deleted_at" = NOW()
      WHERE "page_id" = ${pageId}
    `;

    // 软删除页面节点关联
    await this.prisma.$queryRaw`
      UPDATE "page_node_relations"
      SET "deleted_at" = NOW()
      WHERE "page_id" = ${pageId}
    `;

    return {
      pageId,
    };
  }

  // 删除页面节点
  async deletePageNode(
    user: User | ResolveUserResponse,
    pageId: string,
    nodeId: string
  ): Promise<{ pageId: string; nodeId: string }> {
    const { uid } = user as User;

    // 检查页面是否存在
    const page = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId} AND "uid" = ${uid} AND "deleted_at" IS NULL
    `;

    if (!page || page.length === 0) {
      throw new PageNotFoundError();
    }

    // 检查节点关系是否存在
    const nodeRelation = await this.prisma.$queryRaw<PageNodeRelation[]>`
      SELECT * FROM "page_node_relations"
      WHERE "page_id" = ${pageId} AND "node_id" = ${nodeId} AND "deleted_at" IS NULL
    `;

    if (!nodeRelation || nodeRelation.length === 0) {
      throw new PageNotFoundError();
    }

    // 软删除节点关系
    await this.prisma.$queryRaw`
      UPDATE "page_node_relations"
      SET "deleted_at" = NOW()
      WHERE "page_id" = ${pageId} AND "node_id" = ${nodeId}
    `;

    return {
      pageId,
      nodeId,
    };
  }

  // 按实体ID查找所有分享记录
  async listSharesByEntityId(user: User, entityId: string) {
    const shares = await this.shareService.listShares(user, {
      entityId,
      entityType: "page" as EntityType,
    });
    return shares;
  }

  // 删除指定分享ID的分享
  async deleteShareById(user: User, shareId: string) {
    await this.shareService.deleteShare(user, { shareId });
    return { shareId, deleted: true };
  }
}
