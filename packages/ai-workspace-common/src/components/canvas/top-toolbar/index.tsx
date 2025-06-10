import { useEffect, FC, useState, useCallback, memo } from 'react';
import { useMatch } from 'react-router-dom';
import { Button, Divider, message } from 'antd';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { useDebounce } from 'use-debounce';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { Helmet } from 'react-helmet';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasTitle, ReadonlyCanvasTitle } from './canvas-title';
import { ToolbarButtons } from './buttons';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import ShareSettings from './share-settings';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import './index.scss';
import {
  IconLink,
  IconLanguage,
  IconDown,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuBookCopy } from 'react-icons/lu';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import { UILocaleList } from '@refly-packages/ai-workspace-common/components/ui-locale-list';
import { SiderMenuSettingList } from '@refly-packages/ai-workspace-common/components/sider-menu-setting-list';
import { Avatar } from 'antd';
import userIcon from '../../../assets/user.png';

interface TopToolbarProps {
  canvasId: string;
}

export const TopToolbar: FC<TopToolbarProps> = memo(({ canvasId }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.language as LOCALE;
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { isLogin, userProfile } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));
  const isShareCanvas = useMatch('/share/canvas/:canvasId');
  const isPreviewCanvas = useMatch('/preview/canvas/:shareId');

  const { provider, readonly, shareData } = useCanvasContext();
  const [unsyncedChanges, setUnsyncedChanges] = useState(provider?.unsyncedChanges || 0);
  const [debouncedUnsyncedChanges] = useDebounce(unsyncedChanges, 500);

  const handleUnsyncedChanges = useCallback((data: number) => {
    setUnsyncedChanges(data);
  }, []);

  useEffect(() => {
    provider?.on('unsyncedChanges', handleUnsyncedChanges);
    return () => {
      provider?.off('unsyncedChanges', handleUnsyncedChanges);
    };
  }, [provider, handleUnsyncedChanges]);

  const { config, showPreview, setShowPreview, showMaxRatio, setShowMaxRatio } =
    useCanvasStoreShallow((state) => ({
      config: state.config[canvasId],
      showPreview: state.showPreview,
      setShowPreview: state.setShowPreview,
      showMaxRatio: state.showMaxRatio,
      setShowMaxRatio: state.setShowMaxRatio,
    }));

  const canvasTitle = shareData?.title || provider?.document.getText('title').toJSON() || '';
  const hasCanvasSynced = config?.localSyncedAt > 0 && config?.remoteSyncedAt > 0;

  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();
  const handleDuplicate = () => {
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    duplicateCanvas(canvasId, () => {});
  };

  return (
    <>
      <Helmet>
        <title>{canvasTitle?.toString() || t('common.untitled')} · Refly</title>
        {shareData?.minimapUrl && <meta property="og:image" content={shareData.minimapUrl} />}
      </Helmet>
      <div
        className={`absolute h-16 top-0 left-0 right-0  box-border flex justify-between items-center py-2 px-4 pr-8 bg-transparent ${
          collapse ? 'w-[calc(100vw-12px)]' : 'w-[calc(100vw-232px)]'
        }`}
      >
        <div className="flex items-center relative z-10">
          {collapse && (
            <>
              <SiderPopover>
                <Button
                  type="text"
                  icon={<AiOutlineMenuUnfold size={16} className="text-gray-500" />}
                  onClick={() => {
                    setCollapse(!collapse);
                  }}
                />
              </SiderPopover>
              <Divider type="vertical" className="pr-[4px] h-4" />
            </>
          )}
          {readonly ? (
            <ReadonlyCanvasTitle
              canvasTitle={canvasTitle}
              isLoading={false}
              owner={shareData?.owner}
            />
          ) : (
            <CanvasTitle
              canvasId={canvasId}
              canvasTitle={canvasTitle}
              hasCanvasSynced={hasCanvasSynced}
              providerStatus={provider?.status}
              debouncedUnsyncedChanges={debouncedUnsyncedChanges}
              language={language}
            />
          )}
        </div>

        <div className="flex items-center gap-2 relative z-10 mr-16">
          {/* ToolbarButtons moved to hidden section below for normal canvas */}
          {(isPreviewCanvas || isShareCanvas) && (
            <ToolbarButtons
              canvasTitle={canvasTitle}
              showPreview={showPreview}
              showMaxRatio={showMaxRatio}
              setShowPreview={setShowPreview}
              setShowMaxRatio={setShowMaxRatio}
            />
          )}

          {isPreviewCanvas ? (
            <Button
              loading={duplicating}
              type="primary"
              icon={<LuBookCopy className="flex items-center" />}
              onClick={handleDuplicate}
            >
              {t('template.use')}
            </Button>
          ) : isShareCanvas ? (
            <>
              <Button
                loading={duplicating}
                icon={<LuBookCopy className="flex items-center" />}
                onClick={handleDuplicate}
              >
                {t('template.duplicateCanvas')}
              </Button>
              <Button
                type="primary"
                icon={<IconLink className="flex items-center" />}
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  message.success(t('shareContent.copyLinkSuccess'));
                }}
              >
                {t('canvas.toolbar.copyLink')}
              </Button>
            </>
          ) : (
            <>
              {/* New language switcher and user menu with white background */}
              <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                {/* Language switcher */}
                <UILocaleList>
                  <Button
                    type="text"
                    size="middle"
                    className="px-3 py-1 h-8 flex items-center gap-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 border border-gray-200 rounded-md"
                  >
                    <span className="text-sm font-medium">
                      {i18n.language === 'zh-CN' ? '中文' : 'EN'}
                    </span>
                    <IconDown className="w-3 h-3" />
                  </Button>
                </UILocaleList>

                {/* User account menu - only icon */}
                <SiderMenuSettingList>
                  <Button
                    type="text"
                    size="middle"
                    className="px-2 py-1 h-8 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-50 border border-gray-200 rounded-md w-8"
                  >
                    <img
                      src={userProfile?.avatar || userIcon}
                      alt="User Avatar"
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  </Button>
                </SiderMenuSettingList>
              </div>

              {/* Temporarily hidden - will be moved to different location later */}
              <div className="hidden">
                <ToolbarButtons
                  canvasTitle={canvasTitle}
                  showPreview={showPreview}
                  showMaxRatio={showMaxRatio}
                  setShowPreview={setShowPreview}
                  setShowMaxRatio={setShowMaxRatio}
                />
                <ShareSettings canvasId={canvasId} canvasTitle={canvasTitle} />
                <CanvasActionDropdown
                  canvasId={canvasId}
                  canvasName={canvasTitle}
                  btnSize="large"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
});
