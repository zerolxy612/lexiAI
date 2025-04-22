import { ProviderCategory, ProviderConfig } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { ModelEdit } from './model-edit';
import { useState, useCallback, memo } from 'react';
import { Button } from 'antd';

export const ModelCell = memo(
  ({
    modelValue,
    category,
    placeholder,
  }: {
    modelValue: ProviderConfig;
    placeholder: string;
    category: ProviderCategory;
  }) => {
    return (
      <div className="w-full overflow-hidden">
        <div className="w-full">
          {modelValue ? (
            <span>{modelValue?.modelId}</span>
          ) : (
            <span className={category === 'embedding' ? 'text-red-500' : 'text-gray-500'}>
              {placeholder}
            </span>
          )}
        </div>
      </div>
    );
  },
);

export const ActionCell = memo(
  ({
    modelValue,
    category,
    onSave,
  }: {
    modelValue: ProviderConfig;
    category: ProviderCategory;
    onSave: (type: ProviderCategory, value: ProviderConfig, afterSuccess?: () => void) => void;
  }) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleClose = useCallback(() => {
      setIsModalOpen(false);
    }, []);

    const handleSave = useCallback(
      (model: ProviderConfig) => {
        onSave(category, model, handleClose);
      },
      [category, onSave, handleClose],
    );

    return (
      <div className="flex justify-center">
        <Button size="small" type="primary" ghost onClick={() => setIsModalOpen(true)}>
          {modelValue ? t('common.edit') : t('common.add')}
        </Button>

        <ModelEdit
          isOpen={isModalOpen}
          model={modelValue}
          onClose={handleClose}
          onSave={handleSave}
          isSaving={false}
          filterProviderCategory={category}
        />
      </div>
    );
  },
);
