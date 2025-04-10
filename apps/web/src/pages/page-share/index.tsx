import { useParams } from "react-router-dom";
import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Spin, Button, Layout, Tooltip } from "antd";
import {
  LeftCircleOutlined,
  RightCircleOutlined,
  CloseCircleOutlined,
  UnorderedListOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
  LeftOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useSiderStoreShallow } from "@refly-packages/ai-workspace-common/stores/sider";
import { useFetchShareData } from "@refly-packages/ai-workspace-common/hooks/use-fetch-share-data";
import PoweredByRefly from "@/components/common/PoweredByRefly";
import "../pages/styles/preview-mode.css";

// 导入 NodeRenderer 组件
import { NodeRenderer } from "../pages/components/NodeRenderer";
import { SidebarMinimap } from "../pages/components/SidebarMinimap";
import { type NodeRelation } from "../pages/components/ArtifactRenderer";

const SharePage = () => {
  const { shareId = "" } = useParams();
  const { t } = useTranslation();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { data: shareData, loading: isLoading } = useFetchShareData(shareId);
  
  // 常规模式和预览模式相关状态
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showPreviewMinimap, setShowPreviewMinimap] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [uiState, setUiState] = useState({
    isIdle: false,
    showNav: false
  });
  const previewContentRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<{
    idle: NodeJS.Timeout | null;
    nav: NodeJS.Timeout | null;
    minimap: NodeJS.Timeout | null;
  }>({ idle: null, nav: null, minimap: null });

  // 提取页面数据和节点关系
  const pageData = useMemo(() => {
    if (!shareData) return null;
    return {
      page: shareData.page,
      content: shareData.content,
      nodeRelations: shareData.nodeRelations || [],
      pageConfig: shareData.pageConfig,
      shareInfo: shareData.shareInfo,
      isOwner: shareData.isOwner
    };
  }, [shareData]);

  // 节点数据
  const nodes = useMemo<NodeRelation[]>(() => {
    if (!pageData?.nodeRelations) return [];
    return pageData.nodeRelations;
  }, [pageData?.nodeRelations]);

  // 强制默认隐藏侧边栏
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // 切换侧边栏
  const toggleSidebar = useCallback(() => {
    setCollapse(!collapse);
  }, [collapse, setCollapse]);

  // 切换小地图
  const toggleMinimap = useCallback(
    () => setShowMinimap(!showMinimap),
    [showMinimap]
  );

  // 切换预览模式
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode) setCurrentSlideIndex(0);
  }, [isPreviewMode]);

  // 统一的UI状态管理函数
  const updateUiState = useCallback((updates: Partial<typeof uiState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);

  // 重置定时器
  const resetTimer = useCallback((timerKey: keyof typeof timersRef.current, callback: () => void, delay: number) => {
    if (timersRef.current[timerKey]) {
      clearTimeout(timersRef.current[timerKey]!);
    }
    timersRef.current[timerKey] = setTimeout(callback, delay);
  }, []);

  // 重置闲置状态
  const resetIdleState = useCallback(() => {
    updateUiState({ isIdle: false });
    
    if (isPreviewMode) {
      resetTimer('idle', () => {
        updateUiState({ isIdle: true, showNav: false });
      }, 2000); // 2秒无操作后隐藏导航栏
    }
  }, [isPreviewMode, updateUiState, resetTimer]);

  // 统一的UI交互处理函数
  const handleUiInteraction = useCallback(() => {
    resetIdleState();
    updateUiState({ showNav: true });

    resetTimer('nav', () => {
      if (uiState.isIdle) {
        updateUiState({ showNav: false });
      }
    }, 3000); // 悬停3秒后，如果处于闲置状态则隐藏
  }, [resetIdleState, updateUiState, resetTimer, uiState.isIdle]);

  // 幻灯片导航方法
  const nextSlide = useCallback(() => {
    if (currentSlideIndex < nodes.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  }, [currentSlideIndex, nodes.length]);

  const prevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  }, [currentSlideIndex]);

  // 键盘导航控制
  useEffect(() => {
    if (!isPreviewMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "Space":
          nextSlide();
          break;
        case "ArrowLeft":
          prevSlide();
          break;
        case "Escape":
          setIsPreviewMode(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewMode, nextSlide, prevSlide]);

  // 添加触摸手势支持
  useEffect(() => {
    if (!isPreviewMode || !previewContentRef.current) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
      // 触摸时重置闲置状态
      handleUiInteraction();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleTouchMove = () => {
      // 触摸移动时重置闲置状态
      handleUiInteraction();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      if (touchEndX < touchStartX - swipeThreshold) {
        nextSlide();
      }
      if (touchEndX > touchStartX + swipeThreshold) {
        prevSlide();
      }
    };

    const element = previewContentRef.current;
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isPreviewMode, nextSlide, prevSlide, handleUiInteraction]);

  // 预览模式交互处理
  const handlePreviewMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPreviewMode) return;

      handleUiInteraction();

      // 当鼠标移动到屏幕左侧边缘时显示小地图
      if (e.clientX < 20) {
        setShowPreviewMinimap(true);
        resetTimer('minimap', () => {}, 0);
      }
    },
    [isPreviewMode, handleUiInteraction, resetTimer]
  );

  // 小地图交互处理
  const handleMinimapMouseEnter = useCallback(() => {
    if (timersRef.current.minimap) {
      clearTimeout(timersRef.current.minimap);
      timersRef.current.minimap = null;
    }
  }, []);

  const handleMinimapMouseLeave = useCallback(() => {
    setShowPreviewMinimap(false);
  }, []);

  const handlePreviewSlideSelect = useCallback((index: number) => {
    setCurrentSlideIndex(index);
  }, []);

  const handleSideHintClick = useCallback(() => {
    setShowPreviewMinimap(true);
  }, []);

  // 处理节点选择
  const handleNodeSelect = useCallback((index: number) => {
    setActiveNodeIndex(index);

    // 滚动到对应的内容块
    const element = document.getElementById(`content-block-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // 获取节点标题
  const getNodeTitle = useCallback((node: NodeRelation) => {
    // 尝试从nodeData.title获取标题
    if (node.nodeData?.title) return node.nodeData.title;

    // 尝试从nodeData.metadata.title获取标题
    if (node.nodeData?.metadata?.title) return node.nodeData.metadata.title;

    // 根据节点类型返回默认标题
    if (node.nodeType === "codeArtifact") return "代码组件";
    if (node.nodeType === "document") return "文档组件";
    if (node.nodeType === "skillResponse") return "技能响应";

    return `幻灯片 ${node.orderIndex + 1}`;
  }, []);

  // 清理所有定时器
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // 预览模式状态变化处理
  useEffect(() => {
    if (isPreviewMode) {
      resetIdleState();
      updateUiState({ showNav: true });
    } else {
      updateUiState({ isIdle: false, showNav: false });
      Object.keys(timersRef.current).forEach(key => {
        const timerKey = key as keyof typeof timersRef.current;
        if (timersRef.current[timerKey]) {
          clearTimeout(timersRef.current[timerKey]!);
          timersRef.current[timerKey] = null;
        }
      });
    }
  }, [isPreviewMode, resetIdleState, updateUiState]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex h-full w-full grow items-center justify-center">
        <Spin size="large" tip={t("codeArtifact.shareLoading")} />
      </div>
    );
  }

  // 无数据状态
  if (!pageData || !nodes.length) {
    return (
      <div className="flex h-full w-full grow items-center justify-center">
        <div className="text-gray-500">{t("codeArtifact.noCodeFound")}</div>
      </div>
    );
  }

  // 预览模式渲染
  if (isPreviewMode) {
    return (
      <Layout className="h-screen overflow-hidden bg-black">
        {collapse && <PoweredByRefly onClick={toggleSidebar} />}

        {/* 主内容区域 */}
        <div
          ref={previewContentRef}
          className={`preview-content-container relative ${uiState.isIdle ? "idle" : ""} ${uiState.showNav ? "show-nav" : ""}`}
          onMouseMove={handlePreviewMouseMove}
        >
          {/* 预览导航栏 */}
          <div className="preview-header" onMouseEnter={handleUiInteraction}>
            <div className="preview-header-title">
              {pageData.page?.title || "分享页面"}
              <span className="page-indicator">
                {currentSlideIndex + 1}/{nodes.length}
              </span>
            </div>
            <div className="preview-header-controls">
              <Button
                type="text"
                icon={<LeftCircleOutlined />}
                onClick={prevSlide}
                disabled={currentSlideIndex <= 0}
                className={`preview-control-button ${currentSlideIndex <= 0 ? "disabled" : ""}`}
              />
              <Button
                type="text"
                icon={<RightCircleOutlined />}
                onClick={nextSlide}
                disabled={currentSlideIndex >= nodes.length - 1}
                className={`preview-control-button ${currentSlideIndex >= nodes.length - 1 ? "disabled" : ""}`}
              />
              <Button
                type="text"
                icon={<CloseCircleOutlined />}
                onClick={togglePreviewMode}
                className="preview-control-button close-button"
              />
            </div>
          </div>

          {/* 小地图提示 - 当小地图隐藏时显示 */}
          {!showPreviewMinimap && nodes.length > 1 && (
            <div className="side-hint" onClick={handleSideHintClick}>
              <UnorderedListOutlined />
            </div>
          )}

          {/* 预览模式小地图 */}
          <div
            className={`preview-minimap ${showPreviewMinimap ? "preview-minimap-show" : ""}`}
            onMouseEnter={handleMinimapMouseEnter}
            onMouseLeave={handleMinimapMouseLeave}
          >
            <div className="preview-minimap-header">导航目录</div>
            <div className="preview-minimap-content">
              {nodes.map((node, index) => (
                <div
                  key={`minimap-slide-${index}`}
                  className={`preview-minimap-slide ${currentSlideIndex === index ? "active" : ""}`}
                  onClick={() => handlePreviewSlideSelect(index)}
                >
                  <div className="preview-minimap-number">{index + 1}</div>
                  <div className="preview-minimap-thumbnail">
                    <div
                      style={{
                        height: "100%",
                        overflow: "hidden",
                        transform: "scale(0.95)",
                        background: "#fff",
                        pointerEvents: "none",
                        userSelect: "none",
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
                  <div className="preview-minimap-title">
                    {getNodeTitle(node)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 主要预览内容 */}
          <div className="preview-content">
            <div
              className="w-full h-full preview-slide"
              style={{
                animationName: "slideIn",
                animationDuration: "0.5s",
                animationTimingFunction: "ease-out",
                animationFillMode: "forwards",
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
            <div className="preview-footer" onMouseEnter={handleUiInteraction}>
              <div className="dots-container">
                {nodes.map((_, index) => (
                  <div
                    key={`preview-dot-${index}`}
                    className={`preview-dot ${
                      index === currentSlideIndex ? "active" : ""
                    }`}
                    onClick={() => setCurrentSlideIndex(index)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // 常规模式渲染
  return (
    <Layout className="h-screen overflow-hidden bg-[#f7f9fc]">
      {/* 顶部导航栏 */}
      <div className="flex justify-between items-center px-4 py-2.5 bg-white border-b border-gray-200 z-20 shadow-sm">
        <div className="flex items-center">
          <div className="text-lg font-medium px-2">
            {pageData.page?.title || "分享页面"}
          </div>
          {pageData.shareInfo && (
            <div className="text-sm text-gray-500 ml-2">
              分享于: {new Date(pageData.shareInfo.sharedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div className="flex items-center">
          {nodes.length > 0 && (
            <Tooltip title="幻灯片预览">
              <Button
                type="text"
                onClick={togglePreviewMode}
                icon={<PlayCircleOutlined />}
                className="flex items-center mx-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                幻灯片预览
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 主体内容区 */}
      <Layout className="flex-1 overflow-hidden">
        {/* 左侧缩略图面板 */}
        {showMinimap && (
          <Layout.Sider
            width={180}
            theme="light"
            className="bg-[#f7f9fc] border-r border-gray-200 overflow-hidden relative"
          >
            <SidebarMinimap
              nodes={nodes}
              activeNodeIndex={activeNodeIndex}
              onNodeSelect={handleNodeSelect}
              onReorderNodes={() => {}}
              readonly={true}
            />
            {/* 隐藏小地图的按钮 */}
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={toggleMinimap}
              className="absolute top-2 right-2 z-10 bg-white shadow-sm hover:bg-gray-100 border border-gray-200 rounded-full h-6 w-6 flex items-center justify-center p-0"
              size="small"
            />
          </Layout.Sider>
        )}

        {/* 中间内容区域 */}
        <Layout.Content
          className="relative overflow-y-auto overflow-x-hidden"
          style={{ backgroundColor: "#f7f9fc" }}
        >
          {/* 显示小地图的按钮 */}
          {!showMinimap && (
            <div className="absolute left-0 top-14 z-10">
              <Tooltip title="显示导航面板" placement="right">
                <Button
                  type="default"
                  icon={<UnorderedListOutlined />}
                  onClick={toggleMinimap}
                  className="bg-white shadow-md rounded-r-md border-l-0 h-8 hover:bg-gray-50 border border-gray-200"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                />
              </Tooltip>
            </div>
          )}

          {/* 展开全局侧边栏的按钮 */}
          {collapse && (
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={toggleSidebar}
              className="absolute top-4 right-4 z-10 bg-white shadow-sm hover:bg-gray-100 border border-gray-200 h-8 w-8 flex items-center justify-center p-0 rounded-md"
            />
          )}

          <div
            className="mx-auto py-4 px-8 mb-16"
            style={{ maxWidth: "900px" }}
          >
            {/* 页面描述区域 */}
            {pageData.page?.description && (
              <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
                <div className="text-gray-700 text-base">
                  {pageData.page.description}
                </div>
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
                        ? "shadow-[0_10px_30px_rgba(0,0,0,0.15)] transform -translate-y-1 border border-blue-400"
                        : "shadow-md hover:shadow-lg"
                    }`}
                  >
                    <NodeRenderer
                      node={node}
                      isActive={activeNodeIndex === index}
                      readonly={true}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300 shadow-sm">
                <div className="text-6xl text-gray-300 mb-6">
                  <FileTextOutlined />
                </div>
                <h3 className="text-xl font-medium text-gray-500 mb-3">
                  暂无内容
                </h3>
                <p className="text-gray-400 mb-6">
                  该分享页面没有任何内容
                </p>
              </div>
            )}

            <div className="h-24"></div>
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default SharePage;
