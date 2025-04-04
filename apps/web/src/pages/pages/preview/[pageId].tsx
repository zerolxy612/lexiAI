import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useGetPageDetail } from '@refly-packages/ai-workspace-common/queries/queries'
import NodeRenderer from '../components/NodeRenderer'
import type { PageDetailResponse } from '@refly-packages/ai-workspace-common/requests/types.gen'

// 节点关系接口
interface NodeRelation {
  nodeId: string;
  nodeType: string;
  entityId: string;
  orderIndex: number;
  nodeData: any;
  [key: string]: any;
}

function PreviewPage() {
  const params = useParams()
  const navigate = useNavigate()
  const pageId = params.pageId
  
  const [pageTitle, setPageTitle] = useState('页面预览')
  const [slides, setSlides] = useState<NodeRelation[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  // 使用useGetPageDetail获取页面数据
  const { data, isLoading, error } = useGetPageDetail(
    { path: { pageId: pageId || '' } },
    undefined,
    {
      enabled: !!pageId
    }
  )

  // 当数据加载完成后更新状态
  useEffect(() => {
    if (data && data.success && data.data) {
      // 设置页面标题
      setPageTitle(data.data.title || '未命名页面')
      
      // 将API响应转为any类型来处理nodeRelations字段
      const pageData = data.data as any;
      
      // API响应中包含nodeRelations数组，需要转换为前端使用的NodeRelation格式
      if (pageData.nodeRelations && Array.isArray(pageData.nodeRelations)) {
        setSlides(pageData.nodeRelations.map((relation: any) => ({
          nodeId: relation.node_id,
          nodeType: relation.node_type,
          entityId: relation.entity_id,
          orderIndex: relation.order_index,
          nodeData: typeof relation.node_data === 'string' 
            ? JSON.parse(relation.node_data) 
            : relation.node_data,
          // 保留原始属性
          ...relation
        })))
      }
    } else if (data && !data.success) {
      message.error(`加载页面预览数据失败: ${data.errMsg || '未知错误'}`)
    }
  }, [data])

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        // 下一页
        setCurrentSlideIndex(prev => (prev < slides.length - 1) ? prev + 1 : prev)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        // 上一页
        setCurrentSlideIndex(prev => (prev > 0) ? prev - 1 : 0)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [slides.length])

  // 返回编辑页面
  const handleBackToEdit = () => {
    navigate(`/pages/edit/${pageId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-500">
          <p>加载页面数据失败</p>
          <Button onClick={() => navigate('/pages')} className="mt-4">
            返回页面列表
          </Button>
        </div>
      </div>
    )
  }

  const currentSlide = slides[currentSlideIndex]

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      {/* 顶部工具栏 */}
      <header className="flex justify-between items-center px-6 py-3 bg-gray-900">
        <div className="flex items-center space-x-3">
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBackToEdit}
            className="text-white hover:text-blue-400"
          >
            返回编辑
          </Button>
          <h1 className="text-lg font-medium">{pageTitle}</h1>
        </div>
        <div className="text-sm">
          {currentSlideIndex + 1} / {slides.length}
        </div>
      </header>

      {/* 幻灯片显示区域 */}
      <div 
        className="flex-1 overflow-hidden flex items-center justify-center p-4"
        onClick={() => setCurrentSlideIndex(prev => (prev < slides.length - 1) ? prev + 1 : prev)}
      >
        {slides.length > 0 ? (
          <div className="max-w-4xl w-full h-full bg-white rounded-lg shadow-lg flex items-center justify-center overflow-hidden">
            {currentSlide ? (
              <NodeRenderer node={currentSlide} />
            ) : (
              <div className="text-gray-500">无效的幻灯片</div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <p>该页面没有内容</p>
          </div>
        )}
      </div>

      {/* 底部导航控制区 */}
      <footer className="p-4 flex justify-center items-center space-x-4">
        <Button 
          disabled={currentSlideIndex <= 0}
          onClick={() => setCurrentSlideIndex(prev => prev - 1)}
        >
          上一页
        </Button>
        <Button 
          type="primary"
          disabled={currentSlideIndex >= slides.length - 1}
          onClick={() => setCurrentSlideIndex(prev => prev + 1)}
        >
          下一页
        </Button>
      </footer>
    </div>
  )
}

export default PreviewPage 