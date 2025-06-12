import { useState } from 'react';
import { Button, message, Upload, UploadProps } from 'antd';
import { TbMusic } from 'react-icons/tb';
import { RiInboxArchiveLine } from 'react-icons/ri';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { Resource } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { StorageLimit } from './storageLimit';
import type { RcFile } from 'antd/es/upload/interface';
import { genResourceID } from '@refly/utils/id';
import { LuInfo } from 'react-icons/lu';
import { getAvailableFileCount } from '@refly/utils/quota';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { GrUnlock } from 'react-icons/gr';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useUpdateSourceList } from '@refly-packages/ai-workspace-common/hooks/canvas/use-update-source-list';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';

const { Dragger } = Upload;

interface AudioItem {
  title: string;
  url: string;
  storageKey: string;
  uid?: string;
  status?: 'uploading' | 'done' | 'error';
}

const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];

export const ImportFromAudio = () => {
  const { t } = useTranslation();
  const { setImportResourceModalVisible, insertNodePosition } = useImportResourceStoreShallow(
    (state) => ({
      setImportResourceModalVisible: state.setImportResourceModalVisible,
      insertNodePosition: state.insertNodePosition,
    }),
  );
  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  const { projectId, isCanvasOpen } = useGetProjectCanvasId();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null);
  const { updateSourceList } = useUpdateSourceList();

  const { refetchUsage, storageUsage, fileParsingUsage } = useSubscriptionUsage();

  const [saveLoading, setSaveLoading] = useState(false);
  const [audioList, setAudioList] = useState<AudioItem[]>([]);

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const planType = userProfile?.subscription?.planType || 'free';
  const uploadLimit = fileParsingUsage?.fileUploadLimit ?? -1;
  const maxFileSize = `${uploadLimit}MB`;
  const maxFileSizeBytes = uploadLimit * 1024 * 1024;

  const uploadAudio = async (file: File, uid: string) => {
    const { data } = await getClient().upload({
      body: {
        file,
      },
    });
    if (data?.success) {
      return { ...(data.data || {}), uid };
    }
    return { url: '', storageKey: '', uid };
  };

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    accept: ALLOWED_AUDIO_EXTENSIONS.join(','),
    fileList: audioList.map((item) => ({
      uid: item.uid,
      name: item.title,
      status: item?.status,
      url: item.url,
    })),
    beforeUpload: async (file: File) => {
      if (uploadLimit > 0 && file.size > maxFileSizeBytes) {
        message.error(t('resource.import.fileTooLarge', { size: maxFileSize }));
        return Upload.LIST_IGNORE;
      }

      const tempUid = genResourceID();
      setAudioList((prev) => [
        ...prev,
        {
          title: file.name,
          url: '',
          storageKey: '',
          uid: tempUid,
          status: 'uploading',
        },
      ]);

      const data = await uploadAudio(file, tempUid);
      if (data?.url && data?.storageKey) {
        setAudioList((prev) =>
          prev.map((item) =>
            item.uid === tempUid
              ? {
                  title: file.name,
                  url: data.url,
                  storageKey: data.storageKey,
                  uid: data.uid,
                  status: 'done',
                }
              : item,
          ),
        );
      } else {
        setAudioList((prev) => prev.filter((item) => item.uid !== tempUid));
        message.error(`${t('common.uploadFailed')}: ${file.name}`);
      }

      return false;
    },
    onRemove: (file: RcFile) => {
      setAudioList((prev) => prev.filter((item) => item.uid !== file.uid));
    },
  };

  const handleSave = async () => {
    if (audioList.length === 0) {
      message.warning(t('resource.import.emptyAudio'));
      return;
    }

    setSaveLoading(true);

    const { data } = await getClient().batchCreateResource({
      body: audioList.map((audio) => ({
        projectId: currentProjectId,
        resourceType: 'file', // Currently using 'file' type for audio
        title: audio.title,
        storageKey: audio.storageKey,
      })),
    });

    setSaveLoading(false);
    if (!data?.success) {
      message.error(t('common.putFailed'));
      return;
    }

    setAudioList([]);
    refetchUsage();
    message.success(t('common.putSuccess'));
    setImportResourceModalVisible(false);

    if (isCanvasOpen) {
      const resources = Array.isArray(data.data)
        ? (data.data as Resource[]).map((resource) => ({
            id: resource.resourceId,
            title: resource.title,
            domain: 'resource',
            contentPreview: resource.contentPreview,
          }))
        : [];

      for (const [index, resource] of resources.entries()) {
        const nodePosition = insertNodePosition
          ? {
              x: insertNodePosition.x + index * 300,
              y: insertNodePosition.y,
            }
          : null;

        nodeOperationsEmitter.emit('addNode', {
          node: {
            type: 'resource',
            data: {
              title: resource.title,
              entityId: resource.id,
              contentPreview: resource.contentPreview,
              metadata: {
                resourceType: 'audio',
              },
            },
            position: nodePosition,
          },
        });
      }
    }

    updateSourceList(Array.isArray(data.data) ? (data.data as Resource[]) : [], currentProjectId);
  };

  const canImportCount = getAvailableFileCount(storageUsage);
  const disableSave = audioList.length === 0 || audioList.length > canImportCount;

  const genUploadHint = () => {
    let hint = t('resource.import.supportedAudio', {
      formats: ALLOWED_AUDIO_EXTENSIONS.map((ext) => ext.slice(1).toUpperCase()).join(', '),
    });
    if (uploadLimit > 0) {
      hint += `. ${t('resource.import.fileUploadLimit', { size: maxFileSize })}`;
    }
    return hint;
  };

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-weblink">
      {/* header */}
      <div className="flex items-center gap-x-[8px] pt-6 px-6">
        <span className="flex items-center justify-center">
          <TbMusic className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromAudio')}</div>
        {subscriptionEnabled && planType === 'free' && (
          <Button
            type="text"
            icon={<GrUnlock className="flex items-center justify-center" />}
            onClick={() => setSubscribeModalVisible(true)}
            className="text-green-600 font-medium"
          >
            {t('resource.import.unlockUploadLimit')}
          </Button>
        )}
      </div>

      {/* content */}
      <div className="flex-grow overflow-y-auto px-10 py-6 box-border flex flex-col justify-center">
        <div className="w-full file-upload-container">
          <Dragger {...props}>
            <RiInboxArchiveLine className="text-3xl text-[#00968f]" />
            <p className="ant-upload-text mt-4 text-gray-600 dark:text-gray-300">
              {t('resource.import.dragOrClick')}
            </p>
            <p className="ant-upload-hint text-gray-400 mt-2">{genUploadHint()}</p>
            {fileParsingUsage?.pagesLimit >= 0 && (
              <div className="text-green-500 mt-2 text-xs font-medium flex items-center justify-center gap-1">
                <LuInfo />
                {t('resource.import.fileParsingUsage', {
                  used: fileParsingUsage?.pagesParsed,
                  limit: fileParsingUsage?.pagesLimit,
                })}
              </div>
            )}
          </Dragger>
        </div>
      </div>

      {/* footer */}
      <div className="w-full flex justify-between items-center border-t border-solid border-[#e5e5e5] dark:border-[#2f2f2f] border-x-0 border-b-0 p-[16px] rounded-none">
        <div className="flex items-center gap-x-[8px]">
          <p className="font-bold whitespace-nowrap text-md text-[#00968f]">
            {t('resource.import.audioCount', { count: audioList?.length || 0 })}
          </p>
          <StorageLimit
            resourceCount={audioList?.length || 0}
            projectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
          />
        </div>

        <div className="flex items-center gap-x-[8px] flex-shrink-0">
          <Button onClick={() => setImportResourceModalVisible(false)}>{t('common.cancel')}</Button>
          <Button type="primary" onClick={handleSave} disabled={disableSave} loading={saveLoading}>
            {isCanvasOpen ? t('common.saveToCanvas') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
