import { useTranslation } from 'react-i18next';
import {
  useListProviderItems,
  useDeleteProviderItem,
} from '@refly-packages/ai-workspace-common/queries';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useState, useMemo, useCallback } from 'react';
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
} from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { LuPlus, LuSearch } from 'react-icons/lu';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import {
  IconDelete,
  IconEdit,
  IconMoreHorizontal,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { ProviderItem } from '@refly/openapi-schema';
import { ModelIcon } from '@lobehub/icons';
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

const ModelItem = ({
  model,
  onEdit,
  onDelete,
  onToggleEnabled,
  isSubmitting,
}: {
  model: ProviderItem;
  onEdit: (model: ProviderItem) => void;
  onDelete: (itemId: string) => void;
  onToggleEnabled: (model: ProviderItem, enabled: boolean) => void;
  isSubmitting: boolean;
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
    <div className="mb-3 px-4 py-2 hover:bg-gray-50 rounded-md cursor-pointer border border-solid border-gray-100">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex-1 flex items-center gap-2">
          <ModelIcon model={model.config?.modelId || model.name} size={18} type={'color'} />
          <div className="font-medium">{model.name}</div>
        </div>

        <div className="flex items-center gap-2">
          <ActionDropdown model={model} handleEdit={handleEdit} handleDelete={handleDelete} />

          <Tooltip
            title={
              model.enabled ? t('settings.modelConfig.disable') : t('settings.modelConfig.enable')
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
  );
};

export const ModelConfig = () => {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useListProviderItems({
    query: {
      category: 'llm',
    },
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ProviderItem | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const modelItems = data?.data || ([] as ProviderItem[]);

  const updateModelMutation = useCallback(
    async (values: any, model: ProviderItem) => {
      setIsUpdating(true);
      const res = await getClient().updateProviderItem({
        body: {
          ...values,
          itemId: model.itemId,
          config: {
            ...model.config,
            modelId: values.modelId,
            modelName: values.name,
          },
        },
        query: {
          providerId: values.providerId,
        },
      });
      setIsUpdating(false);
      if (res.data.success) {
        refetch();
        message.success(t('common.saveSuccess'));
      }
    },
    [refetch],
  );

  const deleteModelMutation = useDeleteProviderItem(null, {
    onSuccess: () => {
      message.success(t('common.deleteSuccess'));
      refetch();
    },
    onError: (error) => {
      console.error('Failed to delete model', error);
    },
  });

  const handleAddModel = () => {
    setEditingModel(null);
    setIsModalOpen(true);
  };

  const handleEditModel = (model: ProviderItem) => {
    setEditingModel(model);
    setIsModalOpen(true);
  };

  const handleDeleteModel = (itemId: string) => {
    deleteModelMutation.mutate({
      body: { itemId },
    });
  };

  const handleToggleEnabled = async (model: ProviderItem, enabled: boolean) => {
    updateModelMutation({ enabled }, model);
  };

  const handleSuccess = () => {
    refetch();
    setIsModalOpen(false);
    setEditingModel(null);
  };

  const filteredModels = useMemo(() => {
    const items = modelItems;

    if (!searchQuery.trim()) return items;

    const lowerQuery = searchQuery.toLowerCase();
    return items.filter((model) => model.name?.toLowerCase().includes(lowerQuery));
  }, [modelItems, searchQuery]);

  return (
    <div className="p-4 pt-0 h-full overflow-hidden flex flex-col">
      <Title level={4} className="pb-4">
        {t('settings.tabs.modelConfig')}
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
          onClick={handleAddModel}
        >
          {t('settings.modelConfig.addModel')}
        </Button>
      </div>

      {/* Models List */}
      <div
        className={cn(
          'flex-1 overflow-auto',
          isLoading || filteredModels.length === 0 ? 'flex items-center justify-center' : '',
          filteredModels.length === 0 ? 'border-dashed border-gray-200 rounded-md' : '',
        )}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Spin />
          </div>
        ) : filteredModels.length === 0 ? (
          <Empty
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
              <Button onClick={handleAddModel} icon={<LuPlus className="flex items-center" />}>
                {t('settings.modelConfig.addFirstModel')}
              </Button>
            )}
          </Empty>
        ) : (
          <div>
            <div>
              {filteredModels.map((model) => (
                <ModelItem
                  key={model.itemId}
                  model={model}
                  onEdit={handleEditModel}
                  onDelete={handleDeleteModel}
                  onToggleEnabled={handleToggleEnabled}
                  isSubmitting={isUpdating}
                />
              ))}
            </div>
            <div className="text-center text-gray-400 text-sm mt-4 pb-10">{t('common.noMore')}</div>
          </div>
        )}
      </div>

      {/* Modal for Create and Edit */}
      <ModelFormModal
        isOpen={isModalOpen}
        filterProviderCategory="llm"
        onClose={() => {
          setIsModalOpen(false);
          setEditingModel(null);
        }}
        model={editingModel}
        onSuccess={handleSuccess}
      />
    </div>
  );
};
