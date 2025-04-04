import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Spin, message, Card } from 'antd'
import { 
  useGetPageDetail,
  useUpdatePage
} from '@refly-packages/ai-workspace-common/queries/queries'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'

// 页面编辑组件
function PageEdit() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [formChanged, setFormChanged] = useState(false)
  
  // 获取页面详情
  const { 
    data: pageDetailResponse, 
    isLoading: isLoadingPage, 
    error: pageLoadError 
  } = useGetPageDetail(
    { path: { pageId: pageId || '' } },
    undefined,
    {
      enabled: !!pageId
    }
  )
  
  // 更新页面Hook
  const { 
    mutate: updatePage, 
    isPending: isUpdating 
  } = useUpdatePage()

  // 从响应中提取页面数据
  const pageDetail = pageDetailResponse?.data
  
  // 当页面数据加载后填充表单
  useEffect(() => {
    if (pageDetail) {
      form.setFieldsValue({
        title: pageDetail.title,
        description: pageDetail.description || '',
      })
    }
  }, [pageDetail, form])

  // 提交表单处理函数
  const handleSubmit = (values: any) => {
    if (!pageId) return
    
    updatePage({
      path: { pageId },
      body: {
        title: values.title,
        description: values.description
      }
    }, {
      onSuccess: () => {
        message.success('页面更新成功')
        setFormChanged(false)
      }
    })
  }

  // 返回列表页
  const handleBack = () => {
    navigate('/pages')
  }

  // 表单变化处理
  const handleFormChange = () => {
    setFormChanged(true)
  }

  if (isLoadingPage) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Spin size="large" tip="加载页面中..." />
      </div>
    )
  }

  if (pageLoadError || !pageDetail) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-red-500 mb-4">无法加载页面信息</p>
          <Button onClick={handleBack} icon={<ArrowLeftOutlined />}>返回列表</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Button 
          onClick={handleBack} 
          icon={<ArrowLeftOutlined />} 
          className="mr-4"
        >
          返回
        </Button>
        <h1 className="text-2xl font-bold m-0">编辑页面</h1>
      </div>

      <Card className="mb-6">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleFormChange}
          initialValues={{
            title: pageDetail.title,
            description: pageDetail.description || '',
          }}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入页面标题' }]}
          >
            <Input placeholder="请输入页面标题" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea 
              placeholder="请输入页面描述" 
              rows={4}
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit"
              loading={isUpdating}
              disabled={!formChanged}
              icon={<SaveOutlined />}
            >
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
      
      {/* 页面内容编辑区域 */}
      <Card title="页面内容" className="mb-6">
        <p className="text-gray-500">此处可以集成富文本编辑器或其他内容编辑组件</p>
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify(pageDetail.content, null, 2) || '暂无内容'}
        </pre>
      </Card>
    </div>
  )
}

export default PageEdit 