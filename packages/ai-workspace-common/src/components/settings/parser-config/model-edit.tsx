import { useCallback, useEffect, useMemo, memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useListProviders } from '@refly-packages/ai-workspace-common/queries';
import { Button, Input, Modal, Form, Select } from 'antd';
import { ProviderCategory, ProviderConfig } from '@refly/openapi-schema';
import { providerInfoList } from '@refly/utils';
import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Loading } from './index';
import { ProviderModal } from '@refly-packages/ai-workspace-common/components/settings/model-providers/provider-modal';
import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';

export const ModelEdit = memo(
  ({
    isOpen,
    onClose,
    model,
    onSave,
    isSaving,
    filterProviderCategory,
  }: {
    isOpen: boolean;
    onClose: () => void;
    model?: ProviderConfig | null;
    onSave: (values: ProviderConfig) => void;
    filterProviderCategory?: string;
    isSaving: boolean;
  }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const {
      data: providersResponse,
      isLoading: isProvidersLoading,
      refetch,
    } = useListProviders({ query: { enabled: true } });

    const presetProviders = useMemo(() => {
      return providerInfoList.filter((provider) => {
        if (filterProviderCategory) {
          return provider.categories.includes(filterProviderCategory as ProviderCategory);
        }
        return true;
      });
    }, [providerInfoList, filterProviderCategory]);

    const handleAddModel = useCallback(() => {
      setIsProviderModalOpen(true);
    }, []);

    const handleProviderModalClose = useCallback(() => {
      setIsProviderModalOpen(false);
    }, []);

    const handleCreateProviderSuccess = useCallback((provider: Provider) => {
      refetch();
      if (provider?.enabled) {
        form.setFieldsValue({
          providerId: provider.providerId,
          modelId: '',
        });
      }
    }, []);

    const handleSubmit = useCallback(async () => {
      try {
        const values = await form.validateFields();
        const providerKey = providerOptions.find(
          (provider) => provider.value === values.providerId,
        )?.providerKey;
        onSave?.({ ...values, providerKey });
      } catch (error) {
        console.error('Form validation failed:', error);
      }
    }, [form, onSave]);

    const providerOptions = useMemo(() => {
      return (
        providersResponse?.data?.map((provider) => ({
          providerKey: provider?.providerKey,
          label: provider?.name || provider?.providerId,
          value: provider?.providerId,
        })) || []
      ).filter((provider) => {
        return presetProviders.some((p) => p.key === provider.providerKey);
      });
    }, [providersResponse, filterProviderCategory]);

    useEffect(() => {
      if (isOpen) {
        if (model) {
          form.setFieldsValue({
            modelId: model?.modelId,
            providerId: model?.providerId,
          });
        } else {
          form.resetFields();
          form.setFieldsValue({
            providerId: providerOptions?.[0]?.value,
          });
        }
      }
    }, [model, isOpen, form]);

    useEffect(() => {
      if (isOpen) {
        refetch();
      }
    }, [isOpen, refetch]);

    return (
      <Modal
        title={t('settings.parserConfig.modelConfig.title')}
        centered
        open={isOpen}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('common.cancel')}
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit} loading={isSaving}>
            {t('common.save')}
          </Button>,
        ]}
      >
        <div>
          <Form form={form} className="mt-6" labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
            <Form.Item
              name="providerId"
              label={t('settings.modelConfig.provider')}
              rules={[{ required: true, message: t('settings.modelConfig.providerPlaceholder') }]}
            >
              <Select
                placeholder={t('settings.modelConfig.providerPlaceholder')}
                loading={isProvidersLoading}
                options={providerOptions}
                dropdownRender={(menu) => (
                  <>
                    {isProvidersLoading ? (
                      <Loading />
                    ) : (
                      <>
                        <div className="max-h-60 overflow-y-auto">{menu}</div>
                        <div className="p-2 border-t border-gray-200">
                          <Button
                            type="text"
                            icon={<IconPlus />}
                            onClick={handleAddModel}
                            className="flex items-center w-full"
                          >
                            {t('settings.parserConfig.createProvider')}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              />
            </Form.Item>

            <Form.Item
              name="modelId"
              label={t('settings.modelConfig.modelId')}
              rules={[{ required: true, message: t('settings.modelConfig.modelIdPlaceholder') }]}
            >
              <Input placeholder={t('settings.modelConfig.modelIdPlaceholder')} />
            </Form.Item>
          </Form>
        </div>

        <ProviderModal
          isOpen={isProviderModalOpen}
          presetProviders={presetProviders}
          onClose={handleProviderModalClose}
          onSuccess={handleCreateProviderSuccess}
        />
      </Modal>
    );
  },
);

ModelEdit.displayName = 'ModelEdit';
