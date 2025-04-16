import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Spin, message, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useGetPageDetail,
  useUpdatePage,
  useDeletePageNode,
  useSharePage,
} from '@refly-packages/ai-workspace-common/queries/queries';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  ShareAltOutlined,
  CopyOutlined,
  GlobalOutlined,
  UserOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { NodeRenderer } from './components/NodeRenderer';
import { type NodeRelation } from './components/ArtifactRenderer';
import './styles/preview-mode.css';

// Import abstract components and hooks
import PageLayout from './components/PageLayout';
import PreviewMode from './components/PreviewMode';
import { usePreviewUI } from './hooks/usePreviewUI';
import { useSlideshow } from './hooks/useSlideshow';
import { getNodeTitle } from './utils/nodeUtils';

interface PageDetailType {
  title: string;
  description?: string;
  nodeRelations?: NodeRelation[];
}

interface PageEditProps {
  source: 'slideshow' | 'page';
  pageId?: string;
  showMinimap: boolean;
  minimalMode?: boolean;
  setShowMinimap: (show: boolean) => void;
}

export function SlideshowEdit(props: PageEditProps) {
  const { pageId, showMinimap, setShowMinimap, source, minimalMode = false } = props;
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const [formChanged, setFormChanged] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [nodesList, setNodes] = useState<NodeRelation[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [_isDeletingNode, setIsDeletingNode] = useState(false);
  const [wideMode, setWideMode] = useState<{ isActive: boolean; nodeId: string | null }>({
    isActive: false,
    nodeId: null,
  });

  // Share related states
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareOption, setShareOption] = useState<'internet' | 'notEnabled'>('internet');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Get sidebar state
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  // Force hide sidebar by default
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // Use abstract UI state management hook
  const {
    uiState,
    showPreviewMinimap,
    handleUiInteraction,
    handlePreviewMouseMove,
    handleMinimapMouseEnter,
    handleMinimapMouseLeave,
    handleSideHintClick,
  } = usePreviewUI({ isPreviewMode });

  // Use abstract slideshow preview hook
  const {
    currentSlideIndex,
    nextSlide,
    prevSlide,
    handlePreviewSlideSelect,
    previewContentRef,
    resetSlideIndex,
    setCurrentSlideIndex,
  } = useSlideshow({
    nodes: nodesList,
    isPreviewMode,
    handleUiInteraction,
  });

  // UI interaction handling methods
  const toggleSidebar = useCallback(() => setCollapse(!collapse), [collapse, setCollapse]);

  const toggleMinimap = useCallback(() => {
    setShowMinimap(!showMinimap);
  }, [showMinimap, setShowMinimap]);

  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode) {
      resetSlideIndex();
    }
  }, [isPreviewMode, resetSlideIndex]);

  // Get page details
  const {
    data: pageDetailResponse,
    isLoading: isLoadingPage,
    error: pageLoadError,
  } = useGetPageDetail({ path: { pageId: pageId || '' } }, undefined, {
    enabled: !!pageId,
  });

  // Update page hook
  const { mutate: updatePage, isPending: isUpdating } = useUpdatePage();

  // Share page hook
  const { mutate: sharePage } = useSharePage();

  // Extract page data from response
  const pageDetail = pageDetailResponse?.data as PageDetailType | undefined;

  // Get node data
  const nodes = useMemo<NodeRelation[]>(() => {
    if (!pageDetail?.nodeRelations) return [];

    // Note: Originally had filtering logic, but it doesn't filter anything (node.nodeType === "codeArtifact" || 1)
    return pageDetail.nodeRelations.map((node) => ({
      ...node,
    }));
  }, [pageDetail]);

  // Update local state when page data is loaded
  useEffect(() => {
    if (pageDetail) {
      form.setFieldsValue({
        title: pageDetail.title,
        description: pageDetail.description,
      });
      setNodes(nodes);
      setFormChanged(false);
    }
  }, [form, pageDetail, nodes]);

  // Form submission handler
  const handleSubmit = useCallback(
    (values: any) => {
      if (!pageId) return;

      const { title, description } = values;

      // Prepare node relations with updated order
      const nodeRelations = nodesList.map((node, index) => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityId: node.entityId,
        nodeData: node.nodeData,
        orderIndex: index,
      }));

      setFormChanged(false);

      // Call update API
      updatePage(
        {
          path: { pageId },
          body: {
            title,
            description,
            nodeRelations,
          },
        },
        {
          onSuccess: () => {
            message.success(t('pages.edit.saveSuccess'));
          },
          onError: (error) => {
            console.error('Failed to update page:', error);
            message.error(t('pages.edit.saveFailed'));
          },
        },
      );
    },
    [pageId, nodesList, updatePage, t],
  );

  // Form and navigation handling
  const handleBack = useCallback(() => navigate('/pages'), [navigate]);
  const handleFormChange = useCallback(() => setFormChanged(true), []);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (index: number) => {
      if (index >= 0 && index < nodesList.length) {
        setActiveNodeIndex(index);
        if (isPreviewMode) {
          setCurrentSlideIndex(index);
        }
      }
    },
    [nodesList.length, isPreviewMode, setCurrentSlideIndex],
  );

  // Handle node reordering
  const handleReorderNodes = useCallback((newOrder: NodeRelation[]) => {
    setNodes(newOrder);
    setFormChanged(true);
  }, []);

  // Handle deleting a node
  const deletePageNodeMutation = useDeletePageNode();

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!pageId) return;

      try {
        setIsDeletingNode(true);

        // Use useDeletePageNode to delete the node
        await deletePageNodeMutation.mutateAsync({
          path: {
            pageId,
            nodeId,
          },
        });

        // Remove the node from local state
        setNodes((prevNodes) => prevNodes.filter((node) => node.nodeId !== nodeId));

        // If the deleted node is the currently selected node, select the first node
        if (nodesList[activeNodeIndex]?.nodeId === nodeId) {
          setActiveNodeIndex(0);
        }

        message.success(t('common.deleteSuccess'));
        setFormChanged(true);
      } catch (error) {
        console.error('Failed to delete node:', error);
        message.error(t('common.deleteFailed'));
      } finally {
        setIsDeletingNode(false);
      }
    },
    [pageId, activeNodeIndex, nodesList, deletePageNodeMutation],
  );

  // Handle starting a slideshow from a specific node
  const handleStartSlideshow = useCallback(
    (nodeId: string) => {
      // Find the index of the clicked node
      const nodeIndex = nodesList.findIndex((node) => node.nodeId === nodeId);
      if (nodeIndex !== -1) {
        // Set the current slideshow index to the found node index
        setCurrentSlideIndex(nodeIndex);
        // Open preview mode
        setIsPreviewMode(true);
      }
    },
    [nodesList, setCurrentSlideIndex],
  );

  // Handle wide mode
  const handleWideMode = useCallback(
    (nodeId: string) => {
      const node = nodesList.find((n) => n.nodeId === nodeId);
      if (node) {
        setWideMode({ isActive: true, nodeId });
      }
    },
    [nodesList],
  );

  // Close wide mode
  const handleCloseWideMode = useCallback(() => {
    setWideMode({ isActive: false, nodeId: null });
  }, []);

  // Wide mode keyboard shortcut
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

  // Handle sharing a page
  const handleShare = useCallback(() => {
    setShareModalVisible(true);
  }, []);

  // Execute share operation
  const handleShareSubmit = useCallback(() => {
    if (!pageId) return;

    setIsSharing(true);

    sharePage(
      { path: { pageId } },
      {
        onSuccess: (response) => {
          const shareData = response?.data?.data;
          if (shareData?.shareId && shareData?.shareUrl) {
            setShareUrl(shareData.shareUrl);

            // Try to copy to clipboard automatically
            try {
              navigator.clipboard.writeText(shareData.shareUrl).then(
                () => {
                  setIsCopied(true);
                  message.success(t('common.copy.success'));
                  setTimeout(() => setIsCopied(false), 3000);
                },
                () => {
                  console.error('Failed to copy to clipboard');
                },
              );
            } catch (error) {
              console.error('Clipboard API not available:', error);
            }
          } else {
            setIsSharing(false);
            message.error(t('common.shareFailed'));
          }
        },
        onError: () => {
          setIsSharing(false);
          message.error(t('common.shareFailed'));
        },
      },
    );
  }, [pageId, sharePage, t]);

  // Copy share link
  const handleCopyShareUrl = useCallback(() => {
    if (!shareUrl) return;

    navigator.clipboard.writeText(shareUrl).then(
      () => {
        setIsCopied(true);
        message.success(t('common.copy.success'));
        setTimeout(() => setIsCopied(false), 3000);
      },
      () => {
        message.error(t('common.copyFailed'));
      },
    );
  }, [shareUrl, t]);

  // Close share modal
  const handleCloseShareModal = useCallback(() => {
    setShareModalVisible(false);
  }, []);

  // Render page content
  const renderPageContent = useMemo(() => {
    if (isLoadingPage) {
      return (
        <div className="flex items-center justify-center py-20">
          <Spin size="large" tip={t('common.loading')} />
        </div>
      );
    }

    if (pageLoadError) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <FileTextOutlined className="text-4xl text-red-500 mb-4" />
          <p className="text-lg text-gray-700 mb-2">{t('common.loadFailed')}</p>
          <p className="text-sm text-gray-500 mb-4">{t('common.loadFailedDesc')}</p>
          <Button type="primary" onClick={() => navigate('/pages/list')}>
            {t('common.returnToList')}
          </Button>
        </div>
      );
    }

    if (!pageDetail) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <FileTextOutlined className="text-4xl text-gray-400 mb-4" />
          <p className="text-lg text-gray-700 mb-2">{t('common.noPage')}</p>
          <p className="text-sm text-gray-500 mb-4">{t('common.noPageDesc')}</p>
          <Button type="primary" onClick={() => navigate('/pages/list')}>
            {t('common.returnToList')}
          </Button>
        </div>
      );
    }

    if (isPreviewMode) {
      return (
        <PreviewMode
          nodes={nodesList}
          currentIndex={currentSlideIndex}
          onNext={nextSlide}
          onPrev={prevSlide}
          onClose={togglePreviewMode}
          onMouseMove={handlePreviewMouseMove}
          showUI={uiState.showUI}
          showMinimap={showPreviewMinimap}
          onMinimapMouseEnter={handleMinimapMouseEnter}
          onMinimapMouseLeave={handleMinimapMouseLeave}
          onSlideSelect={handlePreviewSlideSelect}
          onSideHintClick={handleSideHintClick}
          contentRef={previewContentRef}
        />
      );
    }

    return (
      <div>
        {/* Content section - using virtualized list for optimization */}
        {nodesList.length > 0 ? (
          <div className="space-y-6">
            {nodesList.map((node, index) => (
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
                  onDelete={handleDeleteNode}
                  onStartSlideshow={handleStartSlideshow}
                  onWideMode={handleWideMode}
                  node={node}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300 shadow-sm">
            <FileTextOutlined className="text-5xl text-gray-300 mb-4" />
            <h3 className="text-xl text-gray-500 mb-2">{t('common.noContent')}</h3>
            <p className="text-gray-400 mb-6">{t('common.noContentDesc')}</p>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => message.info(t('common.addContentInfo'))}
            >
              {t('common.addContent')}
            </Button>
          </div>
        )}
      </div>
    );
  }, [
    isLoadingPage,
    pageLoadError,
    pageDetail,
    isPreviewMode,
    nodesList,
    currentSlideIndex,
    nextSlide,
    prevSlide,
    togglePreviewMode,
    handlePreviewMouseMove,
    uiState.showUI,
    showPreviewMinimap,
    handleMinimapMouseEnter,
    handleMinimapMouseLeave,
    handlePreviewSlideSelect,
    handleSideHintClick,
    previewContentRef,
    form,
    handleSubmit,
    handleFormChange,
    handleBack,
    handleShare,
    isUpdating,
    activeNodeIndex,
    handleNodeSelect,
    handleDeleteNode,
    handleStartSlideshow,
    handleWideMode,
    navigate,
  ]);

  // Loading state
  if (isLoadingPage) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  // Error state
  if (pageLoadError || !pageDetail) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-red-500 mb-4">{t('common.loadFailed')}</p>
          <Button onClick={handleBack} icon={<ArrowLeftOutlined />}>
            {t('common.returnToList')}
          </Button>
        </div>
      </div>
    );
  }

  // Preview mode rendering
  if (isPreviewMode) {
    return (
      <Modal
        open={isPreviewMode}
        footer={null}
        closable={false}
        onCancel={togglePreviewMode}
        width="100%"
        style={{ top: 0, padding: 0, maxWidth: '100vw' }}
        bodyStyle={{ height: '100vh', padding: 0, overflow: 'hidden' }}
        className="preview-modal"
        maskStyle={{ background: 'rgba(0, 0, 0, 0.85)' }}
        wrapClassName="preview-modal-wrap"
      >
        <div className="bg-black h-full w-full flex flex-col">
          {/* Use abstract PreviewMode component */}
          <PreviewMode
            nodes={nodesList}
            currentSlideIndex={currentSlideIndex}
            showPreviewMinimap={showPreviewMinimap}
            uiState={uiState}
            title={form.getFieldValue('title')}
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
      </Modal>
    );
  }

  return (
    <PageLayout
      source={source}
      showMinimap={showMinimap}
      collapse={collapse}
      nodes={nodesList}
      activeNodeIndex={activeNodeIndex}
      onNodeSelect={handleNodeSelect}
      onReorderNodes={handleReorderNodes}
      toggleMinimap={toggleMinimap}
      toggleSidebar={toggleSidebar}
      headerContent={
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center">
            {source === 'page' && (
              <Button
                onClick={handleBack}
                icon={<ArrowLeftOutlined />}
                type="text"
                className="mr-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              />
            )}

            <div className="text-xl font-semibold text-gray-800 mr-2">
              {pageDetail.title || t('common.untitled')}
            </div>
          </div>

          <div className="flex items-center">
            {nodesList.length > 0 && (
              <Button
                type="text"
                size={minimalMode ? 'small' : 'middle'}
                onClick={togglePreviewMode}
                icon={<PlayCircleOutlined />}
                className={`flex items-center text-gray-600 hover:!text-green-600 hover:bg-gray-50 ${
                  minimalMode ? 'text-xs' : ''
                }`}
              >
                {t('common.preview')}
              </Button>
            )}
            <Button
              type="text"
              size={minimalMode ? 'small' : 'middle'}
              onClick={handleShare}
              icon={<ShareAltOutlined />}
              className={`flex items-center mr-2 text-gray-600 hover:!text-green-600 hover:bg-gray-50 ${
                minimalMode ? 'text-xs' : ''
              }`}
            >
              {t('common.shareLink')}
            </Button>
            {formChanged && (
              <Button
                type="primary"
                size={minimalMode ? 'small' : 'middle'}
                htmlType="submit"
                onClick={() => form.submit()}
                loading={isUpdating}
                icon={<SaveOutlined />}
                className={`flex items-center bg-green-600 hover:bg-green-700 border-none ${
                  minimalMode ? 'text-xs' : ''
                }`}
              >
                {isUpdating ? t('common.saving') : t('common.savePage')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Content module */}
      {renderPageContent}

      {/* Wide mode modal */}
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
          {/* Wide mode content */}
          <div className="flex-1 overflow-auto">
            {wideMode.nodeId && nodesList.find((n) => n.nodeId === wideMode.nodeId) ? (
              <div className="h-[calc(100vh-160px)]">
                <NodeRenderer
                  node={nodesList.find((n) => n.nodeId === wideMode.nodeId)!}
                  isFullscreen={false}
                  isModal={true}
                  isMinimap={false}
                  onDelete={handleDeleteNode}
                  onStartSlideshow={handleStartSlideshow}
                  onWideMode={handleWideMode}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">{t('common.wideModeLoadFailed')}</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Share modal */}
      <Modal
        title={
          <div className="flex items-center text-lg font-medium">
            <ShareAltOutlined className="mr-2 text-green-500" /> {t('common.shareLink')}
          </div>
        }
        open={shareModalVisible}
        onCancel={handleCloseShareModal}
        footer={null}
        width={420}
        className="share-modal"
        maskClosable={false}
      >
        <div className="py-2">
          <div className="mb-4">
            <div className="text-gray-700 mb-2">{t('common.whoCanView')}</div>
            <Select
              value={shareOption}
              onChange={(value) => setShareOption(value)}
              style={{ width: '100%' }}
              options={[
                {
                  value: 'internet',
                  label: (
                    <div className="flex items-center">
                      <GlobalOutlined className="mr-2 text-green-500" />
                      {t('common.internetUsers')}
                    </div>
                  ),
                },
                {
                  value: 'notEnabled',
                  label: (
                    <div className="flex items-center">
                      <UserOutlined className="mr-2 text-gray-500" />
                      {t('common.notEnabled')}
                    </div>
                  ),
                  disabled: true,
                },
              ]}
            />
          </div>

          {!shareUrl ? (
            <Button
              type="primary"
              block
              icon={<ShareAltOutlined />}
              onClick={handleShareSubmit}
              loading={isSharing}
              className="bg-green-600 hover:bg-green-700 border-none mt-2"
            >
              {t('common.copyShareLink')}
            </Button>
          ) : (
            <div className="mt-4">
              <div className="text-gray-700 mb-2">{t('common.shareUrl')}</div>
              <div className="flex items-center">
                <Input value={shareUrl} readOnly className="flex-1 bg-gray-50" />
                <Button
                  type="primary"
                  icon={<CopyOutlined />}
                  onClick={handleCopyShareUrl}
                  className={`ml-2 flex items-center justify-center h-[32px] ${
                    isCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  } border-none`}
                >
                  {isCopied ? t('common.copied') : t('common.copy.title')}
                </Button>
              </div>
              <div className="mt-4 text-gray-500 text-sm">{t('common.shareUrlDesc')}</div>
            </div>
          )}
        </div>
      </Modal>
    </PageLayout>
  );
}

function PageEdit() {
  const [showMinimap, setShowMinimap] = useState(true);
  const { pageId } = useParams<{ pageId: string }>();
  return (
    <SlideshowEdit
      pageId={pageId}
      showMinimap={showMinimap}
      setShowMinimap={setShowMinimap}
      source="page"
    />
  );
}

export default PageEdit;
