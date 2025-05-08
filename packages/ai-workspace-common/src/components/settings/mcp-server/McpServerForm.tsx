import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Tabs,
  Divider,
  message,
  InputNumber,
} from 'antd';
import { PlusOutlined, MinusCircleOutlined, CodeOutlined, FormOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { McpServerType } from '@refly/openapi-schema';
import { McpServerFormProps, McpServerFormData } from './types';
import { McpServerJsonEditor } from './McpServerJsonEditor';
import {
  useCreateMcpServer,
  useUpdateMcpServer,
  useValidateMcpServer,
} from '@refly-packages/ai-workspace-common/queries';

const { TabPane } = Tabs;
const { Option } = Select;

export const McpServerForm: React.FC<McpServerFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<McpServerFormData>();
  const [activeTab, setActiveTab] = useState<string>('form');
  const [formData, setFormData] = useState<McpServerFormData>({
    name: '',
    type: 'sse',
    enabled: true,
  });
  const [serverType, setServerType] = useState<McpServerType>(initialData?.type || 'sse');

  // Create and update mutations
  const createMutation = useCreateMcpServer([], {
    onSuccess: () => {
      message.success(t('settings.mcpServer.createSuccess'));
      onSubmit(form.getFieldsValue());
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.createError'));
      console.error('Failed to create MCP server:', error);
    },
  });

  const updateMutation = useUpdateMcpServer([], {
    onSuccess: () => {
      message.success(t('settings.mcpServer.updateSuccess'));
      onSubmit(form.getFieldsValue());
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.updateError'));
      console.error('Failed to update MCP server:', error);
    },
  });

  const validateMutation = useValidateMcpServer([], {
    onSuccess: () => {
      message.success(t('settings.mcpServer.validateSuccess'));
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.validateError'));
      console.error('Failed to validate MCP server:', error);
    },
  });

  // Initialize form with initial data
  useEffect(() => {
    if (initialData) {
      const formValues: McpServerFormData = {
        serverId: initialData.serverId,
        name: initialData.name,
        type: initialData.type,
        url: initialData.url,
        command: initialData.command,
        args: initialData.args || [],
        env: initialData.env || {},
        headers: initialData.headers || {},
        reconnect: initialData.reconnect || { enabled: false },
        config: initialData.config || {},
        enabled: initialData.enabled,
      };
      form.setFieldsValue(formValues);
      setFormData(formValues);
      setServerType(initialData.type);
    } else {
      // Generate a new serverId for new servers
      form.setFieldsValue({
        serverId: uuidv4(),
        enabled: true,
      });
    }
  }, [initialData, form]);

  // Handle form changes to update JSON editor
  const handleFormValuesChange = () => {
    const values = form.getFieldsValue();
    setFormData(values);
  };

  // Handle JSON editor changes to update form
  const handleJsonChange = (newData: McpServerFormData) => {
    setFormData(newData);
    form.setFieldsValue(newData);
  };

  // Handle server type change
  const handleTypeChange = (value: McpServerType) => {
    setServerType(value);
  };

  // Handle form submission
  const handleFinish = (values: McpServerFormData) => {
    // Prepare data for API
    const apiData = {
      ...values,
      args: values.args || [],
      env: values.env || {},
      headers: values.headers || {},
      reconnect: values.reconnect || {},
      config: values.config || {},
    };

    // Call create or update API
    if (initialData) {
      updateMutation.mutate({ body: apiData });
    } else {
      createMutation.mutate({ body: apiData });
    }
  };

  // Handle validate button click
  const handleValidate = () => {
    const values = form.getFieldsValue();
    validateMutation.mutate({ body: values });
  };

  return (
    <div className="mcp-server-form">
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <FormOutlined /> {t('settings.mcpServer.formMode')}
            </span>
          }
          key="form"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            onValuesChange={handleFormValuesChange}
            initialValues={{
              enabled: true,
              type: 'sse',
            }}
          >
            {/* Hidden serverId field */}
            <Form.Item name="serverId" hidden>
              <Input />
            </Form.Item>

            {/* Basic Information */}
            <Form.Item
              name="name"
              label={t('settings.mcpServer.name')}
              rules={[{ required: true, message: t('settings.mcpServer.nameRequired') }]}
            >
              <Input placeholder={t('settings.mcpServer.namePlaceholder')} />
            </Form.Item>

            <Form.Item
              name="type"
              label={t('settings.mcpServer.type')}
              rules={[{ required: true, message: t('settings.mcpServer.typeRequired') }]}
            >
              <Select onChange={handleTypeChange}>
                <Option value="sse">{t('settings.mcpServer.typeSSE')}</Option>
                <Option value="streamable">{t('settings.mcpServer.typeStreamable')}</Option>
                <Option value="stdio">{t('settings.mcpServer.typeStdio')}</Option>
              </Select>
            </Form.Item>

            {/* URL for SSE and Streamable types */}
            {(serverType === 'sse' || serverType === 'streamable') && (
              <Form.Item
                name="url"
                label={t('settings.mcpServer.url')}
                rules={[{ required: true, message: t('settings.mcpServer.urlRequired') }]}
              >
                <Input placeholder={t('settings.mcpServer.urlPlaceholder')} />
              </Form.Item>
            )}

            {/* Command and Args for Stdio type */}
            {serverType === 'stdio' && (
              <>
                <Form.Item
                  name="command"
                  label={t('settings.mcpServer.command')}
                  rules={[{ required: true, message: t('settings.mcpServer.commandRequired') }]}
                >
                  <Input placeholder={t('settings.mcpServer.commandPlaceholder')} />
                </Form.Item>

                <Divider orientation="left">{t('settings.mcpServer.args')}</Divider>
                <Form.List name="args">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field) => (
                        <Form.Item key={field.key}>
                          <Space align="baseline">
                            <Form.Item {...field} noStyle>
                              <Input placeholder={t('settings.mcpServer.argPlaceholder')} />
                            </Form.Item>
                            <MinusCircleOutlined onClick={() => remove(field.name)} />
                          </Space>
                        </Form.Item>
                      ))}
                      <Form.Item>
                        <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                          {t('settings.mcpServer.addArg')}
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </>
            )}

            {/* Headers for SSE and Streamable types */}
            {(serverType === 'sse' || serverType === 'streamable') && (
              <>
                <Divider orientation="left">{t('settings.mcpServer.headers')}</Divider>
                <Form.List name="headers">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field) => (
                        <Form.Item key={field.key}>
                          <Space align="baseline">
                            <Form.Item name={[field.name, 'key']} noStyle>
                              <Input
                                placeholder={t('settings.mcpServer.headerKey')}
                                style={{ width: 200 }}
                              />
                            </Form.Item>
                            <Form.Item name={[field.name, 'value']} noStyle>
                              <Input
                                placeholder={t('settings.mcpServer.headerValue')}
                                style={{ width: 300 }}
                              />
                            </Form.Item>
                            <MinusCircleOutlined onClick={() => remove(field.name)} />
                          </Space>
                        </Form.Item>
                      ))}
                      <Form.Item>
                        <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                          {t('settings.mcpServer.addHeader')}
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </>
            )}

            {/* Environment Variables for Stdio type */}
            {serverType === 'stdio' && (
              <>
                <Divider orientation="left">{t('settings.mcpServer.env')}</Divider>
                <Form.List name="env">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field) => (
                        <Form.Item key={field.key}>
                          <Space align="baseline">
                            <Form.Item name={[field.name, 'key']} noStyle>
                              <Input
                                placeholder={t('settings.mcpServer.envKey')}
                                style={{ width: 200 }}
                              />
                            </Form.Item>
                            <Form.Item name={[field.name, 'value']} noStyle>
                              <Input
                                placeholder={t('settings.mcpServer.envValue')}
                                style={{ width: 300 }}
                              />
                            </Form.Item>
                            <MinusCircleOutlined onClick={() => remove(field.name)} />
                          </Space>
                        </Form.Item>
                      ))}
                      <Form.Item>
                        <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                          {t('settings.mcpServer.addEnv')}
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </>
            )}

            {/* Reconnect Configuration */}
            <Divider orientation="left">{t('settings.mcpServer.reconnect')}</Divider>
            <Form.Item name={['reconnect', 'enabled']} valuePropName="checked">
              <Switch
                checkedChildren={t('common.enabled')}
                unCheckedChildren={t('common.disabled')}
              />
            </Form.Item>

            <Form.Item
              name={['reconnect', 'maxAttempts']}
              label={t('settings.mcpServer.maxAttempts')}
            >
              <InputNumber min={1} />
            </Form.Item>

            <Form.Item name={['reconnect', 'delayMs']} label={t('settings.mcpServer.delayMs')}>
              <InputNumber min={0} step={100} />
            </Form.Item>

            {/* Enabled Switch */}
            <Form.Item
              name="enabled"
              label={t('settings.mcpServer.enabled')}
              valuePropName="checked"
            >
              <Switch
                checkedChildren={t('common.enabled')}
                unCheckedChildren={t('common.disabled')}
              />
            </Form.Item>

            {/* Form Actions */}
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {initialData ? t('common.update') : t('common.create')}
                </Button>
                <Button onClick={handleValidate} loading={validateMutation.isPending}>
                  {t('settings.mcpServer.validate')}
                </Button>
                <Button onClick={onCancel}>{t('common.cancel')}</Button>
              </Space>
            </Form.Item>
          </Form>
        </TabPane>
        <TabPane
          tab={
            <span>
              <CodeOutlined /> {t('settings.mcpServer.jsonMode')}
            </span>
          }
          key="json"
        >
          <McpServerJsonEditor value={formData} onChange={handleJsonChange} />
          <div className="mt-4">
            <Space>
              <Button
                type="primary"
                onClick={() => form.submit()}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {initialData ? t('common.update') : t('common.create')}
              </Button>
              <Button onClick={handleValidate} loading={validateMutation.isPending}>
                {t('settings.mcpServer.validate')}
              </Button>
              <Button onClick={onCancel}>{t('common.cancel')}</Button>
            </Space>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};
