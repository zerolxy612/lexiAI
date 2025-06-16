import { useState, useEffect } from 'react';
import { Button, Layout } from 'antd';
import {
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import cn from 'classnames';
import LexiHKLogo from '@/assets/Lexihk-dark.png';
import VectorIcon from '@/assets/Vector.png';
import AddIcon from '@/assets/add.png';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
// components
import { SearchQuickOpenBtn } from '@refly-packages/ai-workspace-common/components/search-quick-open-btn';
import { useTranslation } from 'react-i18next';
import { SettingModal } from '@refly-packages/ai-workspace-common/components/settings';
import { TourModal } from '@refly-packages/ai-workspace-common/components/tour-modal';
import { SettingsGuideModal } from '@refly-packages/ai-workspace-common/components/settings-guide';
import { StorageExceededModal } from '@refly-packages/ai-workspace-common/components/subscription/storage-exceeded-modal';
// hooks
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { SiderData, useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
// icons
import { IconProject } from '@refly-packages/ai-workspace-common/components/common/icon';
import { CanvasTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template';
import { SiderLoggedOut } from './sider-logged-out';
import { CreateProjectModal } from '@refly-packages/ai-workspace-common/components/project/project-create';

import './layout.scss';
import { ProjectDirectory } from '../project/project-directory';
import { ConversationHistory } from './conversation-history';
import { SIDEBAR_WIDTH } from '@refly-packages/ai-workspace-common/constants/layout';

const Sider = Layout.Sider;
// const SubMenu = Menu.SubMenu; // Temporarily unused

export const SiderLogo = (props: {
  source: 'sider' | 'popover';
  navigate: (path: string) => void;
  setCollapse: (collapse: boolean) => void;
}) => {
  const { navigate, setCollapse, source } = props;
  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas();

  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-2">
        {/* Book icon on the left */}
        {source === 'sider' && (
          <Button
            type="text"
            icon={<img src={VectorIcon} alt="Toggle sidebar" className="h-4 w-4" />}
            onClick={() => setCollapse(true)}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          />
        )}
        {/* LexiHK logo on the right */}
        <div
          className="flex cursor-pointer flex-row items-center gap-1.5"
          onClick={() => navigate('/')}
        >
          <img src={LexiHKLogo} alt="LexiHK" className="h-6 w-auto" />
        </div>
      </div>

      {/* Add new canvas icon */}
      <Button
        type="text"
        icon={<img src={AddIcon} alt="Create new canvas" className="h-4 w-4" />}
        onClick={(e) => {
          e.stopPropagation();
          debouncedCreateCanvas();
        }}
        loading={createCanvasLoading}
        className="hover:bg-gray-100 dark:hover:bg-gray-800 mt-1"
        disabled={createCanvasLoading}
      />
    </div>
  );
};

// Temporarily unused component
/*
const SettingItem = () => {
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));
  const planType = userProfile?.subscription?.planType || 'free';

  const { t } = useTranslation();

  return (
    <div className="group w-full">
      <SiderMenuSettingList>
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center">
            <Avatar size={32} src={userProfile?.avatar} icon={<AiOutlineUser />} />
            <span
              className={cn(
                'ml-2 max-w-[180px] truncate font-semibold text-gray-600 dark:text-gray-300',
                {
                  'max-w-[80px]': subscriptionEnabled,
                },
              )}
            >
              {userProfile?.nickname}
            </span>
          </div>

          {subscriptionEnabled && (
            <div className="flex h-6 items-center justify-center rounded-full bg-gray-100 px-3 text-xs font-medium group-hover:bg-white dark:bg-gray-800 dark:group-hover:bg-black">
              {t(`settings.subscription.subscriptionStatus.${planType}`)}
            </div>
          )}
        </div>
      </SiderMenuSettingList>
    </div>
  );
};
*/

export const NewCanvasItem = () => {
  const { t } = useTranslation();
  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas();

  return (
    <div className="w-full" onClick={() => debouncedCreateCanvas()}>
      <Button
        className="w-full justify-start px-2"
        key="newCanvas"
        loading={createCanvasLoading}
        type="text"
        icon={<IconPlus className="text-green-600 dark:text-green-300" />}
      >
        <span className="text-green-600 dark:text-green-300">
          {t('loggedHomePage.siderMenu.newCanvas')}
        </span>
      </Button>
    </div>
  );
};

export const NewProjectItem = () => {
  const { t } = useTranslation();
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState(false);
  const { getProjectsList } = useHandleSiderData();

  return (
    <>
      <div key="newProject" className="w-full" onClick={() => setCreateProjectModalVisible(true)}>
        <Button
          type="text"
          icon={<IconPlus className="text-green-600 dark:text-green-300" />}
          className="w-full justify-start px-2"
        >
          <span className="text-green-600 dark:text-green-300">{t('project.create')}</span>
        </Button>
      </div>

      <CreateProjectModal
        mode="create"
        visible={createProjectModalVisible}
        setVisible={setCreateProjectModalVisible}
        onSuccess={() => {
          getProjectsList(true);
        }}
      />
    </>
  );
};

// Temporarily commented out for simplified sidebar
/*
export const CanvasListItem = ({ canvas }: { canvas: SiderData }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showCanvasIdActionDropdown, setShowCanvasIdActionDropdown] = useState<string | null>(null);

  const location = useLocation();
  const selectedKey = useMemo(() => getSelectedKey(location.pathname), [location.pathname]);

  const handleUpdateShowStatus = useCallback((canvasId: string | null) => {
    setShowCanvasIdActionDropdown(canvasId);
  }, []);

  return (
    <div
      key={canvas.id}
      className={cn(
        'group relative my-1 px-2 rounded text-sm leading-8 text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-950',
        {
          '!bg-gray-100 font-medium !text-green-600': selectedKey === canvas.id,
          'dark:!bg-gray-800 dark:!text-green-300': selectedKey === canvas.id, // 新增的dark模式选中状态
        },
      )}
      onClick={() => {
        navigate(`/canvas/${canvas.id}`);
      }}
    >
      <div className="flex w-40 items-center justify-between">
        <div className="flex items-center gap-3">
          <IconCanvas
            className={cn({ 'text-green-600 dark:text-green-300': selectedKey === canvas.id })}
          />
          <div className="w-28 truncate">{canvas?.name || t('common.untitled')}</div>
        </div>

        <div
          className={cn(
            'flex items-center transition-opacity duration-200',
            showCanvasIdActionDropdown === canvas.id
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <CanvasActionDropdown
            btnSize="small"
            canvasId={canvas.id}
            canvasName={canvas.name}
            updateShowStatus={handleUpdateShowStatus}
          />
        </div>
      </div>
    </div>
  );
};
*/

export const ProjectListItem = ({ project }: { project: SiderData }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleProjectClick = async () => {
    // Navigate to the project page
    navigate(`/project/${project.id}?canvasId=empty`);
  };

  return (
    <div
      key={project.id}
      className="group relative my-1 px-2 rounded text-sm leading-8 text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-950"
      onClick={handleProjectClick}
    >
      <div className="flex w-40 items-center justify-between">
        <div className="flex items-center gap-3">
          <IconProject className="text-gray-500 dark:text-gray-400" />
          <div className="w-28 truncate">{project?.name || t('common.untitled')}</div>
        </div>
      </div>
    </div>
  );
};

// Temporarily unused components
/*
const ViewAllButton = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();
  return (
    <Button
      className="group w-full px-2 text-gray-500 text-xs mb-2 !bg-transparent hover:!text-green-600 dark:text-gray-400 dark:hover:!text-green-300"
      type="text"
      size="small"
      onClick={onClick}
      iconPosition="end"
      icon={
        <IconRight className="flex items-center text-gray-500 hover:text-green-600 group-hover:text-green-600 dark:text-gray-400 dark:hover:!text-green-300" />
      }
    >
      {t('common.viewAll')}
    </Button>
  );
};

const getSelectedKey = (pathname: string) => {
  if (pathname.startsWith('/canvas')) {
    const arr = pathname?.split('?')[0]?.split('/');
    return arr[arr.length - 1] ?? '';
  }
  return '';
};
*/

const SiderLoggedIn = (props: { source: 'sider' | 'popover' }) => {
  const { source = 'sider' } = props;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateLibraryModalActiveKey } = useKnowledgeBaseStoreShallow((state) => ({
    updateLibraryModalActiveKey: state.updateLibraryModalActiveKey,
  }));

  // Essential data loading for conversation history
  useHandleSiderData(true);

  // Essential state for core functionality
  const { collapse, setCollapse, showSettingModal, setShowSettingModal } = useSiderStoreShallow(
    (state) => ({
      showSettingModal: state.showSettingModal,
      collapse: state.collapse,
      setCollapse: state.setCollapse,
      setShowSettingModal: state.setShowSettingModal,
    }),
  );

  // Essential user profile data for core functionality
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  // Essential modals state
  const { setShowLibraryModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    setShowLibraryModal: state.setShowLibraryModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));
  // const { t } = useTranslation(); // Temporarily commented out
  const location = useLocation();
  const canvasId = location.pathname.split('/').pop();

  // Temporarily removed for simplified sidebar - will be restored when needed
  /*
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));
  const planType = userProfile?.subscription?.planType || 'free';
  const { canvasList, projectsList, setShowLibraryModal, setShowCanvasListModal, setSettingsModalActiveTab } = ...
  const { isLoadingCanvas, isLoadingProjects } = useHandleSiderData(true);
  const { t } = useTranslation();
  const location = useLocation();
  const selectedKey = useMemo(() => getSelectedKey(location.pathname), [location.pathname]);
  const defaultOpenKeys = useMemo(() => ['Canvas', 'Library'], []);
  const canvasId = location.pathname.split('/').pop();
  const isHome = useMatch('/canvas/:canvasId') && canvasId === 'empty';
  */
  // Essential canvas creation functionality
  const { debouncedCreateCanvas } = useCreateCanvas({
    projectId: null,
    afterCreateSuccess: () => {
      setShowLibraryModal(true);
    },
  });

  // Handle library modal opening from URL parameter - essential for functionality
  useEffect(() => {
    const shouldOpenLibrary = searchParams.get('openLibrary');
    const shouldOpenSettings = searchParams.get('openSettings');
    const settingsTab = searchParams.get('settingsTab');

    if (shouldOpenLibrary === 'true' && userProfile?.uid) {
      if (canvasId && canvasId !== 'empty') {
        setShowLibraryModal(true);
      } else {
        debouncedCreateCanvas();
      }

      // Remove the parameter from URL
      searchParams.delete('openLibrary');
      const newSearch = searchParams.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
      window.history.replaceState({}, '', newUrl);

      updateLibraryModalActiveKey('resource');
    }

    if (shouldOpenSettings === 'true' && userProfile?.uid) {
      setShowSettingModal(true);
      // Remove the parameter from URL
      searchParams.delete('openSettings');
      searchParams.delete('settingsTab');
      const newSearch = searchParams.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
      window.history.replaceState({}, '', newUrl);

      if (settingsTab) {
        setSettingsModalActiveTab(settingsTab as any);
      }
    }
  }, [
    searchParams,
    userProfile?.uid,
    setShowLibraryModal,
    setShowSettingModal,
    setSettingsModalActiveTab,
    debouncedCreateCanvas,
    canvasId,
    updateLibraryModalActiveKey,
  ]);

  return (
    <Sider
      width={source === 'sider' ? (collapse ? 0 : SIDEBAR_WIDTH) : SIDEBAR_WIDTH}
      className={cn(
        'border border-solid border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
        source === 'sider' ? 'h-[calc(100vh)]' : 'h-[calc(100vh-100px)] rounded-r-lg',
      )}
    >
      <div className="flex h-full flex-col">
        <SiderLogo source={source} navigate={(path) => navigate(path)} setCollapse={setCollapse} />

        <SearchQuickOpenBtn />

        {/* Conversation History */}
        <ConversationHistory />

        <SettingModal visible={showSettingModal} setVisible={setShowSettingModal} />
      </div>
    </Sider>
  );
};

export const SiderLayout = (props: { source: 'sider' | 'popover' }) => {
  const { source = 'sider' } = props;
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const isProject = useMatch('/project/:projectId');
  const projectId = location.pathname.split('/').pop();

  return (
    <>
      <SettingsGuideModal />
      <TourModal />
      <StorageExceededModal />
      <CanvasTemplateModal />

      {isLogin ? (
        isProject ? (
          <ProjectDirectory projectId={projectId} source={source} />
        ) : (
          <SiderLoggedIn source={source} />
        )
      ) : (
        <SiderLoggedOut source={source} />
      )}
    </>
  );
};
