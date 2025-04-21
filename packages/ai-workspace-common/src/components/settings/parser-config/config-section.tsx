import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { Button, Select, Typography } from 'antd';
import { memo } from 'react';
import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

const Loading = memo(() => {
  return (
    <div className="w-full h-20 flex items-center justify-center">
      <Spin />
    </div>
  );
});

interface ConfigSectionProps {
  title: string;
  value: string;
  defaultValue: string;
  defaultLabel: string;
  providers: any[];
  isLoading: boolean;
  onAddProvider: () => void;
  onChange: (value: string) => void;
}

export const ConfigSection = memo(
  ({
    title,
    value,
    defaultValue,
    defaultLabel,
    providers,
    isLoading,
    onAddProvider,
    onChange,
  }: ConfigSectionProps) => {
    const { t } = useTranslation();

    return (
      <div className="space-y-4 p-4 border-solid border-1 border-gray-100 rounded-md">
        <Title level={5}>{title}</Title>

        <div className="flex items-center">
          <Select
            className="w-full"
            value={value}
            onChange={(value) => onChange(value)}
            dropdownRender={(menu) => (
              <>
                {isLoading ? (
                  <Loading />
                ) : (
                  <>
                    <div className="max-h-60 overflow-y-auto">{menu}</div>
                    <div className="p-2 border-t border-gray-200">
                      <Button
                        type="text"
                        icon={<IconPlus />}
                        onClick={onAddProvider}
                        className="flex items-center w-full"
                      >
                        {t('settings.parserConfig.createProvider')}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          >
            <Select.Option value={defaultValue}>{defaultLabel}</Select.Option>
            {providers?.map((provider) => (
              <Select.Option key={provider?.providerId} value={provider?.providerId}>
                {provider?.name} ({provider?.providerKey})
              </Select.Option>
            ))}
          </Select>
        </div>
      </div>
    );
  },
);
