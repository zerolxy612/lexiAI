import { Button, Divider, Input, Form } from 'antd';
import { Link } from '@refly-packages/ai-workspace-common/utils/router';
import { useState, useCallback, useMemo, useEffect } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import Logo from '@/assets/logo.svg';
import Google from '@/assets/google.svg';
import GitHub from '@/assets/github-mark.svg';

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

  // Navigate to landing page
  const handleGoToLanding = useCallback(() => {
    navigate('/landing');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-4">
            <img src={Logo} alt="Refly" className="w-8 h-8" />
            <span className="ml-2 text-2xl font-bold text-gray-900">Refly</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {isSignUpMode
              ? t('landingPage.loginModal.signupTitle')
              : t('landingPage.loginModal.signinTitle')}
          </h1>
          <p className="text-sm text-gray-600">
            {isSignUpMode
              ? t('landingPage.loginModal.signupSubtitle')
              : t('landingPage.loginModal.signinSubtitle')}
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-white">
          {/* OAuth Buttons */}
          {(isGithubEnabled || isGoogleEnabled) && (
            <div className="flex flex-col gap-3 mb-6">
              {isGithubEnabled && (
                <Button
                  onClick={() => handleLogin('github')}
                  className="h-10 w-full flex items-center justify-center"
                  data-cy="github-login-button"
                  loading={authStore.loginInProgress && authStore.loginProvider === 'github'}
                  disabled={authStore.loginInProgress && authStore.loginProvider !== 'github'}
                >
                  <img src={GitHub} alt="github" className="mr-2 h-4 w-4" />
                  {authStore.loginInProgress && authStore.loginProvider === 'github'
                    ? t('landingPage.loginModal.loggingStatus')
                    : t('landingPage.loginModal.oauthBtn.github')}
                </Button>
              )}
              {isGoogleEnabled && (
                <Button
                  onClick={() => handleLogin('google')}
                  className="h-10 w-full flex items-center justify-center"
                  data-cy="google-login-button"
                  loading={authStore.loginInProgress && authStore.loginProvider === 'google'}
                  disabled={authStore.loginInProgress && authStore.loginProvider !== 'google'}
                >
                  <img src={Google} alt="google" className="mr-2 h-4 w-4" />
                  {authStore.loginInProgress && authStore.loginProvider === 'google'
                    ? t('landingPage.loginModal.loggingStatus')
                    : t('landingPage.loginModal.oauthBtn.google')}
                </Button>
              )}
            </div>
          )}

          {/* Divider */}
          {(isGithubEnabled || isGoogleEnabled) && isEmailEnabled && (
            <Divider className="my-6">
              <span className="text-gray-500 text-sm">or</span>
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
                  label={
                    <span className="font-medium text-gray-700">
                      {t('landingPage.loginModal.emailLabel')}
                    </span>
                  }
                  validateTrigger={['onBlur']}
                  hasFeedback
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
                >
                  <Input
                    type="email"
                    placeholder={t('landingPage.loginModal.emailPlaceholder')}
                    className="h-10"
                    data-cy="email-input"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label={
                    <div className="flex w-full flex-row items-center justify-between">
                      <span className="font-medium text-gray-700">
                        {t('landingPage.loginModal.passwordLabel')}
                      </span>
                      {!isSignUpMode && (
                        <Button
                          type="link"
                          className="p-0 text-blue-600 hover:text-blue-800"
                          onClick={handleResetPassword}
                        >
                          {t('landingPage.loginModal.passwordForget')}
                        </Button>
                      )}
                    </div>
                  }
                  validateTrigger={['onBlur']}
                  hasFeedback
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
                >
                  <Input.Password
                    placeholder={t('landingPage.loginModal.passwordPlaceholder')}
                    className="h-10"
                    data-cy="password-input"
                  />
                </Form.Item>

                <Form.Item className="mb-6">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={authStore.loginInProgress && authStore.loginProvider === 'email'}
                    className="h-12 w-full text-base font-medium"
                    data-cy="continue-button"
                  >
                    {t('landingPage.loginModal.continue')}
                  </Button>
                </Form.Item>
              </Form>

              {/* Mode Switch */}
              <div className="text-center text-sm text-gray-600 mb-6">
                {isSignUpMode ? (
                  <span>
                    {`${t('landingPage.loginModal.signinHint')} `}
                    <Button
                      type="link"
                      className="p-0 text-blue-600 hover:text-blue-800"
                      data-cy="switch-to-signin-button"
                      onClick={() => handleModeSwitch(false)}
                    >
                      {t('landingPage.loginModal.signin')}
                    </Button>
                  </span>
                ) : (
                  <span>
                    {`${t('landingPage.loginModal.signupHint')} `}
                    <Button
                      type="link"
                      className="p-0 text-blue-600 hover:text-blue-800"
                      data-cy="switch-to-signup-button"
                      onClick={() => handleModeSwitch(true)}
                    >
                      {t('landingPage.loginModal.signup')}
                    </Button>
                  </span>
                )}
              </div>
            </>
          )}

          {/* Terms and Privacy */}
          <div className="text-center text-xs text-gray-500 mb-6">
            {t('landingPage.loginModal.utilText')}
            <Link
              to="https://docs.refly.ai/about/terms-of-service"
              target="_blank"
              className="mx-1 text-xs text-blue-600 underline hover:text-blue-800"
            >
              {t('landingPage.loginModal.terms')}
            </Link>
            {t('landingPage.loginModal.and')}
            <Link
              to="https://docs.refly.ai/about/privacy-policy"
              target="_blank"
              className="mx-1 text-xs text-blue-600 underline hover:text-blue-800"
            >
              {t('landingPage.loginModal.privacyPolicy')}
            </Link>
          </div>

          {/* Back to Landing */}
          <div className="text-center">
            <Button
              type="link"
              onClick={handleGoToLanding}
              className="text-gray-500 hover:text-gray-700"
            >
              ← {t('common.backToHome', { defaultValue: 'Back to Home' })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Optimize with memo to prevent unnecessary re-renders
export default React.memo(AuthPage);
