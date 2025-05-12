import React, { useState, useEffect } from 'react';
import { Modal, Button, message, Typography } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { McpServerJsonEditor } from './McpServerJsonEditor';
import { useCreateMcpServer, useListMcpServers } from '@refly-packages/ai-workspace-common/queries';
import { McpServerBatchImportProps, McpServerFormData } from './types';
import { mapServerType } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/utils';

export const McpServerBatchImport: React.FC<McpServerBatchImportProps> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [jsonData, setJsonData] = useState<any>({});
  const [isImporting, setIsImporting] = useState(false);
  // 移除选项卡状态

  // 查询现有 MCP 服务器列表
  const { data: mcpServersData, isLoading: isLoadingServers } = useListMcpServers({}, [], {
    enabled: isModalVisible, // 只在模态框显示时查询
    refetchOnWindowFocus: false,
  });

  // Create MCP server mutation
  const createMutation = useCreateMcpServer([], {
    onSuccess: () => {
      // Do nothing here, we'll handle success after all servers are imported
    },
    onError: (error) => {
      console.error('Failed to create MCP server:', error);
      // Continue with the next server even if one fails
    },
  });

  // 当获取到服务器列表数据时，转换为通用格式
  useEffect(() => {
    if (mcpServersData?.data && isModalVisible) {
      // 如果有数据，则转换为通用格式
      if (mcpServersData.data.length > 0) {
        const universalFormat = convertToUniversalFormat(mcpServersData.data);
        setJsonData(universalFormat);
      } else {
        // 如果没有数据，初始化示例模板
        setJsonData(getExampleTemplate());
      }
    }
  }, [mcpServersData, isModalVisible]);

  // 将 Refly 格式转换为通用格式
  const convertToUniversalFormat = (servers: any[]): any => {
    const mcpServers: Record<string, any> = {};

    for (const server of servers) {
      mcpServers[server.name] = {
        type: server.type,
        description: server.config?.description || '',
        enabled: server.enabled,
        url: server.url || '',
        command: server.command || '',
        args: server.args || [],
        env: server.env || {},
      };
    }

    return { mcpServers };
  };

  // 获取示例模板
  const getExampleTemplate = () => {
    return {
      mcpServers: {
        'Example Server 1': {
          type: 'sse',
          description: 'Example SSE server',
          enabled: true,
          url: 'http://localhost:3000',
          env: {},
        },
        'Example Server 2': {
          type: 'streamable',
          description: 'Example Streamable server',
          enabled: true,
          url: 'http://localhost:3001',
          env: {},
        },
        'Example Server 3': {
          type: 'stdio',
          description: 'Example Stdio server',
          enabled: true,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-example'],
          env: {},
        },
      },
    };
  };

  // 显示模态框
  const showModal = () => {
    setIsModalVisible(true);
    // 模态框显示时会自动查询数据库，并在 useEffect 中处理数据
  };

  // Handle JSON editor changes
  const handleJsonChange = (newData: any) => {
    setJsonData(newData);
  };

  // Convert universal format to Refly format
  const convertToReflyFormat = (data: any): McpServerFormData[] => {
    // If data is already an array of McpServerFormData, return it
    if (Array.isArray(data)) {
      return data as McpServerFormData[];
    }

    // If data has mcpServers property, it's in the universal format
    if (data?.mcpServers && typeof data.mcpServers === 'object') {
      const servers: McpServerFormData[] = [];

      for (const [name, serverConfig] of Object.entries(data.mcpServers) as [string, any][]) {
        // Map universal format fields to Refly format
        const server: McpServerFormData = {
          name: name, // 使用键作为名称
          type: mapServerType(serverConfig.type, serverConfig),
          enabled: serverConfig.enabled ?? true,
          url: serverConfig.url || '',
          command: serverConfig.command || '',
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          headers: serverConfig.headers || {},
          reconnect: { enabled: false },
          config: {},
        };

        // Add description to config if available
        if (serverConfig.description) {
          server.config = { ...server.config, description: serverConfig.description };
        }

        servers.push(server);
      }

      return servers;
    }

    // If it's a single object, wrap it in an array
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return [data as McpServerFormData];
    }

    return [];
  };

  // 导入服务器
  const handleImport = async () => {
    // 将通用格式转换为 Refly 格式
    const serversToImport = convertToReflyFormat(jsonData);

    if (serversToImport.length === 0) {
      message.error(t('settings.mcpServer.batchImportEmptyError'));
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;
    const totalCount = serversToImport.length;

    // 顺序处理服务器，避免竞争条件
    for (const server of serversToImport) {
      try {
        // 确保每个服务器都有唯一的 ID 和必填字段
        const serverData: McpServerFormData = {
          ...server,
          name: server.name,
          type: server.type,
          url: server.url,
          enabled: server.enabled ?? true,
          headers: server.headers || {},
          reconnect: server.reconnect || { enabled: false },
          args: server.args || [],
          env: server.env || {},
          config: server.config || {},
        };

        // 通过 API 创建服务器
        await createMutation.mutateAsync({ body: serverData });
        successCount++;
      } catch (error) {
        console.error('导入服务器失败:', error);
        errorCount++;
      }
    }

    setIsImporting(false);

    if (successCount > 0) {
      message.success(
        t('settings.mcpServer.batchImportSuccess', {
          count: successCount,
          total: totalCount,
        }),
      );
      setIsModalVisible(false);
      onSuccess(); // 刷新服务器列表
    }

    if (errorCount > 0) {
      message.error(
        t('settings.mcpServer.batchImportPartialError', {
          count: errorCount,
          total: totalCount,
        }),
      );
    }
  };

  return (
    <>
      <Button icon={<ImportOutlined />} onClick={showModal} style={{ marginRight: 8 }}>
        {t('settings.mcpServer.batchImport')}
      </Button>

      <Modal
        title={t('settings.mcpServer.batchImportTitle')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setIsModalVisible(false)}>
            {t('common.cancel')}
          </Button>,
          <Button key="import" type="primary" loading={isImporting} onClick={handleImport}>
            {t('settings.mcpServer.importServers')}
          </Button>,
        ]}
      >
        <Typography.Paragraph className="mb-4">
          {t('settings.mcpServer.batchImportDescription')}
        </Typography.Paragraph>

        <div className="mt-4" style={{ height: '450px' }}>
          {isLoadingServers ? (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-md">
              <div className="text-center">
                <div className="mb-2 w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <Typography.Text>{t('common.loading')}</Typography.Text>
              </div>
            </div>
          ) : (
            <McpServerJsonEditor value={jsonData} onChange={handleJsonChange} readOnly={false} />
          )}
        </div>
      </Modal>
    </>
  );
};
