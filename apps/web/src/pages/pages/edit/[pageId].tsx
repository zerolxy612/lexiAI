import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Form, Input, Button, Spin, message, Layout, Tooltip } from "antd";
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
} from "@ant-design/icons";
import { useSiderStoreShallow } from "@refly-packages/ai-workspace-common/stores/sider";
import { NodeRenderer } from "./components/NodeRenderer";
import { SidebarMinimap } from "./components/SidebarMinimap";
import {
  type NodeRelation,
  type NodeData,
} from "./components/ArtifactRenderer";

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
      </Layout>
    </Layout>
  );
}

export default PageEdit;
