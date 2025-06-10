import { useParams } from 'react-router-dom';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';
import { Button } from 'antd';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import VectorIcon from '@/assets/Vector.png';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useEffect, useState } from 'react';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

const CanvasPage = () => {
  const { canvasId = '' } = useParams();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  // Auto-create canvas functionality
  const { debouncedCreateCanvas, isCreating } = useCreateCanvas({
    projectId: undefined,
    afterCreateSuccess: () => {
      // Canvas creation success is handled by the hook's navigation
    },
  });

  const [autoCreatingCanvas, setAutoCreatingCanvas] = useState(false);
  const [autoCreateFailed, setAutoCreateFailed] = useState(false);

  // Auto-create canvas when user visits /canvas/empty
  useEffect(() => {
    if (canvasId === 'empty' && !autoCreatingCanvas && !isCreating && !autoCreateFailed) {
      setAutoCreatingCanvas(true);

      // Add a timeout fallback in case canvas creation fails
      const timeoutId = setTimeout(() => {
        setAutoCreatingCanvas(false);
        setAutoCreateFailed(true);
      }, 5000); // 5 second timeout

      // Add a small delay to ensure smooth UX
      setTimeout(() => {
        try {
          debouncedCreateCanvas('auto-create');
          // Clear timeout if creation starts successfully
          clearTimeout(timeoutId);
        } catch (error) {
          console.error('Error creating canvas:', error);
          setAutoCreatingCanvas(false);
          setAutoCreateFailed(true);
          clearTimeout(timeoutId);
        }
      }, 100);

      // Cleanup timeout on unmount
      return () => clearTimeout(timeoutId);
    }
  }, [canvasId, debouncedCreateCanvas, autoCreatingCanvas, isCreating, autoCreateFailed]);

  // Show loading state while auto-creating canvas
  if (canvasId === 'empty' && (autoCreatingCanvas || isCreating) && !autoCreateFailed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center">
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
        <Spin size="large" />
        <div className="mt-4 text-gray-500 dark:text-gray-400">Creating your canvas...</div>
      </div>
    );
  }

  // Render existing canvas
  if (canvasId && canvasId !== 'empty') {
    return <Canvas canvasId={canvasId} />;
  }

  // Fallback: Show FrontPage when canvasId is empty or for any unexpected state
  // This ensures users always see something, even if auto-creation fails
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
      <FrontPage projectId={null} />
    </div>
  );
};

export default CanvasPage;
