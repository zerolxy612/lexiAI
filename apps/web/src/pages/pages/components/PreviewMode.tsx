import React from 'react';
import { Button } from 'antd';
import {
  LeftCircleOutlined,
  RightCircleOutlined,
  CloseCircleOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { NodeRenderer } from './NodeRenderer';
import { type NodeRelation } from './ArtifactRenderer';
import '../styles/preview-mode.css';

interface PreviewModeProps {
  nodes: NodeRelation[];
  currentSlideIndex: number;
  showPreviewMinimap: boolean;
  uiState: {
    isIdle: boolean;
    showNav: boolean;
  };
  title: string;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSideHintClick: () => void;
  onUiInteraction: () => void;
  onPreviewSlideSelect: (index: number) => void;
  onMinimapMouseEnter: () => void;
  onMinimapMouseLeave: () => void;
  getNodeTitle: (node: NodeRelation) => string;
  previewContentRef: React.RefObject<HTMLDivElement>;
}

const PreviewMode: React.FC<PreviewModeProps> = ({
  nodes,
  currentSlideIndex,
  showPreviewMinimap,
  uiState,
  title,
  onNext,
  onPrev,
  onClose,
  onMouseMove,
  onSideHintClick,
  onUiInteraction,
  onPreviewSlideSelect,
  onMinimapMouseEnter,
  onMinimapMouseLeave,
  getNodeTitle,
  previewContentRef,
}) => {
  return (
    <div
      ref={previewContentRef}
      className={`preview-content-container relative ${uiState.isIdle ? 'idle' : ''} ${uiState.showNav ? 'show-nav' : ''}`}
      onMouseMove={onMouseMove}
    >
      {/* 预览导航栏 */}
      <div className="preview-header" onMouseEnter={onUiInteraction}>
        <div className="preview-header-title">
          {title}
          <span className="page-indicator">
            {currentSlideIndex + 1}/{nodes.length}
          </span>
        </div>
        <div className="preview-header-controls">
          <Button
            type="text"
            icon={<LeftCircleOutlined />}
            onClick={onPrev}
            disabled={currentSlideIndex <= 0}
            className={`preview-control-button ${currentSlideIndex <= 0 ? 'disabled' : ''}`}
          />
          <Button
            type="text"
            icon={<RightCircleOutlined />}
            onClick={onNext}
            disabled={currentSlideIndex >= nodes.length - 1}
            className={`preview-control-button ${currentSlideIndex >= nodes.length - 1 ? 'disabled' : ''}`}
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
      {!showPreviewMinimap && nodes.length > 1 && (
        <div className="side-hint" onClick={onSideHintClick}>
          <UnorderedListOutlined />
        </div>
      )}

      {/* 预览模式小地图 */}
      <div
        className={`preview-minimap ${showPreviewMinimap ? 'preview-minimap-show' : ''}`}
        onMouseEnter={onMinimapMouseEnter}
        onMouseLeave={onMinimapMouseLeave}
      >
        <div className="preview-minimap-header">导航目录</div>
        <div className="preview-minimap-content">
          {nodes.map((node, index) => (
            <div
              key={`minimap-slide-${index}`}
              className={`preview-minimap-slide ${currentSlideIndex === index ? 'active' : ''}`}
              onClick={() => onPreviewSlideSelect(index)}
            >
              <div className="preview-minimap-number">{index + 1}</div>
              <div className="preview-minimap-thumbnail">
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
                    isActive={false}
                    isFullscreen={false}
                    isModal={true}
                    isMinimap={true}
                  />
                </div>
                {/* 透明遮罩层 */}
                <div className="absolute inset-0 bg-transparent" />
              </div>
              <div className="preview-minimap-title">{getNodeTitle(node)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 主要预览内容 */}
      <div className="preview-content">
        <div
          className="w-full h-full preview-slide"
          style={{
            animationName: 'slideIn',
            animationDuration: '0.5s',
            animationTimingFunction: 'ease-out',
            animationFillMode: 'forwards',
          }}
        >
          <NodeRenderer
            node={nodes[currentSlideIndex]}
            isActive={true}
            isFullscreen={true}
            isModal={true}
          />
        </div>
      </div>

      {/* 滑动提示 - 只在移动设备上显示 */}
      {nodes.length > 1 && (
        <div className="swipe-hint md:hidden">
          左右滑动切换幻灯片 ({currentSlideIndex + 1}/{nodes.length})
        </div>
      )}

      {/* 预览模式底部进度指示器 */}
      {nodes.length > 0 && (
        <div className="preview-footer" onMouseEnter={onUiInteraction}>
          <div className="dots-container">
            {nodes.map((_, index) => (
              <div
                key={`preview-dot-${index}`}
                className={`preview-dot ${index === currentSlideIndex ? 'active' : ''}`}
                onClick={() => onPreviewSlideSelect(index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewMode;
