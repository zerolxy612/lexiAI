import { memo } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { CodeArtifactRenderer } from './CodeArtifactRenderer';
import { DocumentRenderer } from './DocumentRenderer';
import { SkillResponseRenderer } from './SkillResponseRenderer';
import { ImageRenderer } from './ImageRenderer';
import { NodeBlockHeader } from './NodeBlockHeader';

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
              <CodeArtifactRenderer node={node} isFullscreen={isFullscreen} isMinimap={isMinimap} />
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
              <DocumentRenderer node={node} isFullscreen={isFullscreen} isMinimap={isMinimap} />
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
              <SkillResponseRenderer
                node={node}
                isFullscreen={isFullscreen}
                isMinimap={isMinimap}
              />
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
              <ImageRenderer node={node} isFullscreen={isFullscreen} isMinimap={isMinimap} />
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
  },
);

export { NodeRenderer };
