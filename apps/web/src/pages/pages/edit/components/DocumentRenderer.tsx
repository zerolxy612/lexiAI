import React, { memo } from "react";
import { ArtifactRenderer, type NodeRelation } from "./ArtifactRenderer";

// 为了向后兼容，保留原始组件名称但使用统一组件
const DocumentRenderer = memo((props: { node: NodeRelation }) => {
  return <ArtifactRenderer node={props.node} type="document" />;
});

export { DocumentRenderer };
