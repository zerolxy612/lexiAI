import React, { memo } from "react";
import { type NodeRelation } from "./ArtifactRenderer";
import { CodeArtifactRenderer } from "./CodeArtifactRenderer";
import { DocumentRenderer } from "./DocumentRenderer";
import { SkillResponseRenderer } from "./SkillResponseRenderer";
import { ImageRenderer } from "./ImageRenderer";

// 内容渲染组件
const NodeRenderer = memo(
  ({
    node,
    isActive = false,
    isFullscreen = false,
    isMinimap = false,
  }: {
    node: NodeRelation;
    isActive?: boolean;
    isFullscreen?: boolean;
    isMinimap?: boolean;
  }) => {
    // 只渲染 codeArtifact 类型
    if (node.nodeType === "codeArtifact") {
      return (
        <CodeArtifactRenderer
          node={node}
          isFullscreen={isFullscreen}
          isMinimap={isMinimap}
        />
      );
    }

    // 只渲染 document 类型
    if (node.nodeType === "document") {
      return (
        <DocumentRenderer
          node={node}
          isFullscreen={isFullscreen}
          isMinimap={isMinimap}
        />
      );
    }

    // 渲染 skillResponse 类型
    if (node.nodeType === "skillResponse") {
      return (
        <SkillResponseRenderer
          node={node}
          isFullscreen={isFullscreen}
          isMinimap={isMinimap}
        />
      );
    }

    // 渲染 image 类型
    if (node.nodeType === "image") {
      return (
        <ImageRenderer
          node={node}
          isFullscreen={isFullscreen}
          isMinimap={isMinimap}
        />
      );
    }

    // 不支持的类型显示提示
    return (
      <div
        className={`p-6 bg-white rounded-lg flex flex-col items-center justify-center text-gray-400 ${
          !isFullscreen ? "h-[400px]" : "h-full"
        } shadow-md ${isMinimap ? "p-2 h-full" : ""}`}
      >
        <div className={`${isMinimap ? "text-xs" : "text-lg"}`}>
          {isMinimap ? "不支持的组件" : "仅支持代码组件类型"}
        </div>
        {!isMinimap && (
          <div className="text-sm text-gray-400 mt-2">{node.nodeType}</div>
        )}
      </div>
    );
  }
);

export { NodeRenderer };
