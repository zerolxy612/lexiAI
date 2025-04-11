import { memo, useMemo, useCallback } from 'react';
import { message } from 'antd';
import {
  useGetCodeArtifactDetail,
  useGetDocumentDetail,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import Renderer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/render';
import { useTranslation } from 'react-i18next';

// 接口定义
interface NodeData {
  title?: string;
  content?: string;
  metadata?: {
    [key: string]: any;
    url?: string;
    content?: string;
    status?: string;
  };
  entityId?: string;
  [key: string]: any;
}

interface NodeRelation {
  relationId: string;
  pageId?: string;
  nodeId: string;
  nodeType: string;
  entityId: string;
  orderIndex: number;
  nodeData: NodeData;
}

// 统一的工件渲染组件
const ArtifactRenderer = memo(
  ({
    node,
    type: rendererType,
    isFullscreen = false,
    isMinimap = false,
  }: {
    node: NodeRelation;
    type: 'document' | 'code';
    isFullscreen?: boolean;
    isMinimap?: boolean;
  }) => {
    const { t } = useTranslation();
    const artifactId = node.nodeData?.entityId || '';
    const {
      title = rendererType === 'document'
        ? t('pages.components.documentComponent')
        : t('pages.components.codeComponent'),
      status,
      shareId,
      type = 'text/html', // 默认类型
      language,
    } = node.nodeData?.metadata || {};

    // 根据类型选择不同的数据获取hook
    const { data: remoteData, isLoading: isRemoteLoading } =
      rendererType === 'document'
        ? useGetDocumentDetail(
            {
              query: {
                docId: artifactId,
              },
            },
            [artifactId],
            {
              enabled: Boolean(!shareId && artifactId && status?.startsWith('finish')),
            },
          )
        : useGetCodeArtifactDetail(
            {
              query: {
                artifactId,
              },
            },
            [artifactId],
            {
              enabled: Boolean(!shareId && artifactId && status?.startsWith('finish')),
            },
          );

    const { data: shareData, loading: isShareLoading } = useFetchShareData(shareId);

    const isLoading = isRemoteLoading || isShareLoading;

    // 合并数据源
    const artifactData = useMemo(
      () => shareData || remoteData?.data || null,
      [shareData, remoteData],
    );

    // 获取内容
    const content = artifactData?.content || node.nodeData?.metadata?.content || '';

    // 确定当前使用的渲染类型
    const currentType = rendererType === 'document' ? 'text/markdown' : artifactData?.type || type;

    const handleRequestFix = useCallback(
      (error: string) => {
        message.warning(`${t('pages.components.artifact.fixCodeNeeded')}: ${error}`);
      },
      [t],
    );

    // 根据类型获取显示名称
    const _getTypeDisplayName = (typeStr: string) => {
      const typeMap: Record<string, string> = {
        'text/html': t('pages.components.artifact.webRender'),
        'application/refly.artifacts.react': t('pages.components.artifact.reactComponent'),
        'application/refly.artifacts.mermaid': t('pages.components.artifact.flowchart'),
        'application/refly.artifacts.mindmap': t('pages.components.artifact.mindmap'),
        'text/markdown': t('pages.components.artifact.markdown'),
        'application/refly.artifacts.code': t('pages.components.artifact.code'),
        'image/svg+xml': t('pages.components.artifact.svgImage'),
      };

      return typeMap[typeStr] || typeStr;
    };

    if (!artifactId) {
      return (
        <div className="h-full flex items-center justify-center bg-white rounded p-3">
          <span className="text-gray-500">
            {t('pages.components.artifact.notSelected', {
              type:
                rendererType === 'document'
                  ? t('common.document').toLowerCase()
                  : t('pages.components.artifact.code').toLowerCase(),
            })}
          </span>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex h-full w-full grow items-center justify-center">
          <div className="text-gray-500">
            {t('pages.components.artifact.loading', {
              type:
                rendererType === 'document'
                  ? t('common.document').toLowerCase()
                  : t('pages.components.artifact.code').toLowerCase(),
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`h-full bg-white ${!isFullscreen ? 'rounded px-4 pb-4' : 'w-full'} ${isMinimap ? 'p-1' : ''}`}
      >
        <div className="h-full w-full overflow-hidden flex flex-col">
          {isMinimap ? (
            <div className="flex-1 bg-white overflow-hidden">
              {status === 'generating' ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-xs text-gray-500">
                    {t('pages.components.artifact.generating', { type: '' })}
                  </div>
                </div>
              ) : (
                <div className="transform scale-[0.5] origin-top-left w-[200%] h-[200%] overflow-hidden bg-white rounded shadow-sm">
                  <Renderer
                    content={content}
                    type={currentType}
                    title={title}
                    language={artifactData?.language || language}
                    readonly
                    onRequestFix={handleRequestFix}
                    width="100%"
                    height="100%"
                  />
                </div>
              )}
            </div>
          ) : (
            <div
              className={`flex-1 ${isFullscreen ? 'h-[calc(100vh-100px)]' : ''} overflow-${rendererType === 'document' ? 'auto' : 'hidden'}`}
            >
              {status === 'generating' ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-gray-500">
                    {t('pages.components.artifact.generating', {
                      type:
                        rendererType === 'document'
                          ? t('common.document').toLowerCase()
                          : t('pages.components.artifact.code').toLowerCase(),
                    })}
                  </div>
                </div>
              ) : (
                <Renderer
                  content={content}
                  type={currentType}
                  title={title}
                  language={artifactData?.language || language}
                  readonly
                  onRequestFix={handleRequestFix}
                  width="100%"
                  height="100%"
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 只有当节点ID、类型和关键元数据没有变化时，跳过重新渲染
    const prevMetadata = prevProps.node.nodeData?.metadata || {};
    const nextMetadata = nextProps.node.nodeData?.metadata || {};

    return (
      prevProps.type === nextProps.type &&
      prevProps.node.entityId === nextProps.node.entityId &&
      prevMetadata.content === nextMetadata.content &&
      prevMetadata.status === nextMetadata.status &&
      prevMetadata.type === nextMetadata.type
    );
  },
);

export { ArtifactRenderer, type NodeRelation, type NodeData };
