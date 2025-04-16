import { memo } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { ResourceView } from '@refly-packages/ai-workspace-common/components/resource-view';

const ResourceRenderer = memo(
  ({
    node,
    isFullscreen = false,
    isMinimap = false,
  }: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isMinimap?: boolean;
  }) => {
    return (
      <div
        className={`h-full bg-white ${!isFullscreen ? 'rounded' : 'w-full'} ${
          isMinimap ? 'p-1' : ''
        }`}
      >
        <div className="h-full w-full overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto p-4">
            <ResourceView
              resourceId={node.nodeData?.entityId ?? ''}
              nodeId={node.nodeId}
              deckSize={0}
              setDeckSize={() => {}}
            />
          </div>
        </div>
      </div>
    );
  },
);

export { ResourceRenderer };
