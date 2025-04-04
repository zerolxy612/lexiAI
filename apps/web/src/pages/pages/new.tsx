import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest'
import { CanvasNode } from '@refly/openapi-schema'
import { useCreatePage } from '@refly-packages/ai-workspace-common/queries/queries'
import type { CreatePageResponse } from '@refly-packages/ai-workspace-common/requests/types.gen'

// 简单的Spinner组件
const Spinner = ({ size = 'normal' }: { size?: 'small' | 'normal' }) => (
  <div className={`animate-spin rounded-full border-t-2 border-indigo-500 ${size === 'small' ? 'h-4 w-4' : 'h-6 w-6'}`}></div>
);

export default function CreatePageFromCanvas() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [canvasId, setCanvasId] = useState('')
  const [nodeIds, setNodeIds] = useState<string[]>([])
  const [availableNodes, setAvailableNodes] = useState<CanvasNode[]>([])
  const [loading, setCanvasLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // 创建页面的mutate函数
  const { mutate: createPage, isPending } = useCreatePage(undefined, {
    onError: (error) => {
      console.error('创建页面失败:', error)
      setError(`创建页面失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
  
  // 当输入Canvas ID时，加载Canvas数据
  const fetchCanvasData = async () => {
    if (!canvasId.trim()) return
    
    try {
      setCanvasLoading(true)
      setError('')
      // 使用正确的方式获取client
      const client = getClient()
      
      // 调用API获取Canvas数据
      const response = await client.getCanvasData({
        query: { canvasId }
      })
      
      // 获取数据
      // 按照API响应格式，节点数据位于 response.data.data.nodes
      const data = response?.data;
      
      // 通用方式处理响应数据
      if (data?.success && data?.data) {
        // 从响应中正确提取节点数据
        const canvasData = data.data;
        
        if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
          // 节点直接在canvasData.nodes中
          const nodes = canvasData.nodes;
          
          // 验证节点的结构是否符合预期
          const validNodes = nodes.filter((node: any) => 
            node && 
            node.type && 
            node.data && 
            node.data.entityId
          );
          
          if (validNodes.length > 0) {
            setAvailableNodes(validNodes as CanvasNode[]);
          } else {
            setError('未找到有效的节点数据');
            setAvailableNodes([]);
          }
        } else {
          setError('Canvas中没有找到节点数据');
          setAvailableNodes([]);
        }
      } else {
        setError('API响应格式不符合预期');
        setAvailableNodes([]);
      }
    } catch (err) {
      console.error('获取Canvas数据失败:', err)
      setError(`获取Canvas数据失败: ${err instanceof Error ? err.message : String(err)}`)
      setAvailableNodes([])
    } finally {
      setCanvasLoading(false)
    }
  }
  
  // 处理节点选择
  const handleNodeToggle = (nodeId: string) => {
    setNodeIds(prev => 
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    )
  }
  
  // 提交表单创建页面
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!canvasId.trim()) {
      setError('请输入Canvas ID')
      return
    }
    
    if (nodeIds.length === 0) {
      setError('请至少选择一个节点')
      return
    }
    
    setError('')
    
    try {
      createPage({
        body: {
          title: title.trim() || 'Untitled Page',
          description: `从Canvas ${canvasId}创建`,
          // 按CreatePageRequest接口要求，将canvasId和nodeIds放入content对象中
          content: {
            canvasId,
            nodeIds
          }
        }
      }, {
        onSuccess: (response: any) => {
          const data = response?.data
          setSuccess(`页面创建成功! 页面ID: ${data?.pageId || '未知'}`)
          // 重置表单
          setTitle('')
          setNodeIds([])
          // 三秒后跳转到页面列表
          setTimeout(() => {
            navigate('/pages')
          }, 3000)
        },
        onError: (error: unknown) => {
          setError(`创建页面失败: ${error instanceof Error ? error.message : String(error)}`)
        }
      })
    } catch (err) {
      setError(`创建页面失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">从Canvas创建Page</h1>
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            页面标题 (可选)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Page"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Canvas ID *
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={canvasId}
              onChange={(e) => setCanvasId(e.target.value)}
              placeholder="输入Canvas ID"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <button
              type="button"
              onClick={fetchCanvasData}
              disabled={loading || !canvasId.trim()}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
            >
              {loading ? <Spinner size="small" /> : '加载节点'}
            </button>
          </div>
        </div>
        
        {availableNodes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择要包含的节点 *
            </label>
            <div className="border border-gray-300 rounded-md p-3 max-h-96 overflow-y-auto">
              {availableNodes.map((node) => (
                <div key={node.data.entityId} className="flex items-center py-2 border-b border-gray-200 last:border-b-0">
                  <input
                    type="checkbox"
                    id={`node-${node.data.entityId}`}
                    checked={nodeIds.includes(node.data.entityId)}
                    onChange={() => handleNodeToggle(node.data.entityId)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`node-${node.data.entityId}`} className="ml-2 flex-1">
                    <div className="font-medium">{node.data.title || '无标题'}</div>
                    <div className="text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded mr-2">类型: {node.type}</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">ID: {node.data.entityId}</span>
                    </div>
                  </label>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between mt-2">
              <button
                type="button"
                onClick={() => setNodeIds(availableNodes.map(node => node.data.entityId))}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                全选
              </button>
              <button
                type="button"
                onClick={() => setNodeIds([])}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                取消全选
              </button>
            </div>
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || nodeIds.length === 0 || !canvasId.trim()}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
          >
            {isPending ? <Spinner size="small" /> : '创建页面'}
          </button>
        </div>
      </form>
      
      <div className="mt-8">
        <h2 className="text-lg font-medium mb-4">使用说明</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>输入Canvas ID并点击"加载节点"按钮</li>
          <li>从列表中选择您想包含在页面中的节点</li>
          <li>输入页面标题（可选）</li>
          <li>点击"创建页面"按钮</li>
          <li>成功后，您将被重定向到页面列表</li>
        </ol>
      </div>
    </div>
  )
} 