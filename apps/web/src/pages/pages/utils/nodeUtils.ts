import { type NodeRelation } from '../components/ArtifactRenderer';

/**
 * 获取节点标题
 * @param node 节点关系对象
 * @returns 节点标题
 */
export const getNodeTitle = (node: NodeRelation): string => {
  // 尝试从nodeData.title获取标题
  if (node.nodeData?.title) return node.nodeData.title;

  // 尝试从nodeData.metadata.title获取标题
  if (node.nodeData?.metadata?.title) return node.nodeData.metadata.title;

  // 根据节点类型返回默认标题
  if (node.nodeType === 'codeArtifact') return '代码组件';
  if (node.nodeType === 'document') return '文档组件';
  if (node.nodeType === 'skillResponse') return '技能响应';

  return `幻灯片 ${node.orderIndex + 1}`;
};
