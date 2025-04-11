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
 * Virtualized node list component
 * Uses react-window to implement virtual scrolling, only rendering visible areas of nodes to improve performance
 */
const VirtualizedNodeList: React.FC<VirtualizedNodeListProps> = ({
  nodes,
  activeNodeIndex,
  onNodeSelect,
  onDelete,
  onStartSlideshow,
  onWideMode,
}) => {
  // List reference for scroll control
  const listRef = useRef<List>(null);

  // Fixed node height of 400px plus spacing
  const getNodeHeight = useCallback(() => {
    // Node height + spacing
    return 400 + 24; // 400px height + 24px spacing
  }, []);

  // Render single node
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

  // Use AutoSizer to ensure List component fills available space
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
            overscanCount={2} // Pre-render 2 items above and below to improve scrolling experience
            style={{ overflow: 'visible' }} // Ensure shadow effects aren't clipped
          >
            {renderNode}
          </List>
        )}
      </AutoSizer>
    </div>
  );
};

export default VirtualizedNodeList;
