import { memo, useState, useEffect, useMemo } from "react";
import { Markdown } from "@refly-packages/ai-workspace-common/components/markdown";
import { Spin, Result, Button } from "antd";
import { useGetActionResult } from "@refly-packages/ai-workspace-common/queries/queries";
import { useFetchShareData } from "@refly-packages/ai-workspace-common/hooks/use-fetch-share-data";
import {
  ActionStep,
  GetActionResultResponse,
} from "@refly-packages/ai-workspace-common/requests";
import { PreviewChatInput } from "@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/preview-chat-input";
import { SimpleStepCard } from "@/pages/skill-response-share";

interface SkillResponseProps {
  node: {
    nodeData?: {
      title?: string;
      entityId?: string;
      metadata?: {
        status?: string;
        shareId?: string;
        content?: string;
      };
    };
  };
}

export const SkillResponseRenderer = memo(({ node }: SkillResponseProps) => {
  const entityId = node.nodeData?.entityId || "";
  const shareId = node.nodeData?.metadata?.shareId;
  const status = node.nodeData?.metadata?.status;

  // 使用共享数据或直接获取 Action 结果
  const { data: shareData, loading: isShareLoading } =
    useFetchShareData<GetActionResultResponse["data"]>(shareId);

  const { data: actionResultData, isLoading: isActionLoading } =
    useGetActionResult(
      {
        query: { resultId: entityId },
      },
      [entityId],
      {
        enabled: Boolean(!shareId && entityId),
      }
    );

  const isLoading = isShareLoading || isActionLoading;

  // 合并数据源
  const resultData = useMemo(
    () => shareData || actionResultData?.data || null,
    [shareData, actionResultData]
  );

  // 如果没有 entityId
  if (!resultData) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded p-3">
        <span className="text-gray-500">未选择技能响应组件</span>
      </div>
    );
  }

  const { title, steps = [], actionMeta } = resultData;

  return (
    <div className="flex h-full w-full grow relative">
      {/* Main content */}
      <div className="flex h-full w-full grow bg-white overflow-auto">
        <div className="flex flex-col space-y-4 p-4 h-full max-w-[1024px] mx-auto w-full">
          {title && (
            <PreviewChatInput
              enabled={true}
              readonly={true}
              contextItems={[]}
              query={title}
              actionMeta={actionMeta}
              setEditMode={() => {}}
            />
          )}

          <div className="flex-grow">
            {steps.map((step: ActionStep, index: number) => (
              <SimpleStepCard key={step.name} step={step} index={index + 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

SkillResponseRenderer.displayName = "SkillResponseRenderer";
