import { Button } from 'antd';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import VectorIcon from '@/assets/Vector.png';

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
              icon={<img src={VectorIcon} alt="Expand sidebar" className="h-4 w-4" />}
              onClick={() => {
                setCollapse(!collapse);
              }}
              className="hover:bg-gray-100 dark:hover:bg-gray-800"
            />
          </SiderPopover>
        )}
      </div>
      <FrontPage projectId={projectId} />
    </div>
  );
};
