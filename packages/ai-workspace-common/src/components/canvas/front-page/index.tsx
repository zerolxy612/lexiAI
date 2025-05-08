import { memo, useCallback, useEffect, useState, useMemo } from 'react';
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
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useListSkills } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { TechBackground } from './wireframe-cube';

export const FrontPage = memo(({ projectId }: { projectId: string | null }) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const skills = useListSkills();
  const templateLanguage = i18n.language;
  const templateCategoryId = '';

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

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

  const findSkillByName = useCallback(
    (name: string) => {
      return skills.find((skill) => skill.name === name) ?? null;
    },
    [skills],
  );

  const handlePresetScenario = useCallback(
    (scenarioId: string, skillName: string, queryText: string) => {
      setActiveScenarioId(scenarioId);
      const skill = findSkillByName(skillName);
      if (skill) {
        handleSelectSkill(skill);
        setQuery(queryText);
      }
    },
    [findSkillByName, handleSelectSkill, setQuery],
  );

  // Define preset scenarios
  const presetScenarios = useMemo(
    () => [
      {
        id: 'ppt',
        title: t('canvas.presetScenarios.generatePPT'),
        description: t('canvas.presetScenarios.generatePPTDesc'),
        skillName: 'codeArtifacts',
        query: t('canvas.presetScenarios.generatePPTQuery'),
        icon: '📊',
      },
      {
        id: 'landing',
        title: t('canvas.presetScenarios.generateLanding'),
        description: t('canvas.presetScenarios.generateLandingDesc'),
        skillName: 'codeArtifacts',
        query: t('canvas.presetScenarios.generateLandingQuery'),
        icon: '🌐',
      },
      {
        id: 'xiaohongshu',
        title: t('canvas.presetScenarios.generateXHS'),
        description: t('canvas.presetScenarios.generateXHSDesc'),
        skillName: 'codeArtifacts',
        query: t('canvas.presetScenarios.generateXHSQuery'),
        icon: '📱',
      },
      {
        id: 'mediaContent',
        title: t('canvas.presetScenarios.generateMediaContent'),
        description: t('canvas.presetScenarios.generateMediaContentDesc'),
        skillName: 'generateDoc',
        query: t('canvas.presetScenarios.generateMediaContentQuery'),
        icon: '📝',
      },
    ],
    [t],
  );

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div className="relative h-full">
      <div className="w-full h-full overflow-y-auto">
        <TechBackground />
        <div className="relative w-full h-full p-6 max-w-4xl mx-auto z-10">
          <h3 className="text-xl font-semibold text-center text-gray-800 mt-24 mb-6 mx-2">
            {t('canvas.frontPageWelcome', { name: userProfile?.nickname || '' })}
          </h3>

          <div className="w-full bg-white/90 backdrop-blur-sm rounded-lg shadow-sm ring-1 ring-gray-200 p-4 mx-2">
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
                  <Button
                    type="text"
                    size="small"
                    onClick={() => {
                      handleSelectSkill(null);
                      setActiveScenarioId(null);
                    }}
                  >
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

          <div className="mt-6 mx-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {presetScenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className={`bg-white/90 backdrop-blur-sm rounded-md ring-1 ${
                    activeScenarioId === scenario.id ? 'ring-green-500' : 'ring-gray-200'
                  } py-2 px-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer`}
                  onClick={() =>
                    handlePresetScenario(scenario.id, scenario.skillName, scenario.query)
                  }
                >
                  <div className="flex items-center mb-1">
                    <div className="text-2xl mr-2">{scenario.icon}</div>
                    <h5 className="text-sm font-medium text-gray-800">{scenario.title}</h5>
                  </div>
                  <p className="text-xs text-gray-600">{scenario.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-[500px] overflow-hidden flex flex-col">
            <h3 className="pt-6 mx-2">{t('template.templateLibrary')}</h3>
            <div className="flex-1 overflow-y-auto">
              <TemplateList
                source="front-page"
                scrollableTargetId="front-page-scrollable-div"
                language={templateLanguage}
                categoryId={templateCategoryId}
                className="!bg-transparent !px-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

FrontPage.displayName = 'FrontPage';
