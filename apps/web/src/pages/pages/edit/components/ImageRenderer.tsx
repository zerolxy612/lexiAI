import React, { memo, useState } from "react";
import { type NodeRelation } from "./ArtifactRenderer";
import { ImagePreview } from "@refly-packages/ai-workspace-common/components/common/image-preview";

// 图片渲染组件
const ImageRenderer = memo(
  ({
    node,
    isFullscreen = false,
    isMinimap = false,
  }: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isMinimap?: boolean;
  }) => {
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

    // 从节点数据中获取图片URL
    const imageUrl = node.nodeData?.metadata?.imageUrl;
    const title = node.nodeData?.title || "图片";

    // 如果没有图片URL，显示提示
    if (!imageUrl) {
      return (
        <div className="h-full flex items-center justify-center bg-white rounded p-3">
          <span className="text-gray-500">未找到图片资源</span>
        </div>
      );
    }

    const handleOpenPreview = () => {
      setIsPreviewModalVisible(true);
    };

    return (
      <div
        className={`h-full bg-white ${!isFullscreen ? "rounded px-4 pb-4" : "w-full"} ${
          isMinimap ? "p-1" : ""
        }`}
      >
        <div className="h-full w-full overflow-hidden flex flex-col">
          <div
            className={`flex items-center justify-between py-2 ${
              !isFullscreen ? "border-b" : "border-b bg-gray-100 px-4"
            } ${isMinimap ? "py-1 px-2 border-b-0 bg-gray-50" : ""}`}
          >
            <div
              className={`font-medium text-gray-800 ${isMinimap ? "text-xs truncate" : ""}`}
            >
              {title}
            </div>
            {!isMinimap && <div className="text-xs text-gray-500">图片</div>}
          </div>

          <div
            className={`flex-1 flex items-center justify-center overflow-auto p-2 ${
              isMinimap ? "p-0" : ""
            }`}
          >
            <img
              src={imageUrl}
              alt={title}
              onClick={!isMinimap ? handleOpenPreview : undefined}
              className={`max-w-full max-h-full object-contain cursor-pointer ${
                isMinimap
                  ? "transform scale-[0.5] origin-top-left w-[200%] h-[200%]"
                  : ""
              }`}
            />
          </div>
        </div>

        {/* 图片预览模态框 */}
        {isPreviewModalVisible && (
          <ImagePreview
            isPreviewModalVisible={isPreviewModalVisible}
            setIsPreviewModalVisible={setIsPreviewModalVisible}
            imageUrl={imageUrl}
            imageTitle={title}
          />
        )}
      </div>
    );
  }
);

export { ImageRenderer };
