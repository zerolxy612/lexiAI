import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skill } from '@refly/openapi-schema';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useFrontPageStoreShallow } from '@refly-packages/ai-workspace-common/stores/front-page';
import { SkillDisplay } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/skill-display';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Form } from '@arco-design/web-react';
import { Button } from 'antd';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import { Actions } from './action';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { EmptyThreadWelcome } from '@refly-packages/ai-workspace-common/components/canvas/refly-pilot/linear-thread';

export const FrontPage = memo(({ projectId }: { projectId: string | null }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
    setSkillSelectedModel: state.setSkillSelectedModel,
  }));

  const {
    query,
    selectedSkill,
    setQuery,
    setSelectedSkill,
    tplConfig,
    setTplConfig,
    runtimeConfig,
    setRuntimeConfig,
    reset,
  } = useFrontPageStoreShallow((state) => ({
    query: state.query,
    selectedSkill: state.selectedSkill,
    setQuery: state.setQuery,
    setSelectedSkill: state.setSelectedSkill,
    tplConfig: state.tplConfig,
    setTplConfig: state.setTplConfig,
    runtimeConfig: state.runtimeConfig,
    setRuntimeConfig: state.setRuntimeConfig,
    reset: state.reset,
  }));

  const { debouncedCreateCanvas, isCreating } = useCreateCanvas({
    source: 'front-page',
    projectId,
    afterCreateSuccess: () => {
      // When canvas is created successfully, data is already in the store
      // No need to use localStorage anymore
    },
  });

  const handleSelectSkill = useCallback(
    (skill: Skill) => {
      setSelectedSkill(skill);
      setTplConfig(skill?.tplConfig ?? null);
    },
    [setSelectedSkill, setTplConfig],
  );

  const handleSendMessage = useCallback(() => {
    if (!query?.trim()) return;
    debouncedCreateCanvas();
  }, [query, debouncedCreateCanvas]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6">
      <div className="w-full max-w-4xl mx-auto">
        <div className="h-60">
          <EmptyThreadWelcome />
        </div>

        <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          {selectedSkill && (
            <div className="flex w-full justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#6172F3] shadow-lg flex items-center justify-center flex-shrink-0">
                  {getSkillIcon(selectedSkill.name, 'w-4 h-4 text-white')}
                </div>
                <span className="text-sm font-medium leading-normal text-[rgba(0,0,0,0.8)] truncate">
                  {t(`${selectedSkill.name}.name`, { ns: 'skill' })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="text" size="small" onClick={() => handleSelectSkill(null)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          <SkillDisplay
            containCnt={5}
            selectedSkill={selectedSkill}
            setSelectedSkill={handleSelectSkill}
          />

          <div className="flex flex-col">
            <ChatInput
              readonly={false}
              query={query}
              setQuery={setQuery}
              selectedSkillName={selectedSkill?.name ?? null}
              handleSendMessage={handleSendMessage}
              handleSelectSkill={handleSelectSkill}
              maxRows={6}
              minRows={2}
              inputClassName="px-3 py-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {selectedSkill?.configSchema?.items?.length > 0 && (
              <ConfigManager
                readonly={false}
                key={selectedSkill?.name}
                form={form}
                formErrors={formErrors}
                setFormErrors={setFormErrors}
                schema={selectedSkill?.configSchema}
                tplConfig={tplConfig}
                fieldPrefix="tplConfig"
                configScope="runtime"
                resetConfig={() => {
                  const defaultConfig = selectedSkill?.tplConfig ?? {};
                  setTplConfig(defaultConfig);
                  form.setFieldValue('tplConfig', defaultConfig);
                }}
                onFormValuesChange={(_changedValues, allValues) => {
                  setTplConfig(allValues.tplConfig);
                }}
              />
            )}

            <Actions
              query={query}
              model={skillSelectedModel}
              setModel={setSkillSelectedModel}
              runtimeConfig={runtimeConfig}
              setRuntimeConfig={setRuntimeConfig}
              handleSendMessage={handleSendMessage}
              handleAbort={() => {}}
              loading={isCreating}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

FrontPage.displayName = 'FrontPage';
