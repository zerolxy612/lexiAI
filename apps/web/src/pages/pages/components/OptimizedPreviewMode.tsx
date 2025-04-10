import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Button } from 'antd';
import {
  LeftCircleOutlined,
  RightCircleOutlined,
  CloseCircleOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { NodeRenderer } from './NodeRenderer';
import { type NodeRelation } from './ArtifactRenderer';
import {
  LazyImageRenderer,
  LazyCodeArtifactRenderer,
  LazyDocumentRenderer,
  LazySkillResponseRenderer,
  WithSuspense,
} from './LazyComponents';
import '../styles/preview-mode.css';

interface PreviewModeProps {
  nodes: NodeRelation[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  showUI: boolean;
  showMinimap: boolean;
  onMinimapMouseEnter: () => void;
  onMinimapMouseLeave: () => void;
  onSlideSelect: (index: number) => void;
  onSideHintClick: () => void;
  contentRef: React.RefObject<HTMLDivElement>;
}

// 获取节点标题的辅助函数
const getNodeTitle = (node: NodeRelation) => {
  return node.nodeData?.title || '未命名节点';
};

// 优化的预览模式组件
const OptimizedPreviewMode: React.FC<PreviewModeProps> = ({
  nodes,
  currentIndex,
  onNext,
  onPrev,
  onClose,
  onMouseMove,
  showUI,
  showMinimap,
  onMinimapMouseEnter,
  onMinimapMouseLeave,
  onSlideSelect,
  onSideHintClick,
  contentRef,
}) => {
  // 跟踪哪些缩略图已经被查看过
  const [visibleThumbnails, setVisibleThumbnails] = useState<Record<number, boolean>>({});

  // 预加载下一张幻灯片的状态
  const [preloadNextIndex, setPreloadNextIndex] = useState<number | null>(null);

  // 当前幻灯片变化时预加载下一张
  useEffect(() => {
    if (currentIndex < nodes.length - 1) {
      setPreloadNextIndex(currentIndex + 1);
    } else if (currentIndex > 0) {
      setPreloadNextIndex(currentIndex - 1);
    }
  }, [currentIndex, nodes.length]);

  // 当缩略图可见时记录
  const handleThumbnailVisible = useCallback((index: number) => {
    setVisibleThumbnails((prev) => ({
      ...prev,
      [index]: true,
    }));
  }, []);

  // 优化：只渲染当前幻灯片和预加载的幻灯片
  const renderSlide = useCallback(
    (index: number) => {
      if (index !== currentIndex && index !== preloadNextIndex) {
        return null;
      }

      const node = nodes[index];
      if (!node) return null;

      return (
        <div
          key={`slide-${index}`}
          className="w-full h-full preview-slide"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            opacity: index === currentIndex ? 1 : 0,
            pointerEvents: index === currentIndex ? 'auto' : 'none',
            transform: `translate3d(${index === currentIndex ? 0 : index < currentIndex ? '-100%' : '100%'}, 0, 0)`,
            transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
            willChange: 'transform, opacity',
            zIndex: index === currentIndex ? 2 : 1,
          }}
        >
          <WithSuspense>
            <LazySlideContent node={node} isFullscreen={true} />
          </WithSuspense>
        </div>
      );
    },
    [currentIndex, preloadNextIndex, nodes],
  );

  // 懒加载幻灯片内容组件
  const LazySlideContent = useCallback(
    ({
      node,
      isFullscreen,
    }: {
      node: NodeRelation;
      isFullscreen: boolean;
    }) => {
      switch (node.nodeType) {
        case 'codeArtifact':
          return (
            <LazyCodeArtifactRenderer node={node} isFullscreen={isFullscreen} isMinimap={false} />
          );
        case 'document':
          return <LazyDocumentRenderer node={node} isFullscreen={isFullscreen} isMinimap={false} />;
        case 'skillResponse':
          return (
            <LazySkillResponseRenderer node={node} isFullscreen={isFullscreen} isMinimap={false} />
          );
        case 'image':
          return <LazyImageRenderer node={node} isFullscreen={isFullscreen} isMinimap={false} />;
        default:
          return (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-lg">不支持的内容类型</div>
            </div>
          );
      }
    },
    [],
  );

  // 优化：只在小地图打开时渲染缩略图
  const renderMinimap = useMemo(() => {
    if (!showMinimap) return null;

    return (
      <div
        className={`preview-minimap ${showMinimap ? 'preview-minimap-show' : ''}`}
        onMouseEnter={onMinimapMouseEnter}
        onMouseLeave={onMinimapMouseLeave}
        style={{ willChange: 'transform' }}
      >
        <div className="preview-minimap-header">导航目录</div>
        <div className="preview-minimap-content">
          {nodes.map((node, index) => {
            // 判断是否需要渲染缩略图内容
            const shouldRenderContent = visibleThumbnails[index] || index === currentIndex;

            return (
              <div
                key={`minimap-slide-${index}`}
                className={`preview-minimap-slide ${currentIndex === index ? 'active' : ''}`}
                onClick={() => {
                  handleThumbnailVisible(index);
                  onSlideSelect(index);
                }}
                onMouseEnter={() => handleThumbnailVisible(index)}
              >
                <div className="preview-minimap-number">{index + 1}</div>
                <div className="preview-minimap-thumbnail">
                  {shouldRenderContent ? (
                    <div
                      style={{
                        height: '100%',
                        overflow: 'hidden',
                        transform: 'scale(0.95)',
                        background: '#fff',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      <NodeRenderer
                        node={node}
                        isFullscreen={false}
                        isModal={true}
                        isMinimap={true}
                      />
                    </div>
                  ) : (
                    // 使用占位符代替实际内容
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <div className="text-xs text-gray-400">加载中...</div>
                    </div>
                  )}
                  {/* 透明遮罩层 */}
                  <div className="absolute inset-0 bg-transparent" />
                </div>
                <div className="preview-minimap-title">{getNodeTitle(node)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [
    showMinimap,
    nodes,
    currentIndex,
    visibleThumbnails,
    onMinimapMouseEnter,
    onMinimapMouseLeave,
    onSlideSelect,
    handleThumbnailVisible,
  ]);

  return (
    <div
      ref={contentRef}
      className={`preview-content-container relative ${!showUI ? 'idle' : ''}`}
      onMouseMove={onMouseMove}
      style={{ willChange: 'contents' }}
    >
      {/* 预览导航栏 */}
      <div
        className={`preview-header ${showUI ? 'opacity-100' : 'opacity-0'}`}
        style={{
          transition: 'opacity 0.3s ease-out',
          willChange: 'opacity',
        }}
      >
        <div className="preview-header-title">
          {nodes[currentIndex] ? getNodeTitle(nodes[currentIndex]) : '幻灯片预览'}
          <span className="page-indicator">
            {currentIndex + 1}/{nodes.length}
          </span>
        </div>
        <div className="preview-header-controls">
          <Button
            type="text"
            icon={<LeftCircleOutlined />}
            onClick={onPrev}
            disabled={currentIndex <= 0}
            className={`preview-control-button ${currentIndex <= 0 ? 'disabled' : ''}`}
          />
          <Button
            type="text"
            icon={<RightCircleOutlined />}
            onClick={onNext}
            disabled={currentIndex >= nodes.length - 1}
            className={`preview-control-button ${currentIndex >= nodes.length - 1 ? 'disabled' : ''}`}
          />
          <Button
            type="text"
            icon={<CloseCircleOutlined />}
            onClick={onClose}
            className="preview-control-button close-button"
          />
        </div>
      </div>

      {/* 小地图提示 - 当小地图隐藏时显示 */}
      {!showMinimap && nodes.length > 1 && (
        <div
          className={`side-hint ${showUI ? 'opacity-100' : 'opacity-0'}`}
          onClick={onSideHintClick}
          style={{
            transition: 'opacity 0.3s ease-out',
            willChange: 'opacity',
          }}
        >
          <UnorderedListOutlined />
        </div>
      )}

      {/* 渲染小地图 */}
      {renderMinimap}

      {/* 主要预览内容 - 只渲染当前和预加载的幻灯片 */}
      <div className="preview-content">{nodes.map((_, index) => renderSlide(index))}</div>

      {/* 滑动提示 - 只在移动设备上显示 */}
      {nodes.length > 1 && (
        <div
          className={`swipe-hint md:hidden ${showUI ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transition: 'opacity 0.3s ease-out',
            willChange: 'opacity',
          }}
        >
          左右滑动切换幻灯片 ({currentIndex + 1}/{nodes.length})
        </div>
      )}

      {/* 预览模式底部进度指示器 */}
      {nodes.length > 0 && (
        <div
          className={`preview-footer ${showUI ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transition: 'opacity 0.3s ease-out',
            willChange: 'opacity',
          }}
        >
          <div className="dots-container">
            {nodes.map((_, index) => (
              <div
                key={`preview-dot-${index}`}
                className={`preview-dot ${index === currentIndex ? 'active' : ''}`}
                onClick={() => onSlideSelect(index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizedPreviewMode;
