import * as Y from 'yjs';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { MiscService } from '@/misc/misc.service';
import { CanvasService } from '@/canvas/canvas.service';
import { KnowledgeService } from '@/knowledge/knowledge.service';
import { MinioService } from '@/common/minio.service';
import { MINIO_INTERNAL } from '@/common/minio.service';
import { streamToBuffer } from '@/utils';
import { User, EntityType } from '@refly-packages/openapi-schema';
import { ShareNotFoundError } from '@refly-packages/errors';
import { CodeArtifactService } from '@/code-artifact/code-artifact.service';
import { ShareService } from '@/share/share.service';
import {
  UpdatePageDto,
  PageDetailResult,
  UpdatePageResult,
  SharePageResult,
  DeletePageResult,
  DeletePageNodeResult,
  Page,
  PageNodeRelation,
} from './pages.dto';
import { createId } from '@paralleldrive/cuid2';

// Type definitions
interface ResolveUserResponse {
  uid: string;
  userInfo?: {
    name?: string;
  };
}

// Custom error class for page not found
class PageNotFoundError extends ShareNotFoundError {
  code = 'E1010'; // Custom error code
  messageDict = {
    en: 'Page not found',
    'zh-CN': 'Page not found', // Changed to English
  };
}

// Generate unique IDs
const genPageId = (): string => `page-${createId()}`;
const genPageNodeRelationId = (): string => `pnr-${createId()}`;

@Injectable()
export class PagesService {
  private logger = new Logger(PagesService.name);

  constructor(
    private prisma: PrismaService,
    private miscService: MiscService,
    private canvasService: CanvasService,
    private knowledgeService: KnowledgeService,
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
      canvasId: page.canvas_id,
      shareId: shareRecord.shareId,
      shareUrl: `${process.env.FRONTEND_URL || 'https://refly.ai'}/share/pages/${shareRecord.shareId}`,
    };
  }

  // Delete page node
  async deletePageNode(
    user: User | ResolveUserResponse,
    pageId: string,
    nodeId: string,
  ): Promise<DeletePageNodeResult> {
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
      canvasId: page[0]?.canvas_id,
      nodeId,
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
      canvasId: page.canvas_id,
    };
  }

  /**
   * Get page associated with a canvas
   * @param user Current user
   * @param canvasId Canvas ID
   * @returns Page and node relations
   */
  async getPageByCanvasId(
    user: User,
    canvasId: string,
  ): Promise<{ page: Page | null; nodeRelations: PageNodeRelation[] }> {
    // Check if canvas exists and user has access
    const canvas = await this.prisma.canvas.findFirst({
      where: {
        canvasId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!canvas) {
      throw new Error('Canvas not found or access denied');
    }

    // Find page associated with canvas using canvas_id field
    // Ensure we only get one page (the most recent one)
    const [page] = await this.prisma.$queryRaw<Page[]>`
      SELECT * FROM "pages"
      WHERE "canvas_id" = ${canvasId}
      AND "uid" = ${user.uid}
      AND "deleted_at" IS NULL
      ORDER BY "updated_at" DESC
      LIMIT 1
    `;

    if (!page) {
      return { page: null, nodeRelations: [] };
    }

    // Get page node relations
    const nodeRelations = await this.prisma.$queryRaw<PageNodeRelation[]>`
      SELECT * FROM "page_node_relations"
      WHERE "page_id" = ${page.page_id}
      AND "deleted_at" IS NULL
      ORDER BY "order_index" ASC
    `;

    return { page, nodeRelations };
  }

  /**
   * Add nodes to a canvas page
   * If page doesn't exist, create a new one
   * @param user Current user
   * @param canvasId Canvas ID
   * @param addNodesDto Nodes to add
   * @returns Updated page and node relations
   */
  async addNodesToCanvasPage(
    user: User,
    canvasId: string,
    addNodesDto: { nodeIds: string[] },
  ): Promise<{ page: Page; nodeRelations: PageNodeRelation[] }> {
    // Use transaction for all database operations
    return this.prisma.$transaction(async (tx) => {
      // Check if canvas exists and user has access
      const canvas = await tx.canvas.findFirst({
        where: {
          canvasId,
          uid: user.uid,
          deletedAt: null,
        },
      });

      if (!canvas) {
        throw new Error('Canvas not found or access denied');
      }

      // Find page associated with canvas using canvas_id field
      // Ensure we only get one page (the most recent one)
      const [existingPage] = await tx.$queryRaw<Page[]>`
        SELECT * FROM "pages"
        WHERE "canvas_id" = ${canvasId}
        AND "uid" = ${user.uid}
        AND "deleted_at" IS NULL
        ORDER BY "updated_at" DESC
        LIMIT 1
      `;

      let page: Page;

      // If no page exists, create a new one
      if (!existingPage) {
        // Generate pageId
        const pageId = genPageId();
        const stateStorageKey = `pages/${user.uid}/${pageId}/state.update`;

        // Create new Page record with canvas_id
        await tx.$executeRaw`
          INSERT INTO "pages" (
            "page_id", "uid", "title", "state_storage_key", "status", 
            "canvas_id", "created_at", "updated_at"
          )
          VALUES (
            ${pageId}, ${user.uid}, ${canvas.title || 'Untitled Page'}, 
            ${stateStorageKey}, 'draft', ${canvasId}, NOW(), NOW()
          )
        `;

        // Get the newly created page
        const [createdPage] = await tx.$queryRaw<Page[]>`
          SELECT * FROM "pages"
          WHERE "page_id" = ${pageId}
        `;

        page = createdPage;

        // Create initial Y.doc to store page state
        const doc = new Y.Doc();
        doc.transact(() => {
          doc.getText('title').insert(0, page.title);
          doc.getMap('pageConfig').set('layout', 'slides');
          doc.getMap('pageConfig').set('theme', 'default');
        });

        // Upload Y.doc - Convert Y.Doc to Uint8Array, then to Buffer
        const state = Y.encodeStateAsUpdate(doc);
        await this.minio.client.putObject(stateStorageKey, Buffer.from(state));
      } else {
        page = existingPage;
      }

      // Get raw Canvas data, including node information
      const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);

      // Handle case when canvas has no nodes
      if (!canvasData || !canvasData.nodes || canvasData.nodes.length === 0) {
        this.logger.warn(`Canvas ${canvasId} has no nodes, returning empty node relations`);
        return {
          page,
          nodeRelations: [],
        };
      }

      // Get existing node relations for the current page
      const existingNodeRelations = await tx.$queryRaw<{ node_id: string }[]>`
        SELECT "node_id" FROM "page_node_relations"
        WHERE "page_id" = ${page.page_id}
        AND "deleted_at" IS NULL
      `;

      // Extract the set of existing node IDs
      const existingNodeIds = new Set(existingNodeRelations.map((relation) => relation.node_id));

      // Filter out node IDs that already exist
      const newNodeIds = addNodesDto.nodeIds.filter((nodeId) => !existingNodeIds.has(nodeId));

      // If there are no new nodes to add, directly return the current page and node relations
      if (newNodeIds.length === 0) {
        const currentNodeRelations = await tx.$queryRaw<PageNodeRelation[]>`
          SELECT * FROM "page_node_relations"
          WHERE "page_id" = ${page.page_id}
          AND "deleted_at" IS NULL
          ORDER BY "order_index" ASC
        `;

        return {
          page,
          nodeRelations: currentNodeRelations,
        };
      }

      // Extract node information from Canvas data
      const validNodeIds: string[] = [];
      const nodeInfos = newNodeIds
        .map((nodeId) => {
          // Find matching node in Canvas nodes array
          // Note: Canvas node ID may be stored in data.entityId
          const node = canvasData.nodes.find((n) => n.data?.entityId === nodeId);

          if (!node) {
            this.logger.warn(`Node ${nodeId} not found in canvas ${canvasId}, skipping it`);
            return null;
          }

          validNodeIds.push(nodeId);
          return {
            nodeId: nodeId,
            nodeType: node.type || 'unknown',
            entityId: node.data?.entityId || nodeId,
            nodeData: node.data || {},
          };
        })
        .filter((info): info is NonNullable<typeof info> => info !== null);

      // If all nodes are invalid, return current page and node relations
      if (nodeInfos.length === 0) {
        this.logger.warn(`No valid nodes found for canvas ${canvasId}, returning current state`);
        const currentNodeRelations = await tx.$queryRaw<PageNodeRelation[]>`
          SELECT * FROM "page_node_relations"
          WHERE "page_id" = ${page.page_id}
          AND "deleted_at" IS NULL
          ORDER BY "order_index" ASC
        `;

        return {
          page,
          nodeRelations: currentNodeRelations,
        };
      }

      // Get the current maximum order_index
      const [maxOrderResult] = await tx.$queryRaw<{ max_order: number }[]>`
        SELECT COALESCE(MAX("order_index"), -1) as max_order FROM "page_node_relations"
        WHERE "page_id" = ${page.page_id}
        AND "deleted_at" IS NULL
      `;

      const startOrderIndex = (maxOrderResult?.max_order ?? -1) + 1;

      // Create page-node relation records
      const nodeRelationsPromises = nodeInfos.map(async (node, index) => {
        const relationId = genPageNodeRelationId();
        const orderIndex = startOrderIndex + index;
        const nodeData =
          typeof node.nodeData === 'string' ? node.nodeData : JSON.stringify(node.nodeData || {});

        const [relation] = await tx.$queryRaw<PageNodeRelation[]>`
          INSERT INTO "page_node_relations" (
            "relation_id", "page_id", "node_id", "node_type", "entity_id", 
            "order_index", "node_data", "created_at", "updated_at"
          )
          VALUES (
            ${relationId}, ${page.page_id}, ${node.nodeId}, ${node.nodeType}, ${node.entityId}, 
            ${orderIndex}, ${nodeData}, NOW(), NOW()
          )
          RETURNING *
        `;

        return relation;
      });

      await Promise.all(nodeRelationsPromises);

      // Get all node relations (including both new and existing ones)
      const allNodeRelations = await tx.$queryRaw<PageNodeRelation[]>`
        SELECT * FROM "page_node_relations"
        WHERE "page_id" = ${page.page_id}
        AND "deleted_at" IS NULL
        ORDER BY "order_index" ASC
      `;

      return {
        page,
        nodeRelations: allNodeRelations,
      };
    });
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
