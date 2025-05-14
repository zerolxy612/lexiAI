import { Button } from 'antd';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';

export const NoCanvas = ({ projectId }: { projectId: string }) => {
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  return (
    <div className="flex h-full w-full flex-col">
      <div className="absolute top-0 left-0 h-16 items-center justify-between px-4 py-2 z-10">
        {collapse && (
          <SiderPopover>
            <Button
              type="text"
              icon={<AiOutlineMenuUnfold size={16} className="text-gray-500" />}
              onClick={() => {
                setCollapse(!collapse);
              }}
            />
          </SiderPopover>
        )}
      </div>
      <FrontPage projectId={projectId} />
    </div>
  );
};
