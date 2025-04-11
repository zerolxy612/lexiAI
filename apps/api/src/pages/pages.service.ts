import * as Y from 'yjs';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { MiscService } from '@/misc/misc.service';
import { CanvasService } from '@/canvas/canvas.service';
import { KnowledgeService } from '@/knowledge/knowledge.service';
import { ActionService } from '@/action/action.service';
import { MinioService } from '@/common/minio.service';
import { MINIO_INTERNAL } from '@/common/minio.service';
import { streamToBuffer } from '@/utils';
import { User, EntityType, CanvasNode } from '@refly-packages/openapi-schema';
import { ShareNotFoundError } from '@refly-packages/errors';
import { CodeArtifactService } from '@/code-artifact/code-artifact.service';
import { ShareService } from '@/share/share.service';
import {
  CreatePageDto,
  UpdatePageDto,
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
} from './pages.dto';
import { createId } from '@paralleldrive/cuid2';

// Type definitions
interface ResolveUserResponse {
  uid: string;
  userInfo?: {
    name?: string;
  };
}

// Custom PageNotFoundError class
class PageNotFoundError extends ShareNotFoundError {
  code = 'E1010'; // Custom error code, ensure it doesn't conflict with other error codes
  messageDict = {
    en: 'Page not found',
    'zh-CN': 'Page not found',
  };
}

// Generate unique IDs
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
    @Inject(MINIO_INTERNAL) private minio: MinioService,
  ) {}

  // List all pages for a user
  async listPages(
    user: User,
    page = 1,
    pageSize = 20,
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

  // Create a new page
  async createPage(
    user: User | ResolveUserResponse,
    { title = 'Untitled', content }: CreatePageDto,
  ): Promise<CreatePageResult> {
    const { uid } = user as User;

    // Generate pageId
    const pageId = genPageId();
    const stateStorageKey = `pages/${uid}/${pageId}/state.update`;

    // Extract canvasId and nodeIds from content
    const canvasId = content?.canvasId;
    const nodeIds = content?.nodeIds || [];

    if (!canvasId) {
      throw new Error('Missing canvasId in content');
    }

    if (!nodeIds.length) {
      throw new Error('No nodes selected');
    }

    // Get data from canvas
    const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);

    // Filter specified nodes
    const selectedNodes = (canvasData.nodes as CanvasNode[]).filter((node) =>
      nodeIds.includes(node.data.entityId),
    );

    // Verify all required nodes exist
    if (selectedNodes.length !== nodeIds.length) {
      throw new Error('Some selected nodes cannot be found');
    }

    // Create new Page record
    const [page] = await this.prisma.$queryRaw<Page[]>`
      INSERT INTO "pages" ("page_id", "uid", "title", "state_storage_key", "status", "created_at", "updated_at")
      VALUES (${pageId}, ${uid}, ${title || 'Untitled Page'}, ${stateStorageKey}, 'draft', NOW(), NOW())
      RETURNING *
    `;

    // Create initial Y.doc to store page state
    const doc = new Y.Doc();
    doc.transact(() => {
      doc.getText('title').insert(0, page.title);
      doc.getArray('nodeIds').insert(0, nodeIds);
      doc.getMap('pageConfig').set('layout', 'slides');
      doc.getMap('pageConfig').set('theme', 'default');
    });

    // Upload Y.doc - Convert Y.Doc to Uint8Array, then to Buffer
    const state = Y.encodeStateAsUpdate(doc);
    await this.minio.client.putObject(stateStorageKey, Buffer.from(state));

    // Create page-node relation records
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

  // Get page details - used for editing
  async getPageDetail(user: User | ResolveUserResponse, pageId: string): Promise<PageDetailResult> {
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

    // Get page node relations
    const nodeRelations = await this.prisma.$queryRaw<PageNodeRelation[]>`
      SELECT * FROM "page_node_relations"
      WHERE "page_id" = ${pageId}
      AND "deleted_at" IS NULL
      ORDER BY "order_index" ASC
    `;

    // Get page configuration
    let pageConfig = {
      layout: 'slides',
      theme: 'light',
    };

    try {
      // Read page state from storage service
      if (page.state_storage_key) {
        const stateStream = await this.minio.client.getObject(page.state_storage_key);
        const stateBuffer = await streamToBuffer(stateStream);

        if (stateBuffer) {
          const update = new Uint8Array(stateBuffer);
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, update);

          const pageConfigMap = ydoc.getMap('pageConfig');

          if (pageConfigMap.size > 0) {
            pageConfig = {
              layout: (pageConfigMap.get('layout') as string) || 'slides',
              theme: (pageConfigMap.get('theme') as string) || 'light',
            };
          }
        }
      }
    } catch (error) {
      this.logger.error('Error reading page state:', error);
    }

    return {
      page,
      nodeRelations,
      pageConfig,
    };
  }

  // Update page - save edit state
  async updatePage(
    user: User | ResolveUserResponse,
    pageId: string,
    param: UpdatePageDto,
  ): Promise<UpdatePageResult> {
    const { uid } = user as User;
    const { title, nodeRelations, nodeRelationOrders, pageConfig } = param;

    // Check if page exists
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "uid" = ${uid}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // Use transaction for all database operations
    return await this.prisma.$transaction(async (tx) => {
      // Start update operations
      let updatePage = page;

      // If title is updated
      if (title !== undefined) {
        const [updated] = await tx.$queryRaw<Page[]>`
          UPDATE "pages"
          SET "title" = ${title}, "updated_at" = NOW()
          WHERE "page_id" = ${pageId}
          RETURNING *
        `;
        updatePage = updated;
      }

      // If only updating node order
      let updatedRelations = undefined;
      if (nodeRelationOrders && nodeRelationOrders.length > 0) {
        this.logger.log('Updating node relation orders', nodeRelationOrders);

        // Get current page node relations
        const existingRelations = await tx.$queryRaw<PageNodeRelation[]>`
          SELECT * FROM "page_node_relations"
          WHERE "page_id" = ${pageId}
          AND "deleted_at" IS NULL
        `;

        // Group existing relations by relationId for easy lookup
        const relationsByRelationId = existingRelations.reduce(
          (acc: Record<string, PageNodeRelation>, relation) => {
            acc[relation.relation_id] = relation;
            return acc;
          },
          {},
        );

        // Only update node order
        const updatedRelationsPromises = nodeRelationOrders.map(async (relation) => {
          const { relationId, orderIndex } = relation;

          // Check if this relation ID exists
          if (relationsByRelationId[relationId]) {
            // Only update order
            const [updated] = await tx.$queryRaw<PageNodeRelation[]>`
              UPDATE "page_node_relations"
              SET "order_index" = ${orderIndex}, "updated_at" = NOW()
              WHERE "relation_id" = ${relationId}
              RETURNING *
            `;
            return updated;
          }
          // If relation ID not found, return null
          return null;
        });

        // Filter out null values
        const results = await Promise.all(updatedRelationsPromises);
        updatedRelations = results.filter(Boolean);
      }
      // If complete node relation update
      else if (nodeRelations && nodeRelations.length > 0) {
        // Get current page node relations
        const existingRelations = await tx.$queryRaw<PageNodeRelation[]>`
          SELECT * FROM "page_node_relations"
          WHERE "page_id" = ${pageId}
          AND "deleted_at" IS NULL
        `;

        // Group existing relations by nodeId for easy lookup
        const relationsByNodeId = existingRelations.reduce(
          (acc: Record<string, PageNodeRelation>, relation) => {
            acc[relation.node_id] = relation;
            return acc;
          },
          {},
        );

        // Update existing relations or create new ones
        const updatedRelationsPromises = nodeRelations.map(async (relation, index) => {
          const { nodeId, nodeType, entityId, nodeData, orderIndex = index } = relation;

          // Check if this node relation already exists
          if (relationsByNodeId[nodeId]) {
            // Update existing relation
            const [updated] = await tx.$queryRaw<PageNodeRelation[]>`
              UPDATE "page_node_relations"
              SET 
                "node_type" = ${nodeType},
                "entity_id" = ${entityId},
                "order_index" = ${orderIndex},
                "node_data" = ${JSON.stringify(nodeData) || '{}'},
                "updated_at" = NOW()
              WHERE "relation_id" = ${relationsByNodeId[nodeId].relation_id}
              RETURNING *
            `;
            return updated;
          }
          // Create new relation
          const relationId = genPageNodeRelationId();
          const nodeDataStr =
            typeof nodeData === 'string' ? nodeData : JSON.stringify(nodeData || {});

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
        });

        updatedRelations = await Promise.all(updatedRelationsPromises);
      }

      // Handle non-database operations after transaction (like updating page state file)
      if (pageConfig) {
        try {
          // Read existing state file
          let ydoc = new Y.Doc();

          if (page.state_storage_key) {
            try {
              const stateStream = await this.minio.client.getObject(page.state_storage_key);
              const stateBuffer = await streamToBuffer(stateStream);

              if (stateBuffer) {
                const update = new Uint8Array(stateBuffer);
                Y.applyUpdate(ydoc, update);
              }
            } catch (error) {
              // If file doesn't exist, use new Y.Doc()
              this.logger.error('Error reading state file, creating new:', error);
              ydoc = new Y.Doc();
            }
          }

          // Update pageConfig
          const pageConfigMap = ydoc.getMap('pageConfig');
          for (const [key, value] of Object.entries(pageConfig)) {
            pageConfigMap.set(key, value);
          }

          // Save updated state
          const update = Y.encodeStateAsUpdate(ydoc);
          await this.minio.client.putObject(page.state_storage_key, Buffer.from(update));
        } catch (error) {
          this.logger.error('Error saving page state:', error);
        }
      }

      return {
        page: updatePage,
        nodeRelations: updatedRelations,
      };
    });
  }

  // Publish page - generate shareable version
  async publishPage(user: User | ResolveUserResponse, pageId: string): Promise<PublishPageResult> {
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

    // Get node relations
    const nodeRelations = await this.prisma.$queryRaw<PageNodeRelation[]>`
      SELECT * FROM "page_node_relations"
      WHERE "page_id" = ${pageId}
      AND "deleted_at" IS NULL
      ORDER BY "order_index" ASC
    `;

    // Get page content, assuming it's from state_storage_key
    let content: any = { nodes: [] };
    let pageConfig = {
      layout: 'slides',
      theme: 'light',
    };

    try {
      // Read page state from storage service
      if (page.state_storage_key) {
        const stateStream = await this.minio.client.getObject(page.state_storage_key);
        const stateBuffer = await streamToBuffer(stateStream);

        if (stateBuffer) {
          const update = new Uint8Array(stateBuffer);
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, update);

          // Get pageConfig
          const pageConfigMap = ydoc.getMap('pageConfig');
          pageConfig = {
            layout: (pageConfigMap.get('layout') as string) || 'slides',
            theme: (pageConfigMap.get('theme') as string) || 'light',
          };
        }
      }

      // Build content object
      content = {
        pageConfig,
        nodes: await Promise.all(
          nodeRelations.map(async (relation) => {
            let nodeData = {};
            try {
              nodeData = relation.node_data
                ? typeof relation.node_data === 'string'
                  ? JSON.parse(relation.node_data)
                  : relation.node_data
                : {};
            } catch (error) {
              this.logger.error('Error parsing node data:', error);
            }

            // Add code content for code nodes
            if (relation.node_type === 'code_artifact') {
              try {
                const codeArtifact = await this.codeArtifactService.getCodeArtifactDetail(
                  user,
                  relation.entity_id,
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
                this.logger.error('Error getting code artifact:', error);
              }
            }

            // Add knowledge content for knowledge nodes
            if (relation.node_type === 'knowledge') {
              try {
                const knowledge = await this.knowledgeService.getResourceDetail(user, {
                  resourceId: relation.entity_id,
                });
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
                this.logger.error('Error getting knowledge:', error);
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
          }),
        ),
      };
    } catch (error) {
      this.logger.error('Error building page content:', error);
    }

    // Get latest version number
    const [latestVersion] = await this.prisma.$queryRaw<{ max_version: number }[]>`
      SELECT COALESCE(MAX(version), 0) as max_version FROM "page_versions"
      WHERE "page_id" = ${pageId}
    `;

    const nextVersion = latestVersion.max_version + 1;
    const contentStorageKey = `pages/${page.uid}/${pageId}/versions/${nextVersion}.json`;

    // Save content to storage
    const contentString = JSON.stringify(content);
    await this.minio.client.putObject(contentStorageKey, Buffer.from(contentString));

    // Save latest version
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

    // Update page status to published
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

  // Get page version - can specify version, if not specified get latest version
  async getPageVersion(pageId: string, version?: number): Promise<PageVersionResult> {
    // Get page information
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // Get version information
    let versionQuery: Promise<PageVersion[]>;
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

    // Get version content
    let content: any = null;

    try {
      if (pageVersion.content_storage_key) {
        const contentStream = await this.minio.client.getObject(pageVersion.content_storage_key);
        const contentBuffer = await streamToBuffer(contentStream);

        if (contentBuffer) {
          content = JSON.parse(contentBuffer.toString());
        }
      }
    } catch (error) {
      this.logger.error('Error reading version content:', error);
      content = { error: 'Failed to read content' };
    }

    return {
      page,
      version: pageVersion,
      content,
    };
  }

  // Get all versions of a page
  async getPageVersions(pageId: string): Promise<PageVersionsResult> {
    // Get page information
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // Get all versions
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

  // Share page - create public share link
  async sharePage(user: User | ResolveUserResponse, pageId: string): Promise<SharePageResult> {
    const { uid } = user as User;

    // Check if page exists
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId}
      AND "uid" = ${uid}
      AND "deleted_at" IS NULL
    `;

    if (!page) {
      throw new PageNotFoundError();
    }

    // Use ShareService to create share
    const shareRecord = await this.shareService.createShare(user as User, {
      entityId: pageId,
      entityType: 'page' as EntityType,
      title: page.title,
      allowDuplication: false, // Default: do not allow duplication
    });

    return {
      pageId,
      shareId: shareRecord.shareId,
      shareUrl: `${process.env.FRONTEND_URL || 'https://refly.ai'}/share/pages/${shareRecord.shareId}`,
    };
  }

  // Get shared page content
  async getSharedPage(shareId: string, currentUser?: User) {
    // Use ShareService to get share record
    const shareRecord = await this.prisma.shareRecord.findFirst({
      where: {
        shareId,
        entityType: 'page' as EntityType,
        deletedAt: null,
      },
    });

    if (!shareRecord) {
      throw new ShareNotFoundError();
    }

    // Get shared content
    const sharedContent = await this.shareService.getSharedData(shareRecord.storageKey);

    // Determine if current user is owner
    const isOwner = currentUser && currentUser.uid === shareRecord.uid;

    // Parse extra data
    let extraData = {};
    if (shareRecord.extraData) {
      try {
        extraData = JSON.parse(shareRecord.extraData);
      } catch (e) {
        this.logger.error('Error parsing extraData:', e);
      }
    }

    // Return shared content
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

  // Delete page
  async deletePage(user: User | ResolveUserResponse, pageId: string): Promise<DeletePageResult> {
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

    // Soft delete page
    await this.prisma.$queryRaw`
      UPDATE "pages"
      SET "deleted_at" = NOW()
      WHERE "page_id" = ${pageId}
    `;

    // Soft delete page node relations
    await this.prisma.$queryRaw`
      UPDATE "page_node_relations"
      SET "deleted_at" = NOW()
      WHERE "page_id" = ${pageId}
    `;

    return {
      pageId,
    };
  }

  // Delete page node
  async deletePageNode(
    user: User | ResolveUserResponse,
    pageId: string,
    nodeId: string,
  ): Promise<{ pageId: string; nodeId: string }> {
    const { uid } = user as User;

    // Check if page exists
    const page = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "page_id" = ${pageId} AND "uid" = ${uid} AND "deleted_at" IS NULL
    `;

    if (!page || page.length === 0) {
      throw new PageNotFoundError();
    }

    // Check if node relation exists
    const nodeRelation = await this.prisma.$queryRaw<PageNodeRelation[]>`
      SELECT * FROM "page_node_relations"
      WHERE "page_id" = ${pageId} AND "node_id" = ${nodeId} AND "deleted_at" IS NULL
    `;

    if (!nodeRelation || nodeRelation.length === 0) {
      throw new PageNotFoundError();
    }

    // Soft delete node relation
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

  // List all share records by entity ID
  async listSharesByEntityId(user: User, entityId: string) {
    const shares = await this.shareService.listShares(user, {
      entityId,
      entityType: 'page' as EntityType,
    });
    return shares;
  }

  // Delete share by share ID
  async deleteShareById(user: User, shareId: string) {
    await this.shareService.deleteShare(user, { shareId });
    return { shareId, deleted: true };
  }
}
