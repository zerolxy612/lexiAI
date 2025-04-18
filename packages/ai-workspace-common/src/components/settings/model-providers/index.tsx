import { useTranslation } from 'react-i18next';
import { useListProviders } from '@refly-packages/ai-workspace-common/queries';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { Button, Input, Modal, Empty, Form, Switch } from 'antd';
import { LuSettings, LuPlus, LuSearch } from 'react-icons/lu';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';
const ProviderItem = React.memo(
  ({
    provider,
    onSettingsClick,
  }: { provider: Provider; onSettingsClick: (provider: Provider) => void }) => {
    return (
      <div
        className="mb-3 p-4 hover:bg-gray-50 rounded-md cursor-pointer border border-solid border-gray-100"
        onClick={() => onSettingsClick(provider)}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex-1 flex items-center">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
              {provider.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{provider.name}</div>
              <div className="text-sm text-gray-500">{provider.providerKey}</div>
            </div>
          </div>

          <Button
            type="text"
            icon={<LuSettings size={18} className="text-gray-500" />}
            onClick={() => onSettingsClick(provider)}
          />
        </div>
      </div>
    );
  },
);

const ProviderModal = React.memo(
  ({
    isOpen,
    onClose,
    provider,
    onSuccess,
  }: {
    isOpen: boolean;
    onClose: () => void;
    provider?: Provider | null;
    onSuccess?: () => void;
  }) => {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form] = Form.useForm();

    const isEditMode = !!provider;

    useEffect(() => {
      if (isOpen) {
        if (provider) {
          form.setFieldsValue({
            name: provider.name,
            apiKey: provider.apiKey,
            baseUrl: provider.baseUrl || '',
            enabled: provider.enabled,
          });
        } else {
          form.resetFields();
          form.setFieldsValue({
            enabled: true,
          });
        }
      }
    }, [provider, isOpen, form]);

    const handleSubmit = useCallback(async () => {
      try {
        const values = await form.validateFields();
        setIsSubmitting(true);

        if (isEditMode && provider) {
          const res = await getClient().updateProvider({
            body: {
              ...provider,
              name: values.name,
              enabled: values.enabled,
              apiKey: values.apiKey,
              baseUrl: values.baseUrl || undefined,
            },
          });
          if (res.data.success) {
            onSuccess?.();
            form.resetFields();
            onClose();
          }
        } else {
          const res = await getClient().createProvider({
            body: {
              name: values.name,
              enabled: values.enabled,
              apiKey: values.apiKey,
              baseUrl: values.baseUrl,
              providerKey: 'openai',
              category: 'llm',
              // TODO: add category and providerKey
            },
          });
          if (res.data.success) {
            onSuccess?.();
            form.resetFields();
            onClose();
          }
        }
      } catch (error) {
        console.error(`Failed to ${isEditMode ? 'update' : 'create'} provider`, error);
      } finally {
        setIsSubmitting(false);
      }
    }, [form, onClose, onSuccess, provider, isEditMode]);

    const modalTitle = isEditMode
      ? t('settings.modelProviders.editProvider')
      : t('settings.modelProviders.addProvider');

    const submitButtonText = isEditMode ? t('common.save') : t('common.add');

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
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('settings.modelProviders.name')}
            rules={[
              {
                required: true,
                message: t('settings.modelProviders.namePlaceholder'),
              },
            ]}
          >
            <Input placeholder={t('settings.modelProviders.namePlaceholder')} />
          </Form.Item>

          <Form.Item name="apiKey" label={t('settings.modelProviders.apiKey')}>
            <Input placeholder={t('settings.modelProviders.apiKeyPlaceholder')} />
          </Form.Item>

          <Form.Item name="baseUrl" label={t('settings.modelProviders.baseUrl')}>
            <Input placeholder={t('settings.modelProviders.baseUrlPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="enabled"
            label={t('settings.modelProviders.enabled')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

export const ModelProviders = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<Provider | null>(null);

  const { data, isLoading, refetch } = useListProviders();

  const handleSettingsClick = useCallback((provider: Provider) => {
    setEditProvider(provider);
  }, []);

  const filteredProviders = useMemo(() => {
    if (!data?.data) return [];

    if (!searchQuery.trim()) return data.data;

    const lowerQuery = searchQuery.toLowerCase();
    return data.data.filter(
      (provider) =>
        provider.name?.toLowerCase().includes(lowerQuery) ||
        provider.providerKey?.toLowerCase().includes(lowerQuery),
    );
  }, [data?.data, searchQuery]);

  return (
    <div className="p-4 h-full overflow-hidden flex flex-col">
      {/* Search and Add Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-xs">
          <Input
            prefix={<LuSearch className="h-4 w-4 text-gray-400" />}
            placeholder={t('settings.modelProviders.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Button
          type="primary"
          icon={<LuPlus className="h-5 w-5 flex items-center" />}
          onClick={() => setIsAddDialogOpen(true)}
        >
          {t('settings.modelProviders.addProvider')}
        </Button>
      </div>

      {/* Providers List */}
      <div
        className={cn(
          'min-h-[300px] flex-1 overflow-auto',
          isLoading || filteredProviders.length === 0 ? 'flex items-center justify-center' : '',
          filteredProviders.length === 0 ? 'border-dashed border-gray-200 rounded-md' : '',
        )}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Spin />
          </div>
        ) : filteredProviders.length === 0 ? (
          <Empty
            description={
              searchQuery ? (
                <>
                  <p>{t('settings.modelProviders.noSearchResults')}</p>
                  <p className="text-sm text-gray-400">
                    {t('settings.modelProviders.tryDifferentSearch')}
                  </p>
                </>
              ) : (
                <p>{t('settings.modelProviders.noProviders')}</p>
              )
            }
          >
            {!searchQuery && (
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                icon={<LuPlus className="flex items-center" />}
              >
                {t('settings.modelProviders.addFirstProvider')}
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <div>
              {filteredProviders?.map((provider) => (
                <ProviderItem
                  key={provider.providerId}
                  provider={provider}
                  onSettingsClick={handleSettingsClick}
                />
              ))}
            </div>
            <div className="text-center text-gray-400 text-sm">{t('common.noMore')}</div>
          </>
        )}
      </div>

      {/* Combined Modal for Create and Edit */}
      <ProviderModal
        isOpen={isAddDialogOpen || !!editProvider}
        onClose={() => {
          setIsAddDialogOpen(false);
          setEditProvider(null);
        }}
        provider={editProvider}
        onSuccess={refetch}
      />
    </div>
  );
};
