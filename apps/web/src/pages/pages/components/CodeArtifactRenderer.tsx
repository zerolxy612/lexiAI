import { memo } from 'react';
import { ArtifactRenderer, type NodeRelation } from './ArtifactRenderer';

// 为了向后兼容，保留原始组件名称但使用统一组件
const CodeArtifactRenderer = memo(
  (props: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isMinimap?: boolean;
  }) => {
    return (
      <ArtifactRenderer
        node={props.node}
        type="code"
        isFullscreen={props.isFullscreen}
        isMinimap={props.isMinimap}
      />
    );
  },
);

export { CodeArtifactRenderer };
