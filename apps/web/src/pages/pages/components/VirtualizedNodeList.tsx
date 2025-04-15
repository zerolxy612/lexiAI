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
            className={`
              transform transition-all duration-700 ease-in-out 
              h-[400px] rounded-lg bg-white 
              ${
                isActive
                  ? 'shadow-[0_8px_28px_rgba(59,130,246,0.08)] border border-blue-200 scale-[1.01] ring-1 ring-blue-100 ring-opacity-50'
                  : 'shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:border-gray-200'
              }
            `}
            style={{
              // Transition property, timing function, duration, and will-change property for smooth animation
              transitionProperty: 'all',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
              transitionDuration: '700ms',
              willChange: 'transform, box-shadow, border-color',
            }}
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
