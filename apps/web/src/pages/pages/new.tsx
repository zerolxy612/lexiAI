import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CanvasNode } from '@refly/openapi-schema';
import { useCreatePage } from '@refly-packages/ai-workspace-common/queries/queries';
import { useTranslation } from 'react-i18next';

// Simple Spinner component
const Spinner = ({ size = 'normal' }: { size?: 'small' | 'normal' }) => (
  <div
    className={`animate-spin rounded-full border-t-2 border-indigo-500 ${size === 'small' ? 'h-4 w-4' : 'h-6 w-6'}`}
  />
);

export default function CreatePageFromCanvas() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [canvasId, setCanvasId] = useState('');
  const [nodeIds, setNodeIds] = useState<string[]>([]);
  const [availableNodes, setAvailableNodes] = useState<CanvasNode[]>([]);
  const [loading, setCanvasLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Mutate function for creating a page
  const { mutate: createPage, isPending } = useCreatePage(undefined, {
    onError: (error) => {
      console.error('Failed to create page:', error);
      setError(
        `${t('pages.new.createPageFailed')}: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });

  // Load Canvas data when Canvas ID is input
  const fetchCanvasData = async () => {
    if (!canvasId.trim()) return;

    try {
      setCanvasLoading(true);
      setError('');
      // Use the correct way to get client
      const client = getClient();

      // Call API to get Canvas data
      const response = await client.getCanvasData({
        query: { canvasId },
      });

      // Get data
      // According to API response format, node data is located at response.data.data.nodes
      const data = response?.data;

      // General way to process response data
      if (data?.success && data?.data) {
        // Extract node data correctly from the response
        const canvasData = data.data;

        if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
          // Nodes are directly in canvasData.nodes
          const nodes = canvasData.nodes;

          // Verify if node structure meets expectations
          const validNodes = nodes.filter(
            (node: any) => node?.type && node.data && node.data.entityId,
          );

          if (validNodes.length > 0) {
            setAvailableNodes(validNodes as CanvasNode[]);
          } else {
            setError(t('pages.new.noValidNodes'));
            setAvailableNodes([]);
          }
        } else {
          setError(t('pages.new.noNodesFound'));
          setAvailableNodes([]);
        }
      } else {
        setError(t('pages.new.invalidApiResponse'));
        setAvailableNodes([]);
      }
    } catch (err) {
      console.error('Failed to fetch Canvas data:', err);
      setError(
        `${t('pages.new.fetchCanvasDataFailed')}: ${err instanceof Error ? err.message : String(err)}`,
      );
      setAvailableNodes([]);
    } finally {
      setCanvasLoading(false);
    }
  };

  // Handle node selection
  const handleNodeToggle = (nodeId: string) => {
    setNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    );
  };

  // Submit form to create page
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canvasId.trim()) {
      setError(t('pages.new.pleaseEnterCanvasId'));
      return;
    }

    if (nodeIds.length === 0) {
      setError(t('pages.new.pleaseSelectAtLeastOneNode'));
      return;
    }

    setError('');

    try {
      createPage(
        {
          body: {
            title: title.trim() || t('pages.new.untitledPage'),
            description: t('pages.new.createdFromCanvas', { canvasId }),
            // According to CreatePageRequest interface requirements, put canvasId and nodeIds into content object
            content: {
              canvasId,
              nodeIds,
            },
          },
        },
        {
          onSuccess: (response: any) => {
            const data = response?.data;
            setSuccess(
              `${t('pages.new.pageCreatedSuccess')}! ${t('pages.new.pageId')}: ${data?.pageId || t('pages.new.unknown')}`,
            );
            // Reset form
            setTitle('');
            setNodeIds([]);
            // Redirect to page list after three seconds
            setTimeout(() => {
              navigate('/pages');
            }, 3000);
          },
          onError: (error: unknown) => {
            setError(
              `${t('pages.new.createPageFailed')}: ${error instanceof Error ? error.message : String(error)}`,
            );
          },
        },
      );
    } catch (err) {
      setError(
        `${t('pages.new.createPageFailed')}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('pages.new.createPageFromCanvas')}</h1>

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            {t('pages.new.pageTitle')} ({t('pages.new.optional')})
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('pages.new.enterPageTitle')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="canvasId" className="block text-sm font-medium text-gray-700 mb-2">
            Canvas ID *
          </label>
          <div className="flex gap-2">
            <input
              id="canvasId"
              type="text"
              value={canvasId}
              onChange={(e) => setCanvasId(e.target.value)}
              placeholder={t('pages.new.enterCanvasId')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <button
              type="button"
              onClick={fetchCanvasData}
              disabled={loading || !canvasId.trim()}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
            >
              {loading ? <Spinner size="small" /> : t('pages.new.loadNodes')}
            </button>
          </div>
        </div>

        {availableNodes.length > 0 && (
          <div>
            <label
              htmlFor="node-selection"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              {t('pages.new.selectNodesToInclude')} *
            </label>
            <div
              id="node-selection"
              className="border border-gray-300 rounded-md p-3 max-h-96 overflow-y-auto"
            >
              {availableNodes.map((node) => (
                <div
                  key={node.data.entityId}
                  className="flex items-center py-2 border-b border-gray-200 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    id={`node-${node.data.entityId}`}
                    checked={nodeIds.includes(node.data.entityId)}
                    onChange={() => handleNodeToggle(node.data.entityId)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`node-${node.data.entityId}`} className="ml-2 flex-1">
                    <div className="font-medium">{node.data.title || t('pages.new.untitled')}</div>
                    <div className="text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded mr-2">
                        {t('pages.new.type')}: {node.type}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        ID: {node.data.entityId}
                      </span>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-2">
              <button
                type="button"
                onClick={() => setNodeIds(availableNodes.map((node) => node.data.entityId))}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                {t('pages.new.selectAll')}
              </button>
              <button
                type="button"
                onClick={() => setNodeIds([])}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                {t('pages.new.deselectAll')}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || nodeIds.length === 0 || !canvasId.trim()}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
          >
            {isPending ? <Spinner size="small" /> : t('pages.new.createPage')}
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-lg font-medium mb-4">{t('pages.new.instructions')}</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>{t('pages.new.instructionStep1')}</li>
          <li>{t('pages.new.instructionStep2')}</li>
          <li>{t('pages.new.instructionStep3')}</li>
          <li>{t('pages.new.instructionStep4')}</li>
          <li>{t('pages.new.instructionStep5')}</li>
        </ol>
      </div>
    </div>
  );
}
