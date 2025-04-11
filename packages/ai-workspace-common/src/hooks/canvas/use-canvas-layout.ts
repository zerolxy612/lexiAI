import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { CanvasNode } from '../../components/canvas/nodes';
import { Edge } from '@xyflow/react';
import { useCanvasSync } from './use-canvas-sync';

// Helper function to check if two rectangles overlap
const doRectanglesOverlap = (
  rect1: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  rect2: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
) => {
  // Ensure all values are numbers to prevent NaN issues
  const r1 = {
    x: Number(rect1?.x ?? 0),
    y: Number(rect1?.y ?? 0),
    width: Number(rect1?.width ?? 0),
    height: Number(rect1?.height ?? 0),
  };

  const r2 = {
    x: Number(rect2?.x ?? 0),
    y: Number(rect2?.y ?? 0),
    width: Number(rect2?.width ?? 0),
    height: Number(rect2?.height ?? 0),
  };

  // If any rectangle has zero width or height, they don't meaningfully overlap
  if (r1.width <= 0 || r1.height <= 0 || r2.width <= 0 || r2.height <= 0) {
    return false;
  }

  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
};

// Helper function to get node dimensions
const getNodeDimensions = (node: CanvasNode<any>) => {
  const defaultWidth = 288;
  const defaultHeight = 320;

  // Handle nullish or undefined node
  if (!node) {
    return { width: defaultWidth, height: defaultHeight };
  }

  return {
    width: node?.measured?.width ?? node?.width ?? defaultWidth,
    height: node?.measured?.height ?? node?.height ?? defaultHeight,
  };
};

// Helper function to resolve overlap between nodes
const resolveOverlap = (nodes: CanvasNode<any>[]) => {
  const resolvedNodes = [...nodes];
  const PADDING = 20; // Padding between nodes

  // First, create a map of group nodes and their boundaries
  const groupBoundaries = new Map<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  >();

  // Process group nodes first
  for (const node of resolvedNodes) {
    if (node?.type === 'group') {
      const { width, height } = getNodeDimensions(node);
      groupBoundaries.set(node.id, {
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        width,
        height,
      });
    }
  }

  // Function to check if a node overlaps with any group (except its parent)
  const nodeOverlapsWithGroup = (
    node: CanvasNode<any>,
    nodeRect: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ) => {
    if (!node) return { overlaps: false };

    for (const [groupId, groupRect] of groupBoundaries.entries()) {
      // Skip if the group is the node's parent or if group is not defined properly
      if (!groupRect || node.parentId === groupId) continue;

      if (doRectanglesOverlap(nodeRect, groupRect)) {
        return { overlaps: true, groupRect };
      }
    }
    return { overlaps: false };
  };

  // Function to check if a node overlaps with any other node
  const nodeOverlapsWithOtherNodes = (
    node: CanvasNode<any>,
    nodeRect: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
    index: number,
  ) => {
    for (let i = 0; i < resolvedNodes.length; i++) {
      if (i === index) continue; // Skip self

      const otherNode = resolvedNodes[i];

      // Skip undefined nodes or nodes in different hierarchies
      if (!otherNode || node.parentId !== otherNode.parentId) continue;

      // Skip if comparing a node with a group that's not its parent
      if (otherNode?.type === 'group' && node.parentId !== otherNode.id) continue;

      const otherDimensions = getNodeDimensions(otherNode);
      const otherRect = {
        x: otherNode.position?.x ?? 0,
        y: otherNode.position?.y ?? 0,
        width: otherDimensions.width,
        height: otherDimensions.height,
      };

      if (doRectanglesOverlap(nodeRect, otherRect)) {
        return { overlaps: true, otherRect };
      }
    }
    return { overlaps: false };
  };

  // Function to determine the best direction to move a node to resolve overlap
  const resolveOverlapDirection = (
    nodeRect: { x: number; y: number; width: number; height: number },
    otherRect: { x: number; y: number; width: number; height: number },
  ) => {
    // Calculate overlap amounts in each direction
    const overlapRight = nodeRect.x + nodeRect.width - otherRect.x;
    const overlapLeft = otherRect.x + otherRect.width - nodeRect.x;
    const overlapBottom = nodeRect.y + nodeRect.height - otherRect.y;
    const overlapTop = otherRect.y + otherRect.height - nodeRect.y;

    // Find the direction with minimum overlap
    const minOverlap = Math.min(overlapRight, overlapLeft, overlapBottom, overlapTop);

    // Choose direction based on minimum overlap
    if (minOverlap === overlapRight) {
      return { dx: -minOverlap - PADDING, dy: 0 };
    }

    if (minOverlap === overlapLeft) {
      return { dx: minOverlap + PADDING, dy: 0 };
    }

    if (minOverlap === overlapBottom) {
      return { dx: 0, dy: -minOverlap - PADDING };
    }

    return { dx: 0, dy: minOverlap + PADDING };
  };

  // Resolve overlaps iteratively
  const MAX_ITERATIONS = 5;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let overlapFound = false;

    // First, ensure that group nodes don't overlap with other groups
    for (let i = 0; i < resolvedNodes.length; i++) {
      const node = resolvedNodes[i];

      // Only process group nodes in this pass
      if (node?.type !== 'group') continue;

      const dimensions = getNodeDimensions(node);
      const nodeRect = {
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        width: dimensions.width,
        height: dimensions.height,
      };

      // Check overlap with other groups
      for (let j = 0; j < resolvedNodes.length; j++) {
        if (i === j) continue; // Skip self

        const otherNode = resolvedNodes[j];
        if (otherNode?.type !== 'group') continue; // Only check against groups

        // Skip hierarchical relationships
        if (node.parentId === otherNode.id || otherNode.parentId === node.id) continue;

        const otherDimensions = getNodeDimensions(otherNode);
        const otherRect = {
          x: otherNode.position?.x ?? 0,
          y: otherNode.position?.y ?? 0,
          width: otherDimensions.width,
          height: otherDimensions.height,
        };

        if (doRectanglesOverlap(nodeRect, otherRect)) {
          overlapFound = true;

          // Determine best direction to resolve overlap
          const { dx, dy } = resolveOverlapDirection(nodeRect, otherRect);

          // Move the group node
          resolvedNodes[i] = {
            ...node,
            position: {
              x: (node.position?.x ?? 0) + dx,
              y: (node.position?.y ?? 0) + dy,
            },
          };

          // Update group boundaries
          const { width, height } = getNodeDimensions(resolvedNodes[i]);
          groupBoundaries.set(node.id, {
            x: resolvedNodes[i].position?.x ?? 0,
            y: resolvedNodes[i].position?.y ?? 0,
            width,
            height,
          });

          break; // Process one overlap at a time
        }
      }
    }

    // Then, ensure that non-child nodes don't overlap with group nodes
    for (let i = 0; i < resolvedNodes.length; i++) {
      const node = resolvedNodes[i];

      // Skip group nodes in this pass
      if (node?.type === 'group') continue;

      const dimensions = getNodeDimensions(node);
      const nodeRect = {
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        width: dimensions.width,
        height: dimensions.height,
      };

      // Check overlap with groups
      const { overlaps: overlapsWithGroup, groupRect } = nodeOverlapsWithGroup(node, nodeRect);

      if (overlapsWithGroup && groupRect) {
        overlapFound = true;

        // Determine best direction to resolve overlap
        const { dx, dy } = resolveOverlapDirection(nodeRect, groupRect);

        resolvedNodes[i] = {
          ...node,
          position: {
            x: (node.position?.x ?? 0) + dx,
            y: (node.position?.y ?? 0) + dy,
          },
        };
      }
    }

    // Then, ensure regular nodes don't overlap with each other
    for (let i = 0; i < resolvedNodes.length; i++) {
      const node = resolvedNodes[i];

      // Skip group nodes in this pass
      if (node?.type === 'group') continue;

      const dimensions = getNodeDimensions(node);
      const nodeRect = {
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        width: dimensions.width,
        height: dimensions.height,
      };

      // Check overlap with other nodes
      const { overlaps: overlapsWithNode, otherRect } = nodeOverlapsWithOtherNodes(
        node,
        nodeRect,
        i,
      );

      if (overlapsWithNode && otherRect) {
        overlapFound = true;

        // Determine best direction to resolve overlap
        const { dx, dy } = resolveOverlapDirection(nodeRect, otherRect);

        resolvedNodes[i] = {
          ...node,
          position: {
            x: (node.position?.x ?? 0) + dx,
            y: (node.position?.y ?? 0) + dy,
          },
        };
      }
    }

    // Finally, update all group boundaries
    for (const node of resolvedNodes) {
      if (node?.type === 'group') {
        const { width, height } = getNodeDimensions(node);
        groupBoundaries.set(node.id, {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
          width,
          height,
        });
      }
    }

    if (!overlapFound) break;
  }

  return resolvedNodes;
};

const getLayoutedElements = (
  nodes: CanvasNode<any>[],
  edges: Edge[],
  options: { direction: 'TB' | 'LR' },
) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options.direction,
    nodesep: 100,
    ranksep: 80,
    marginx: 50,
    marginy: 50,
  });

  // First, add all edges to the graph
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Add all nodes to the graph
  for (const node of nodes) {
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? 288,
      height: node.measured?.height ?? 320,
    });
  }

  // Run the layout algorithm
  Dagre.layout(g);

  // Process nodes and preserve group node positions
  let layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);

    // If the node is inside a group, preserve its relative position
    if (node.parentId) {
      const parentNode = nodes.find((n) => n.id === node.parentId);
      if (parentNode) {
        // Keep the original relative position within the group
        return node;
      }
    }

    // For non-group nodes, apply the new layout position
    return {
      ...node,
      position: {
        x: nodeWithPosition?.x ?? node.position?.x ?? 0,
        y: nodeWithPosition?.y ?? node.position?.y ?? 0,
      },
    };
  });

  // Resolve any node overlaps after the initial layout
  layoutedNodes = resolveOverlap(layoutedNodes);

  return {
    nodes: layoutedNodes,
    edges,
  };
};

export const useCanvasLayout = () => {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow<CanvasNode<any>>();

  const { syncNodesToYDoc, syncEdgesToYDoc } = useCanvasSync();
  const { fitView } = useReactFlow();

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const nodes = getNodes();
      const edges = getEdges();
      const layouted = getLayoutedElements(nodes, edges, { direction });

      setNodes(layouted.nodes);
      setEdges(layouted.edges);
      syncNodesToYDoc(layouted.nodes);
      syncEdgesToYDoc(layouted.edges);

      window.requestAnimationFrame(() => {
        fitView({
          padding: 0.2,
          duration: 200,
          maxZoom: 1,
        });
      });
    },
    [fitView, setNodes, setEdges, syncNodesToYDoc, syncEdgesToYDoc],
  );

  return {
    onLayout,
  };
};
