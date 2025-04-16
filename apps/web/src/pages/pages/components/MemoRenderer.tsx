import { memo } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';

const MemoRenderer = memo(
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
            <Markdown content={node.nodeData?.contentPreview} />
          </div>
        </div>
      </div>
    );
  },
);

export { MemoRenderer };
