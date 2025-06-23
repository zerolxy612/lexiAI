# 解决RAG流式响应末尾出现多余元数据（JSON）的问题

## 1. 问题描述

在使用RAG（检索增强生成）等具备流式响应能力的模型时，前端界面在接收完模型生成的主要内容后，会额外显示一段不应出现的JSON字符串。

**具体表现：**
在问答内容的末尾，出现类似如下的字符串：
```json
{"id": null, "spentMillis": null, "search": {"results": "[]"}}, "chatPreGenerationResponse": null}
```
这部分内容是模型的元数据或调试信息，不应作为最终结果展示给用户。

## 2. 问题根源

该问题的核心原因是，部分大语言模型（LLM）服务提供商在实现其流式API时，会将最后一条包含**元数据（metadata）** 的信息，作为普通的内容块（content chunk）混入流式响应中。

在本次案例中，RAG模型的流式API在所有文本内容块发送完毕后，将一个包含`chatPreGenerationResponse`等字段的JSON对象，伪装成一个普通的文本块发送了过来。

后端的 `skill.service.ts` 在处理流式事件时，已经有逻辑可以过滤掉标准的 `on_llm_end` 事件（该事件通常携带元数据），但未能预料到RAG模型会通过 `on_chat_model_stream` 事件来发送元数据，从而导致这个JSON对象被当作正常内容传递给了前端。

## 3. 定位与解决方案

### 定位过程
1.  **关键字搜索失败**：最初尝试在整个项目中搜索`chatPreGenerationResponse`等关键字，但没有找到任何结果。这表明该字符串并非硬编码，而是动态生成的。
2.  **锁定核心服务**：将调查重点放在API模块负责处理技能调用和流式响应的 `apps/api/src/modules/skill/skill.service.ts` 文件。
3.  **发现关键线索**：在 `_invokeSkill` 方法的事件处理循环中，发现了一段已有代码，它会显式忽略 `on_llm_end` 事件，注释表明此举正是为了防止其携带的元数据被发送到客户端。这证明了"在流末尾过滤元数据"是一个已知的设计模式。
4.  **形成假设**：推断RAG模型也存在同样的行为，只是它发送元数据所用的事件类型不是 `on_llm_end`，导致其绕过了现有的过滤逻辑。
5.  **确认方案**：既然无法在事件层面简单过滤，最佳解决方案是在内容处理层面增加一个"防御性"的检查。

### 解决方案

我们在 `apps/api/src/modules/skill/skill.service.ts` 文件中，对 `on_chat_model_stream` 事件的处理逻辑增加了精准的拦截代码。

```typescript
// 文件路径: apps/api/src/modules/skill/skill.service.ts

// ... in _invokeSkill method ...
      for await (const event of skill.streamEvents(input, { ...config, version: 'v2' })) {
        // ...
        switch (event.event) {
          // ...
          case 'on_chat_model_stream': {
            const content = chunk.content.toString();

            // Critical Check: 拦截并丢弃RAG流中的最终元数据对象
            // RAG API会错误地将其最终的元数据作为内容块发送
            // 我们通过尝试将其解析为JSON并检查一个已知键来识别它
            try {
              const parsedContent = JSON.parse(content);
              if (parsedContent && typeof parsedContent === 'object' && 'chatPreGenerationResponse' in parsedContent) {
                this.logger.log('Intercepted and discarded final RAG metadata payload.');
                continue; // 跳过处理这个数据块
              }
            } catch (e) {
              // 对于正常的文本块，这里会抛出异常，是预期行为，我们什么都不做
            }

            const reasoningContent = chunk?.additional_kwargs?.reasoning_content?.toString() || '';
            // ... 后续正常处理逻辑 ...
          }
          // ...
        }
      }
// ...
```

这段代码的逻辑是：
- 在处理每一个收到的内容块（`content`）时，先尝试将其作为JSON解析。
- 如果解析成功，并且解析出的对象包含 `chatPreGenerationResponse` 这个特征键，就认定它是我们不想要的元数据。此时，使用 `continue` 关键字直接跳过该数据块，不进行后续处理。
- 如果JSON解析失败（这对于正常的文本内容是预期行为），程序会捕获异常并安全地继续执行后续的逻辑，将文本内容发送给前端。

## 4. 总结与建议

- **核心思想**：在处理第三方流式API时，要对接收到的数据块保持警惕，它们可能并非总是纯净的文本内容。
- **防御性编程**：在消费流式数据的入口处，增加对数据格式和内容的校验，是保证系统稳定性的有效手段。
- **举一反三**：未来如果遇到其他模型或API在流末尾输出多余信息的问题，可以复用本方案的思路：**"识别特征，精准过滤"**。首先分析多余信息的特征（例如，可被解析为JSON、包含特定字段等），然后在数据处理的关键路径上增加相应的判断和过滤逻辑。 