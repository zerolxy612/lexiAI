import { useState, useCallback, useEffect, memo, useRef, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useTranslation } from 'react-i18next';
import { CloseOutlined, ToolOutlined } from '@ant-design/icons';
import { Badge, Button, Form, Input, Upload } from 'antd';
import { ModelInfo, Skill, SkillRuntimeConfig, SkillTemplateConfig } from '@refly/openapi-schema';
import { CanvasNode, CanvasNodeData, SkillNodeMeta } from '../nodes/shared/types';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import {
  ChatActions,
  CustomAction,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import {
  IContextItem,
  useContextPanelStore,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { genActionResultID } from '@refly/utils/id';
import { convertContextItemsToNodeFilters } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useReactFlow } from '@xyflow/react';
import { McpSelectorPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';
import { t } from 'i18next';
import { cn } from '@refly/utils/cn';

const { TextArea } = Input;

// Memoized Header Component
const NodeHeader = memo(
  ({
    selectedSkillName,
    setSelectedSkill,
    readonly,
  }: {
    selectedSkillName?: string;
    setSelectedSkill: (skill: Skill | null) => void;
    readonly: boolean;
  }) => {
    const { t } = useTranslation();
    return (
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#6172F3] shadow-lg flex items-center justify-center flex-shrink-0">
            {getSkillIcon(selectedSkillName, 'w-4 h-4 text-white')}
          </div>
          <span className="text-sm font-medium leading-normal text-[rgba(0,0,0,0.8)] truncate dark:text-[rgba(225,225,225,0.8)]">
            {selectedSkillName
              ? t(`${selectedSkillName}.name`, { ns: 'skill' })
              : t('canvas.skill.askAI')}
          </span>
        </div>
        {selectedSkillName && !readonly && (
          <Button
            type="text"
            size="small"
            className="p-0"
            icon={<CloseOutlined />}
            onClick={() => {
              setSelectedSkill?.(null);
            }}
          />
        )}
      </div>
    );
  },
);

NodeHeader.displayName = 'NodeHeader';

interface SkillNodePreviewProps {
  node: CanvasNode<SkillNodeMeta>;
}

export const SkillNodePreview = memo(({ node }: SkillNodePreviewProps) => {
  const [form] = Form.useForm();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const chatInputRef = useRef<HTMLDivElement>(null);
  const { deleteElements } = useReactFlow();

  const { entityId, metadata = {} } = node?.data ?? {};
  const {
    query,
    selectedSkill,
    modelInfo,
    contextItems = [],
    tplConfig,
    runtimeConfig,
    viewMode,
  } = metadata;
  const skill = useFindSkill(selectedSkill?.name);

  const [localQuery, setLocalQuery] = useState(query);
  const [documentContent, setDocumentContent] = useState(metadata?.documentContent || '');

  // Debug log for contract review mode
  useEffect(() => {
    if (viewMode === 'contract-review') {
      console.log('🎯 [Contract Review] Node preview initialized:', {
        viewMode,
        selectedSkill,
        modelInfo,
        documentContent,
        entityId,
      });
    }
  }, [viewMode, selectedSkill, modelInfo, documentContent, entityId]);

  // Update local state when query changes from external sources
  useEffect(() => {
    if (query !== localQuery) {
      setLocalQuery(query);
    }
  }, [query]);

  // Update documentContent when metadata changes
  useEffect(() => {
    if (metadata?.documentContent !== documentContent) {
      setDocumentContent(metadata?.documentContent || '');
    }
  }, [metadata?.documentContent]);

  const { skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
    setSkillSelectedModel: state.setSkillSelectedModel,
  }));

  const { invokeAction, abortAction } = useInvokeAction();
  const { canvasId, readonly } = useCanvasContext();
  const { handleUploadImage } = useUploadImage();
  const { addNode } = useAddNode();
  const setNodeDataByEntity = useSetNodeDataByEntity();

  const updateNodeData = useDebouncedCallback((data: Partial<CanvasNodeData<SkillNodeMeta>>) => {
    if (node?.id) {
      setNodeDataByEntity({ entityId, type: 'skill' }, data);
    }
  }, 50);

  const setQuery = useCallback(
    (query: string) => {
      setLocalQuery(query);
      updateNodeData({ title: query, metadata: { query } });
    },
    [updateNodeData],
  );

  const setModelInfo = useCallback(
    (modelInfo: ModelInfo | null) => {
      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { modelInfo } });
      setSkillSelectedModel(modelInfo);
    },
    [entityId, setNodeDataByEntity, setSkillSelectedModel],
  );

  const setContextItems = useCallback(
    (items: IContextItem[]) => {
      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { contextItems: items } });
    },
    [entityId, setNodeDataByEntity],
  );

  const setRuntimeConfig = useCallback(
    (runtimeConfig: SkillRuntimeConfig) => {
      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { runtimeConfig } });
    },
    [entityId, setNodeDataByEntity],
  );

  const setDocumentContentValue = useCallback(
    (content: string) => {
      setDocumentContent(content);
      updateNodeData({ metadata: { documentContent: content } });
    },
    [updateNodeData],
  );

  // Handle document upload and content extraction
  const handleDocumentUpload = useCallback(
    async (file: File) => {
      try {
        console.log('🎯 [Contract] Processing file:', file.name, file.type);

        // For now, let's implement basic text file reading
        // TODO: Add support for PDF, DOC parsing using project's existing logic
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          const content = await file.text();
          setDocumentContentValue(content);
          console.log('🎯 [Contract] Text content extracted, length:', content.length);
        } else {
          // For other file types, show a placeholder message
          const placeholder = `[Document: ${file.name}]\nThis is a ${file.type} file. Document content extraction will be implemented using the project's existing document processing logic.`;
          setDocumentContentValue(placeholder);
          console.log('🎯 [Contract] Placeholder content set for:', file.type);
        }
      } catch (error) {
        console.error('🎯 [Contract] Error processing file:', error);
      }
    },
    [setDocumentContentValue],
  );

  useEffect(() => {
    if (skillSelectedModel && !modelInfo) {
      setModelInfo(skillSelectedModel);
    }
  }, [skillSelectedModel, modelInfo]);

  // Initialize model for contract review mode
  useEffect(() => {
    if (viewMode === 'contract-review' && !modelInfo) {
      const contractModelInfo = {
        name: 'hkgai/contract',
        label: 'HKGAI Contract Review',
        provider: 'hkgai',
        providerItemId: 'hkgai-contract-item',
        tier: 't2' as const,
        contextLimit: 16000,
        maxOutput: 4000,
        capabilities: {},
        isDefault: false,
      };
      setModelInfo(contractModelInfo);
    }
  }, [viewMode, modelInfo]);

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

      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { selectedSkill } });
    },
    [entityId, form, setNodeDataByEntity],
  );

  const handleSelectSkill = useCallback(
    (skillToSelect: Skill | null) => {
      // Ensure we don't trigger updates if skill is the same
      if (skillToSelect?.name === selectedSkill?.name) return;

      setQuery(localQuery?.slice(0, -1) ?? '');
      setSelectedSkill(skillToSelect);
    },
    [localQuery, selectedSkill?.name, setQuery, setSelectedSkill],
  );

  const handleSendMessage = useCallback(() => {
    if (!node) return;

    const data = node?.data as CanvasNodeData<SkillNodeMeta>;
    const {
      query = '',
      contextItems = [],
      runtimeConfig = {},
      documentContent: nodeDocumentContent = '',
    } = data?.metadata ?? {};
    const { runtimeConfig: contextRuntimeConfig = {} } = useContextPanelStore.getState();

    const tplConfig = form.getFieldValue('tplConfig');

    // Use current documentContent state for contract review mode
    const finalDocumentContent =
      viewMode === 'contract-review' ? documentContent : nodeDocumentContent;

    // For contract review mode, include document content in query
    let finalQuery = query;
    if (viewMode === 'contract-review' && finalDocumentContent) {
      finalQuery = `请审查以下合同文档：\n\n${finalDocumentContent}\n\n用户问题：${query || '请审查这份合同并指出潜在的法律风险'}`;
      console.log(
        '🎯 [Contract] Final query with document content:',
        finalQuery.substring(0, 200) + '...',
      );
    }

    deleteElements({ nodes: [node] });

    setTimeout(() => {
      const resultId = genActionResultID();
      invokeAction(
        {
          resultId,
          ...data?.metadata,
          query: finalQuery, // Use modified query for contract review
          tplConfig,
          runtimeConfig: {
            ...contextRuntimeConfig,
            ...runtimeConfig,
          },
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
            title: viewMode === 'contract-review' ? 'Legal Contract Review' : query,
            entityId: resultId,
            metadata: {
              status: 'executing',
              contextItems,
              tplConfig,
            },
          },
          position: node.position,
        },
        convertContextItemsToNodeFilters(contextItems),
      );
    });
  }, [node, deleteElements, invokeAction, canvasId, addNode, form, viewMode, documentContent]);

  const handleImageUpload = async (file: File) => {
    const nodeData = await handleUploadImage(file, canvasId);
    if (nodeData) {
      const newContextItems = [
        ...(contextItems ?? []),
        {
          type: 'image' as const,
          ...nodeData,
        },
      ];
      setContextItems(newContextItems as IContextItem[]);
    }
  };

  const handleTplConfigChange = useCallback(
    (config: SkillTemplateConfig) => {
      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { tplConfig: config } });
    },
    [entityId, setNodeDataByEntity],
  );

  const [mcpSelectorOpen, setMcpSelectorOpen] = useState<boolean>(false);

  // Toggle MCP selector panel
  const handleMcpSelectorToggle = useCallback(() => {
    setMcpSelectorOpen(!mcpSelectorOpen);
  }, [mcpSelectorOpen, setMcpSelectorOpen]);

  // 获取选择的 MCP 服务器
  const { selectedMcpServers } = useLaunchpadStoreShallow((state) => ({
    selectedMcpServers: state.selectedMcpServers,
  }));

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: (
          <Badge
            count={selectedMcpServers.length > 0 ? selectedMcpServers.length : 0}
            size="small"
            offset={[2, -2]}
          >
            <ToolOutlined className="flex items-center" />
          </Badge>
        ),
        title: t('copilot.chatActions.chooseMcp'),
        onClick: () => {
          handleMcpSelectorToggle();
        },
      },
    ],
    [handleMcpSelectorToggle, t, selectedMcpServers],
  );

  if (!node) return null;

  console.log('🎯 [SkillNodePreview] Rendering with:', {
    viewMode,
    modelInfo,
    selectedSkill,
    documentContent,
    entityId,
    isContractReview: viewMode === 'contract-review',
  });

  // Contract review mode UI
  if (viewMode === 'contract-review') {
    return (
      <div className="flex flex-col gap-3 h-full p-3 box-border">
        <McpSelectorPanel isOpen={mcpSelectorOpen} onClose={() => setMcpSelectorOpen(false)} />

        <NodeHeader
          readonly={readonly}
          selectedSkillName={skill?.name || 'Legal Contract Review'}
          setSelectedSkill={setSelectedSkill}
        />

        {/* Document Upload Interface */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('skill.contractReview.documentUpload', 'Upload Contract Document')}
          </label>
          <Upload.Dragger
            accept=".pdf,.doc,.docx,.txt"
            beforeUpload={(file) => {
              handleDocumentUpload(file);
              return false; // Prevent default upload
            }}
            showUploadList={true}
            maxCount={1}
            disabled={readonly}
            className="border-dashed border-2 border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors"
          >
            <div className="flex flex-col items-center justify-center py-6">
              <div className="text-4xl mb-2">📄</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('skill.contractReview.uploadHint', 'Click or drag contract file to upload')}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Support: PDF, DOC, DOCX, TXT
              </div>
              {documentContent && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                  ✓ Document content loaded ({documentContent.length} characters)
                </div>
              )}
            </div>
          </Upload.Dragger>
        </div>

        <ContextManager
          className="px-0.5"
          contextItems={contextItems}
          setContextItems={setContextItems}
        />

        {skill?.configSchema?.items?.length > 0 && (
          <ConfigManager
            readonly={readonly}
            key={skill?.name}
            form={form}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            schema={skill?.configSchema}
            tplConfig={tplConfig}
            fieldPrefix="tplConfig"
            configScope="runtime"
            resetConfig={() => {
              const defaultConfig = skill?.tplConfig ?? {};
              form.setFieldValue('tplConfig', defaultConfig);
            }}
            onFormValuesChange={(_changedValues, allValues) => {
              handleTplConfigChange(allValues.tplConfig);
            }}
          />
        )}

        <ChatActions
          customActions={customActions}
          query={'Contract Review'}
          model={modelInfo}
          setModel={setModelInfo}
          handleSendMessage={handleSendMessage}
          handleAbort={abortAction}
          onUploadImage={handleImageUpload}
          contextItems={contextItems}
          runtimeConfig={runtimeConfig}
          setRuntimeConfig={setRuntimeConfig}
          readonly={readonly}
        />
      </div>
    );
  }

  // Default skill node UI
  return (
    <div className="flex flex-col gap-3 h-full p-3 box-border">
      <McpSelectorPanel isOpen={mcpSelectorOpen} onClose={() => setMcpSelectorOpen(false)} />

      <NodeHeader
        readonly={readonly}
        selectedSkillName={skill?.name}
        setSelectedSkill={setSelectedSkill}
      />
      <ContextManager
        className="px-0.5"
        contextItems={contextItems}
        setContextItems={setContextItems}
      />
      <ChatInput
        readonly={readonly}
        ref={chatInputRef}
        query={localQuery}
        setQuery={setQuery}
        selectedSkillName={skill?.name}
        inputClassName="px-1 py-0"
        maxRows={100}
        handleSendMessage={handleSendMessage}
        handleSelectSkill={handleSelectSkill}
        onUploadImage={handleImageUpload}
      />
      {skill?.configSchema?.items?.length > 0 && (
        <ConfigManager
          readonly={readonly}
          key={skill?.name}
          form={form}
          formErrors={formErrors}
          setFormErrors={setFormErrors}
          schema={skill?.configSchema}
          tplConfig={tplConfig}
          fieldPrefix="tplConfig"
          configScope="runtime"
          resetConfig={() => {
            const defaultConfig = skill?.tplConfig ?? {};
            form.setFieldValue('tplConfig', defaultConfig);
          }}
          onFormValuesChange={(_changedValues, allValues) => {
            handleTplConfigChange(allValues.tplConfig);
          }}
        />
      )}

      <ChatActions
        customActions={customActions}
        query={localQuery}
        model={modelInfo}
        setModel={setModelInfo}
        handleSendMessage={handleSendMessage}
        handleAbort={abortAction}
        onUploadImage={handleImageUpload}
        contextItems={contextItems}
        runtimeConfig={runtimeConfig}
        setRuntimeConfig={setRuntimeConfig}
      />
    </div>
  );
});

SkillNodePreview.displayName = 'SkillNodePreview';
