import React, { memo, useCallback } from 'react';
import { Button, Dropdown, Modal } from 'antd';
import type { MenuProps } from 'antd';
import {
  MoreHorizontal,
  X,
  Maximize2,
  Minimize2,
  FileText,
  Sparkles,
  Wrench,
  Trash2,
} from 'lucide-react';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { NodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-header';
import { type NodeRelation } from './ArtifactRenderer';
import {
  IconWideMode,
  IconDocument,
  IconResource,
  IconResponse,
  IconCodeArtifact,
  IconWebsite,
} from '@refly-packages/ai-workspace-common/components/common/icon';

// 获取节点图标组件
const getNodeIcon = (nodeType: string) => {
  switch (nodeType) {
    case 'document':
      return IconDocument;
    case 'resource':
      return IconResource;
    case 'skillResponse':
      return IconResponse;
    case 'toolResponse':
      return IconResponse;
    case 'codeArtifact':
      return IconCodeArtifact;
    case 'website':
      return IconWebsite;
    case 'skill':
      // 这里可以根据skillType返回不同的图标，但目前我们简化处理
      return Sparkles;
    case 'tool':
      return Wrench;
    default:
      return FileText;
  }
};

// 获取节点标题
const getNodeTitle = (node: NodeRelation) => {
  return node.nodeData?.title || '未命名节点';
};

interface NodeBlockHeaderProps {
  node: NodeRelation;
  onClose?: () => void;
  onMaximize?: () => void;
  onWideMode?: () => void;
  isMaximized?: boolean;
  isWideMode?: boolean;
  isMinimap?: boolean;
  onDelete?: (nodeId: string) => void;
}

export const NodeBlockHeader: React.FC<NodeBlockHeaderProps> = memo(
  ({
    node,
    onClose,
    onMaximize,
    onWideMode,
    isMaximized = false,
    isWideMode = false,
    isMinimap = false,
    onDelete,
  }) => {
    const IconComponent = getNodeIcon(node.nodeType);
    const nodeColor = NODE_COLORS[node.nodeType as keyof typeof NODE_COLORS] || '#17B26A';
    const title = getNodeTitle(node);

    // 处理标题更新
    const handleTitleUpdate = useCallback((newTitle: string) => {
      // 这里可以添加标题更新的逻辑
      console.log('Title updated:', newTitle);
    }, []);

    // 处理删除节点
    const handleDeleteNode = useCallback(() => {
      if (!onDelete) return;

      Modal.confirm({
        title: '确认删除节点',
        content: `确定要删除节点"${title}"吗？此操作不可恢复。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          onDelete(node.nodeId);
        },
      });
    }, [node.nodeId, onDelete, title]);

    // 定义下拉菜单项
    const menuItems: MenuProps['items'] = [
      {
        key: 'delete',
        label: (
          <div className="flex items-center gap-2 text-red-600 whitespace-nowrap">
            <Trash2 className="w-4 h-4 flex-shrink-0" />
            <span>删除节点</span>
          </div>
        ),
        onClick: handleDeleteNode,
      },
    ];

    // 如果是小地图模式，不显示header
    if (isMinimap) {
      return null;
    }

    return (
      <div className="flex justify-between items-center py-2 px-4 border-b border-[#EAECF0] relative">
        {/* Left: Icon and Title */}
        <div className="flex items-center gap-2 flex-grow overflow-hidden">
          <div className="flex-grow overflow-hidden">
            <NodeHeader
              source="node"
              title={title}
              Icon={IconComponent}
              iconBgColor={nodeColor}
              canEdit={false}
              updateTitle={handleTitleUpdate}
            />
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onWideMode && (
            <Button
              type="text"
              className={`p-1.5 hover:bg-gray-100 ${isWideMode ? 'text-primary-600' : 'text-gray-500'}`}
              onClick={onWideMode}
              title="宽屏模式查看"
            >
              <IconWideMode className="w-4 h-4" />
            </Button>
          )}
          {onMaximize && (
            <Button
              type="text"
              className={`p-1.5 hover:bg-gray-100 ${isMaximized ? 'text-primary-600' : 'text-gray-500'}`}
              onClick={onMaximize}
              title="幻灯片预览"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}

          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
            overlayClassName="min-w-[160px] w-max"
            getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
            dropdownRender={(menu) => (
              <div className="min-w-[160px] bg-white rounded-lg border-[0.5px] border-[rgba(0,0,0,0.03)] shadow-lg">
                {menu}
              </div>
            )}
          >
            <Button type="text" className="p-1.5 hover:bg-gray-100 text-gray-500">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </Dropdown>
          {onClose && (
            <Button type="text" className="p-1.5 hover:bg-gray-100 text-gray-500" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  },
);

NodeBlockHeader.displayName = 'NodeBlockHeader';
