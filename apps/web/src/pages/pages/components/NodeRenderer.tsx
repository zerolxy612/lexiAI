import { memo, useMemo } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { NodeBlockHeader } from './NodeBlockHeader';
import {
  LazyCodeArtifactRenderer,
  LazyDocumentRenderer,
  LazySkillResponseRenderer,
  LazyImageRenderer,
  WithSuspense,
} from './LazyComponents';

// 内容渲染组件
const NodeRenderer = memo(
  ({
    node,
    isFullscreen = false,
    isModal = false,
    isMinimap = false,
    onDelete,
    onStartSlideshow,
    onWideMode,
  }: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isModal?: boolean;
    isMinimap?: boolean;
    onDelete?: (nodeId: string) => void;
    onStartSlideshow?: (nodeId: string) => void;
    onWideMode?: (nodeId: string) => void;
  }) => {
    // 使用useMemo缓存渲染内容，避免不必要的重新计算
    const renderContent = useMemo(() => {
      // 根据不同节点类型返回对应的渲染器
      switch (node.nodeType) {
        case 'codeArtifact':
          return (
            <div className="flex flex-col h-full">
              {/* 只在常规编辑模式（非全屏模式且非模态框模式）下显示header */}
              {!isFullscreen && !isModal && (
                <NodeBlockHeader
                  node={node}
                  isMinimap={isMinimap}
                  onMaximize={() => onStartSlideshow?.(node.nodeId)}
                  onWideMode={() => onWideMode?.(node.nodeId)}
                  onDelete={onDelete}
                />
              )}
              <div className={`flex-1 overflow-auto ${!isFullscreen ? '' : 'h-full'}`}>
                <WithSuspense>
                  <LazyCodeArtifactRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </div>
            </div>
          );
        case 'document':
          return (
            <div className="flex flex-col h-full">
              {/* 只在常规编辑模式（非全屏模式且非模态框模式）下显示header */}
              {!isFullscreen && !isModal && (
                <NodeBlockHeader
                  node={node}
                  isMinimap={isMinimap}
                  onMaximize={() => onStartSlideshow?.(node.nodeId)}
                  onWideMode={() => onWideMode?.(node.nodeId)}
                  onDelete={onDelete}
                />
              )}
              <div className={`flex-1 overflow-auto ${!isFullscreen ? '' : 'h-full'}`}>
                <WithSuspense>
                  <LazyDocumentRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </div>
            </div>
          );
        case 'skillResponse':
          return (
            <div className="flex flex-col h-full">
              {/* 只在常规编辑模式（非全屏模式且非模态框模式）下显示header */}
              {!isFullscreen && !isModal && (
                <NodeBlockHeader
                  node={node}
                  isMinimap={isMinimap}
                  onMaximize={() => onStartSlideshow?.(node.nodeId)}
                  onWideMode={() => onWideMode?.(node.nodeId)}
                  onDelete={onDelete}
                />
              )}
              <div className={`flex-1 overflow-auto ${!isFullscreen ? '' : 'h-full'}`}>
                <WithSuspense>
                  <LazySkillResponseRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </div>
            </div>
          );
        case 'image':
          return (
            <div className="flex flex-col h-full">
              {/* 只在常规编辑模式（非全屏模式且非模态框模式）下显示header */}
              {!isFullscreen && !isModal && (
                <NodeBlockHeader
                  node={node}
                  isMinimap={isMinimap}
                  onMaximize={() => onStartSlideshow?.(node.nodeId)}
                  onWideMode={() => onWideMode?.(node.nodeId)}
                  onDelete={onDelete}
                />
              )}
              <div className={`flex-1 overflow-auto ${!isFullscreen ? '' : 'h-full'}`}>
                <WithSuspense>
                  <LazyImageRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </div>
            </div>
          );
        default:
          // 不支持的类型显示提示
          return (
            <div
              className={`p-6 bg-white rounded-lg flex flex-col items-center justify-center text-gray-400 ${
                !isFullscreen ? 'h-[400px]' : 'h-full'
              } shadow-md ${isMinimap ? 'p-2 h-full' : ''}`}
            >
              <div className={`${isMinimap ? 'text-xs' : 'text-lg'}`}>
                {isMinimap ? '不支持的组件' : '仅支持代码组件类型'}
              </div>
              {!isMinimap && <div className="text-sm text-gray-400 mt-2">{node.nodeType}</div>}
            </div>
          );
      }
    }, [node, isFullscreen, isModal, isMinimap, onDelete, onStartSlideshow, onWideMode]);

    return renderContent;
  },
  // 自定义比较函数，只有当关键属性变化时才重新渲染
  (prevProps, nextProps) => {
    // 检查关键属性是否变化
    return (
      prevProps.node.nodeId === nextProps.node.nodeId &&
      prevProps.node.nodeType === nextProps.node.nodeType &&
      prevProps.isFullscreen === nextProps.isFullscreen &&
      prevProps.isModal === nextProps.isModal &&
      prevProps.isMinimap === nextProps.isMinimap
    );
  },
);

export { NodeRenderer };
