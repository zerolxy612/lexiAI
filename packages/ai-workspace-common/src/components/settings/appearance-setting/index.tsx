import { useTranslation } from 'react-i18next';
import { Radio, Typography, Divider } from 'antd';
import { useThemeStoreShallow } from '../../../stores/theme';
import { useEffect } from 'react';

const { Title } = Typography;
export const AppearanceSetting = () => {
  const { t } = useTranslation();
  const { themeMode, setThemeMode, initTheme } = useThemeStoreShallow((state) => ({
    themeMode: state.themeMode,
    setThemeMode: state.setThemeMode,
    initTheme: state.initTheme,
  }));

  // 初始化主题
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // 处理主题模式变更
  const handleThemeModeChange = (e: any) => {
    setThemeMode(e.target.value);
  };

  return (
    <div className="p-4 pt-0 h-full overflow-auto flex flex-col">
      <Title level={4}>{t('settings.appearance.title')}</Title>
      <Divider />
      <div className="mb-6">
        <Typography.Title level={5}>{t('settings.appearance.themeMode')}</Typography.Title>
        <div className="mt-2">
          <Radio.Group value={themeMode} onChange={handleThemeModeChange}>
            <Radio.Button value="light">{t('settings.appearance.lightMode')}</Radio.Button>
            <Radio.Button value="dark">{t('settings.appearance.darkMode')}</Radio.Button>
            <Radio.Button value="system">{t('settings.appearance.systemMode')}</Radio.Button>
          </Radio.Group>
        </div>
      </div>
    </div>
  );
};
