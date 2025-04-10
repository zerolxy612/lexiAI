import React, { useCallback, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { type NodeRelation } from './ArtifactRenderer';
import { NodeRenderer } from './NodeRenderer';

interface VirtualizedNodeListProps {
  nodes: NodeRelation[];
  activeNodeIndex: number;
  onNodeSelect: (index: number) => void;
  onDelete?: (nodeId: string) => void;
  onStartSlideshow?: (nodeId: string) => void;
  onWideMode?: (nodeId: string) => void;
}

/**
 * 虚拟化节点列表组件
 * 使用react-window实现虚拟滚动，只渲染可见区域的节点，提高性能
 */
const VirtualizedNodeList: React.FC<VirtualizedNodeListProps> = ({
  nodes,
  activeNodeIndex,
  onNodeSelect,
  onDelete,
  onStartSlideshow,
  onWideMode,
}) => {
  // 列表引用，用于滚动控制
  const listRef = useRef<List>(null);

  // 固定节点高度为400px加上间距
  const getNodeHeight = useCallback(() => {
    // 节点高度 + 间距
    return 400 + 24; // 400px高度 + 24px间距
  }, []);

  // 渲染单个节点
  const renderNode = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const node = nodes[index];
      if (!node) return null;

      const isActive = index === activeNodeIndex;

      return (
        <div
          style={{
            ...style,
            paddingTop: 12,
            paddingBottom: 12,
          }}
        >
          <div
            key={node.relationId || `content-${index}`}
            id={`content-block-${index}`}
            onClick={() => onNodeSelect(index)}
            className={`transition-all duration-300 h-[400px] rounded-lg bg-white ${
              isActive
                ? 'shadow-[0_10px_30px_rgba(0,0,0,0.15)] transform -translate-y-1 border border-blue-400'
                : 'shadow-md hover:shadow-lg'
            }`}
          >
            <NodeRenderer
              node={node}
              isFullscreen={false}
              isModal={false}
              isMinimap={false}
              onDelete={onDelete}
              onStartSlideshow={onStartSlideshow}
              onWideMode={onWideMode}
            />
          </div>
        </div>
      );
    },
    [nodes, activeNodeIndex, onNodeSelect, onDelete, onStartSlideshow, onWideMode],
  );

  // 使用AutoSizer确保List组件填充可用空间
  return (
    <div className="space-y-6">
      <AutoSizer disableHeight>
        {({ width }: { width: number }) => (
          <List
            ref={listRef}
            height={Math.max(nodes.length * getNodeHeight(), 500)}
            width={width}
            itemCount={nodes.length}
            itemSize={getNodeHeight}
            overscanCount={2} // 预渲染上下2个项目以提高滚动体验
            style={{ overflow: 'visible' }} // 确保阴影效果不被裁剪
          >
            {renderNode}
          </List>
        )}
      </AutoSizer>
    </div>
  );
};

export default VirtualizedNodeList;
