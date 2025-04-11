import { useMemo, CSSProperties } from 'react';
import { Button, message, Tooltip } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { type NodeRelation } from './ArtifactRenderer';
import { NodeRenderer } from './NodeRenderer';
import { getNodeTitle } from '../utils/nodeUtils';
import { useTranslation } from 'react-i18next';

// Sidebar minimap component
function SidebarMinimap({
  nodes,
  activeNodeIndex,
  onNodeSelect,
  onReorderNodes,
  readonly = false,
}: {
  nodes: NodeRelation[];
  activeNodeIndex: number;
  onNodeSelect: (index: number) => void;
  onReorderNodes: (newOrder: NodeRelation[]) => void;
  readonly?: boolean;
}) {
  const { t } = useTranslation();

  // Handle drag end event
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const items = Array.from(nodes);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, reorderedItem);

    // Update node order
    onReorderNodes(items);

    // After dragging, set the selected node to the dragged node's new position
    onNodeSelect(destinationIndex);
  };

  const addNewSlide = () => {
    message.info(t('pages.sidebar.addNewSlideInDevelopment'));
  };

  // Cache thumbnail card style
  const thumbnailCardStyle = useMemo(
    (): CSSProperties => ({
      pointerEvents: 'none',
      transform: 'scale(0.4)',
      transformOrigin: 'top left',
      width: '250%',
      height: '250%',
      overflow: 'hidden',
    }),
    [],
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-600">
          {t('pages.components.navigationDirectory')}
        </span>
        {!readonly && (
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={addNewSlide} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {nodes.length === 0 ? (
          <div className="text-center p-6 text-gray-400">
            <div className="text-xs">{t('common.empty')}</div>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="sidebar-nodes" isDropDisabled={readonly}>
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {nodes.map((node, index) => (
                    <Draggable
                      key={node.relationId || `node-${index}`}
                      draggableId={node.relationId || `node-${index}`}
                      index={index}
                      isDragDisabled={readonly}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`relative rounded ${!readonly ? 'cursor-grab' : 'cursor-pointer'} transition border overflow-hidden shadow-sm hover:shadow-md ${
                            activeNodeIndex === index
                              ? 'ring-2 ring-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                          onClick={() => onNodeSelect(index)}
                        >
                          {/* Card title */}
                          <div className="py-1.5 px-2 bg-white border-b border-gray-100 z-10 relative flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-xs text-gray-500">{index + 1}.</span>
                              <Tooltip title={getNodeTitle(node)}>
                                <span className="truncate text-xs font-medium text-gray-600 max-w-[100px]">
                                  {getNodeTitle(node)}
                                </span>
                              </Tooltip>
                            </div>
                          </div>

                          {/* Content preview area */}
                          <div className="h-20 overflow-hidden relative bg-gray-50">
                            <div style={thumbnailCardStyle}>
                              <NodeRenderer node={node} isMinimap={true} />
                            </div>

                            {/* Gradient mask */}
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                          </div>
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
      </div>
    </div>
  );
}

export { SidebarMinimap };
