import { useNavigate } from 'react-router-dom';
import { message, Button, Table, Popconfirm, Space, Empty } from 'antd';
import { PlusOutlined, EditOutlined, ShareAltOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useListPages,
  useSharePage,
  useDeletePage,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { Page } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { formatDate } from '@/utils/date';

function PagesPage() {
  const navigate = useNavigate();

  // 使用 useListPages 查询钩子获取页面列表
  const {
    data: pagesData,
    isLoading: loading,
    refetch: refetchPages,
  } = useListPages({}, undefined, {
    onError: () => {
      console.error('获取页面列表失败');
      message.error('获取页面列表失败');
    },
  });

  // 使用 useSharePage 和 useDeletePage 变更钩子处理页面操作
  const { mutate: sharePage, isPending: isSharing } = useSharePage(undefined, {
    onSuccess: (data) => {
      if (data?.data?.shareUrl) {
        message.success('分享成功，链接已复制到剪贴板');
        navigator.clipboard.writeText(data.data.shareUrl);
      }
    },
    onError: () => {
      console.error('分享页面失败');
      message.error('分享页面失败');
    },
  });

  const { mutate: deletePage, isPending: isDeleting } = useDeletePage(undefined, {
    onSuccess: () => {
      message.success('删除成功');
      refetchPages();
    },
    onError: () => {
      console.error('删除页面失败');
      message.error('删除页面失败');
    },
  });

  const handleEditPage = (pageId: string) => {
    navigate(`/pages/edit/${pageId}`);
  };

  const handleSharePage = (pageId: string) => {
    sharePage({ path: { pageId } });
  };

  const handleDeletePage = (pageId: string) => {
    deletePage({ path: { pageId } });
  };

  // 提取页面数据
  const pages = pagesData?.data?.pages || [];

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, string> = {
          draft: '草稿',
          published: '已发布',
        };
        return statusMap[status] || status;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Page) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditPage(record.pageId)}>
            编辑
          </Button>
          <Button
            type="link"
            icon={<ShareAltOutlined />}
            onClick={() => handleSharePage(record.pageId)}
            loading={isSharing}
          >
            分享
          </Button>
          <Popconfirm
            title="确定要删除这个页面吗?"
            onConfirm={() => handleDeletePage(record.pageId)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} loading={isDeleting}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">我的页面</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/canvas')}>
          创建页面
        </Button>
      </div>

      {pages.length === 0 && !loading ? (
        <Empty description="暂无页面" className="py-10" />
      ) : (
        <Table
          columns={columns}
          dataSource={pages.map((page) => ({ ...page, key: page.pageId }))}
          loading={loading}
          pagination={{
            pageSize: 10,
            total: pagesData?.data?.total,
            current: pagesData?.data?.page,
            onChange: (_page, _pageSize) => {
              // 切换页面时重新查询
              refetchPages();
            },
          }}
          className="mt-4"
        />
      )}
    </div>
  );
}

export default PagesPage;
