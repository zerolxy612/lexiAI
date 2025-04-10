import { useParams } from 'react-router-dom';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spin, Button, Modal } from 'antd';
import { FileTextOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import '../pages/styles/preview-mode.css';

// 导入抽象的组件和 hooks
import { NodeRenderer } from '../pages/components/NodeRenderer';
import { type NodeRelation } from '../pages/components/ArtifactRenderer';
import PageLayout from '../pages/components/PageLayout';
import PreviewMode from '../pages/components/PreviewMode';
import { usePreviewUI } from '../pages/hooks/usePreviewUI';
import { useSlideshow } from '../pages/hooks/useSlideshow';
import { getNodeTitle } from '../pages/utils/nodeUtils';

const SharePage = () => {
  const { shareId = '' } = useParams();
  const { t } = useTranslation();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { data: shareData, loading: isLoading } = useFetchShareData(shareId);

  // 常规模式和预览模式相关状态
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [wideMode, setWideMode] = useState<{ isActive: boolean; nodeId: string | null }>({
    isActive: false,
    nodeId: null,
  });

  // 提取页面数据和节点关系
  const pageData = useMemo(() => {
    if (!shareData) return null;
    return {
      page: shareData.page,
      content: shareData.content,
      nodeRelations: shareData.nodeRelations || [],
      pageConfig: shareData.pageConfig,
      shareInfo: shareData.shareInfo,
      isOwner: shareData.isOwner,
    };
  }, [shareData]);

  // 节点数据
  const nodes = useMemo<NodeRelation[]>(() => {
    if (!pageData?.nodeRelations) return [];
    return pageData.nodeRelations;
  }, [pageData?.nodeRelations]);

  // 使用抽象的 UI 状态管理 hook
  const {
    uiState,
    showPreviewMinimap,
    handleUiInteraction,
    handlePreviewMouseMove,
    handleMinimapMouseEnter,
    handleMinimapMouseLeave,
    handleSideHintClick,
  } = usePreviewUI({
    isPreviewMode,
  });

  // 使用抽象的幻灯片预览 hook
  const {
    currentSlideIndex,
    nextSlide,
    prevSlide,
    handlePreviewSlideSelect,
    previewContentRef,
    resetSlideIndex,
    setCurrentSlideIndex,
  } = useSlideshow({
    nodes,
    isPreviewMode,
    handleUiInteraction,
  });

  // 切换预览模式
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode((prev) => {
      if (!prev) {
        // 进入预览模式时重置幻灯片索引
        resetSlideIndex();
      }
      return !prev;
    });
  }, [resetSlideIndex]);

  // 强制默认隐藏侧边栏
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // 切换侧边栏
  const toggleSidebar = useCallback(() => {
    setCollapse(!collapse);
  }, [collapse, setCollapse]);

  // 切换小地图
  const toggleMinimap = useCallback(() => setShowMinimap(!showMinimap), [showMinimap]);

  // 处理节点选择
  const handleNodeSelect = useCallback((index: number) => {
    setActiveNodeIndex(index);

    // 滚动到对应的内容块
    const element = document.getElementById(`content-block-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // 处理从指定节点开始幻灯片预览
  const handleStartSlideshow = useCallback(
    (nodeId: string) => {
      // 查找点击的节点索引
      const nodeIndex = nodes.findIndex((node) => node.nodeId === nodeId);
      if (nodeIndex !== -1) {
        // 设置当前幻灯片索引为找到的节点索引
        setCurrentSlideIndex?.(nodeIndex);
        // 打开预览模式
        setIsPreviewMode(true);
      }
    },
    [nodes, setCurrentSlideIndex],
  );

  // 宽屏模式处理
  const handleWideMode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.nodeId === nodeId);
      if (node) {
        setWideMode({ isActive: true, nodeId });
      }
    },
    [nodes],
  );

  // 关闭宽屏模式
  const handleCloseWideMode = useCallback(() => {
    setWideMode({ isActive: false, nodeId: null });
  }, []);

  // 宽屏模式键盘快捷键
  useEffect(() => {
    if (!wideMode.isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseWideMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wideMode.isActive, handleCloseWideMode]);

  // 添加 Escape 键退出幻灯片预览模式
  useEffect(() => {
    if (!isPreviewMode) return;

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        togglePreviewMode();
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isPreviewMode, togglePreviewMode]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  // 数据加载失败或无效分享链接
  if (!shareData || !pageData.page) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-2xl font-medium mb-4 text-gray-700">{t('Invalid share link')}</div>
        <div className="text-gray-500">
          {t('This share link may have expired or does not exist')}
        </div>
      </div>
    );
  }

  // 预览模式渲染
  if (isPreviewMode) {
    return (
      <div className="h-screen overflow-hidden bg-black">
        <PreviewMode
          nodes={nodes}
          currentSlideIndex={currentSlideIndex}
          showPreviewMinimap={showPreviewMinimap}
          uiState={uiState}
          title={pageData.page?.title || '分享页面'}
          onNext={nextSlide}
          onPrev={prevSlide}
          onClose={togglePreviewMode}
          onMouseMove={handlePreviewMouseMove}
          onSideHintClick={handleSideHintClick}
          onUiInteraction={handleUiInteraction}
          onPreviewSlideSelect={handlePreviewSlideSelect}
          onMinimapMouseEnter={handleMinimapMouseEnter}
          onMinimapMouseLeave={handleMinimapMouseLeave}
          getNodeTitle={getNodeTitle}
          previewContentRef={previewContentRef}
        />
      </div>
    );
  }

  // 常规模式渲染 - 使用抽象的 PageLayout 组件
  return (
    <>
      <PageLayout
        showMinimap={showMinimap}
        collapse={collapse}
        nodes={nodes}
        activeNodeIndex={activeNodeIndex}
        onNodeSelect={handleNodeSelect}
        toggleMinimap={toggleMinimap}
        toggleSidebar={toggleSidebar}
        readonly={true}
        headerContent={
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center">
              <div className="text-lg font-medium px-2">{pageData.page?.title || '分享页面'}</div>
              {pageData.shareInfo && (
                <div className="text-sm text-gray-500 ml-2">
                  分享于: {new Date(pageData.shareInfo.sharedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex items-center">
              {nodes.length > 0 && (
                <Button
                  type="text"
                  onClick={togglePreviewMode}
                  icon={<PlayCircleOutlined />}
                  className="flex items-center mx-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  幻灯片预览
                </Button>
              )}
            </div>
          </div>
        }
      >
        {/* 页面描述区域 */}
        {pageData.page?.description && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
            <div className="text-gray-700 text-base">{pageData.page.description}</div>
          </div>
        )}

        {/* 内容模块 */}
        {nodes.length > 0 ? (
          <div className="space-y-6">
            {nodes.map((node, index) => (
              <div
                key={node.relationId || `content-${index}`}
                id={`content-block-${index}`}
                onClick={() => setActiveNodeIndex(index)}
                className={`transition-all duration-300 h-[400px] rounded-lg bg-white ${
                  activeNodeIndex === index
                    ? 'shadow-[0_10px_30px_rgba(0,0,0,0.15)] transform -translate-y-1 border border-blue-400'
                    : 'shadow-md hover:shadow-lg'
                }`}
              >
                <NodeRenderer
                  node={node}
                  isActive={activeNodeIndex === index}
                  onStartSlideshow={handleStartSlideshow}
                  onWideMode={handleWideMode}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300 shadow-sm">
            <div className="text-6xl text-gray-300 mb-6">
              <FileTextOutlined />
            </div>
            <h3 className="text-xl font-medium text-gray-500 mb-3">暂无内容</h3>
            <p className="text-gray-400 mb-6">该分享页面没有任何内容</p>
          </div>
        )}

        <div className="h-24" />
      </PageLayout>

      {/* 宽屏模式弹窗 */}
      {wideMode.isActive && (
        <Modal
          open={wideMode.isActive}
          footer={null}
          onCancel={handleCloseWideMode}
          width="85%"
          style={{ top: 20 }}
          bodyStyle={{
            maxHeight: 'calc(100vh - 100px)',
            padding: 0,
            overflow: 'hidden',
          }}
          className="wide-mode-modal"
          closeIcon={<CloseCircleOutlined className="text-gray-500 hover:text-red-500" />}
          maskStyle={{ background: 'rgba(0, 0, 0, 0.65)' }}
        >
          <div className="bg-white h-full w-full flex flex-col rounded-lg overflow-hidden">
            {/* 宽屏模式内容 */}
            <div className="flex-1 overflow-auto">
              {wideMode.nodeId && nodes.find((n) => n.nodeId === wideMode.nodeId) ? (
                <div className="h-[calc(100vh-160px)]">
                  <NodeRenderer
                    node={nodes.find((n) => n.nodeId === wideMode.nodeId)!}
                    isActive={true}
                    isFullscreen={false}
                    isModal={true}
                    isMinimap={false}
                    onStartSlideshow={handleStartSlideshow}
                    onWideMode={handleWideMode}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">无法加载内容</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default SharePage;
