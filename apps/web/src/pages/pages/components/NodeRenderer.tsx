import React from 'react'
import { Empty } from 'antd'
import { NodeRelationResponse } from '@refly-packages/ai-workspace-common/requests/types.gen'

interface NodeRendererProps {
  node: NodeRelationResponse
}

function NodeRenderer({ node }: NodeRendererProps) {
  if (!node) {
    return <Empty description="未找到节点" />
  }

  const { nodeType, nodeData } = node

  // 文本节点渲染
  if (nodeType === 'text') {
    return nodeData?.content ? (
      <div className="p-4">
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: nodeData.content }} />
      </div>
    ) : (
      <Empty description="空文本节点" />
    )
  }

  // 图片节点渲染
  if (nodeType === 'image') {
    return nodeData?.url ? (
      <div className="p-4 flex justify-center">
        <img 
          src={nodeData.url} 
          alt={nodeData.alt || '图片'} 
          className="max-w-full max-h-[60vh] object-contain"
        />
      </div>
    ) : (
      <Empty description="图片未找到" />
    )
  }

  // 图表节点渲染
  if (nodeType === 'chart') {
    // 图表渲染需要更复杂的逻辑，这里仅展示一个占位符
    return (
      <div className="p-4">
        <div className="bg-blue-50 p-6 rounded-lg text-center">
          <p className="text-blue-600 font-medium">图表组件</p>
          <p className="text-sm text-gray-500">
            {nodeData?.chartType || '未知图表类型'}
          </p>
        </div>
      </div>
    )
  }

  // 代码节点渲染
  if (nodeType === 'code') {
    return (
      <div className="p-4">
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
          <code>{nodeData?.content || '// 空代码块'}</code>
        </pre>
      </div>
    )
  }

  // 表格节点渲染
  if (nodeType === 'table') {
    // 简单表格渲染示例
    if (nodeData?.rows && Array.isArray(nodeData.rows) && nodeData.rows.length > 0) {
      return (
        <div className="p-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {nodeData.rows[0].map((cell: string, index: number) => (
                  <th 
                    key={index}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {nodeData.rows.slice(1).map((row: string[], rowIndex: number) => (
                <tr key={rowIndex}>
                  {row.map((cell: string, cellIndex: number) => (
                    <td 
                      key={cellIndex}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    
    return <Empty description="空表格" />
  }

  // 默认渲染
  return (
    <div className="p-4 text-center">
      <p className="text-gray-500">
        不支持的节点类型: {nodeType}
      </p>
    </div>
  )
}

export default NodeRenderer 