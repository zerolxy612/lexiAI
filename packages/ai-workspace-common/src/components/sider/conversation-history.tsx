import { memo, useMemo } from 'react';
import { useNavigate, useLocation } from '@refly-packages/ai-workspace-common/utils/router';
import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';
// Icons and Button removed as they are no longer needed

interface ConversationItem {
  id: string;
  title: string;
  type: 'canvas' | 'conversation';
  updatedAt: string;
  path: string;
}

// Extract first user question or generate summary from canvas data
const extractTitleFromContent = (item: any): string => {
  // For canvas items with linear thread messages
  if (item.linearThreadMessages?.length > 0) {
    const firstMessage = item.linearThreadMessages[0];
    if (firstMessage?.data?.request?.query) {
      return firstMessage.data.request.query;
    }
  }

  // For regular canvas/conversation items
  if (item.name && item.name !== 'Untitled') {
    return item.name;
  }

  // Fallback title
  return item.type === 'canvas' ? 'New Canvas' : 'New Conversation';
};

// Truncate text with ellipsis
const truncateText = (text: string, maxLength = 40): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const ConversationHistory = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { canvasList } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList,
  }));

  const { linearThreadMessages } = useCanvasStore((state) => ({
    linearThreadMessages: state.linearThreadMessages,
  }));

  // Combine and sort conversation items
  const conversationItems = useMemo<ConversationItem[]>(() => {
    const items: ConversationItem[] = [];

    // Add canvas items
    canvasList?.forEach((canvas) => {
      items.push({
        id: canvas.id,
        title: extractTitleFromContent(canvas),
        type: 'canvas' as const,
        updatedAt: canvas.updatedAt,
        path: `/canvas/${canvas.id}`,
      });
    });

    // Add linear thread conversations (if not already in canvas list)
    const canvasIds = new Set(canvasList?.map((c) => c.id) || []);
    linearThreadMessages?.forEach((message) => {
      if (!canvasIds.has(message.nodeId)) {
        items.push({
          id: message.id,
          title: extractTitleFromContent(message),
          type: 'conversation' as const,
          updatedAt: new Date(message.timestamp).toISOString(),
          path: `/canvas/${message.nodeId}`,
        });
      }
    });

    // Sort by updated time (newest first)
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [canvasList, linearThreadMessages]);

  // Get current selected item
  const currentPath = location.pathname;
  const selectedId = currentPath.split('/').pop();

  if (conversationItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col p-3 min-h-0">
        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
          <div>{t('sider.history.empty.title')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-3 min-h-0">
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {conversationItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              'group relative p-2 rounded-lg text-sm cursor-pointer transition-colors',
              'hover:bg-gray-50 dark:hover:bg-gray-800',
              {
                'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300':
                  selectedId === item.id,
                'text-gray-700 dark:text-gray-300': selectedId !== item.id,
              },
            )}
            onClick={() => navigate(item.path)}
          >
            <div className="font-semibold leading-tight">{truncateText(item.title)}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

ConversationHistory.displayName = 'ConversationHistory';
