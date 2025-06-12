import { Button } from 'antd';
import { AiOutlineMenuFold, AiOutlineMenuUnfold } from 'react-icons/ai';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';

const PageTitle = (props: { title: string }) => {
  const { title } = props;
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  return (
    <div className="border-b-1 flex h-16 w-full items-center gap-2 border-x-0 border-t-0 border-solid border-b-gray-200 bg-[#edf2f8]">
      {collapse ? (
        <SiderPopover>
          <Button
            type="text"
            icon={<AiOutlineMenuUnfold size={20} />}
            onClick={() => {
              setCollapse(!collapse);
            }}
          />
        </SiderPopover>
      ) : (
        <Button
          type="text"
          icon={<AiOutlineMenuFold size={20} />}
          onClick={() => {
            setCollapse(!collapse);
          }}
        />
      )}

      <div className="text-xl font-bold">{title}</div>
    </div>
  );
};

export default PageTitle;
