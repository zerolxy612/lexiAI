// 页面实体类型接口定义
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
  created_at: Date;
  updated_at: Date;
  deletedAt: Date | null;
}

export interface PageVersion {
  pk: number;
  version_id: string;
  page_id: string;
  version: number;
  title: string;
  content_storage_key: string;
  cover_storage_key: string | null;
  created_at: Date;
}

// 服务方法返回类型
export interface PageDetailResult {
  page: Page;
  nodeRelations: PageNodeRelation[];
  pageConfig: {
    layout: string;
    theme: string;
  };
}

export interface CreatePageResult {
  page: Page;
  nodeRelations: PageNodeRelation[];
}

export interface UpdatePageResult {
  page: Page;
  nodeRelations?: PageNodeRelation[];
}

export interface PublishPageResult {
  page: Page;
  version: PageVersion;
}

export interface PageVersionResult {
  page: Page;
  version: PageVersion;
  content: any;
}

export interface PageVersionsResult {
  page: Page;
  versions: PageVersion[];
}

export interface SharePageResult {
  pageId: string;
  shareId: string;
  shareUrl: string;
}

export interface DeletePageResult {
  pageId: string;
}

export interface CreatePageDto {
  title?: string;
  description?: string;
  content?: {
    canvasId: string;
    nodeIds: string[];
  };
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

// 专门用于更新节点顺序的DTO
export interface NodeRelationOrderDto {
  relationId: string;
  orderIndex: number;
}

export interface PageVersionParamDto {
  pageId: string;
  version?: number;
}

export const pagePO2DTO = (page: any) => {
  return {
    pageId: page.page_id,
    title: page.title,
    description: page.description,
    status: page.status,
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

export const pageVersionPO2DTO = (version: any) => {
  return {
    versionId: version.version_id,
    pageId: version.page_id,
    version: version.version,
    title: version.title,
    coverUrl: version.cover_storage_key
      ? `/api/v1/misc/file?key=${version.cover_storage_key}`
      : undefined,
    createdAt: version.created_at,
  };
};
