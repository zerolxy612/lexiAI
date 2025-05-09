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
  Tooltip,
  Card,
  Typography,
  Collapse,
} from 'antd';
import {
  PlusOutlined,
  MinusCircleOutlined,
  CodeOutlined,
  FormOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { McpServerType } from '@refly/openapi-schema';
import { McpServerFormProps, McpServerFormData } from './types';
import { McpServerJsonEditor } from './McpServerJsonEditor';
import {
  useCreateMcpServer,
  useUpdateMcpServer,
  useValidateMcpServer,
} from '@refly-packages/ai-workspace-common/queries';
import { mapServerType } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/utils';

const { TabPane } = Tabs;
const { Option } = Select;

export const McpServerForm: React.FC<McpServerFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<McpServerFormData>();
  const [activeTab, setActiveTab] = useState<string>('form');
  const [formData, setFormData] = useState<McpServerFormData>({
    name: '',
    type: 'sse',
    enabled: false,
  });
  const [isEnabled, setIsEnabled] = useState<boolean>(initialData?.enabled || false);

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

  // 验证服务器配置
  const validateMutation = useValidateMcpServer([], {
    onSuccess: (response) => {
      if (!response?.data?.success) {
        throw response.data.errMsg;
      }

      // 服务端验证成功时返回 true
      message.success(t('settings.mcpServer.validateSuccess'));

      setIsEnabled(true);
      const currentValues = form.getFieldsValue();
      form.setFieldsValue({ ...currentValues, enabled: true });
      setFormData({ ...formData, enabled: true });
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.validateError'));
      console.error('Failed to validate MCP server:', error);
      setIsEnabled(false);
      const currentValues = form.getFieldsValue();
      if (currentValues.enabled) {
        form.setFieldsValue({ ...currentValues, enabled: false });
      }
      setFormData({ ...formData, enabled: false });
    },
  });

  // Initialize form with initial data
  useEffect(() => {
    if (initialData) {
      const formValues: McpServerFormData = {
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
      form.setFieldsValue({
        enabled: false,
        type: 'sse',
      });
    }
  }, [initialData, form]);

  // Handle form changes to update JSON editor
  const handleFormValuesChange = () => {
    const values = form.getFieldsValue();
    setFormData(values);
  };

  // 将 Refly 格式转换为通用格式
  const convertToUniversalFormat = (server: McpServerFormData): any => {
    const mcpServers: Record<string, any> = {};

    mcpServers[server.name] = {
      type: server.type,
      description: server.config?.description || '',
      isActive: server.enabled,
      baseUrl: server.url || '',
      command: server.command || '',
      args: server.args || [],
      env: server.env || {},
    };

    return { mcpServers };
  };

  // 将通用格式转换为 Refly 格式
  const convertToReflyFormat = (data: any): McpServerFormData => {
    // 如果数据已经是 McpServerFormData 格式，直接返回
    if (!data.mcpServers && typeof data === 'object') {
      return data as McpServerFormData;
    }

    // 如果数据有 mcpServers 属性，说明是通用格式
    if (data?.mcpServers && typeof data.mcpServers === 'object') {
      // 只取第一个服务器，因为表单只能编辑一个服务器
      const entries = Object.entries(data.mcpServers);
      if (entries.length > 0) {
        const [name, serverConfig] = entries[0] as [string, any];

        // 映射通用格式字段到 Refly 格式
        const server: McpServerFormData = {
          name: name,
          type: mapServerType(serverConfig.type, serverConfig),
          enabled: serverConfig.isActive ?? true,
          url: serverConfig.baseUrl || '',
          command: serverConfig.command || '',
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          headers: serverConfig.headers || {},
          reconnect: { enabled: false },
          config: {},
        };

        // 如果有描述，添加到 config 中
        if (serverConfig.description) {
          server.config = { ...server.config, description: serverConfig.description };
        }

        return server;
      }
    }

    // 如果无法转换，返回原始数据
    return formData;
  };

  // 处理 JSON 编辑器变更
  const handleJsonChange = (newData: any) => {
    // 将通用格式转换为 Refly 格式
    const reflyData = convertToReflyFormat(newData);
    setFormData(reflyData);
    form.setFieldsValue(reflyData);
  };

  // Handle server type change
  const handleTypeChange = (value: McpServerType) => {
    setServerType(value);
  };

  // Handle form submission
  const handleFinish = (values: McpServerFormData) => {
    // 确保表单中的enabled值与isEnabled状态一致
    values.enabled = isEnabled;

    // 如果服务器启用但未经过验证，自动进行验证
    if (isEnabled) {
      message.info(t('settings.mcpServer.validatingBeforeEnable'));
      // 自动验证
      validateMutation.mutate({ body: values });
      return;
    }

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

  // 处理启用状态变更
  const handleEnabledChange = async (checked: boolean) => {
    if (checked) {
      validateMutation.mutate({ body: form.getFieldsValue() });
    } else {
      // 关闭时不需要验证，直接更新状态
      setIsEnabled(false);
    }
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

                <Card
                  title={
                    <Space>
                      {t('settings.mcpServer.args')}
                      <Tooltip title={t('settings.mcpServer.argsTooltip')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  size="small"
                  className="mb-4"
                >
                  <Form.List name="args">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field) => (
                          <Form.Item key={field.key} style={{ marginBottom: 8 }}>
                            <div className="flex items-center">
                              <Form.Item {...field} noStyle>
                                <Input
                                  placeholder={t('settings.mcpServer.argPlaceholder')}
                                  style={{ width: 'calc(100% - 32px)' }}
                                />
                              </Form.Item>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(field.name)}
                                style={{ marginLeft: 8 }}
                              />
                            </div>
                          </Form.Item>
                        ))}
                        <Form.Item>
                          <Button
                            type="dashed"
                            onClick={() => add('-y')}
                            icon={<PlusOutlined />}
                            block
                          >
                            {t('settings.mcpServer.addArg')}
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Card>
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
              <Card
                title={
                  <Space>
                    {t('settings.mcpServer.env')}
                    <Tooltip title={t('settings.mcpServer.envTooltip')}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                size="small"
                className="mb-4"
              >
                <Form.List name="env">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field) => (
                        <Form.Item key={field.key} style={{ marginBottom: 12 }}>
                          <div className="flex items-center">
                            <Form.Item
                              name={[field.name, 'key']}
                              noStyle
                              rules={[
                                {
                                  required: true,
                                  message: t('settings.mcpServer.envKeyRequired'),
                                },
                              ]}
                            >
                              <Input
                                placeholder={t('settings.mcpServer.envKey')}
                                style={{ width: '40%', marginRight: 8 }}
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, 'value']}
                              noStyle
                              rules={[
                                {
                                  required: true,
                                  message: t('settings.mcpServer.envValueRequired'),
                                },
                              ]}
                            >
                              <Input
                                placeholder={t('settings.mcpServer.envValue')}
                                style={{ width: 'calc(60% - 40px)' }}
                              />
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                              style={{ marginLeft: 8 }}
                            />
                          </div>
                        </Form.Item>
                      ))}
                      <Form.Item>
                        <Button
                          type="dashed"
                          onClick={() => add({ key: '', value: '' })}
                          icon={<PlusOutlined />}
                          block
                        >
                          {t('settings.mcpServer.addEnv')}
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </Card>
            )}

            {/* Reconnect Configuration */}
            <Collapse
              className="mb-4"
              bordered={false}
              expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
              items={[
                {
                  key: 'reconnect',
                  label: (
                    <Space>
                      {t('settings.mcpServer.reconnect')}
                      <Tooltip title={t('settings.mcpServer.reconnectTooltip')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  ),
                  children: (
                    <div className="pl-4 pr-4 pb-2">
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
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item
                        name={['reconnect', 'delayMs']}
                        label={t('settings.mcpServer.delayMs')}
                      >
                        <InputNumber min={0} step={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </div>
                  ),
                },
              ]}
            />

            {/* Enabled Switch */}
            <Card title={t('settings.mcpServer.status')} size="small" className="mb-4">
              <div className="flex items-center justify-between">
                <Typography.Text>
                  {t('settings.mcpServer.enabled')}
                  <Tooltip title={t('settings.mcpServer.enabledTooltip')}>
                    <QuestionCircleOutlined style={{ marginLeft: 8 }} />
                  </Tooltip>
                </Typography.Text>
                <Form.Item noStyle>
                  <Switch
                    checked={isEnabled}
                    checkedChildren={t('common.enabled')}
                    unCheckedChildren={t('common.disabled')}
                    onChange={handleEnabledChange}
                  />
                </Form.Item>
              </div>
              {!validateMutation.data && !initialData?.enabled && (
                <Typography.Text type="secondary" className="block mt-2">
                  {t('settings.mcpServer.autoValidateHint')}
                </Typography.Text>
              )}
            </Card>

            {/* Form Actions */}
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    validateMutation.isPending
                  }
                >
                  {initialData ? t('common.update') : t('common.create')}
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
          <McpServerJsonEditor
            value={convertToUniversalFormat(formData)}
            onChange={handleJsonChange}
          />
          <div className="mt-4">
            <Space>
              <Button
                type="primary"
                onClick={() => form.submit()}
                loading={
                  createMutation.isPending || updateMutation.isPending || validateMutation.isPending
                }
              >
                {initialData ? t('common.update') : t('common.create')}
              </Button>
              <Button onClick={onCancel}>{t('common.cancel')}</Button>
            </Space>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};
