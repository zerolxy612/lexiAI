import { Button, Divider, Input, Form } from 'antd';
import { useState, useCallback, useMemo, useEffect } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Google from '@/assets/google.svg';
import GitHub from '@/assets/github-mark.svg';
import MyLogo from '@/assets/Lexihk-dark.png';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { serverOrigin } from '@refly-packages/ai-workspace-common/utils/env';
import { useGetAuthConfig } from '@refly-packages/ai-workspace-common/queries';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';

interface FormValues {
  email: string;
  password: string;
}

const AuthPage = () => {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const navigate = useNavigate();

  const authStore = useAuthStoreShallow((state) => ({
    loginInProgress: state.loginInProgress,
    loginProvider: state.loginProvider,
    setLoginInProgress: state.setLoginInProgress,
    setLoginProvider: state.setLoginProvider,
    setVerificationModalOpen: state.setVerificationModalOpen,
    setResetPasswordModalOpen: state.setResetPasswordModalOpen,
    setSessionId: state.setSessionId,
    setEmail: state.setEmail,
    reset: state.reset,
  }));

  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const _isPublicAccessPage = usePublicAccessPage();

  const { t } = useTranslation();

  const { data: authConfig, isLoading: isAuthConfigLoading } = useGetAuthConfig();

  // Redirect to canvas if already logged in
  useEffect(() => {
    if (isLogin) {
      navigate('/canvas/empty', { replace: true });
    }
  }, [isLogin, navigate]);

  // Provide default values if config is not loaded
  const { isGithubEnabled, isGoogleEnabled, isEmailEnabled } = useMemo(() => {
    // Default to showing email login if config is not available
    if (!authConfig?.data || isAuthConfigLoading) {
      return { isGithubEnabled: false, isGoogleEnabled: false, isEmailEnabled: true };
    }

    return {
      isGithubEnabled: authConfig.data.some((item) => item.provider === 'github'),
      isGoogleEnabled: authConfig.data.some((item) => item.provider === 'google'),
      isEmailEnabled: authConfig.data.some((item) => item.provider === 'email') || true, // Always enable email as fallback
    };
  }, [authConfig?.data, isAuthConfigLoading]);

  const handleLogin = useCallback(
    (provider: 'github' | 'google') => {
      authStore.setLoginInProgress(true);
      authStore.setLoginProvider(provider);
      location.href = `${serverOrigin}/v1/auth/${provider}`;
    },
    [authStore],
  );

  const handleEmailAuth = useCallback(async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch (error) {
      console.error('Error validating form fields', error);
      return;
    }

    authStore.setLoginProvider('email');
    authStore.setLoginInProgress(true);

    if (isSignUpMode) {
      const { data } = await getClient().emailSignup({
        body: {
          email: values.email,
          password: values.password,
        },
      });
      authStore.setLoginInProgress(false);

      if (data?.success) {
        if (data.data?.skipVerification) {
          authStore.reset();
          window.location.replace('/canvas/empty');
        } else {
          authStore.setEmail(values.email);
          authStore.setSessionId(data.data?.sessionId ?? null);
          authStore.setVerificationModalOpen(true);
        }
      }
    } else {
      const { data } = await getClient().emailLogin({
        body: {
          email: values.email,
          password: values.password,
        },
      });
      authStore.setLoginInProgress(false);

      if (data?.success) {
        authStore.reset();
        window.location.replace('/canvas/empty');
      }
    }
  }, [authStore, form, isSignUpMode]);

  const handleResetPassword = useCallback(() => {
    authStore.setResetPasswordModalOpen(true);
  }, [authStore]);

  const handleModeSwitch = useCallback(
    (signUp: boolean) => {
      setIsSignUpMode(signUp);
      form.resetFields();
    },
    [form],
  );

  return (
    <div className="min-h-screen flex bg-[#EDF2F8]">
      {/* Left Brand Area */}
      <div className="hidden lg:flex lg:w-[65%] items-center justify-center relative">
        <div className="absolute left-[20%] top-[30%] text-left">
          <div className="w-[320px] h-[55px]">
            <img src={MyLogo} alt="LexiHK" className="w-full h-full object-contain" />
          </div>
          <p className="mt-4 ml-[44px] text-[#1B2559] font-['PingFang_SC'] text-[48px] font-medium leading-none">
            Hello
          </p>
        </div>
      </div>

      {/* Right Login Area */}
      <div className="w-full lg:w-[35%] flex flex-col justify-center px-4 sm:px-6 lg:px-8 xl:px-12 bg-white shadow-[4px_0_40px_rgba(0,0,0,0.04)]">
        <div className="max-w-[360px] mx-auto w-full">
          {/* Logo for mobile */}
          <div className="mb-[18px] lg:hidden text-center">
            <div className="h-8 mx-auto w-[138px]">
              <img src={MyLogo} alt="LexiHK" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="text-center">
            {/* Logo for desktop */}
            <div className="h-8 mx-auto hidden lg:block mb-[18px]">
              <img src={MyLogo} alt="LexiHK" className="w-full h-full object-contain" />
            </div>

            {/* Mode indicator */}
            <div className="text-center mb-6">
              <span className="text-lg text-gray-600">{isSignUpMode ? '注册' : '登录'}</span>
            </div>

            {/* OAuth Buttons */}
            {(isGithubEnabled || isGoogleEnabled) && (
              <div className="flex flex-col gap-3 mb-6">
                {isGithubEnabled && (
                  <Button
                    onClick={() => handleLogin('github')}
                    className="h-12 w-full flex items-center justify-center text-base"
                    data-cy="github-login-button"
                    loading={authStore.loginInProgress && authStore.loginProvider === 'github'}
                    disabled={authStore.loginInProgress && authStore.loginProvider !== 'github'}
                  >
                    <img src={GitHub} alt="github" className="mr-2 h-5 w-5" />
                    {authStore.loginInProgress && authStore.loginProvider === 'github'
                      ? t('landingPage.loginModal.loggingStatus')
                      : t('landingPage.loginModal.oauthBtn.github')}
                  </Button>
                )}
                {isGoogleEnabled && (
                  <Button
                    onClick={() => handleLogin('google')}
                    className="h-12 w-full flex items-center justify-center text-base"
                    data-cy="google-login-button"
                    loading={authStore.loginInProgress && authStore.loginProvider === 'google'}
                    disabled={authStore.loginInProgress && authStore.loginProvider !== 'google'}
                  >
                    <img src={Google} alt="google" className="mr-2 h-5 w-5" />
                    {authStore.loginInProgress && authStore.loginProvider === 'google'
                      ? t('landingPage.loginModal.loggingStatus')
                      : t('landingPage.loginModal.oauthBtn.google')}
                  </Button>
                )}
              </div>
            )}

            {/* Divider */}
            {(isGithubEnabled || isGoogleEnabled) && isEmailEnabled && (
              <Divider className="my-8">
                <span className="text-gray-400 text-sm">或</span>
              </Divider>
            )}

            {/* Email Form */}
            {isEmailEnabled && (
              <>
                <Form
                  form={form}
                  layout="vertical"
                  className="w-full"
                  requiredMark={false}
                  onFinish={handleEmailAuth}
                >
                  <Form.Item
                    name="email"
                    rules={[
                      {
                        required: true,
                        message: t('verifyRules.emailRequired'),
                      },
                      {
                        type: 'email',
                        message: t('verifyRules.emailInvalid'),
                      },
                    ]}
                    className="mb-6"
                  >
                    <Input
                      type="email"
                      placeholder="邮箱"
                      className="h-12 text-base"
                      data-cy="email-input"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[
                      {
                        required: true,
                        message: t('verifyRules.passwordRequired'),
                      },
                      ...(isSignUpMode
                        ? [
                            {
                              min: 8,
                              message: t('verifyRules.passwordMin'),
                            },
                          ]
                        : []),
                    ]}
                    className="mb-8"
                  >
                    <Input.Password
                      placeholder="密码"
                      className="h-12 text-base"
                      data-cy="password-input"
                    />
                  </Form.Item>

                  <Form.Item className="mb-8">
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={authStore.loginInProgress && authStore.loginProvider === 'email'}
                      className="h-12 w-full text-base font-medium bg-teal-600 hover:bg-teal-700 border-teal-600 hover:border-teal-700"
                      data-cy="continue-button"
                    >
                      {isSignUpMode ? '注册' : '登录'}
                    </Button>
                  </Form.Item>
                </Form>

                {/* Bottom Links */}
                <div className="text-center space-y-2">
                  <div>
                    <Button
                      type="link"
                      className="p-0 text-gray-800 hover:text-gray-600 text-sm"
                      data-cy="switch-mode-button"
                      onClick={() => handleModeSwitch(!isSignUpMode)}
                    >
                      {isSignUpMode ? '已有账户？登录' : '还没有账户？注册'}
                    </Button>
                  </div>

                  {!isSignUpMode && (
                    <div>
                      <Button
                        type="link"
                        className="p-0 text-blue-600 hover:text-blue-800 text-sm"
                        onClick={handleResetPassword}
                      >
                        忘记密码？
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Optimize with memo to prevent unnecessary re-renders
export default React.memo(AuthPage);
