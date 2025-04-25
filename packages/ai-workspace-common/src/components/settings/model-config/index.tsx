import { useTranslation } from 'react-i18next';
import { useDeleteProviderItem } from '@refly-packages/ai-workspace-common/queries';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  Button,
  Input,
  Empty,
  Switch,
  Tooltip,
  Dropdown,
  Popconfirm,
  Typography,
  message,
  MenuProps,
  Divider,
} from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { LuPlus, LuSearch, LuGripVertical } from 'react-icons/lu';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import {
  IconDelete,
  IconEdit,
  IconMoreHorizontal,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { LLMModelConfig, ProviderCategory, ProviderItem } from '@refly/openapi-schema';
import { ModelIcon } from '@lobehub/icons';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { ModelFormModal } from './model-form';

const { Title } = Typography;

const ActionDropdown = ({
  model,
  handleEdit,
  handleDelete,
}: {
  model: ProviderItem;
  handleEdit: () => void;
  handleDelete: () => void;
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const items: MenuProps['items'] = [
    {
      label: (
        <div className="flex items-center flex-grow">
          <IconEdit size={16} className="mr-2" />
          {t('common.edit')}
        </div>
      ),
      key: 'edit',
      onClick: () => handleEdit(),
    },
    {
      label: (
        <Popconfirm
          placement="bottomLeft"
          title={t('settings.modelConfig.deleteConfirm', {
            name: model.name || t('common.untitled'),
          })}
          onConfirm={() => handleDelete()}
          onCancel={() => setVisible(false)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          overlayStyle={{ maxWidth: '300px' }}
        >
          <div className="flex items-center text-red-600 flex-grow">
            <IconDelete size={16} className="mr-2" />
            {t('common.delete')}
          </div>
        </Popconfirm>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setVisible(open);
    }
  };

  return (
    <Dropdown trigger={['click']} open={visible} onOpenChange={handleOpenChange} menu={{ items }}>
      <Button type="text" icon={<IconMoreHorizontal />} />
    </Dropdown>
  );
};

const ModelItem = memo(
  ({
    model,
    onEdit,
    onDelete,
    onToggleEnabled,
    isSubmitting,
    index,
    draggable = true,
  }: {
    model: ProviderItem;
    onEdit: (model: ProviderItem) => void;
    onDelete: (itemId: string) => void;
    onToggleEnabled: (model: ProviderItem, enabled: boolean) => void;
    isSubmitting: boolean;
    index: number;
    draggable?: boolean;
  }) => {
    const { t } = useTranslation();

    const handleToggleChange = useCallback(
      (checked: boolean) => {
        onToggleEnabled(model, checked);
      },
      [model, onToggleEnabled],
    );

    const handleSwitchWrapperClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
    }, []);

    const handleEdit = useCallback(() => {
      onEdit(model);
    }, [model, onEdit]);

    const handleDelete = useCallback(() => {
      onDelete(model.itemId);
    }, [model.itemId, onDelete]);

    return (
      <Draggable draggableId={model.itemId} index={index}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className="mb-3 px-4 py-0.5 hover:bg-gray-50 rounded-md cursor-pointer border border-solid border-gray-100 group"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1 flex items-center gap-2">
                {draggable && (
                  <div
                    {...provided.dragHandleProps}
                    className="p-1 text-gray-400 hover:text-green-600 group-hover:opacity-100 opacity-0 hidden group-hover:block transition-opacity duration-200"
                  >
                    <LuGripVertical size={16} className="flex items-center" />
                  </div>
                )}

                <ModelIcon
                  model={(model.config as LLMModelConfig)?.modelId || model.name}
                  size={18}
                  type={'color'}
                />
                <div className="font-medium">{model.name}</div>
              </div>

              <div className="flex items-center gap-2">
                <ActionDropdown model={model} handleEdit={handleEdit} handleDelete={handleDelete} />

                <Tooltip
                  title={
                    model.enabled
                      ? t('settings.modelConfig.disable')
                      : t('settings.modelConfig.enable')
                  }
                >
                  <div onClick={handleSwitchWrapperClick} className="flex items-center">
                    <Switch
                      size="small"
                      checked={model.enabled ?? false}
                      onChange={handleToggleChange}
                      loading={isSubmitting}
                    />
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>
        )}
      </Draggable>
    );
  },
);

export const ModelConfig = ({ visible }: { visible: boolean }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState<ProviderCategory>('llm');
  const [modelItems, setModelItems] = useState<ProviderItem[]>([]);
  const [embedding, setEmbedding] = useState<ProviderItem | null>(null);
  const [reranker, setReranker] = useState<ProviderItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ProviderItem | null>(null);

  const batchUpdateProviderItems = async (items: ProviderItem[]) => {
    const res = await getClient().batchUpdateProviderItems({
      body: { items: items.map((item, index) => ({ ...item, order: index })) },
    });
    if (res.data.success) {
      message.success(t('common.saveSuccess'));
    }
  };

  const getProviderItems = useCallback(async () => {
    setIsLoading(true);
    const res = await getClient().listProviderItems();
    setIsLoading(false);
    if (res?.data?.success) {
      const list = res?.data?.data || [];
      setModelItems(list.filter((item) => item.category === 'llm'));
      setEmbedding(list.filter((item) => item.category === 'embedding')?.[0]);
      setReranker(list.filter((item) => item.category === 'reranker')?.[0]);
    }
  }, []);

  const updateModelMutation = useCallback(
    async (enabled: boolean, model: ProviderItem) => {
      setIsUpdating(true);
      const res = await getClient().updateProviderItem({
        body: {
          ...model,
          enabled,
        },
        query: {
          providerId: model.providerId,
        },
      });
      setIsUpdating(false);
      if (res.data.success) {
        const updatedModel = res.data.data;
        setModelItems(
          modelItems.map((item) => (item.itemId === updatedModel.itemId ? updatedModel : item)),
        );
        message.success(t('common.saveSuccess'));
      }
    },
    [modelItems],
  );

  const deleteModelMutation = useDeleteProviderItem(null, {
    onSuccess: (data) => {
      message.success(t('common.deleteSuccess'));
      console.log('data', data);
      // setModelItems(modelItems.filter((item) => item.itemId !== data.itemId));
    },
    onError: (error) => {
      console.error('Failed to delete model', error);
    },
  });

  const handleAddModel = (category: ProviderCategory) => {
    setCategory(category);
    setEditingModel(null);
    setIsModalOpen(true);
  };

  const handleEditModel = (model: ProviderItem) => {
    setEditingModel(model);
    setCategory(model.category);
    setIsModalOpen(true);
  };

  const handleEditEmbedding = () => {
    if (embedding) {
      handleEditModel(embedding);
    } else {
      handleAddModel('embedding');
    }
  };

  const handleEditReranker = () => {
    if (reranker) {
      handleEditModel(reranker);
    } else {
      handleAddModel('reranker');
    }
  };

  const handleDeleteModel = (itemId: string) => {
    deleteModelMutation.mutate({
      body: { itemId },
    });
  };

  const handleToggleEnabled = async (model: ProviderItem, enabled: boolean) => {
    updateModelMutation(enabled, model);
  };

  const handleSuccess = (
    categoryType: ProviderCategory,
    type?: 'create' | 'update',
    model?: ProviderItem,
  ) => {
    if (categoryType === 'llm') {
      if (type === 'create') {
        setModelItems([...modelItems, model]);
      } else if (type === 'update') {
        setModelItems([
          ...modelItems.map((item) => (item.itemId === model.itemId ? { ...model } : item)),
        ]);
      }
    } else if (categoryType === 'embedding') {
      setEmbedding(model);
    } else if (categoryType === 'reranker') {
      setReranker(model);
    }
    setIsModalOpen(false);
    setEditingModel(null);
  };

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source } = result;

      // If dropped outside the list or no movement
      if (!destination || destination.index === source.index) {
        return;
      }

      // Reorder the list
      const reorderedItems = Array.from(modelItems);
      const [removed] = reorderedItems.splice(source.index, 1);
      reorderedItems.splice(destination.index, 0, removed);

      // Update the order property for each item
      const updatedItems = reorderedItems.map((item, index) => ({
        ...item,
        order: index,
      }));

      // Update the state with the new order
      setModelItems(updatedItems);

      batchUpdateProviderItems(updatedItems);
    },
    [modelItems, batchUpdateProviderItems],
  );

  const filteredModels = useMemo(() => {
    const items = modelItems;

    if (!searchQuery.trim()) return items;

    const lowerQuery = searchQuery.toLowerCase();
    return items.filter((model) => model.name?.toLowerCase().includes(lowerQuery));
  }, [modelItems, searchQuery]);

  const draggable = useMemo(() => {
    return searchQuery.trim() === '';
  }, [searchQuery]);

  useEffect(() => {
    if (visible) {
      getProviderItems();
    }
  }, [visible]);

  return (
    <div className="p-4 pt-0 h-full overflow-hidden flex flex-col">
      <Title level={4} className="pb-4">
        {t('settings.modelConfig.chatModels')}
      </Title>

      {/* Search and Add Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-xs">
          <Input
            prefix={<LuSearch className="h-4 w-4 text-gray-400" />}
            placeholder={t('settings.modelConfig.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Button
          type="primary"
          icon={<LuPlus className="h-5 w-5 flex items-center" />}
          onClick={() => handleAddModel('llm')}
        >
          {t('settings.modelConfig.addModel')}
        </Button>
      </div>

      {/* Models List */}
      <div
        className={cn(
          isLoading || filteredModels.length === 0 ? 'flex items-center justify-center' : '',
          filteredModels.length === 0 ? 'p-4 border-dashed border-gray-200 rounded-md' : '',
          'max-h-[400px] min-h-[50px] overflow-y-auto',
        )}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Spin />
          </div>
        ) : filteredModels.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchQuery ? (
                <>
                  <p>{t('settings.modelConfig.noSearchResults')}</p>
                  <p className="text-sm text-gray-400">
                    {t('settings.modelConfig.tryDifferentSearch')}
                  </p>
                </>
              ) : (
                <p>{t('settings.modelConfig.noModels')}</p>
              )
            }
          >
            {!searchQuery && (
              <Button
                onClick={() => handleAddModel('llm')}
                icon={<LuPlus className="flex items-center" />}
              >
                {t('settings.modelConfig.addFirstModel')}
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="model-list">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {filteredModels.map((model, index) => (
                      <ModelItem
                        key={model.itemId}
                        model={model}
                        onEdit={handleEditModel}
                        onDelete={handleDeleteModel}
                        onToggleEnabled={handleToggleEnabled}
                        isSubmitting={isUpdating}
                        index={index}
                        draggable={draggable}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="text-center text-gray-400 text-sm mt-4 pb-10">{t('common.noMore')}</div>
          </>
        )}
      </div>

      <Divider />

      <Title level={4} className="pb-4">
        {t('settings.modelConfig.otherModels')}
      </Title>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-medium">{t('settings.modelConfig.embedding')}</div>
            <div className="text-xs text-gray-500">
              {t('settings.modelConfig.embeddingDescription')}
            </div>
          </div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleEditEmbedding()}
          >
            <Button
              type="text"
              icon={<IconEdit size={16} className="text-gray-700" />}
              iconPosition="end"
              className={cn(embedding?.name ? 'text-gray-500' : 'text-gray-400', 'text-sm')}
            >
              {embedding?.name || t('settings.modelConfig.clickToSet')}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-medium">{t('settings.modelConfig.reranker')}</div>
            <div className="text-xs text-gray-500">
              {t('settings.modelConfig.rerankerDescription')}
            </div>
          </div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleEditReranker()}
          >
            <Button
              type="text"
              icon={<IconEdit size={16} className="text-gray-700" />}
              iconPosition="end"
              className={cn(reranker?.name ? 'text-gray-500' : 'text-gray-400', 'text-sm')}
            >
              {reranker?.name || t('settings.modelConfig.clickToSet')}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal for Create and Edit */}
      <ModelFormModal
        isOpen={isModalOpen}
        filterProviderCategory={category}
        onClose={() => {
          setIsModalOpen(false);
          setEditingModel(null);
        }}
        model={editingModel}
        onSuccess={handleSuccess}
        disabledEnableControl={['embedding', 'reranker'].includes(category)}
      />
    </div>
  );
};
