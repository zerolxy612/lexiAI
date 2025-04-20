import { useCallback, useEffect, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useListProviders } from '@refly-packages/ai-workspace-common/queries';
import { Button, Input, Modal, Form, Switch, Select } from 'antd';
import { ProviderItem } from '@refly/openapi-schema';

export const ModelFormModal = memo(
  ({
    isOpen,
    onClose,
    model,
    onSave,
    isSubmitting,
  }: {
    isOpen: boolean;
    onClose: () => void;
    model?: ProviderItem | null;
    onSave: (values: any) => void;
    isSubmitting: boolean;
  }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const isEditMode = !!model;
    const { data: providersResponse, isLoading: isProvidersLoading } = useListProviders();

    // Reset form when modal opens or model changes
    useEffect(() => {
      if (isOpen) {
        if (model) {
          form.setFieldsValue({
            name: model?.name,
            modelId: model?.config?.modelId,
            providerId: model?.providerId,
            enabled: model?.enabled ?? true,
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

    const handleSubmit = useCallback(async () => {
      console.log('handleSubmit', form.getFieldsValue());
      try {
        const values = await form.validateFields();
        onSave(values);
      } catch (error) {
        console.error('Form validation failed:', error);
      }
    }, [form, onSave]);

    const providerOptions = useMemo(() => {
      return (
        providersResponse?.data?.map((provider) => ({
          label: provider?.name || provider?.providerId,
          value: provider?.providerId,
        })) || []
      );
    }, [providersResponse]);

    return (
      <Modal
        title={t(`settings.modelConfig.${isEditMode ? 'editModel' : 'addModel'}`)}
        centered
        open={isOpen}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('common.cancel')}
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit} loading={isSubmitting}>
            {isEditMode ? t('common.save') : t('common.add')}
          </Button>,
        ]}
      >
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
            />
          </Form.Item>

          <Form.Item
            name="modelId"
            label={t('settings.modelConfig.modelId')}
            rules={[{ required: true, message: t('settings.modelConfig.modelIdPlaceholder') }]}
          >
            <Input placeholder={t('settings.modelConfig.modelIdPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="name"
            label={t('settings.modelConfig.name')}
            rules={[{ required: true, message: t('settings.modelConfig.namePlaceholder') }]}
          >
            <Input placeholder={t('settings.modelConfig.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="enabled"
            label={t('settings.modelConfig.enabled')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

ModelFormModal.displayName = 'ModelFormModal';
