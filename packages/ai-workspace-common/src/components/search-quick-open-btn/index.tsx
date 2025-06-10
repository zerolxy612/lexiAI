import { bigSearchQuickOpenEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/big-search-quick-open';
import classNames from 'classnames';
import { IconMoreVertical } from '@refly-packages/ai-workspace-common/components/common/icon';

interface SearchQuickOpenBtnProps extends React.ComponentProps<'div'> {
  placeholder?: string;
}

export const SearchQuickOpenBtn = (props: SearchQuickOpenBtnProps) => {
  const { placeholder, ...divProps } = props;

  return (
    <div {...divProps} className={classNames('mb-3 mt-4', divProps.className)}>
      <div
        className="mx-3 flex flex-row flex-nowrap justify-between items-center rounded-md p-2 transition-colors duration-500 hover:cursor-pointer"
        style={{ backgroundColor: '#f1f5f8' }}
        onClick={() => {
          bigSearchQuickOpenEmitter.emit('openSearch');
        }}
      >
        <div className="flex items-center text-xs font-normal text-gray-500 dark:text-gray-400">
          <span>The landlord does not return the deposit</span>
        </div>
        <div className="flex items-center">
          <IconMoreVertical className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      </div>
    </div>
  );
};
