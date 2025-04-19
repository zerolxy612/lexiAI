import { useTranslation } from 'react-i18next';
import {
  useListProviderItems,
  useCreateProviderItem,
  useDeleteProviderItem,
  useUpdateProviderItem,
} from '@refly-packages/ai-workspace-common/queries';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Modal,
  Empty,
  Form,
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

const { Title } = Typography;

interface ModelItem {
  id: string;
  name: string;
  provider: string;
  enabled?: boolean;
  [key: string]: any;
}

interface ProviderItemsResponse {
  items?: ModelItem[];
  [key: string]: any;
}

const ActionDropdown = ({
  model,
  handleEdit,
  handleDelete,
}: {
  model: ModelItem;
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
  model: ModelItem;
  onEdit: (model: ModelItem) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (model: ModelItem, enabled: boolean) => void;
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
    onDelete(model.id);
  }, [model.id, onDelete]);

  return (
    <div className="mb-3 p-4 hover:bg-gray-50 rounded-md cursor-pointer border border-solid border-gray-100">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex-1 flex items-center">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
            {model.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-medium">{model.name}</div>
            <div className="text-sm text-gray-500">{model.provider}</div>
          </div>
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

const ModelFormModal = ({
  isOpen,
  onClose,
  model,
  onSave,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  model?: ModelItem | null;
  onSave: (values: any) => void;
  isSubmitting: boolean;
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEditMode = !!model;

  // Reset form when modal opens or model changes
  useEffect(() => {
    if (isOpen) {
      if (model) {
        form.setFieldsValue({
          name: model.name,
          provider: model.provider,
          enabled: model.enabled ?? true,
          // Set other fields as needed
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          enabled: true,
        });
      }
    }
  }, [model, isOpen, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSave(values);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const modalTitle = isEditMode
    ? t('settings.modelConfig.editModel')
    : t('settings.modelConfig.addModel');

  const submitButtonText = isEditMode
    ? t('settings.modelConfig.update')
    : t('settings.modelConfig.add');

  return (
    <Modal
      title={modalTitle}
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common.cancel')}
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} loading={isSubmitting}>
          {submitButtonText}
        </Button>,
      ]}
    >
      <Form form={form} className="mt-6" layout="vertical">
        <Form.Item
          name="name"
          label={t('settings.modelConfig.name')}
          rules={[{ required: true, message: t('settings.modelConfig.nameRequired') }]}
        >
          <Input placeholder={t('settings.modelConfig.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          name="provider"
          label={t('settings.modelConfig.provider')}
          rules={[{ required: true, message: t('settings.modelConfig.providerRequired') }]}
        >
          <Input placeholder={t('settings.modelConfig.providerPlaceholder')} />
        </Form.Item>

        <Form.Item name="enabled" label={t('settings.modelConfig.enabled')} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const ModelConfig = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: modelItems, isLoading } = useListProviderItems();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createModelMutation = useCreateProviderItem(undefined, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listProviderItems'] });
      setIsModalOpen(false);
      setEditingModel(null);
      message.success(t('settings.modelConfig.addSuccess'));
    },
    onError: (error) => {
      message.error(
        `${t('settings.modelConfig.addError')}: ${(error as any)?.message ?? t('common.unknownError')}`,
      );
    },
  });

  const updateModelMutation = useUpdateProviderItem(undefined, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listProviderItems'] });
      setIsModalOpen(false);
      setEditingModel(null);
      message.success(t('settings.modelConfig.updateSuccess'));
    },
    onError: (error) => {
      message.error(
        `${t('settings.modelConfig.updateError')}: ${(error as any)?.message ?? t('common.unknownError')}`,
      );
    },
  });

  const deleteModelMutation = useDeleteProviderItem(undefined, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listProviderItems'] });
      message.success(t('settings.modelConfig.deleteSuccess'));
    },
    onError: (error) => {
      message.error(
        `${t('settings.modelConfig.deleteError')}: ${(error as any)?.message ?? t('common.unknownError')}`,
      );
    },
  });

  const handleAddModel = () => {
    setEditingModel(null);
    setIsModalOpen(true);
  };

  const handleEditModel = (model: ModelItem) => {
    setEditingModel(model);
    setIsModalOpen(true);
  };

  const handleDeleteModel = (modelId: string) => {
    deleteModelMutation.mutate({
      clientOptions: {
        data: { id: modelId },
      },
    } as any);
  };

  const handleToggleEnabled = async (model: ModelItem, enabled: boolean) => {
    setIsSubmitting(true);
    try {
      updateModelMutation.mutate({
        clientOptions: {
          data: {
            id: model.id,
            enabled,
          },
        },
      } as any);
    } catch (error) {
      console.error('Failed to update model status', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveModel = (values: any) => {
    if (editingModel) {
      // Update existing model
      updateModelMutation.mutate({
        clientOptions: {
          data: {
            id: editingModel.id,
            ...values,
          },
        },
      } as any);
    } else {
      // Create new model
      createModelMutation.mutate({
        clientOptions: {
          data: values,
        },
      } as any);
    }
  };

  const filteredModels = useMemo(() => {
    const items = (modelItems as ProviderItemsResponse)?.items || [];

    if (!searchQuery.trim()) return items;

    const lowerQuery = searchQuery.toLowerCase();
    return items.filter(
      (model) =>
        model.name?.toLowerCase().includes(lowerQuery) ||
        model.provider?.toLowerCase().includes(lowerQuery),
    );
  }, [modelItems, searchQuery]);

  return (
    <div className="p-4 pt-0 h-full overflow-hidden flex flex-col">
      <Title level={4} className="pb-4">
        {t('settings.modelConfig.title')}
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
          'min-h-[300px] flex-1 overflow-auto',
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
          <>
            <div>
              {filteredModels.map((model) => (
                <ModelItem
                  key={model.id}
                  model={model}
                  onEdit={handleEditModel}
                  onDelete={handleDeleteModel}
                  onToggleEnabled={handleToggleEnabled}
                  isSubmitting={isSubmitting}
                />
              ))}
            </div>
            <div className="text-center text-gray-400 text-sm mt-4">{t('common.noMore')}</div>
          </>
        )}
      </div>

      {/* Modal for Create and Edit */}
      <ModelFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingModel(null);
        }}
        model={editingModel}
        onSave={handleSaveModel}
        isSubmitting={createModelMutation.isPending || updateModelMutation.isPending}
      />
    </div>
  );
};
