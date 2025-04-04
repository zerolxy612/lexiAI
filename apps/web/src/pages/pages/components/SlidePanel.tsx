import React from 'react'
import { Button, Empty, Card } from 'antd'
import { PlusOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from 'react-beautiful-dnd'
import { NodeRelationResponse } from '@refly-packages/ai-workspace-common/requests/types.gen'

interface SlidePanelProps {
  slides: NodeRelationResponse[]
  activeIndex: number
  onSelectSlide: (index: number) => void
  onReorderSlides: (newOrder: NodeRelationResponse[]) => void
}

function SlidePanel({ slides, activeIndex, onSelectSlide, onReorderSlides }: SlidePanelProps) {
  // 处理拖拽结束事件
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(slides)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    onReorderSlides(items)
  }

  // 生成幻灯片缩略图
  const renderSlideThumbnail = (node: NodeRelationResponse) => {
    // 根据节点类型生成不同的缩略图预览
    const { nodeType, nodeData } = node
    
    if (nodeType === 'text') {
      return (
        <div className="p-2 text-xs overflow-hidden" style={{ maxHeight: '50px' }}>
          {nodeData?.content ? (
            <div dangerouslySetInnerHTML={{ __html: nodeData.content }} />
          ) : (
            <span className="text-gray-400">空文本</span>
          )}
        </div>
      )
    }
    
    if (nodeType === 'image') {
      return nodeData?.url ? (
        <div className="h-16 flex items-center justify-center overflow-hidden">
          <img 
            src={nodeData.url} 
            alt="图片" 
            className="max-h-full object-contain" 
          />
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center bg-gray-100">
          <span className="text-gray-400">图片</span>
        </div>
      )
    }
    
    if (nodeType === 'chart') {
      return (
        <div className="h-16 flex items-center justify-center bg-blue-50">
          <span className="text-blue-400">图表</span>
        </div>
      )
    }
    
    // 默认缩略图
    return (
      <div className="h-16 flex items-center justify-center bg-gray-50">
        <span className="text-gray-400">{nodeType || '未知类型'}</span>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h3 className="font-medium mb-4">幻灯片</h3>
      
      {slides.length === 0 ? (
        <Empty 
          description="暂无幻灯片" 
          className="py-4" 
          imageStyle={{ height: 40 }} 
        />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="slides">
            {(provided: DroppableProvided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-3"
              >
                {slides.map((slide, index) => (
                  <Draggable 
                    key={slide.relationId || `slide-${index}`} 
                    draggableId={slide.relationId || `slide-${index}`} 
                    index={index}
                  >
                    {(provided: DraggableProvided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <Card
                          size="small"
                          className={`cursor-pointer transition hover:shadow ${
                            activeIndex === index ? 'border-blue-500 shadow-sm' : ''
                          }`}
                          onClick={() => onSelectSlide(index)}
                        >
                          <div className="text-xs text-gray-500 mb-1">
                            幻灯片 {index + 1} - {slide.nodeType}
                          </div>
                          {renderSlideThumbnail(slide)}
                        </Card>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
      
      <div className="mt-4 flex justify-center">
        <div className="flex space-x-2">
          <Button
            size="small"
            disabled={activeIndex <= 0}
            onClick={() => activeIndex > 0 && onSelectSlide(activeIndex - 1)}
            icon={<UpOutlined />}
          />
          <Button
            size="small"
            disabled={activeIndex >= slides.length - 1}
            onClick={() => activeIndex < slides.length - 1 && onSelectSlide(activeIndex + 1)}
            icon={<DownOutlined />}
          />
        </div>
      </div>
    </div>
  )
}

export default SlidePanel