import { useTranslation } from 'react-i18next';
import { message, Typography } from 'antd';
import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { ProviderModal } from '../model-providers/provider-modal';
import { useListProviders } from '@refly-packages/ai-workspace-common/queries';
import { ProviderInfo, providerInfoList } from '@refly/utils';
import { Provider } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { ConfigSection } from './config-section';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

const { Title } = Typography;

const DEFAULT_PROVIDERS = {
  webSearch: 'bing',
  urlParsing: 'cheerio',
  pdfParsing: 'pdfjs',
};

interface ParserConfigProps {
  visible: boolean;
}

export const ParserConfig = memo(({ visible }: ParserConfigProps) => {
  const { t } = useTranslation();
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [presetProviders, setPresetProviders] = useState<ProviderInfo[]>([]);
  const [currentType, setCurrentType] = useState<'webSearch' | 'urlParsing' | 'pdfParsing'>(
    'webSearch',
  );
  const { userProfile, setUserProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    setUserProfile: state.setUserProfile,
  }));

  const [webSearchValue, setWebSearchValue] = useState<string>(
    userProfile?.preferences?.webSearch?.providerId || DEFAULT_PROVIDERS.webSearch,
  );
  const [urlParsingValue, setUrlParsingValue] = useState<string>(
    userProfile?.preferences?.urlParsing?.providerId || DEFAULT_PROVIDERS.urlParsing,
  );
  const [pdfParsingValue, setPdfParsingValue] = useState<string>(
    userProfile?.preferences?.pdfParsing?.providerId || DEFAULT_PROVIDERS.pdfParsing,
  );

  const { data, isLoading, refetch } = useListProviders({
    query: {
      enabled: true,
    },
  });

  const providers = data?.data || [];

  const webSearchProviders = useMemo(
    () =>
      providers?.filter((provider) =>
        providerInfoList
          .find((p) => p.key === provider?.providerKey)
          ?.categories?.includes('webSearch'),
      ),
    [providers],
  );

  const urlParsingProviders = useMemo(
    () =>
      providers?.filter((provider) =>
        providerInfoList
          .find((p) => p.key === provider?.providerKey)
          ?.categories?.includes('urlParsing'),
      ),
    [providers],
  );

  const pdfParsingProviders = useMemo(
    () =>
      providers?.filter((provider) =>
        providerInfoList
          .find((p) => p.key === provider?.providerKey)
          ?.categories?.includes('pdfParsing'),
      ),
    [providers],
  );

  const setCurrentProvider = useCallback(
    (type: 'webSearch' | 'urlParsing' | 'pdfParsing', providerKey: string) => {
      switch (type) {
        case 'webSearch':
          setWebSearchValue(providerKey);
          break;
        case 'urlParsing':
          setUrlParsingValue(providerKey);
          break;
        case 'pdfParsing':
          setPdfParsingValue(providerKey);
          break;
      }
    },
    [],
  );

  // Open provider modal with specific category
  const openProviderModal = useCallback((type: 'webSearch' | 'urlParsing' | 'pdfParsing') => {
    setCurrentType(type);
    const filteredProviderInfoList = providerInfoList.filter((provider) =>
      provider?.categories?.includes(type),
    );
    setPresetProviders(filteredProviderInfoList);

    setIsProviderModalOpen(true);
  }, []);

  // Handle provider modal close
  const handleProviderModalClose = useCallback(() => {
    setCurrentType(null);
    setIsProviderModalOpen(false);
  }, []);

  // Success callback after provider creation/update
  const handleCreateProviderSuccess = useCallback(
    (provider: Provider) => {
      refetch();
      if (provider.enabled) {
        setCurrentProvider(currentType, provider.providerId);
      }
    },
    [currentType, refetch, setCurrentProvider],
  );

  const updateUserProfile = useCallback(
    async (type: 'webSearch' | 'urlParsing' | 'pdfParsing', value: string) => {
      const selectedProvider = providers.find((provider) => provider.providerId === value);

      const updatedPreferences = {
        ...userProfile.preferences,
        [type]: {
          providerKey: selectedProvider?.providerKey,
          providerId: selectedProvider?.providerId,
        },
      };

      const res = await getClient().updateSettings({
        body: {
          preferences: updatedPreferences,
        },
      });

      if (res?.data?.success) {
        message.success(t('settings.parserConfig.updateParserConfigSuccessfully'));
        setUserProfile({
          ...userProfile,
          preferences: updatedPreferences,
        });
      } else {
        message.error(t('settings.parserConfig.updateParserConfigFailed'));
      }
    },
    [userProfile, setUserProfile, providers],
  );

  const handleSelectProvider = useCallback(
    (value: string, type: 'webSearch' | 'urlParsing' | 'pdfParsing') => {
      console.log('value', value);
      console.log('type', type);
      setCurrentProvider(type, value);
      updateUserProfile(type, value);
    },
    [setCurrentProvider, updateUserProfile],
  );

  useEffect(() => {
    if (visible) {
      refetch();
    }
  }, [visible, refetch]);

  useEffect(() => {
    console.log('isLoading', isLoading);
  }, [isLoading]);

  return (
    <div className="p-4 pt-0 h-full overflow-hidden flex flex-col">
      <Title level={4} className="pb-4">
        {t('settings.tabs.parserConfig')}
      </Title>

      <div className="flex-grow overflow-y-auto space-y-8">
        {/* Web Search Configuration */}
        <ConfigSection
          title={t('settings.parserConfig.webSearch')}
          value={webSearchValue}
          defaultValue={DEFAULT_PROVIDERS.webSearch}
          defaultLabel={t('settings.parserConfig.bing')}
          providers={webSearchProviders}
          isLoading={isLoading}
          onAddProvider={() => openProviderModal('webSearch')}
          onChange={(value) => handleSelectProvider(value, 'webSearch')}
        />

        {/* URL Parsing Configuration */}
        <ConfigSection
          title={t('settings.parserConfig.urlParsing')}
          value={urlParsingValue}
          defaultValue={DEFAULT_PROVIDERS.urlParsing}
          defaultLabel={t('settings.parserConfig.cheerio')}
          providers={urlParsingProviders}
          isLoading={isLoading}
          onAddProvider={() => openProviderModal('urlParsing')}
          onChange={(value) => handleSelectProvider(value, 'urlParsing')}
        />

        {/* PDF Parsing Configuration */}
        <ConfigSection
          title={t('settings.parserConfig.pdfParsing')}
          value={pdfParsingValue}
          defaultValue={DEFAULT_PROVIDERS.pdfParsing}
          defaultLabel={t('settings.parserConfig.pdfjs')}
          providers={pdfParsingProviders}
          isLoading={isLoading}
          onAddProvider={() => openProviderModal('pdfParsing')}
          onChange={(value) => handleSelectProvider(value, 'pdfParsing')}
        />

        {/* Provider Modal */}
        <ProviderModal
          isOpen={isProviderModalOpen}
          presetProviders={presetProviders}
          onClose={handleProviderModalClose}
          onSuccess={handleCreateProviderSuccess}
        />
      </div>
    </div>
  );
});
