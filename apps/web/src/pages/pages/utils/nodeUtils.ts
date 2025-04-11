import { type NodeRelation } from '../components/ArtifactRenderer';
import i18next from 'i18next';

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
  if (node.nodeType === 'codeArtifact') return i18next.t('pages.components.codeComponent');
  if (node.nodeType === 'document') return i18next.t('pages.components.documentComponent');
  if (node.nodeType === 'skillResponse') return i18next.t('pages.components.skillResponse');

  return i18next.t('pages.components.slide', { index: node.orderIndex + 1 });
};
