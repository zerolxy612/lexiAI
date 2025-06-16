import { Edge, NodeProps, Position, useReactFlow } from '@xyflow/react';
import { CanvasNode, CanvasNodeData, SkillNodeMeta } from './shared/types';
import { Node } from '@xyflow/react';
import { Form } from 'antd';
import { CustomHandle } from './shared/custom-handle';
import { useState, useCallback, useEffect, useMemo, memo, useRef } from 'react';

import { getNodeCommonStyles } from './index';
import { ModelInfo, Skill, SkillRuntimeConfig, SkillTemplateConfig } from '@refly/openapi-schema';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useChatStore } from '@refly-packages/ai-workspace-common/stores/chat';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { cleanupNodeEvents } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useEdgeStyles } from '@refly-packages/ai-workspace-common/components/canvas/constants';
import { genActionResultID, genUniqueId } from '@refly/utils/id';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { convertContextItemsToNodeFilters } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useNodeSize } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';
import { NodeResizer as NodeResizerComponent } from './shared/node-resizer';
import classNames from 'classnames';
import Moveable from 'react-moveable';
import { useContextUpdateByEdges } from '@refly-packages/ai-workspace-common/hooks/canvas/use-debounced-context-update';
import { ChatPanel } from '@refly-packages/ai-workspace-common/components/canvas/node-chat-panel';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useDebouncedCallback } from 'use-debounce';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { edgeEventsEmitter } from '@refly-packages/ai-workspace-common/events/edge';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { NodeActionButtons } from './shared/node-action-buttons';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { useTranslation } from 'react-i18next';
import { IconSearch } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { AlertCircle } from 'lucide-react';

type SkillNode = Node<CanvasNodeData<SkillNodeMeta>, 'skill'>;

// Simple Search Component for search nodes
const SimpleSearchComponent = memo(
  ({
    query,
    setQuery,
    onSearch,
    readonly,
    nodeType = 'search',
  }: {
    query: string;
    setQuery: (query: string) => void;
    onSearch: () => void;
    readonly: boolean;
    nodeType?: 'search' | 'missingInfo';
  }) => {
    const { t } = useTranslation();

    // Determine icon and title based on node type
    const getIconAndTitle = () => {
      if (nodeType === 'missingInfo') {
        return {
          icon: AlertCircle,
          title: t('canvas.nodeActions.missingInformation'),
        };
      }
      return {
        icon: IconSearch,
        title: t('canvas.toolbar.search'),
      };
    };

    const { icon: IconComponent, title } = getIconAndTitle();

    return (
      <div className="flex flex-col gap-3 h-full p-3 box-border">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <IconComponent className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
        </div>

        {/* Simple input */}
        <div className="flex-1">
          <ChatInput
            readonly={readonly}
            query={query}
            setQuery={setQuery}
            selectedSkillName={null}
            inputClassName="px-3 py-2"
            maxRows={3}
            handleSendMessage={onSearch}
          />
        </div>
      </div>
    );
  },
);

SimpleSearchComponent.displayName = 'SimpleSearchComponent';

export const SkillNode = memo<NodeProps<SkillNode>>(
  ({ data, selected, id }: NodeProps<SkillNode>) => {
    const { metadata = {}, entityId } = data;
    const {
      query,
      selectedSkill,
      modelInfo,
      contextItems = [],
      tplConfig,
      runtimeConfig,
    } = metadata;
    const skill = useFindSkill(selectedSkill?.name);

    const [isHovered, setIsHovered] = useState(false);
    const [localQuery, setLocalQuery] = useState(query);
    const [form] = Form.useForm();
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const targetRef = useRef<HTMLDivElement>(null);
    const moveableRef = useRef<Moveable>(null);

    const { edges } = useCanvasData();
    const { setNodeData } = useNodeData();
    const edgeStyles = useEdgeStyles();
    const { getNode, getNodes, getEdges, addEdges, deleteElements } = useReactFlow();
    const { addNode } = useAddNode();
    const { deleteNode } = useDeleteNode();
    useSelectedNodeZIndex(id, selected);

    const { operatingNodeId } = useCanvasStore((state) => ({
      operatingNodeId: state.operatingNodeId,
    }));
    const isOperating = operatingNodeId === id;
    const node = useMemo(() => getNode(id), [id, getNode]);
    const { canvasId, readonly } = useCanvasContext();

    const { projectId, handleProjectChange, getFinalProjectId } = useAskProject();

    const { containerStyle, handleResize, updateSize } = useNodeSize({
      id,
      node,
      readonly,
      isOperating,
      minWidth: 100,
      maxWidth: 800,
      minHeight: 200,
      defaultWidth: 384,
      defaultHeight: 'auto',
    });

    // Add a safe container style with NaN check
    const safeContainerStyle = useMemo(() => {
      const style = { ...containerStyle };
      // Ensure height is never NaN
      if (typeof style.height === 'number' && Number.isNaN(style.height)) {
        style.height = 'auto';
      }
      return style;
    }, [containerStyle]);

    // Check if node has any connections
    const isTargetConnected = useMemo(() => edges?.some((edge) => edge.target === id), [edges, id]);
    const isSourceConnected = useMemo(() => edges?.some((edge) => edge.source === id), [edges, id]);

    const updateNodeData = useDebouncedCallback((data: Partial<CanvasNodeData<SkillNodeMeta>>) => {
      setNodeData(id, data);
    }, 50);

    const { skillSelectedModel, setSkillSelectedModel } = useChatStore((state) => ({
      skillSelectedModel: state.selectedModel,
      setSkillSelectedModel: state.setSelectedModel,
    }));

    const { invokeAction, abortAction } = useInvokeAction();

    const userProfile = useUserStore((state) => state.userProfile);
    const isInitializedRef = useRef(false); // Track if model has been initialized

    // Update local state when query changes from external sources
    useEffect(() => {
      if (query !== localQuery) {
        setLocalQuery(query);
      }
    }, [query]);

    const setQuery = useCallback(
      (query: string) => {
        setLocalQuery(query);
        updateNodeData({ title: query, metadata: { query } });
      },
      [id, updateNodeData],
    );

    const setModelInfo = useCallback(
      (modelInfo: ModelInfo | null) => {
        setNodeData(id, { metadata: { modelInfo } });
        // Only update global state if this is the currently focused node
        if (selected) {
          setSkillSelectedModel(modelInfo);
        }
      },
      [id, setNodeData, setSkillSelectedModel, selected],
    );

    // Initialize model only once when node is created without modelInfo
    useEffect(() => {
      // Only initialize if not already done and no existing model info
      if (isInitializedRef.current || modelInfo) {
        return;
      }

      // Mark as initialized to prevent future runs
      isInitializedRef.current = true;

      // Check if there's a model from skill selected model
      if (skillSelectedModel) {
        setModelInfo(skillSelectedModel);
        return;
      }

      // Get default model from user preferences
      const defaultModel = userProfile?.preferences?.defaultModel;
      const chatModel = defaultModel?.chat;

      if (chatModel) {
        // Convert ProviderItem to ModelInfo format
        const config =
          typeof chatModel.config === 'string' ? JSON.parse(chatModel.config) : chatModel.config;
        const autoModelInfo: ModelInfo = {
          name: config?.modelId || chatModel.name,
          label: chatModel.name,
          provider: chatModel.providerId || 'hkgai',
          providerItemId: chatModel.itemId,
          tier: chatModel.tier || 't2',
          contextLimit: config?.contextLimit || 8000,
          maxOutput: config?.maxOutput || 4000,
          capabilities: config?.capabilities || {},
          isDefault: true,
        };
        setModelInfo(autoModelInfo);
      } else {
        // Fallback model based on node type
        let fallbackModelInfo: ModelInfo;

        if (metadata.missingInfoNode) {
          // Missing information nodes use hkgai-missinginfo model
          fallbackModelInfo = {
            name: 'hkgai-missinginfo',
            label: 'HKGAI Missing Info',
            provider: 'hkgai',
            providerItemId: 'hkgai-missinginfo-item',
            tier: 't2',
            contextLimit: 8000,
            maxOutput: 4000,
            capabilities: {},
            isDefault: true,
          };
        } else {
          // Default fallback to hkgai-searchentry for other nodes
          fallbackModelInfo = {
            name: 'hkgai-searchentry', // Use model ID for proper HKGAI adapter matching
            label: 'HKGAI Search Entry',
            provider: 'hkgai',
            providerItemId: 'hkgai-searchentry-item', // Match exact itemId from database
            tier: 't2',
            contextLimit: 8000,
            maxOutput: 4000,
            capabilities: {},
            isDefault: true,
          };
        }

        setModelInfo(fallbackModelInfo);
      }
    }, []); // Empty dependency array - only run once on mount

    const setContextItems = useCallback(
      (items: IContextItem[]) => {
        setNodeData(id, { metadata: { contextItems: items } });

        const nodes = getNodes() as CanvasNode<any>[];
        const entityNodeMap = new Map(nodes.map((node) => [node.data?.entityId, node]));
        const contextNodes = items.map((item) => entityNodeMap.get(item.entityId)).filter(Boolean);

        const edges = getEdges();
        const existingEdges = edges?.filter((edge) => edge.target === id) ?? [];
        const existingSourceIds = new Set(existingEdges.map((edge) => edge.source));
        const newSourceNodes = contextNodes.filter((node) => !existingSourceIds.has(node?.id));

        const newEdges = newSourceNodes.map((node) => ({
          id: `edge-${genUniqueId()}`,
          source: node.id,
          target: id,
          style: edgeStyles.hover,
          type: 'default',
        }));

        const contextNodeIds = new Set(contextNodes.map((node) => node?.id));
        const edgesToRemove = existingEdges.filter((edge) => !contextNodeIds.has(edge.source));

        setTimeout(() => {
          if (newEdges?.length > 0) {
            addEdges(newEdges);
          }

          if (edgesToRemove?.length > 0) {
            deleteElements({ edges: edgesToRemove });
          }
        }, 10);
      },
      [id, setNodeData, addEdges, getNodes, getEdges, deleteElements, edgeStyles.hover],
    );

    const setRuntimeConfig = useCallback(
      (runtimeConfig: SkillRuntimeConfig) => {
        setNodeData(id, { metadata: { runtimeConfig } });
      },
      [id, setNodeData],
    );

    const setNodeDataByEntity = useSetNodeDataByEntity();
    const setTplConfig = useCallback(
      (config: SkillTemplateConfig) => {
        setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { tplConfig: config } });
      },
      [id],
    );

    const resizeMoveable = useCallback((width: number, height: number) => {
      moveableRef.current?.request('resizable', { width, height });
    }, []);

    useEffect(() => {
      if (!targetRef.current || readonly) return;

      const { offsetWidth, offsetHeight } = targetRef.current;
      // Ensure we're not passing NaN values to resizeMoveable
      if (
        !Number.isNaN(offsetWidth) &&
        !Number.isNaN(offsetHeight) &&
        offsetWidth > 0 &&
        offsetHeight > 0
      ) {
        resizeMoveable(offsetWidth, offsetHeight);
      }
    }, [resizeMoveable, targetRef.current?.offsetHeight]);

    const setSelectedSkill = useCallback(
      (newSelectedSkill: Skill | null) => {
        const selectedSkill = newSelectedSkill;

        // Reset form when skill changes
        if (selectedSkill?.configSchema?.items?.length) {
          const defaultConfig = {};
          for (const item of selectedSkill.configSchema.items) {
            if (item.defaultValue !== undefined) {
              defaultConfig[item.key] = {
                value: item.defaultValue,
                label: item.labelDict?.en ?? item.key,
                displayValue: String(item.defaultValue),
              };
            }
          }
          form.setFieldValue('tplConfig', defaultConfig);
        } else {
          form.setFieldValue('tplConfig', undefined);
        }

        setNodeData(id, { metadata: { selectedSkill } });
      },
      [id, form, setNodeData],
    );

    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart();
    }, [onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

    const handleSendMessage = useCallback(() => {
      const node = getNode(id);
      const data = node?.data as CanvasNodeData<SkillNodeMeta>;
      const {
        query = '',
        contextItems = [],
        selectedSkill,
        modelInfo,
        runtimeConfig = {},
        tplConfig,
        projectId,
      } = data?.metadata ?? {};
      const { runtimeConfig: contextRuntimeConfig } = useContextPanelStore.getState();
      const finalProjectId = getFinalProjectId(projectId);

      deleteElements({ nodes: [node] });

      setTimeout(() => {
        const resultId = genActionResultID();
        invokeAction(
          {
            resultId,
            ...data?.metadata,
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
        addNode(
          {
            type: 'skillResponse',
            data: {
              title: query,
              entityId: resultId,
              metadata: {
                ...data?.metadata,
                status: 'executing',
                contextItems,
                tplConfig,
                selectedSkill,
                modelInfo,
                runtimeConfig: {
                  ...contextRuntimeConfig,
                  ...runtimeConfig,
                },
                structuredData: {
                  query,
                },
                projectId: finalProjectId,
              },
            },
            position: node.position,
          },
          convertContextItemsToNodeFilters(contextItems),
        );
      });
    }, [id, getNode, deleteElements, invokeAction, canvasId, addNode, form]);

    const handleDelete = useCallback(() => {
      const currentNode = getNode(id);
      deleteNode({
        id,
        type: 'skill',
        data,
        position: currentNode?.position || { x: 0, y: 0 },
      });
    }, [id, data, getNode, deleteNode]);

    useEffect(() => {
      const handleNodeRun = () => handleSendMessage();
      const handleNodeDelete = () => handleDelete();

      nodeActionEmitter.on(createNodeEventName(id, 'run'), handleNodeRun);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

      return () => {
        nodeActionEmitter.off(createNodeEventName(id, 'run'), handleNodeRun);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        cleanupNodeEvents(id);
      };
    }, [id, handleSendMessage, handleDelete]);

    // Use the new custom hook instead of the local implementation
    const { debouncedUpdateContextItems } = useContextUpdateByEdges({
      readonly,
      nodeId: id,
      updateNodeData: (data) => updateNodeData(data),
    });

    // listen to edges changes and automatically update contextItems
    useEffect(() => {
      const handleEdgeChange = (data: { newEdges: Edge[] }) => {
        const node = getNode(id) as CanvasNode<SkillNodeMeta>;
        if (!node) return;
        const contextItems = node.data?.metadata?.contextItems ?? [];
        debouncedUpdateContextItems(contextItems, data.newEdges ?? []);
      };

      edgeEventsEmitter.on('edgeChange', handleEdgeChange);

      return () => edgeEventsEmitter.off('edgeChange', handleEdgeChange);
    }, [id, debouncedUpdateContextItems]);

    return (
      <div className={classNames({ nowheel: isOperating && isHovered })}>
        <div
          ref={targetRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={classNames({
            'relative group nodrag nopan select-text': isOperating,
          })}
          style={safeContainerStyle}
        >
          <div className={`w-full h-full  ${getNodeCommonStyles({ selected, isHovered })}`}>
            {
              <>
                <CustomHandle
                  id={`${id}-target`}
                  nodeId={id}
                  type="target"
                  position={Position.Left}
                  isConnected={isTargetConnected}
                  isNodeHovered={isHovered}
                  nodeType="skill"
                />
                <CustomHandle
                  id={`${id}-source`}
                  nodeId={id}
                  type="source"
                  position={Position.Right}
                  isConnected={isSourceConnected}
                  isNodeHovered={isHovered}
                  nodeType="skill"
                />
              </>
            }

            {!readonly && (
              <NodeActionButtons
                nodeId={id}
                nodeType="skill"
                isNodeHovered={isHovered}
                isSelected={selected}
              />
            )}

            {metadata.searchNode || metadata.missingInfoNode ? (
              <SimpleSearchComponent
                query={localQuery}
                setQuery={setQuery}
                onSearch={handleSendMessage}
                readonly={readonly}
                nodeType={metadata.missingInfoNode ? 'missingInfo' : 'search'}
              />
            ) : (
              <ChatPanel
                mode="node"
                readonly={readonly}
                query={localQuery}
                setQuery={setQuery}
                selectedSkill={skill}
                setSelectedSkill={setSelectedSkill}
                contextItems={contextItems}
                setContextItems={setContextItems}
                modelInfo={modelInfo}
                setModelInfo={setModelInfo}
                runtimeConfig={runtimeConfig || {}}
                setRuntimeConfig={setRuntimeConfig}
                tplConfig={tplConfig}
                setTplConfig={setTplConfig}
                handleSendMessage={handleSendMessage}
                handleAbortAction={abortAction}
                onInputHeightChange={() => updateSize({ height: 'auto' })}
                projectId={projectId}
                handleProjectChange={(projectId) => {
                  handleProjectChange(projectId);
                  updateNodeData({ metadata: { projectId } });
                }}
              />
            )}
          </div>
        </div>

        {!readonly && (
          <NodeResizerComponent
            moveableRef={moveableRef}
            targetRef={targetRef}
            isSelected={selected}
            isHovered={isHovered}
            isPreview={false}
            onResize={handleResize}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Optimize re-renders by comparing only necessary props
    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.data?.title === nextProps.data?.title &&
      JSON.stringify(prevProps.data?.metadata) === JSON.stringify(nextProps.data?.metadata)
    );
  },
);

SkillNode.displayName = 'SkillNode';
