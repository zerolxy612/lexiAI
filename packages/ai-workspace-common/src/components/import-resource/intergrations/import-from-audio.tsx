import { useState, useCallback, useMemo } from 'react';
import { Button, message, Upload, UploadProps, Switch, Tooltip } from 'antd';
import { TbMusic, TbMicrophone } from 'react-icons/tb';
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
import { useAudioTranscription } from '@refly-packages/ai-workspace-common/hooks/use-audio-transcription';
import TranscriptionDisplay from '@refly-packages/ai-workspace-common/components/audio-transcription/transcription-display';
import type { TranscriptionResult } from '@refly-packages/ai-workspace-common/requests/transcription';

const { Dragger } = Upload;

interface AudioItem {
  title: string;
  url: string;
  storageKey: string;
  uid?: string;
  status?: 'uploading' | 'done' | 'error';
  // Transcription related fields
  transcriptionText?: string;
  transcriptionResult?: TranscriptionResult;
  transcriptionStatus?: 'idle' | 'transcribing' | 'completed' | 'error';
  originalFile?: File;
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
  const [enableTranscription, setEnableTranscription] = useState(true);

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  // Audio transcription hook
  const { startTranscription, isTranscribing } = useAudioTranscription({
    autoShowMessages: false, // We'll handle messages ourselves
    onTranscriptionComplete: useCallback((result: TranscriptionResult, audioUid?: string) => {
      if (audioUid) {
        setAudioList((prev) =>
          prev.map((item) =>
            item.uid === audioUid
              ? {
                  ...item,
                  transcriptionText: result.text,
                  transcriptionResult: result,
                  transcriptionStatus: 'completed' as const,
                }
              : item,
          ),
        );
      }
    }, []),
    onTranscriptionError: useCallback(
      (error: string, audioUid?: string) => {
        if (audioUid) {
          setAudioList((prev) =>
            prev.map((item) =>
              item.uid === audioUid
                ? {
                    ...item,
                    transcriptionStatus: 'error' as const,
                  }
                : item,
            ),
          );
        }
        message.error(t('resource.transcription.failed', { error }));
      },
      [t],
    ),
  });

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

  // Handle transcription for uploaded audio
  const handleTranscription = useCallback(
    async (file: File, audioUid: string) => {
      if (!enableTranscription) return;

      try {
        // Update transcription status to 'transcribing'
        setAudioList((prev) =>
          prev.map((item) =>
            item.uid === audioUid
              ? {
                  ...item,
                  transcriptionStatus: 'transcribing' as const,
                }
              : item,
          ),
        );

        await startTranscription(file, audioUid);
      } catch (error) {
        console.error('Transcription failed:', error);
      }
    },
    [enableTranscription, startTranscription],
  );

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
          transcriptionStatus: 'idle',
          originalFile: file,
        },
      ]);

      try {
        const data = await uploadAudio(file, tempUid);
        if (data?.url && data?.storageKey) {
          setAudioList((prev) =>
            prev.map((item) =>
              item.uid === tempUid
                ? {
                    ...item,
                    title: file.name,
                    url: data.url,
                    storageKey: data.storageKey,
                    uid: data.uid,
                    status: 'done',
                  }
                : item,
            ),
          );

          // Start transcription after successful upload
          if (enableTranscription) {
            await handleTranscription(file, tempUid);
          }
        } else {
          setAudioList((prev) => prev.filter((item) => item.uid !== tempUid));
          message.error(`${t('common.uploadFailed')}: ${file.name}`);
        }
      } catch (error) {
        setAudioList((prev) => prev.filter((item) => item.uid !== tempUid));
        message.error(`${t('common.uploadFailed')}: ${file.name}`);
      }

      return false;
    },
    onRemove: (file: RcFile) => {
      setAudioList((prev) => prev.filter((item) => item.uid !== file.uid));
    },
  };

  // Handle transcription text changes
  const handleTranscriptionTextChange = useCallback((audioUid: string, newText: string) => {
    setAudioList((prev) =>
      prev.map((item) =>
        item.uid === audioUid
          ? {
              ...item,
              transcriptionText: newText,
            }
          : item,
      ),
    );
  }, []);

  // Retry transcription for a specific audio
  const retryTranscription = useCallback(
    async (audioUid: string) => {
      const audio = audioList.find((item) => item.uid === audioUid);
      if (audio?.originalFile) {
        await handleTranscription(audio.originalFile, audioUid);
      }
    },
    [audioList, handleTranscription],
  );

  const handleSave = async () => {
    if (audioList.length === 0) {
      message.warning(t('resource.import.emptyAudio'));
      return;
    }

    setSaveLoading(true);

    try {
      const { data } = await getClient().batchCreateResource({
        body: audioList.map((audio) => ({
          projectId: currentProjectId,
          resourceType: 'file', // Currently using 'file' type for audio
          title: audio.title,
          storageKey: audio.storageKey,
          // Include transcription text in contentPreview if available
          contentPreview: audio.transcriptionText || undefined,
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
    } catch (error) {
      setSaveLoading(false);
      message.error(t('common.putFailed'));
    }
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
    if (enableTranscription) {
      hint += `. ${t('resource.transcription.transcriptionHint')}`;
    }
    return hint;
  };

  // Calculate transcription progress
  const transcriptionStats = useMemo(() => {
    const total = audioList.length;
    const completed = audioList.filter((item) => item.transcriptionStatus === 'completed').length;
    const inProgress = audioList.filter(
      (item) => item.transcriptionStatus === 'transcribing',
    ).length;
    const errors = audioList.filter((item) => item.transcriptionStatus === 'error').length;

    return { total, completed, inProgress, errors };
  }, [audioList]);

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-weblink">
      {/* header */}
      <div className="flex items-center justify-between pt-6 px-6">
        <div className="flex items-center gap-x-[8px]">
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

        {/* Transcription Toggle */}
        <div className="flex items-center gap-2">
          <TbMicrophone className="text-sm text-gray-500" />
          <Tooltip
            title={
              enableTranscription
                ? t('resource.transcription.disableTranscription')
                : t('resource.transcription.enableTranscription')
            }
          >
            <Switch checked={enableTranscription} onChange={setEnableTranscription} size="small" />
          </Tooltip>
          <span className="text-sm text-gray-600">{t('resource.transcription.title')}</span>
        </div>
      </div>

      {/* content */}
      <div className="flex-grow overflow-y-auto px-10 py-6 box-border">
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

          {/* Transcription Status Summary */}
          {enableTranscription && audioList.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">
                  {t('resource.transcription.transcriptionPreview')}
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  {transcriptionStats.completed}/{transcriptionStats.total} 已完成
                  {transcriptionStats.inProgress > 0 &&
                    ` (${transcriptionStats.inProgress} 转录中)`}
                  {transcriptionStats.errors > 0 && ` (${transcriptionStats.errors} 失败)`}
                </span>
              </div>
            </div>
          )}

          {/* Transcription Results */}
          {enableTranscription &&
            audioList.map((audio) => (
              <TranscriptionDisplay
                key={audio.uid}
                status={audio.transcriptionStatus || 'idle'}
                result={audio.transcriptionResult || null}
                error={null}
                progress={audio.transcriptionStatus === 'transcribing' ? 50 : 0}
                filename={audio.title}
                onTextChange={(text) => handleTranscriptionTextChange(audio.uid!, text)}
                editable={true}
                showStats={true}
              />
            ))}
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
          <Button
            type="primary"
            onClick={handleSave}
            disabled={disableSave || isTranscribing}
            loading={saveLoading}
          >
            {isCanvasOpen ? t('common.saveToCanvas') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
