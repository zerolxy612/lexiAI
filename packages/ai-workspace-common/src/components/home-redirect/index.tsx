import { useEffect } from 'react';
import { useState } from 'react';
import { SuspenseLoading } from '@refly-packages/ai-workspace-common/components/common/loading';
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';

interface HomeRedirectProps {
  defaultNode: ReactNode;
  authNode?: ReactNode;
}

export const HomeRedirect = ({ defaultNode, authNode }: HomeRedirectProps) => {
  const [element, setElement] = useState<ReactNode | null>(null);
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const handleHomeRedirect = async () => {
    // If user is logged in, redirect to canvas
    if (isLogin) {
      return <Navigate to={'/canvas/empty'} replace />;
    }

    // For unauthenticated users, show auth page if provided, otherwise redirect to auth page
    if (authNode) {
      return authNode;
    }

    // Fallback: redirect to auth page
    return <Navigate to={'/auth'} replace />;
  };

  useEffect(() => {
    handleHomeRedirect().then(setElement);
  }, [isLogin, defaultNode, authNode]);

  return element ?? <SuspenseLoading />;
};
