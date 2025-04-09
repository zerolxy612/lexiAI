import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Form,
  Input,
  Button,
  Spin,
  message,
  Layout,
  Tooltip,
  Modal,
} from "antd";
import {
  useGetPageDetail,
  useUpdatePage,
  useDeletePageNode,
} from "@refly-packages/ai-workspace-common/queries/queries";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  LeftOutlined,
  UnorderedListOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  LeftCircleOutlined,
  RightCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useSiderStoreShallow } from "@refly-packages/ai-workspace-common/stores/sider";
import { NodeRenderer } from "./components/NodeRenderer";
import { SidebarMinimap } from "./components/SidebarMinimap";
import {
  type NodeRelation,
  type NodeData,
} from "./components/ArtifactRenderer";
import "./styles/preview-mode.css";
import axios from "axios";

interface PageDetailType {
  title: string;
  description?: string;
  nodeRelations?: NodeRelation[];
}

function PageEdit() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [formChanged, setFormChanged] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [nodes, setNodes] = useState<NodeRelation[]>([]);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showPreviewMinimap, setShowPreviewMinimap] = useState(false);
  const [wideMode, setWideMode] = useState<{ isActive: boolean; nodeId: string | null }>({ isActive: false, nodeId: null });
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [isDeletingNode, setIsDeletingNode] = useState(false);
  const [uiState, setUiState] = useState({
    isIdle: false,
    showNav: false
  });
  const timersRef = useRef<{
    idle: NodeJS.Timeout | null;
    nav: NodeJS.Timeout | null;
    minimap: NodeJS.Timeout | null;
  }>({ idle: null, nav: null, minimap: null });

  // 获取侧边栏状态
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  // 强制默认隐藏侧边栏
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // UI 交互处理方法
  const toggleSidebar = useCallback(
    () => setCollapse(!collapse),
    [collapse, setCollapse]
  );
  const toggleMinimap = useCallback(
    () => setShowMinimap(!showMinimap),
    [showMinimap]
  );
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode) setCurrentSlideIndex(0);
  }, [isPreviewMode]);

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

  // 获取页面详情
  const {
    data: pageDetailResponse,
    isLoading: isLoadingPage,
    error: pageLoadError,
  } = useGetPageDetail({ path: { pageId: pageId || "" } }, undefined, {
    enabled: !!pageId,
  });

  // 更新页面Hook
  const { mutate: updatePage, isPending: isUpdating } = useUpdatePage();

  // 从响应中提取页面数据
  const pageDetail = pageDetailResponse?.data as PageDetailType | undefined;

  // 获取节点数据
  const nodeRelations = useMemo<NodeRelation[]>(() => {
    if (!pageDetail?.nodeRelations) return [];

    // 注: 原本有过滤逻辑，但实际上不过滤任何内容 (node.nodeType === "codeArtifact" || 1)
    const filteredNodes = pageDetail.nodeRelations;
    setNodes(filteredNodes);
    return filteredNodes;
  }, [pageDetail?.nodeRelations]);

  // 当页面数据加载后填充表单
  useEffect(() => {
    if (pageDetail) {
      form.setFieldsValue({
        title: pageDetail.title,
        description: pageDetail.description || "",
      });
    }
  }, [pageDetail, form]);

  // 提交表单处理函数
  const handleSubmit = (values: any) => {
    if (!pageId) return;

    const updateData = {
      path: { pageId },
      body: {
        title: values.title,
        description: values.description,
      } as any,
    };

    // 如果有节点数据，仅更新节点顺序
    if (nodes.length > 0) {
      updateData.body.nodeRelationOrders = nodes.map(
        (node: NodeRelation, index: number) => ({
          relationId: node.relationId,
          orderIndex: index,
        })
      );
    }

    updatePage(updateData, {
      onSuccess: () => {
        message.success("页面更新成功");
        setFormChanged(false);
      },
      onError: (error) => {
        console.error("更新页面失败:", error);
        message.error("保存失败，请稍后重试");
      },
    });
  };

  // 表单与导航处理
  const handleBack = () => navigate("/pages");
  const handleFormChange = () => setFormChanged(true);

  // 处理节点选择
  const handleNodeSelect = (index: number) => {
    setActiveNodeIndex(index);

    // 滚动到对应的内容块
    const element = document.getElementById(`content-block-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // 处理节点重新排序
  const handleReorderNodes = (newOrder: NodeRelation[]) => {
    setNodes(
      newOrder.map((node, index) => ({
        ...node,
        orderIndex: index,
      }))
    );
    setFormChanged(true);
  };

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

  // 清理所有定时器
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

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

  // 处理删除节点
  const deletePageNodeMutation = useDeletePageNode();

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!pageId) return;

      try {
        setIsDeletingNode(true);

        // 使用 useDeletePageNode 删除节点
        await deletePageNodeMutation.mutateAsync({
          path: {
            pageId,
            nodeId,
          },
        });

        // 从本地状态中移除节点
        setNodes((prevNodes) =>
          prevNodes.filter((node) => node.nodeId !== nodeId)
        );

        // 如果删除的是当前选中的节点，选择第一个节点
        if (nodes[activeNodeIndex]?.nodeId === nodeId) {
          setActiveNodeIndex(0);
        }

        message.success("节点删除成功");
        setFormChanged(true);
      } catch (error) {
        console.error("删除节点失败:", error);
        message.error("删除节点失败，请重试");
      } finally {
        setIsDeletingNode(false);
      }
    },
    [pageId, activeNodeIndex, nodes, deletePageNodeMutation]
  );

  // 处理从指定节点开始幻灯片预览
  const handleStartSlideshow = useCallback(
    (nodeId: string) => {
      // 查找点击的节点索引
      const nodeIndex = nodes.findIndex((node) => node.nodeId === nodeId);
      if (nodeIndex !== -1) {
        // 设置当前幻灯片索引为找到的节点索引
        setCurrentSlideIndex(nodeIndex);
        // 打开预览模式
        setIsPreviewMode(true);
      }
    },
    [nodes]
  );

  // 宽屏模式处理
  const handleWideMode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.nodeId === nodeId);
      if (node) {
        setWideMode({ isActive: true, nodeId });
      }
    },
    [nodes]
  );

  // 关闭宽屏模式
  const handleCloseWideMode = useCallback(() => {
    setWideMode({ isActive: false, nodeId: null });
  }, []);

  // 宽屏模式键盘快捷键
  useEffect(() => {
    if (!wideMode.isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseWideMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [wideMode.isActive, handleCloseWideMode]);

  // 加载状态
  if (isLoadingPage) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Spin size="large" tip="加载页面中..." />
      </div>
    );
  }

  // 错误状态
  if (pageLoadError || !pageDetail) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-red-500 mb-4">无法加载页面信息</p>
          <Button onClick={handleBack} icon={<ArrowLeftOutlined />}>
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Layout className="h-screen overflow-hidden bg-[#f7f9fc]">
      {/* 顶部导航栏 */}
      <div className="flex justify-between items-center px-4 py-2.5 bg-white border-b border-gray-200 z-20 shadow-sm">
        <div className="flex items-center">
          <Button
            onClick={handleBack}
            icon={<ArrowLeftOutlined />}
            type="text"
            className="mr-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          />
          <Form
            form={form}
            layout="inline"
            onFinish={handleSubmit}
            onValuesChange={handleFormChange}
            initialValues={{
              title: pageDetail.title,
              description: pageDetail.description || "",
            }}
            className="flex items-center"
          >
            <Form.Item
              name="title"
              rules={[{ required: true, message: "请输入页面标题" }]}
              className="mb-0"
            >
              <Input
                placeholder="请输入页面标题"
                bordered={false}
                className="text-lg font-medium px-0"
              />
            </Form.Item>
          </Form>
        </div>

        <div className="flex items-center">
          {nodes.length > 0 && (
            <Tooltip title="预览模式">
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
          {formChanged && (
            <Button
              type="primary"
              htmlType="submit"
              onClick={() => form.submit()}
              loading={isUpdating}
              icon={<SaveOutlined />}
              className="flex items-center bg-blue-600 hover:bg-blue-700 border-none"
            >
              保存更改
            </Button>
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
              onReorderNodes={handleReorderNodes}
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
              <Tooltip title="显示代码组件面板" placement="right">
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
            {pageDetail.description && (
              <div className="mb-6">
                <Form
                  form={form}
                  onFinish={handleSubmit}
                  onValuesChange={handleFormChange}
                >
                  <Form.Item name="description">
                    <Input.TextArea
                      placeholder="添加页面描述..."
                      autoSize={{ minRows: 2, maxRows: 4 }}
                      bordered={false}
                      className="text-gray-700 text-base resize-none bg-transparent"
                    />
                  </Form.Item>
                </Form>
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
                      onDelete={handleDeleteNode}
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
                <h3 className="text-xl font-medium text-gray-500 mb-3">
                  暂无代码组件
                </h3>
                <p className="text-gray-400 mb-6">
                  {showMinimap
                    ? '点击左侧"添加代码组件"按钮添加内容'
                    : "点击侧边按钮打开代码组件面板，然后添加内容"}
                </p>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    if (!showMinimap) {
                      setShowMinimap(true);
                      setTimeout(() => {
                        message.info("请使用左侧面板添加代码组件");
                      }, 300);
                    } else {
                      message.info("添加新代码组件功能开发中");
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 border-none shadow"
                >
                  添加代码组件
                </Button>
              </div>
            )}

            <div className="h-24"></div>
          </div>
        </Layout.Content>

        {/* 预览模式弹窗 */}
        <Modal
          open={isPreviewMode}
          footer={null}
          closable={false}
          onCancel={togglePreviewMode}
          width="100%"
          style={{ top: 0, padding: 0, maxWidth: "100vw" }}
          bodyStyle={{ height: "100vh", padding: 0, overflow: "hidden" }}
          className="preview-modal"
          maskStyle={{ background: "rgba(0, 0, 0, 0.85)" }}
          wrapClassName="preview-modal-wrap"
        >
          <div className="bg-black h-full w-full flex flex-col">
            {/* 预览内容区域 */}
            <div
              ref={previewContentRef}
              className={`preview-content-container relative ${uiState.isIdle ? "idle" : ""} ${uiState.showNav ? "show-nav" : ""}`}
              onMouseMove={handlePreviewMouseMove}
            >
              {/* 预览导航栏 - 默认隐藏 */}
              <div className="preview-header" onMouseEnter={handleUiInteraction}>
                <div className="preview-header-title">
                  {form.getFieldValue("title")}
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
                {nodes.length > 0 ? (
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
                ) : (
                  <div className="text-center text-white">
                    <p>没有可用的内容来预览</p>
                  </div>
                )}
              </div>

              {/* 滑动提示 - 只在移动设备上显示 */}
              {nodes.length > 1 && (
                <div className="swipe-hint md:hidden">
                  左右滑动切换幻灯片 ({currentSlideIndex + 1}/{nodes.length})
                </div>
              )}

              {/* 预览模式底部进度指示器 - 默认隐藏 */}
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
          </div>
        </Modal>

        {/* 宽屏模式弹窗 */}
        <Modal
          open={wideMode.isActive}
          footer={null}
          onCancel={handleCloseWideMode}
          width="85%"
          style={{ top: 20 }}
          bodyStyle={{
            maxHeight: "calc(100vh - 100px)",
            padding: 0,
            overflow: "hidden",
          }}
          className="wide-mode-modal"
          closeIcon={
            <CloseCircleOutlined className="text-gray-500 hover:text-red-500" />
          }
          maskStyle={{ background: "rgba(0, 0, 0, 0.65)" }}
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
                    onDelete={handleDeleteNode}
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
      </Layout>
    </Layout>
  );
}

export default PageEdit;
