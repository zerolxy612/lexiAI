import React, { useMemo } from 'react';
import { Button } from 'antd';
import { CloseCircleOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  // 计算当前进度百分比
  const progressPercentage = useMemo(() => {
    if (nodes.length <= 1) return 100;
    return (currentSlideIndex / (nodes.length - 1)) * 100;
  }, [currentSlideIndex, nodes.length]);

  return (
    <div
      ref={previewContentRef}
      className={`preview-content-container relative ${uiState.isIdle ? 'idle' : ''} ${uiState.showNav ? 'show-nav' : ''}`}
      onMouseMove={onMouseMove}
    >
      {/* 顶部进度条 */}
      <div
        className="preview-progress-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${progressPercentage}%`,
          height: '2px',
          background: 'linear-gradient(to right, #108ee9, #1890ff)',
          borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 6px rgba(24, 144, 255, 0.5)',
          transition: 'width 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
          zIndex: 1000,
        }}
      />

      {/* 预览导航栏 - 只保留右上角关闭按钮 */}
      <div
        className={`preview-close-button ${uiState.isIdle ? 'opacity-0' : 'opacity-100'}`}
        onMouseEnter={onUiInteraction}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 50,
          transition: 'opacity 0.3s ease-out',
        }}
      >
        <Button
          type="text"
          icon={<CloseCircleOutlined style={{ fontSize: '24px' }} />}
          onClick={onClose}
          className="preview-control-button close-button"
          style={{
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            border: 'none',
          }}
        />
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
        <div className="preview-minimap-header">{t('pages.components.navigationDirectory')}</div>
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
          {t('pages.components.swipeHint', { current: currentSlideIndex + 1, total: nodes.length })}
        </div>
      )}

      {/* 预览模式底部进度指示器 */}
      {nodes.length > 1 && (
        <div
          className={`preview-footer ${uiState.isIdle ? 'opacity-0' : 'opacity-100'}`}
          onMouseEnter={onUiInteraction}
          style={{ transition: 'opacity 0.3s ease-out' }}
        >
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
