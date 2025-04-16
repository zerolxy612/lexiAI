import { FC, useCallback, useState } from 'react';
import { Button, message, Modal, Spin } from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useGetCanvasData,
  useAddNodesToCanvasPage,
} from '@refly-packages/ai-workspace-common/queries/queries';

interface EmptyContentPromptProps {
  pageId?: string;
  canvasId?: string;
  onNodeAdded?: () => void;
}

/**
 * A component that displays when there is no content available
 * and provides a way to add content by selecting from available nodes
 */
const EmptyContentPrompt: FC<EmptyContentPromptProps> = ({ pageId, canvasId, onNodeAdded }) => {
  const { t } = useTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // Get canvas data to find available nodes
  const {
    data: canvasData,
    isLoading: isLoadingCanvas,
    refetch: refetchCanvas,
  } = useGetCanvasData(
    {
      query: {
        canvasId: canvasId || pageId || '',
      },
    },
    undefined,
    { enabled: !!(canvasId || pageId) },
  );

  // Add nodes to page mutation
  const { mutate: addNodesToPage, isPending: isAddingNodes } = useAddNodesToCanvasPage();

  // Function to handle adding content
  const handleAddContent = useCallback(() => {
    if (!pageId && !canvasId) {
      message.error(t('common.pageIdMissing'));
      return;
    }

    // Refetch canvas data to ensure we have the latest
    refetchCanvas().then(() => {
      setIsModalVisible(true);
    });
  }, [pageId, canvasId, refetchCanvas, t]);

  // Handle node selection in modal
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeIds((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      }

      return [...prev, nodeId];
    });
  }, []);

  // Handle adding selected nodes to the page
  const handleAddNodes = useCallback(() => {
    if (!pageId || selectedNodeIds.length === 0) return;

    // 注意：这里使用 canvasId 而不是 pageId，因为 API 需要 canvasId
    const targetCanvasId = canvasId || pageId;

    if (!targetCanvasId) {
      message.error(t('common.canvasIdMissing'));
      return;
    }

    addNodesToPage(
      {
        path: {
          canvasId: targetCanvasId,
        },
        body: {
          nodeIds: selectedNodeIds,
        },
      },
      {
        onSuccess: () => {
          message.success(t('common.nodesAddedSuccess'));
          setIsModalVisible(false);
          setSelectedNodeIds([]);
          if (onNodeAdded) {
            onNodeAdded();
          }
        },
        onError: (error) => {
          console.error('Failed to add nodes:', error);
          message.error(t('common.nodesAddedFailed'));
        },
      },
    );
  }, [pageId, canvasId, selectedNodeIds, addNodesToPage, onNodeAdded, t]);

  // Get available nodes from canvas data
  const availableNodes = canvasData?.data?.nodes || [];

  return (
    <>
      <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300 shadow-sm">
        <FileTextOutlined className="text-5xl text-gray-300 mb-4" />
        <h3 className="text-xl text-gray-500 mb-2">{t('common.noContent')}</h3>
        <p className="text-gray-400 mb-6">{t('common.noContentDesc')}</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddContent}>
          {t('common.addContent')}
        </Button>
      </div>

      <Modal
        title={t('common.selectNodes')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={handleAddNodes}
        okButtonProps={{ disabled: selectedNodeIds.length === 0 }}
        okText={t('common.addSelected')}
        width={600}
      >
        {isLoadingCanvas ? (
          <div className="py-10 text-center">
            <Spin />
            <p className="mt-2 text-gray-500">{t('common.loading')}</p>
          </div>
        ) : availableNodes.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-gray-500">{t('common.noNodesAvailable')}</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            {availableNodes.map((node: any) => (
              <div
                key={node.id}
                className={`p-4 mb-2 border rounded-lg cursor-pointer transition-colors ${
                  selectedNodeIds.includes(node.id)
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => handleNodeSelect(node.id)}
              >
                <div className="font-medium">{node.title || node.id}</div>
                {node.description && (
                  <div className="text-gray-500 text-sm mt-1">{node.description}</div>
                )}
                {node.type && (
                  <div className="text-xs text-gray-400 mt-1">
                    {t('common.type')}: {node.type}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {isAddingNodes && (
          <div className="mt-4 text-center text-gray-500">
            <Spin size="small" className="mr-2" />
            {t('common.addingNodes')}
          </div>
        )}
      </Modal>
    </>
  );
};

export default EmptyContentPrompt;
