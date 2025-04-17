import { memo, useMemo } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { useGetResourceDetail } from '@refly-packages/ai-workspace-common/queries';
import { Skeleton } from 'antd';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';

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
    const resourceId = node.nodeData?.entityId ?? '';
    const { data, isLoading } = useGetResourceDetail({ query: { resourceId } }, undefined, {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !!node.nodeData?.entityId,
    });
    const resourceDetail = useMemo(() => data?.data || null, [data]);

    return (
      <div
        className={`h-full bg-white ${!isFullscreen ? 'rounded' : 'w-full'} ${
          isMinimap ? 'p-1' : ''
        }`}
      >
        <div className="h-full w-full overflow-auto">
          {isLoading ? (
            <Skeleton active style={{ marginTop: 24 }} />
          ) : (
            <Markdown content={resourceDetail?.content || ''} className="text-base p-4" />
          )}
        </div>
      </div>
    );
  },
);

export { ResourceRenderer };
