import React, { memo } from "react";
import { type NodeRelation } from "./ArtifactRenderer";
import { CodeArtifactRenderer } from "./CodeArtifactRenderer";
import { DocumentRenderer } from "./DocumentRenderer";
import { SkillResponseRenderer } from "./SkillResponseRenderer";

// 内容渲染组件
const NodeRenderer = memo(
  ({ node, isActive = false }: { node: NodeRelation; isActive?: boolean }) => {
    // 只渲染 codeArtifact 类型
    if (node.nodeType === "codeArtifact") {
      return <CodeArtifactRenderer node={node} />;
    }

    // 只渲染 document 类型
    if (node.nodeType === "document") {
      return <DocumentRenderer node={node} />;
    }

    // 渲染 skillResponse 类型
    if (node.nodeType === "skillResponse") {
      return <SkillResponseRenderer node={node} />;
    }

    // 不支持的类型显示提示
    return (
      <div className="p-6 bg-white rounded-lg flex flex-col items-center justify-center text-gray-400 h-[400px] shadow-md">
        <div className="text-lg">仅支持代码组件类型</div>
        <div className="text-sm text-gray-400 mt-2">{node.nodeType}</div>
      </div>
    );
  }
);

export { NodeRenderer };
