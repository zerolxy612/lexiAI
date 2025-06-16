import React, { memo, useState, useCallback } from 'react';
import { Card, Input, Button, Progress, Typography, Space, Tag, Tooltip } from 'antd';
import { TbVolume, TbCopy, TbEdit, TbCheck, TbX, TbClock, TbLanguage } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import type { TranscriptionResult } from '@refly-packages/ai-workspace-common/requests/transcription';
import type { TranscriptionStatus } from '@refly-packages/ai-workspace-common/hooks/use-audio-transcription';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

export interface TranscriptionDisplayProps {
  status: TranscriptionStatus;
  result: TranscriptionResult | null;
  error: string | null;
  progress: number;
  filename: string;
  onTextChange?: (text: string) => void;
  editable?: boolean;
  showStats?: boolean;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = memo(
  ({
    status,
    result,
    error,
    progress,
    filename,
    onTextChange,
    editable = true,
    showStats = true,
  }) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');

    const handleEditStart = useCallback(() => {
      setEditText(result?.text || '');
      setIsEditing(true);
    }, [result?.text]);

    const handleEditSave = useCallback(() => {
      onTextChange?.(editText);
      setIsEditing(false);
    }, [editText, onTextChange]);

    const handleEditCancel = useCallback(() => {
      setEditText('');
      setIsEditing(false);
    }, []);

    const handleCopyText = useCallback(async () => {
      if (result?.text) {
        try {
          await navigator.clipboard.writeText(result.text);
          // Could add a success message here
        } catch (error) {
          console.error('Failed to copy text:', error);
        }
      }
    }, [result?.text]);

    const formatDuration = useCallback((seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, []);

    const formatFileSize = useCallback((bytes: number) => {
      const mb = bytes / (1024 * 1024);
      return mb < 1 ? `${(bytes / 1024).toFixed(1)}KB` : `${mb.toFixed(1)}MB`;
    }, []);

    if (status === 'idle') {
      return null;
    }

    return (
      <Card
        className="w-full mt-4 transcription-display"
        title={
          <div className="flex items-center gap-2">
            <TbVolume className="text-lg text-blue-500" />
            <span className="text-sm font-medium">{t('resource.transcription.title')}</span>
            <Text type="secondary" className="text-xs">
              {filename}
            </Text>
          </div>
        }
        size="small"
      >
        {/* Transcribing Status */}
        {status === 'transcribing' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {t('resource.transcription.processing')}
              </span>
              <Tag color="processing">{t('resource.transcription.inProgress')}</Tag>
            </div>
            <Progress
              percent={progress}
              size="small"
              strokeColor={{
                '0%': '#87CEEB',
                '100%': '#155EEF',
              }}
            />
          </div>
        )}

        {/* Error Status */}
        {status === 'error' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag color="error">{t('resource.transcription.error')}</Tag>
            </div>
            <Text type="danger" className="text-sm">
              {error}
            </Text>
          </div>
        )}

        {/* Completed Status */}
        {status === 'completed' && result && (
          <div className="space-y-4">
            {/* Stats */}
            {showStats && (
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <Tooltip title={t('resource.transcription.duration')}>
                  <div className="flex items-center gap-1">
                    <TbClock />
                    <span>{formatDuration(result.duration)}</span>
                  </div>
                </Tooltip>
                <Tooltip title={t('resource.transcription.language')}>
                  <div className="flex items-center gap-1">
                    <TbLanguage />
                    <span>{result.language?.toUpperCase()}</span>
                  </div>
                </Tooltip>
                <Tooltip title={t('resource.transcription.fileSize')}>
                  <div className="flex items-center gap-1">
                    <span>{formatFileSize(result.fileSize)}</span>
                  </div>
                </Tooltip>
                <Tooltip title={t('resource.transcription.processingTime')}>
                  <div className="flex items-center gap-1">
                    <span>{(result.processingTimeMs / 1000).toFixed(1)}s</span>
                  </div>
                </Tooltip>
              </div>
            )}

            {/* Text Content */}
            <div className="space-y-2">
              {isEditing ? (
                <div className="space-y-2">
                  <TextArea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={6}
                    placeholder={t('resource.transcription.editPlaceholder')}
                    className="resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="small" icon={<TbX />} onClick={handleEditCancel}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="primary" size="small" icon={<TbCheck />} onClick={handleEditSave}>
                      {t('common.save')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative group">
                    <Paragraph
                      className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-sm leading-relaxed mb-0 min-h-[120px] max-h-[200px] overflow-y-auto"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {result.text || t('resource.transcription.noContent')}
                    </Paragraph>

                    {/* Action Buttons */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Space>
                        <Tooltip title={t('resource.transcription.copyText')}>
                          <Button
                            type="text"
                            size="small"
                            icon={<TbCopy />}
                            onClick={handleCopyText}
                            className="hover:bg-white hover:shadow-sm"
                          />
                        </Tooltip>
                        {editable && (
                          <Tooltip title={t('resource.transcription.editText')}>
                            <Button
                              type="text"
                              size="small"
                              icon={<TbEdit />}
                              onClick={handleEditStart}
                              className="hover:bg-white hover:shadow-sm"
                            />
                          </Tooltip>
                        )}
                      </Space>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Text Length Info */}
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>
                {t('resource.transcription.textLength', {
                  length: result.text?.length || 0,
                })}
              </span>
              {result.requestId && <span>ID: {result.requestId}</span>}
            </div>
          </div>
        )}
      </Card>
    );
  },
);

TranscriptionDisplay.displayName = 'TranscriptionDisplay';

export default TranscriptionDisplay;
