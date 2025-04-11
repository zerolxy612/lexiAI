import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';

// 加载中组件
const LoadingComponent = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-8 h-full">
      <Spin tip={t('common.loading')} />
    </div>
  );
};

// 懒加载各个渲染器组件
export const LazyCodeArtifactRenderer = lazy(() =>
  import('./CodeArtifactRenderer').then((module) => ({
    default: module.CodeArtifactRenderer,
  })),
);

export const LazyDocumentRenderer = lazy(() =>
  import('./DocumentRenderer').then((module) => ({
    default: module.DocumentRenderer,
  })),
);

export const LazySkillResponseRenderer = lazy(() =>
  import('./SkillResponseRenderer').then((module) => ({
    default: module.SkillResponseRenderer,
  })),
);

export const LazyImageRenderer = lazy(() =>
  import('./ImageRenderer').then((module) => ({
    default: module.ImageRenderer,
  })),
);

// 包装组件，添加Suspense
interface WithSuspenseProps {
  children: React.ReactNode;
}

export const WithSuspense: React.FC<WithSuspenseProps> = ({ children }) => (
  <Suspense fallback={<LoadingComponent />}>{children}</Suspense>
);
