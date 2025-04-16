// Page entity type interface definitions
export interface PageNodeRelation {
  relation_id: string;
  page_id: string;
  node_id: string;
  node_type: string;
  entity_id: string;
  order_index: number;
  node_data: string;
  created_at: Date;
  updated_at: Date;
  deletedAt: Date | null;
}

export interface Page {
  pk: number;
  page_id: string;
  uid: string;
  title: string;
  description: string | null;
  state_storage_key: string;
  cover_storage_key: string | null;
  status: string;
  canvas_id?: string;
  created_at: Date;
  updated_at: Date;
  deletedAt: Date | null;
}

// Service method return types
export interface PageDetailResult {
  page: Page;
  nodeRelations: PageNodeRelation[];
  pageConfig: {
    layout: string;
    theme: string;
  };
}

export interface UpdatePageResult {
  page: Page;
  nodeRelations?: PageNodeRelation[];
}

export interface SharePageResult {
  pageId: string;
  canvasId?: string;
  shareId: string;
  shareUrl: string;
}

export interface DeletePageNodeResult {
  pageId: string;
  canvasId?: string;
  nodeId: string;
}

export interface DeletePageResult {
  pageId: string;
  canvasId?: string;
}

export interface UpdatePageDto {
  title?: string;
  nodeRelations?: NodeRelationDto[];
  nodeRelationOrders?: NodeRelationOrderDto[];
  pageConfig?: Record<string, any>;
}

export interface NodeRelationDto {
  nodeId: string;
  nodeType: string;
  entityId: string;
  nodeData?: any;
  orderIndex?: number;
}

// DTO specifically for updating node order
export interface NodeRelationOrderDto {
  relationId: string;
  orderIndex: number;
}

// DTO for adding nodes to canvas page
export interface AddPageNodesDto {
  nodeIds: string[];
}

// Result type for canvas page query
export interface CanvasPageResult {
  page: Page | null;
  nodeRelations: PageNodeRelation[];
}

export const pagePO2DTO = (page: any) => {
  return {
    pageId: page.page_id,
    title: page.title,
    description: page.description,
    status: page.status,
    canvasId: page.canvas_id,
    coverUrl: page.cover_storage_key
      ? `/api/v1/misc/file?key=${page.cover_storage_key}`
      : undefined,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
  };
};

export const pageNodeRelationPO2DTO = (relation: any) => {
  return {
    relationId: relation.relation_id,
    pageId: relation.page_id,
    nodeId: relation.node_id,
    nodeType: relation.node_type,
    entityId: relation.entity_id,
    orderIndex: relation.order_index,
    nodeData: relation.node_data
      ? typeof relation.node_data === 'string'
        ? JSON.parse(relation.node_data)
        : relation.node_data
      : {},
  };
};
