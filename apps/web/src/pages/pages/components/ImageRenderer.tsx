import { memo, useState } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';

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
    const title = node.nodeData?.title || '图片';

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
        className={`h-full bg-white ${!isFullscreen ? 'rounded' : 'w-full'} ${
          isMinimap ? 'p-1' : ''
        }`}
      >
        <div className="h-full w-full overflow-hidden flex flex-col">
          {/* 图片内容区域 */}
          <div className="flex-1 overflow-auto p-4">
            <div
              className="cursor-pointer hover:opacity-90 transition-opacity"
              onClick={handleOpenPreview}
            >
              <img
                src={imageUrl}
                alt={title}
                className="max-w-full max-h-full object-contain mx-auto"
              />
            </div>
          </div>

          {/* 预览模态框 */}
          {isPreviewModalVisible && (
            <ImagePreview
              isPreviewModalVisible={isPreviewModalVisible}
              setIsPreviewModalVisible={setIsPreviewModalVisible}
              imageUrl={imageUrl}
              imageTitle={title}
            />
          )}
        </div>
      </div>
    );
  },
);

export { ImageRenderer };
