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
  FullscreenOutlined,
  LeftCircleOutlined,
  RightCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useSiderStoreShallow } from "@refly-packages/ai-workspace-common/stores/sider";
import { NodeRenderer } from "./components/NodeRenderer";
import { MiniNodeRenderer } from "./components/MiniNodeRenderer";
import { SidebarMinimap } from "./components/SidebarMinimap";
import {
  type NodeRelation,
  type NodeData,
} from "./components/ArtifactRenderer";
import "./styles/preview-mode.css";

interface PageDetailType {
  title: string;
  description?: string;
  nodeRelations?: NodeRelation[];
}

// 页面编辑组件
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
  const previewMinimapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 获取侧边栏状态
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  // 强制默认隐藏侧边栏
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // 切换侧边栏显示隐藏
  const toggleSidebar = useCallback(() => {
    setCollapse(!collapse);
  }, [collapse, setCollapse]);

  // 切换小地图显示隐藏
  const toggleMinimap = useCallback(() => {
    setShowMinimap(!showMinimap);
  }, [showMinimap]);

  // 切换预览模式
  const togglePreviewMode = useCallback(() => {
    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode) {
      setCurrentSlideIndex(0);
    }
  }, [isPreviewMode]);

  // 下一张幻灯片
  const nextSlide = useCallback(() => {
    if (currentSlideIndex < nodes.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  }, [currentSlideIndex, nodes.length]);

  // 上一张幻灯片
  const prevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  }, [currentSlideIndex]);

  // 键盘导航控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPreviewMode) return;

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
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
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

  // 获取节点数据并过滤出 codeArtifact 类型
  const nodeRelations = useMemo<NodeRelation[]>(() => {
    if (!pageDetail?.nodeRelations) {
      return [];
    }

    // 过滤出 codeArtifact 类型的节点
    const filteredNodes = pageDetail.nodeRelations.filter(
      (node) =>
        node.nodeType === "codeArtifact" ||
        // 不过滤
        1
    );

    // 更新全局状态
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

  // 返回列表页
  const handleBack = () => {
    navigate("/pages");
  };

  // 表单变化处理
  const handleFormChange = () => {
    setFormChanged(true);
  };

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
    // 更新节点顺序
    setNodes(
      newOrder.map((node, index) => ({
        ...node,
        orderIndex: index,
      }))
    );
    setFormChanged(true);
  };

  // 预览模式内容
  const previewContentRef = useRef<HTMLDivElement>(null);

  // 添加触摸手势支持
  useEffect(() => {
    if (!isPreviewMode || !previewContentRef.current) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      // 向左滑动，显示下一页
      if (touchEndX < touchStartX - swipeThreshold) {
        nextSlide();
      }
      // 向右滑动，显示上一页
      if (touchEndX > touchStartX + swipeThreshold) {
        prevSlide();
      }
    };

    const element = previewContentRef.current;
    element.addEventListener("touchstart", handleTouchStart);
    element.addEventListener("touchend", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPreviewMode, nextSlide, prevSlide]);

  // 处理预览模式下的小地图显示与隐藏
  const handlePreviewMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPreviewMode) return;

      // 当鼠标移动到屏幕左侧边缘时显示小地图
      if (e.clientX < 20) {
        setShowPreviewMinimap(true);
        // 清除之前的定时器
        if (previewMinimapTimeoutRef.current) {
          clearTimeout(previewMinimapTimeoutRef.current);
          previewMinimapTimeoutRef.current = null;
        }
      }
    },
    [isPreviewMode]
  );

  // 处理小地图区域的鼠标进入事件，保持小地图显示
  const handleMinimapMouseEnter = useCallback(() => {
    if (previewMinimapTimeoutRef.current) {
      clearTimeout(previewMinimapTimeoutRef.current);
      previewMinimapTimeoutRef.current = null;
    }
  }, []);

  // 处理小地图区域的鼠标离开事件，立即隐藏小地图
  const handleMinimapMouseLeave = useCallback(() => {
    setShowPreviewMinimap(false);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (previewMinimapTimeoutRef.current) {
        clearTimeout(previewMinimapTimeoutRef.current);
      }
    };
  }, []);

  // 选择幻灯片并更新当前索引
  const handlePreviewSlideSelect = useCallback((index: number) => {
    setCurrentSlideIndex(index);
  }, []);

  // 点击左侧提示处理函数
  const handleSideHintClick = useCallback(() => {
    setShowPreviewMinimap(true);
  }, []);

  // 获取节点标题
  const getNodeTitle = useCallback((node: NodeRelation) => {
    // 尝试从nodeData.title获取标题
    if (node.nodeData?.title) {
      return node.nodeData.title;
    }

    // 尝试从nodeData.metadata.title获取标题
    if (node.nodeData?.metadata?.title) {
      return node.nodeData.metadata.title;
    }

    // 根据节点类型返回默认标题
    if (node.nodeType === "codeArtifact") {
      return "代码组件";
    } else if (node.nodeType === "document") {
      return "文档组件";
    } else if (node.nodeType === "skillResponse") {
      return "技能响应";
    }

    return `幻灯片 ${node.orderIndex + 1}`;
  }, []);

  if (isLoadingPage) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Spin size="large" tip="加载页面中..." />
      </div>
    );
  }

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
        {/* 左侧缩略图面板 - 根据showMinimap状态控制显示/隐藏 */}
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
          style={{
            backgroundColor: "#f7f9fc",
          }}
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

            {/* 底部留白区域 */}
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
            {/* 预览导航栏 */}
            <div className="flex justify-between items-center px-4 py-3 bg-black text-white">
              <div className="text-lg font-medium truncate max-w-[calc(100%-180px)]">
                {form.getFieldValue("title")} - 幻灯片 {currentSlideIndex + 1}/
                {nodes.length}
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  type="text"
                  icon={<LeftCircleOutlined />}
                  onClick={prevSlide}
                  disabled={currentSlideIndex <= 0}
                  className="text-white hover:text-blue-300"
                />
                <Button
                  type="text"
                  icon={<RightCircleOutlined />}
                  onClick={nextSlide}
                  disabled={currentSlideIndex >= nodes.length - 1}
                  className="text-white hover:text-blue-300"
                />
                <Button
                  type="text"
                  icon={<CloseCircleOutlined />}
                  onClick={togglePreviewMode}
                  className="text-white hover:text-red-300"
                />
              </div>
            </div>

            {/* 预览内容区域 - 完全全屏 */}
            <div
              ref={previewContentRef}
              className="flex-1 flex items-stretch justify-center bg-black relative"
              onMouseMove={handlePreviewMouseMove}
            >
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
                        {/* 透明遮罩层，确保用户只能点击整个卡片 */}
                        <div className="absolute inset-0 bg-transparent" />
                      </div>
                      <div className="preview-minimap-title">
                        {getNodeTitle(node)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
                  />
                </div>
              ) : (
                <div className="text-center text-white">
                  <p>没有可用的内容来预览</p>
                </div>
              )}

              {/* 滑动提示 - 只在移动设备上显示 */}
              {nodes.length > 1 && (
                <div className="swipe-hint md:hidden">
                  左右滑动切换幻灯片 ({currentSlideIndex + 1}/{nodes.length})
                </div>
              )}
            </div>

            {/* 预览模式底部进度指示器 */}
            {nodes.length > 0 && (
              <div className="bg-black px-4 py-2 flex justify-center">
                <div className="flex space-x-2">
                  {nodes.map((_, index) => (
                    <div
                      key={`preview-dot-${index}`}
                      className={`h-2 w-2 rounded-full cursor-pointer ${
                        index === currentSlideIndex
                          ? "bg-blue-500"
                          : "bg-gray-500 hover:bg-gray-400"
                      }`}
                      onClick={() => setCurrentSlideIndex(index)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      </Layout>
    </Layout>
  );
}

export default PageEdit;
