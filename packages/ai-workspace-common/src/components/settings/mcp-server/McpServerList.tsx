import React, { useState, useMemo } from 'react';
import { Table, Button, Tag, Space, Tooltip, Modal, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { McpServerDTO, McpServerType } from '@refly/openapi-schema';

import { useDeleteMcpServer } from '@refly-packages/ai-workspace-common/queries';
import { useListMcpServersSuspense } from '@refly-packages/ai-workspace-common/queries/suspense';
import { McpServerForm } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/McpServerForm';
import { McpServerBatchImport } from '@refly-packages/ai-workspace-common/components/settings/mcp-server/McpServerBatchImport';

interface McpServerListProps {
  visible: boolean;
}

export const McpServerList: React.FC<McpServerListProps> = ({ visible }) => {
  const { t } = useTranslation();
  const [editingServer, setEditingServer] = useState<McpServerDTO | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<McpServerDTO | null>(null);

  // Fetch MCP servers
  const { data, refetch } = useListMcpServersSuspense({}, [], {
    enabled: visible,
    refetchOnWindowFocus: false,
  });

  const mcpServers = useMemo(() => data?.data || [], [data]);

  // Delete MCP server mutation
  const deleteMutation = useDeleteMcpServer([], {
    onSuccess: () => {
      message.success(t('settings.mcpServer.deleteSuccess'));
      setDeleteModalVisible(false);
      // 刷新列表数据
      refetch();
    },
    onError: (error) => {
      message.error(t('settings.mcpServer.deleteError'));
      console.error('Failed to delete MCP server:', error);
    },
  });

  // Handle form submission
  const handleFormSubmit = () => {
    // Form submission is handled in the form component
    setIsFormVisible(false);
    setEditingServer(null);
    // 刷新列表数据
    refetch();
  };

  // Handle edit button click
  const handleEdit = (server: McpServerDTO) => {
    setEditingServer(server);
    setIsFormVisible(true);
  };

  // Handle delete button click
  const handleDelete = (server: McpServerDTO) => {
    setServerToDelete(server);
    setDeleteModalVisible(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (serverToDelete) {
      deleteMutation.mutate({
        body: { name: serverToDelete.name },
      });
    }
  };

  // Get type tag color
  const getTypeColor = (type: McpServerType) => {
    switch (type) {
      case 'sse':
        return 'blue';
      case 'streamable':
        return 'green';
      case 'stdio':
        return 'purple';
      default:
        return 'default';
    }
  };

  // Table columns
  const columns = [
    {
      title: t('settings.mcpServer.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('settings.mcpServer.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type: McpServerType) => <Tag color={getTypeColor(type)}>{type.toUpperCase()}</Tag>,
    },
    {
      title: t('settings.mcpServer.url'),
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => url || '-',
    },
    {
      title: t('settings.mcpServer.status'),
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'success' : 'error'}>
          {enabled ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: any, record: McpServerDTO) => (
        <Space size="middle">
          <Tooltip title={t('common.edit')}>
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              disabled={record.isGlobal}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!visible) return null;

  return (
    <div className="mcp-server-list">
      <div className="flex justify-between items-center mb-4">
        <h2>{t('settings.mcpServer.title')}</h2>
        <Space>
          {/* Batch import button */}
          <McpServerBatchImport onSuccess={refetch} />
          {/* Add single server button */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingServer(null);
              setIsFormVisible(true);
            }}
          >
            {t('settings.mcpServer.addServer')}
          </Button>
        </Space>
      </div>

      <Table dataSource={mcpServers} columns={columns} rowKey="name" pagination={false} />

      {/* Form Modal */}
      <Modal
        title={
          editingServer ? t('settings.mcpServer.editServer') : t('settings.mcpServer.addServer')
        }
        open={isFormVisible}
        onCancel={() => setIsFormVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <McpServerForm
          initialData={editingServer || undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => setIsFormVisible(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title={t('settings.mcpServer.deleteConfirmTitle')}
        open={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        onOk={confirmDelete}
        okText={t('common.delete')}
        okButtonProps={{
          danger: true,
          loading: deleteMutation.isPending,
        }}
        cancelText={t('common.cancel')}
      >
        <p>
          {t('settings.mcpServer.deleteConfirmMessage', {
            name: serverToDelete?.name,
          })}
        </p>
      </Modal>
    </div>
  );
};
