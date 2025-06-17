import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  CanvasNode,
  ResponseNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { LinearThreadContent } from '@refly-packages/ai-workspace-common/components/canvas/refly-pilot/linear-thread';
import { LinearThreadMessage } from '@refly-packages/ai-workspace-common/stores/canvas';
import { cn } from '@refly/utils/cn';
import { useFindThreadHistory } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-thread-history';
import { genActionResultID, genUniqueId } from '@refly/utils/id';
import { ChatPanel } from '@refly-packages/ai-workspace-common/components/canvas/node-chat-panel';
import {
  IContextItem,
  useContextPanelStore,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import {
  ModelInfo,
  Skill,
  SkillRuntimeConfig,
  SkillTemplateConfig,
  ActionStatus,
} from '@refly/openapi-schema';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { convertContextItemsToNodeFilters } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useContextUpdateByResultId } from '@refly-packages/ai-workspace-common/hooks/canvas/use-debounced-context-update';
import { useReactFlow } from '@xyflow/react';
import { contextEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/context';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { Button, Input } from 'antd';
import { ArrowLeftOutlined, HistoryOutlined } from '@ant-design/icons';

// Search History Selection Component (placeholder)
const SearchHistorySelection = memo(({ onBack }: { onBack: () => void }) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header with back button */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          className="flex items-center gap-2"
        >
          Back to conversation
        </Button>
      </div>

      {/* Search interface content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Search input */}
        <div className="mb-4">
          <Input
            placeholder="Please enter the bill or clause you want to query"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
            size="large"
            allowClear
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-1 mb-6 flex-wrap">
          <Button
            className="rounded-full border-black font-bold text-xs px-2 py-0 h-6 min-h-0 text-[10px]"
            size="small"
          >
            All Cases
            <span className="ml-0.5 text-[8px]">▼</span>
          </Button>
          <Button
            className="rounded-full border-black font-bold text-xs px-2 py-0 h-6 min-h-0 text-[10px]"
            size="small"
          >
            Any Date
            <span className="ml-0.5 text-[8px]">▼</span>
          </Button>
          <Button
            className="rounded-full border-black font-bold text-xs px-2 py-0 h-6 min-h-0 text-[10px]"
            size="small"
          >
            All States & Federal
            <span className="ml-0.5 text-[8px]">▼</span>
          </Button>
        </div>

        {/* Search results area - placeholder for now */}
        <div className="space-y-4">
          {searchQuery ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8">
              Search results for "{searchQuery}" will be displayed here.
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8">
              Enter a search query to find historical cases.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

SearchHistorySelection.displayName = 'SearchHistorySelection';

interface EnhancedSkillResponseProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
  className?: string;
  searchViewMode?: 'conversation' | 'history';
  setSearchViewMode?: (mode: 'conversation' | 'history') => void;
}

export const EnhancedSkillResponse = memo(
  ({
    node,
    resultId,
    className,
    searchViewMode,
    setSearchViewMode,
  }: EnhancedSkillResponseProps) => {
    // Check if this is a search node
    const isSearchNode = useMemo(() => {
      return (
        node.data?.metadata?.searchNode === true ||
        node.data?.metadata?.viewMode === 'search' ||
        node.data?.metadata?.selectedSkill?.name?.includes('searchentry') ||
        node.data?.metadata?.modelInfo?.name === 'hkgai-searchentry' ||
        node.data?.metadata?.modelInfo?.label?.includes('Search Entry')
      );
    }, [node.data?.metadata]);

    // Use local state as fallback if props are not provided (for backward compatibility)
    const [localSearchViewMode, setLocalSearchViewMode] = useState<'conversation' | 'history'>(
      'conversation',
    );
    const currentSearchViewMode = searchViewMode ?? localSearchViewMode;
    const currentSetSearchViewMode = setSearchViewMode ?? setLocalSearchViewMode;

    // Thread messages state
    const [messages, setMessages] = useState<LinearThreadMessage[]>([]);
    const findThreadHistory = useFindThreadHistory();
    const { getNodes, getEdges } = useReactFlow();

    // Local state for ChatPanel
    const [query, setQuery] = useState('');
    const [selectedSkillName, setSelectedSkillName] = useState<string | undefined>();
    const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
    const [contextItems, setContextItems] = useState<IContextItem[]>([]);
    const [runtimeConfig, setRuntimeConfig] = useState<SkillRuntimeConfig>({});
    const [tplConfig, setTplConfig] = useState<SkillTemplateConfig | undefined>();

    const { projectId, handleProjectChange, getFinalProjectId } = useAskProject();
    const { readonly, canvasId } = useCanvasContext();

    // Extract the last message resultId for context updates
    const lastMessageResultId = useMemo(() => {
      const lastMessage = messages?.[messages.length - 1];
      return lastMessage?.resultId;
    }, [messages]);

    // Document store state for active result ID
    const { activeResultId, setActiveResultId } = useContextPanelStoreShallow((state) => ({
      activeResultId: state.activeResultId,
      setActiveResultId: state.setActiveResultId,
    }));

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout>();
    const isInitializedRef = useRef(false);
    const prevTplConfigRef = useRef<SkillTemplateConfig | undefined>();
    const contentHeight = useMemo(
      () => (messages.length === 0 ? 'auto' : '300px'),
      [messages.length],
    );

    // Hooks
    const selectedSkill = useFindSkill(selectedSkillName);
    const { invokeAction, abortAction } = useInvokeAction();
    const { addNode } = useAddNode();

    const { debouncedUpdateContextItems } = useContextUpdateByResultId({
      resultId: lastMessageResultId ?? resultId,
      setContextItems,
    });

    // Initialize messages from resultId and its thread history with retry mechanism
    useEffect(() => {
      const initializeMessages = () => {
        if (resultId && node) {
          const nodes = getNodes();
          const edges = getEdges();

          // Check if we have enough data loaded
          if (nodes.length === 0 && edges.length === 0) {
            // Clear any existing timeout
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            // Retry after a delay
            retryTimeoutRef.current = setTimeout(initializeMessages, 500);
            return;
          }

          // Find thread history based on resultId
          const threadHistory = findThreadHistory({ resultId });

          // Initialize with empty messages array
          const initialMessages: LinearThreadMessage[] = [];

          // Check if current node is already in thread history to avoid duplication
          const isNodeInHistory = threadHistory.some((historyNode) => historyNode.id === node.id);

          // Add all history nodes to messages (and current node only if not already in history)
          const allNodes = isNodeInHistory ? threadHistory : [...threadHistory, node];

          allNodes.forEach((historyNode, index) => {
            const nodeResultId = historyNode?.data?.entityId;
            if (nodeResultId) {
              initialMessages.push({
                id: `history-${historyNode.id}-${index}`,
                resultId: nodeResultId,
                nodeId: historyNode.id,
                timestamp: Date.now() - (allNodes.length - index) * 1000, // Ensure proper ordering
                data: historyNode.data,
              });
            }
          });

          setMessages(initialMessages);

          // Initialize ChatPanel state from node data if available
          if (node?.data?.metadata && !isInitializedRef.current) {
            isInitializedRef.current = true;
            const metadata = node.data.metadata as any;

            if (metadata.selectedSkill?.name) setSelectedSkillName(metadata.selectedSkill.name);
            if (metadata.modelInfo) setModelInfo(metadata.modelInfo);

            // Preserve tplConfig stability
            if (
              metadata.tplConfig &&
              (!prevTplConfigRef.current ||
                JSON.stringify(metadata.tplConfig) !== JSON.stringify(prevTplConfigRef.current))
            ) {
              prevTplConfigRef.current = metadata.tplConfig;
              setTplConfig(metadata.tplConfig);
            }

            if (metadata.runtimeConfig) setRuntimeConfig(metadata.runtimeConfig);
          }

          // Add delay to ensure edges are properly updated before calling debouncedUpdateContextItems
          setTimeout(() => {
            debouncedUpdateContextItems();
          }, 150);
        }
      };

      initializeMessages();

      // Cleanup
      return () => {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
      };
    }, [resultId, node, getNodes, getEdges, findThreadHistory, debouncedUpdateContextItems]);

    // When tplConfig changes, update the ref
    useEffect(() => {
      if (tplConfig && JSON.stringify(tplConfig) !== JSON.stringify(prevTplConfigRef.current)) {
        prevTplConfigRef.current = tplConfig;
      }
    }, [tplConfig]);

    // Listen for context item events specific to this resultId
    useEffect(() => {
      // Handler for when a context item is added to this specific resultId
      const handleAddToContext = (data: { contextItem: IContextItem; resultId: string }) => {
        if (data.resultId === resultId) {
          setContextItems((prevItems) => {
            // Check if item already exists
            const itemExists = prevItems.some(
              (prevItem) => prevItem.entityId === data.contextItem.entityId,
            );
            if (itemExists) return prevItems;

            // Add the new item
            return [...prevItems, data.contextItem];
          });
        }
      };

      // Register event listeners
      contextEmitter.on('addToContext', handleAddToContext);

      // Cleanup
      return () => {
        contextEmitter.off('addToContext', handleAddToContext);
      };
    }, [resultId]);

    // Update context when lastMessageResultId changes
    useEffect(() => {
      if (lastMessageResultId) {
        // Add delay to ensure edges are properly updated
        const timer = setTimeout(() => {
          debouncedUpdateContextItems();
        }, 150);

        return () => clearTimeout(timer);
      }
    }, [lastMessageResultId, debouncedUpdateContextItems]);

    // Handler for send message - memoized for stability
    const handleSendMessage = useCallback(() => {
      if (!canvasId || !query.trim()) return;

      // Store current query for later use
      const currentQuery = query;

      // Clear the input query immediately
      setQuery('');

      // Generate IDs for the new skill response
      const newResultId = genActionResultID();
      const newNodeId = genUniqueId();

      const finalProjectId = getFinalProjectId();
      const { runtimeConfig: contextRuntimeConfig = {} } = useContextPanelStore.getState();

      // Create message object for the thread
      const newMessage: LinearThreadMessage = {
        id: `message-${newNodeId}`,
        resultId: newResultId,
        nodeId: newNodeId,
        timestamp: Date.now(),
        data: {
          title: currentQuery,
          entityId: newResultId,
          metadata: {
            status: 'executing' as ActionStatus,
            contextItems,
            tplConfig,
            selectedSkill,
            modelInfo,
            runtimeConfig,
            structuredData: {
              query: currentQuery,
            },
            projectId: finalProjectId,
          } as ResponseNodeMeta,
        },
      };

      // Add this message to the thread
      setMessages((prev) => [...prev, newMessage]);

      // Invoke the action with all necessary parameters
      invokeAction(
        {
          resultId: newResultId,
          query: currentQuery,
          selectedSkill,
          modelInfo,
          contextItems,
          tplConfig,
          runtimeConfig: {
            ...contextRuntimeConfig,
            ...runtimeConfig,
          },
          projectId: finalProjectId,
        },
        {
          entityId: canvasId,
          entityType: 'canvas',
        },
      );

      // Create a node to display the response
      addNode(
        {
          type: 'skillResponse',
          data: {
            title: currentQuery,
            entityId: newResultId,
            metadata: {
              status: 'executing' as ActionStatus,
              contextItems,
              tplConfig,
              selectedSkill,
              modelInfo,
              runtimeConfig: {
                ...contextRuntimeConfig,
                ...runtimeConfig,
              },
              structuredData: {
                query: currentQuery,
              },
              projectId: finalProjectId,
            } as ResponseNodeMeta,
          },
        },
        convertContextItemsToNodeFilters(contextItems),
        false,
        true,
      );
    }, [
      query,
      selectedSkill,
      modelInfo,
      contextItems,
      tplConfig,
      runtimeConfig,
      canvasId,
      invokeAction,
      addNode,
    ]);

    // Handler for setting selected skill - memoized to ensure referential stability
    const handleSetSelectedSkill = useCallback((skill: Skill | null) => {
      setSelectedSkillName(skill?.name);
    }, []);

    // Memoized query setter to prevent unnecessary re-renders
    const handleSetQuery = useCallback((newQuery: string) => {
      setQuery(newQuery);
    }, []);

    // Memoized function to handle tplConfig changes for stability
    const handleSetTplConfig = useCallback(
      (config: SkillTemplateConfig) => {
        // Only update if the config has actually changed
        if (
          !prevTplConfigRef.current ||
          JSON.stringify(prevTplConfigRef.current) !== JSON.stringify(config)
        ) {
          prevTplConfigRef.current = config;
          setTplConfig(config);
        }
      },
      [setTplConfig],
    );
    // Handle container click for activation
    const handleContainerClick = useCallback(() => {
      if (activeResultId !== resultId) {
        setActiveResultId(resultId);
      }
    }, [activeResultId, resultId, setActiveResultId]);

    // Memoize the ChatPanel component to prevent unnecessary re-renders
    const chatPanelComponent = useMemo(
      () => (
        <ChatPanel
          mode="list"
          readonly={readonly}
          query={query}
          setQuery={handleSetQuery}
          selectedSkill={selectedSkill}
          setSelectedSkill={handleSetSelectedSkill}
          contextItems={contextItems}
          setContextItems={setContextItems}
          modelInfo={modelInfo}
          setModelInfo={setModelInfo}
          runtimeConfig={runtimeConfig}
          setRuntimeConfig={setRuntimeConfig}
          tplConfig={tplConfig}
          setTplConfig={handleSetTplConfig}
          handleSendMessage={handleSendMessage}
          handleAbortAction={abortAction}
          onInputHeightChange={() => {
            // Adjust container height if needed
          }}
          className="w-full max-w-[1024px] mx-auto"
          resultId={resultId}
          projectId={projectId}
          handleProjectChange={handleProjectChange}
        />
      ),
      [
        readonly,
        query,
        handleSetQuery,
        selectedSkill,
        handleSetSelectedSkill,
        contextItems,
        modelInfo,
        runtimeConfig,
        tplConfig,
        handleSetTplConfig,
        handleSendMessage,
        abortAction,
        resultId,
      ],
    );

    // Memoize the LinearThreadContent component
    const threadContentComponent = useMemo(
      () => <LinearThreadContent messages={messages} contentHeight={contentHeight} />,
      [messages, contentHeight],
    );

    // Search view mode handlers
    const handleToggleToHistory = useCallback(() => {
      currentSetSearchViewMode('history');
    }, [currentSetSearchViewMode]);

    const handleBackToConversation = useCallback(() => {
      currentSetSearchViewMode('conversation');
    }, [currentSetSearchViewMode]);

    // Render search history selection for search nodes
    if (isSearchNode && currentSearchViewMode === 'history') {
      return (
        <div
          ref={containerRef}
          className={cn('flex flex-col h-full w-full', className)}
          onClick={handleContainerClick}
          data-debug="enhanced-skill-response-container"
        >
          <SearchHistorySelection onBack={handleBackToConversation} />
        </div>
      );
    }

    // Render normal conversation interface (default for all nodes)
    return (
      <div
        ref={containerRef}
        className={cn('flex flex-col h-full w-full', className)}
        onClick={handleContainerClick}
        data-debug="enhanced-skill-response-container"
      >
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col w-full max-w-[1024px] mx-auto">
            {/* Search toggle button - only for search nodes */}
            {isSearchNode && (
              <div className="flex justify-end p-2 border-b border-gray-100 dark:border-gray-700">
                <Button
                  type="text"
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={handleToggleToHistory}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-300"
                >
                  Search History
                </Button>
              </div>
            )}

            {threadContentComponent}
            {chatPanelComponent}
          </div>
        </div>
      </div>
    );
  },
);

EnhancedSkillResponse.displayName = 'EnhancedSkillResponse';
