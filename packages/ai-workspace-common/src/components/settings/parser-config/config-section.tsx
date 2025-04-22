import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { Button, Select, Typography } from 'antd';
import { memo, useMemo } from 'react';
import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

export const Loading = memo(() => {
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
    const options = useMemo(() => {
      return [
        {
          label: defaultLabel,
          value: defaultValue,
        },
        ...providers.map((provider) => ({
          label: `${provider.name} (${provider.providerKey})`,
          value: provider.providerId,
        })),
      ];
    }, [providers, defaultValue, defaultLabel]);

    return (
      <div className="space-y-2 p-4 border-solid border-1 border-gray-100 rounded-md">
        <Title level={5}>{title}</Title>

        <div className="flex items-center">
          <Select
            className="w-full"
            value={value}
            options={options}
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
          />
        </div>
      </div>
    );
  },
);
