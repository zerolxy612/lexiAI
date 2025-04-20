import { useTranslation } from 'react-i18next';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Button, Input, Modal, Form, Switch, Select, message } from 'antd';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { ProviderKey, providerInfoList } from '@refly/utils';

export const ProviderModal = React.memo(
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
            providerKey: provider.providerKey,
          });
        } else {
          form.resetFields();
          form.setFieldsValue({
            enabled: true,
            providerKey: ProviderKey.OPENAI,
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
              providerKey: values.providerKey,
            },
          });
          if (res.data.success) {
            message.success(t('common.saveSuccess'));
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
              providerKey: values.providerKey,
            },
          });
          if (res.data.success) {
            message.success(t('common.addSuccess'));
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

    // Convert provider info list to options for the select component
    const providerOptions = useMemo(
      () =>
        providerInfoList.map((providerInfo) => ({
          label: providerInfo.name,
          value: providerInfo.key,
        })),
      [],
    );

    return (
      <Modal
        centered
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
        <Form form={form} className="mt-6" labelCol={{ span: 5 }} wrapperCol={{ span: 18 }}>
          <Form.Item
            name="providerKey"
            label={t('settings.modelProviders.providerType')}
            rules={[
              {
                required: true,
                message: t('settings.modelProviders.selectProviderType'),
              },
            ]}
          >
            <Select
              placeholder={t('settings.modelProviders.selectProviderType')}
              options={providerOptions}
            />
          </Form.Item>

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

          <Form.Item
            name="apiKey"
            label={t('settings.modelProviders.apiKey')}
            rules={[
              {
                required: true,
                message: t('settings.modelProviders.apiKeyPlaceholder'),
              },
            ]}
          >
            <Input.Password placeholder={t('settings.modelProviders.apiKeyPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="baseUrl"
            label={t('settings.modelProviders.baseUrl')}
            rules={[{ message: t('settings.modelProviders.baseUrlPlaceholder') }]}
          >
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

ProviderModal.displayName = 'ProviderModal';
