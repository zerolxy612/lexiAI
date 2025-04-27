import { useCallback, useEffect, useMemo, memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useListProviders } from '@refly-packages/ai-workspace-common/queries';
import { Button, Input, Modal, Form, Switch, Select, message, InputNumber, Checkbox } from 'antd';
import { ProviderCategory, ProviderItem } from '@refly/openapi-schema';
import { providerInfoList } from '@refly/utils';
import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Loading } from '../parser-config';
import { ProviderModal } from '@refly-packages/ai-workspace-common/components/settings/model-providers/provider-modal';
import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const ModelFormModal = memo(
  ({
    isOpen,
    onClose,
    model,
    onSuccess,
    filterProviderCategory,
    disabledEnableControl = false,
  }: {
    isOpen: boolean;
    onClose: () => void;
    model?: ProviderItem | null;
    onSuccess: (category: ProviderCategory, type: 'create' | 'update', model: ProviderItem) => void;
    filterProviderCategory?: ProviderCategory;
    disabledEnableControl?: boolean;
  }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const isEditMode = !!model;
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

    const [isSaving, setIsSaving] = useState(false);

    const getConfigByCategory = useCallback(
      (values: any, existingConfig: any = {}) => {
        const baseConfig = {
          ...existingConfig,
          modelId: values.modelId,
          modelName: values.name,
        };

        if (filterProviderCategory === 'llm') {
          const capabilitiesObject = {};
          if (Array.isArray(values.capabilities)) {
            for (const capability of values.capabilities) {
              capabilitiesObject[capability] = true;
            }
          }

          return {
            ...baseConfig,
            contextLimit: values.contextLimit,
            maxOutput: values.maxOutput,
            capabilities: capabilitiesObject,
          };
        }

        if (filterProviderCategory === 'embedding') {
          return {
            ...baseConfig,
            batchSize: values.batchSize,
            dimensions: values.dimensions,
          };
        }

        if (filterProviderCategory === 'reranker') {
          return {
            ...baseConfig,
            topN: values.topN,
            relevanceThreshold: values.relevanceThreshold,
          };
        }

        return baseConfig;
      },
      [filterProviderCategory],
    );

    const createModelMutation = useCallback(
      async (values: any) => {
        setIsSaving(true);
        const res = await getClient().createProviderItem({
          body: {
            ...values,
            category: (filterProviderCategory as ProviderCategory) || 'llm',
            providerId: values.providerId,
            config: getConfigByCategory(values),
          },
        });
        setIsSaving(false);
        if (res.data.success) {
          message.success(t('common.addSuccess'));
          onSuccess?.(filterProviderCategory, 'create', res.data.data);
          onClose();
        }
      },
      [onSuccess, onClose, getConfigByCategory, filterProviderCategory],
    );

    const updateModelMutation = useCallback(
      async (values: any, model: ProviderItem) => {
        setIsSaving(true);
        const res = await getClient().updateProviderItem({
          body: {
            ...values,
            itemId: model.itemId,
            config: getConfigByCategory(values, model.config),
          },
          query: {
            providerId: values.providerId,
          },
        });
        setIsSaving(false);
        if (res.data.success) {
          message.success(t('common.saveSuccess'));
          onSuccess?.(filterProviderCategory, 'update', res.data.data);
          onClose();
        }
      },
      [onSuccess, onClose, getConfigByCategory],
    );

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
        });
      }
    }, []);

    const handleSubmit = useCallback(async () => {
      try {
        const values = await form.validateFields();
        if (isEditMode) {
          updateModelMutation(values, model);
        } else {
          createModelMutation(values);
        }
      } catch (error) {
        console.error('Form validation failed:', error);
      }
    }, [form, updateModelMutation, createModelMutation]);

    const providerOptions = useMemo(() => {
      return (
        providersResponse?.data?.map((provider) => ({
          categories: provider?.categories,
          providerKey: provider?.providerKey,
          label: provider?.name || provider?.providerId,
          value: provider?.providerId,
        })) || []
      ).filter((provider) => {
        return provider.categories?.includes(filterProviderCategory as ProviderCategory);
      });
    }, [providersResponse, filterProviderCategory]);

    useEffect(() => {
      if (isOpen) {
        if (model) {
          const config = model?.config || ({} as any);

          interface FormValuesType {
            name: string;
            modelId: string;
            providerId: string;
            enabled: boolean;
            contextLimit?: number;
            maxOutput?: number;
            capabilities?: string[];
            batchSize?: number;
            dimensions?: number;
            topN?: number;
            relevanceThreshold?: number;
          }

          const capabilitiesArray: string[] = [];
          if (config.capabilities && typeof config.capabilities === 'object') {
            for (const [key, value] of Object.entries(config.capabilities)) {
              if (value === true) {
                capabilitiesArray.push(key);
              }
            }
          }

          const formValues: FormValuesType = {
            name: model?.name || '',
            modelId: config.modelId,
            providerId: model?.providerId || '',
            enabled: model?.enabled ?? true,
          };

          if (filterProviderCategory === 'llm') {
            formValues.contextLimit = config.contextLimit;
            formValues.maxOutput = config.maxOutput;
            formValues.capabilities = capabilitiesArray;
          } else if (filterProviderCategory === 'embedding') {
            formValues.batchSize = config.batchSize;
            formValues.dimensions = config.dimensions;
          } else if (filterProviderCategory === 'reranker') {
            formValues.topN = config.topN;
            formValues.relevanceThreshold = config.relevanceThreshold;
          }

          form.setFieldsValue(formValues);
        } else {
          form.resetFields();
          form.setFieldsValue({
            enabled: true,
            providerId: providerOptions?.[0]?.value,
            capabilities: [],
          });
        }
      }
    }, [model, isOpen, form, filterProviderCategory]);

    useEffect(() => {
      if (isOpen) {
        refetch();
      }
    }, [isOpen]);

    const renderCategorySpecificFields = useMemo(() => {
      if (filterProviderCategory === 'llm') {
        return (
          <>
            <Form.Item
              name="contextLimit"
              label={t('settings.modelConfig.contextLimit')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.contextLimitPlaceholder')}
                className="w-full"
                min={0}
              />
            </Form.Item>

            <Form.Item
              name="maxOutput"
              label={t('settings.modelConfig.maxOutput')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.maxOutputPlaceholder')}
                className="w-full"
                min={0}
              />
            </Form.Item>

            <Form.Item
              name="capabilities"
              label={t('settings.modelConfig.capabilities')}
              valuePropName="checked"
            >
              <Checkbox.Group className="w-full">
                <div className="grid grid-cols-2 gap-2">
                  <Checkbox value="functionCall">{t('settings.modelConfig.functionCall')}</Checkbox>
                  <Checkbox value="vision">{t('settings.modelConfig.vision')}</Checkbox>
                  <Checkbox value="reasoning">{t('settings.modelConfig.reasoning')}</Checkbox>
                  <Checkbox value="contextCaching">
                    {t('settings.modelConfig.contextCaching')}
                  </Checkbox>
                </div>
              </Checkbox.Group>
            </Form.Item>
          </>
        );
      }

      if (filterProviderCategory === 'embedding') {
        return (
          <>
            <Form.Item
              name="batchSize"
              label={t('settings.modelConfig.batchSize')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.batchSizePlaceholder')}
                className="w-full"
                min={1}
              />
            </Form.Item>

            <Form.Item
              name="dimensions"
              label={t('settings.modelConfig.dimensions')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.dimensionsPlaceholder')}
                className="w-full"
                min={1}
              />
            </Form.Item>
          </>
        );
      }

      if (filterProviderCategory === 'reranker') {
        return (
          <>
            <Form.Item
              name="topN"
              label={t('settings.modelConfig.topN')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.topNPlaceholder')}
                className="w-full"
                min={1}
              />
            </Form.Item>

            <Form.Item
              name="relevanceThreshold"
              label={t('settings.modelConfig.relevanceThreshold')}
              rules={[{ type: 'number' }]}
            >
              <InputNumber
                placeholder={t('settings.modelConfig.relevanceThresholdPlaceholder')}
                className="w-full"
                min={0}
                max={1}
                step={0.01}
              />
            </Form.Item>
          </>
        );
      }

      return null;
    }, [filterProviderCategory, t]);

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
          <Button key="submit" type="primary" onClick={handleSubmit} loading={isSaving}>
            {isEditMode ? t('common.save') : t('common.add')}
          </Button>,
        ]}
      >
        <div>
          <Form form={form} className="mt-6" labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
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
                        <div className="max-h-50 overflow-y-auto">{menu}</div>
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

            <Form.Item
              name="name"
              label={t('settings.modelConfig.name')}
              rules={[{ required: true, message: t('settings.modelConfig.namePlaceholder') }]}
            >
              <Input placeholder={t('settings.modelConfig.namePlaceholder')} />
            </Form.Item>

            {renderCategorySpecificFields}

            <Form.Item
              name="enabled"
              label={t('settings.modelConfig.enabled')}
              valuePropName="checked"
            >
              <Switch disabled={disabledEnableControl} />
            </Form.Item>
          </Form>
        </div>

        <ProviderModal
          isOpen={isProviderModalOpen}
          filterCategory={filterProviderCategory}
          presetProviders={presetProviders}
          onClose={handleProviderModalClose}
          onSuccess={handleCreateProviderSuccess}
          disabledEnableControl={true}
        />
      </Modal>
    );
  },
);

ModelFormModal.displayName = 'ModelFormModal';
