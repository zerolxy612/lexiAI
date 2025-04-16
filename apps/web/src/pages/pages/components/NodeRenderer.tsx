import { memo, useMemo } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { NodeBlockHeader } from './NodeBlockHeader';
import {
  LazyCodeArtifactRenderer,
  LazyDocumentRenderer,
  LazySkillResponseRenderer,
  LazyImageRenderer,
  WithSuspense,
  LazyMemoRenderer,
  LazyResourceRenderer,
  LazyWebsiteRenderer,
} from './LazyComponents';
import { useTranslation } from 'react-i18next';

// Content renderer component
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
    const { t } = useTranslation();

    // Use useMemo to cache rendered content, avoiding unnecessary recalculations
    const renderContent = useMemo(() => {
      // Return appropriate renderer based on node type
      switch (node.nodeType) {
        case 'codeArtifact':
          return (
            <div className="flex flex-col h-full">
              {/* Only show header in regular editing mode (not full screen or modal) */}
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
              {/* Only show header in regular editing mode (not full screen or modal) */}
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
              {/* Only show header in regular editing mode (not full screen or modal) */}
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
              {/* Only show header in regular editing mode (not full screen or modal) */}
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
        case 'memo':
          return (
            <div className="flex flex-col h-full">
              {/* Only show header in regular editing mode (not full screen or modal) */}
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
                  <LazyMemoRenderer node={node} isFullscreen={isFullscreen} isMinimap={isMinimap} />
                </WithSuspense>
              </div>
            </div>
          );
        case 'resource':
          return (
            <div className="flex flex-col h-full">
              {/* Only show header in regular editing mode (not full screen or modal) */}
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
                  <LazyResourceRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </div>
            </div>
          );
        case 'website':
          return (
            <div className="flex flex-col h-full">
              {/* Only show header in regular editing mode (not full screen or modal) */}
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
                  <LazyWebsiteRenderer
                    node={node}
                    isFullscreen={isFullscreen}
                    isMinimap={isMinimap}
                  />
                </WithSuspense>
              </div>
            </div>
          );
        default:
          // Display message for unsupported types
          return (
            <div
              className={`p-6 bg-white rounded-lg flex flex-col items-center justify-center text-gray-400 ${
                !isFullscreen ? 'h-[400px]' : 'h-full'
              } shadow-md ${isMinimap ? 'p-2 h-full' : ''}`}
            >
              <div className={`${isMinimap ? 'text-xs' : 'text-lg'}`}>
                {isMinimap
                  ? t('pages.components.nodeRenderer.unsupportedComponent')
                  : t('pages.components.nodeRenderer.onlyCodeComponentSupported')}
              </div>
              {!isMinimap && <div className="text-sm text-gray-400 mt-2">{node.nodeType}</div>}
            </div>
          );
      }
    }, [node, isFullscreen, isModal, isMinimap, onDelete, onStartSlideshow, onWideMode, t]);

    return renderContent;
  },
  // Custom comparison function, only re-render when key properties change
  (prevProps, nextProps) => {
    // Check if key properties have changed
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
