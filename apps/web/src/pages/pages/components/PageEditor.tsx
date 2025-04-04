import React, { useState, useEffect } from 'react'
import { Layout, Button, Spin, message, Tabs, Space, Typography, Tooltip } from 'antd'
import {
  SaveOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SettingOutlined,
  DeleteOutlined,
  CopyOutlined
} from '@ant-design/icons'
import SlidePanel from './SlidePanel'
import NodeRenderer from './NodeRenderer'
import { useNavigate } from 'react-router-dom'
import { NodeRelationResponse } from '@refly-packages/ai-workspace-common/requests/types.gen'
import { fetchPageRelations, createNode, deleteNode, updateNodeRelations } from '../services/pageServices'

const { Header, Sider, Content } = Layout
const { Title } = Typography
const { TabPane } = Tabs

interface PageEditorProps {
  pageId: string
}

function PageEditor({ pageId }: PageEditorProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pageTitle, setPageTitle] = useState('未命名页面')
  const [slides, setSlides] = useState<NodeRelationResponse[]>([])
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [rightPanelTab, setRightPanelTab] = useState('style')

  // 获取页面数据
  useEffect(() => {
    const loadPageData = async () => {
      try {
        setLoading(true)
        const data = await fetchPageRelations(pageId)
        
        if (data) {
          // 设置页面标题
          setPageTitle(data.title || '未命名页面')
          
          // 设置幻灯片数据
          if (data.relations && Array.isArray(data.relations)) {
            setSlides(data.relations)
          }
        }
      } catch (error) {
        console.error('加载页面数据失败:', error)
        message.error('加载页面数据失败')
      } finally {
        setLoading(false)
      }
    }

    if (pageId) {
      loadPageData()
    }
  }, [pageId])

  // 处理保存
  const handleSave = async () => {
    try {
      setSaving(true)
      
      // 构建保存数据，使用orderIndex而不是order
      const relations = slides.map((slide, index) => ({
        ...slide,
        orderIndex: index,
      }))
      
      // 调用API保存数据
      await updateNodeRelations(pageId, relations)
      
      message.success('保存成功')
    } catch (error) {
      console.error('保存失败:', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 处理幻灯片重新排序
  const handleReorderSlides = (newOrder: NodeRelationResponse[]) => {
    setSlides(newOrder)
  }

  // 添加新幻灯片
  const handleAddSlide = async () => {
    try {
      // 创建默认文本节点
      const newNode = await createNode(pageId, 'text', {
        content: '<p>在此输入文本内容</p>'
      })
      
      if (newNode) {
        // 添加到幻灯片列表
        const updatedSlides = [...slides, newNode]
        setSlides(updatedSlides)
        
        // 切换到新创建的幻灯片
        setActiveSlideIndex(updatedSlides.length - 1)
        
        message.success('添加幻灯片成功')
      }
    } catch (error) {
      console.error('添加幻灯片失败:', error)
      message.error('添加幻灯片失败')
    }
  }

  // 删除当前幻灯片
  const handleDeleteSlide = async () => {
    if (slides.length === 0 || activeSlideIndex < 0) return
    
    try {
      const slideToDelete = slides[activeSlideIndex]
      
      // 调用API删除节点
      await deleteNode(slideToDelete.nodeId)
      
      // 更新本地状态
      const updatedSlides = slides.filter((_, index) => index !== activeSlideIndex)
      setSlides(updatedSlides)
      
      // 调整当前激活的幻灯片索引
      if (activeSlideIndex >= updatedSlides.length) {
        setActiveSlideIndex(Math.max(0, updatedSlides.length - 1))
      }
      
      message.success('删除幻灯片成功')
    } catch (error) {
      console.error('删除幻灯片失败:', error)
      message.error('删除幻灯片失败')
    }
  }

  // 获取当前活动幻灯片
  const activeSlide = slides[activeSlideIndex]

  // 处理预览
  const handlePreview = () => {
    if (pageId) {
      navigate(`/pages/preview/${pageId}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <Layout className="min-h-screen">
      <Header className="bg-white shadow-sm px-6 flex items-center justify-between">
        <div>
          <Title level={4} className="m-0">{pageTitle}</Title>
        </div>
        <div className="flex items-center space-x-3">
          <Tooltip title="预览">
            <Button 
              icon={<PlayCircleOutlined />} 
              onClick={handlePreview}
            >
              预览
            </Button>
          </Tooltip>
          <Tooltip title="保存">
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              loading={saving}
              onClick={handleSave}
            >
              保存
            </Button>
          </Tooltip>
        </div>
      </Header>
      
      <Layout>
        {/* 左侧幻灯片面板 */}
        <Sider width={220} theme="light" className="border-r">
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <SlidePanel 
                slides={slides}
                activeIndex={activeSlideIndex}
                onSelectSlide={setActiveSlideIndex}
                onReorderSlides={handleReorderSlides}
              />
            </div>
            
            <div className="p-4 border-t">
              <Space className="w-full justify-between">
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={handleAddSlide}
                >
                  添加
                </Button>
                <Button 
                  danger 
                  icon={<DeleteOutlined />}
                  disabled={slides.length === 0}
                  onClick={handleDeleteSlide}
                >
                  删除
                </Button>
              </Space>
            </div>
          </div>
        </Sider>
        
        {/* 中间内容区域 */}
        <Content className="p-6 bg-gray-50">
          <div className="bg-white rounded-lg shadow-sm min-h-[600px] max-w-5xl mx-auto overflow-hidden">
            {activeSlide ? (
              <NodeRenderer node={activeSlide} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>暂无内容</p>
              </div>
            )}
          </div>
        </Content>
        
        {/* 右侧属性面板 */}
        <Sider width={300} theme="light" className="border-l">
          <Tabs 
            activeKey={rightPanelTab} 
            onChange={setRightPanelTab}
            className="px-4 pt-4"
          >
            <TabPane tab="样式" key="style">
              <div className="p-4">
                <p className="text-gray-500 text-center py-8">
                  {activeSlide ? '样式编辑区域' : '请选择一个幻灯片'}
                </p>
              </div>
            </TabPane>
            <TabPane tab="设置" key="settings">
              <div className="p-4">
                <p className="text-gray-500 text-center py-8">
                  {activeSlide ? '节点设置区域' : '请选择一个幻灯片'}
                </p>
              </div>
            </TabPane>
          </Tabs>
        </Sider>
      </Layout>
    </Layout>
  )
}

export default PageEditor 