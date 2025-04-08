import React, { memo } from "react";
import { type NodeRelation } from "./ArtifactRenderer";

// 小地图专用的简化节点渲染器
const MiniNodeRenderer = memo(({ node }: { node: NodeRelation }) => {
  const nodeType = node.nodeType;
  const title = node.nodeData?.title || "";

  // 根据不同节点类型展示不同的缩略图
  if (nodeType === "codeArtifact") {
    return (
      <div className="h-full bg-gradient-to-r from-blue-50 to-blue-100 flex items-center justify-center p-1">
        <div className="text-xs text-center text-blue-500 truncate w-full">
          {title || "代码组件"}
        </div>
      </div>
    );
  }

  if (nodeType === "document") {
    return (
      <div className="h-full bg-gradient-to-r from-green-50 to-green-100 flex items-center justify-center p-1">
        <div className="text-xs text-center text-green-500 truncate w-full">
          {title || "文档组件"}
        </div>
      </div>
    );
  }

  if (nodeType === "skillResponse") {
    return (
      <div className="h-full bg-gradient-to-r from-purple-50 to-purple-100 flex items-center justify-center p-1">
        <div className="text-xs text-center text-purple-500 truncate w-full">
          {title || "技能响应"}
        </div>
      </div>
    );
  }

  // 默认显示
  return (
    <div className="h-full bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-center p-1">
      <div className="text-xs text-center text-gray-500 truncate w-full">
        {nodeType || "未知组件"}
      </div>
    </div>
  );
});

export { MiniNodeRenderer };
