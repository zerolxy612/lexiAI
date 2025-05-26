import { FC, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { NodeActionMenu } from '../node-action-menu';
import { CanvasNodeType } from '@refly/openapi-schema';
import { NodeContextMenuSource } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { CreateNodeMenu } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/create-node-menu';

interface NodeContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  nodeId: string;
  nodeType: CanvasNodeType;
  source?: NodeContextMenuSource;
  setOpen: (open: boolean) => void;
}

export const NodeContextMenu: FC<NodeContextMenuProps> = ({
  open,
  position,
  nodeId,
  nodeType,
  source,
  setOpen,
}) => {
  const reactFlowInstance = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999]"
      style={{
        left: `${reactFlowInstance.flowToScreenPosition(position).x}px`,
        top: `${reactFlowInstance.flowToScreenPosition(position).y}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {source === 'handle' ? (
        <CreateNodeMenu nodeId={nodeId} nodeType={nodeType} onClose={() => setOpen(false)} />
      ) : (
        <NodeActionMenu
          nodeId={nodeId}
          nodeType={nodeType}
          onClose={() => setOpen(false)}
          hasFixedHeight
        />
      )}
    </div>
  );
};
