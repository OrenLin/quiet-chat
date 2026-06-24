// DeepSeek 云端 Provider：流式调用 chat/completions，支持中止与 Token 计量

import type { ChatMessage, TokenUsage } from "../types";
import { estimateTokens } from "../crypto";
import {
  type ChatParams,
  type ChatProvider,
  type ChatResult,
  AbortError,
} from "./types";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

export class DeepSeekProvider implements ChatProvider {
  id = "deepseek" as const;
  private apiKey: string;
  private model: string;
  private controller: AbortController | null = null;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  setModel(model: string) {
    this.model = model;
  }

  async isReady(): Promise<boolean> {
    return !!this.apiKey;
  }

  abort(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    if (!this.apiKey) throw new Error("未设置 DeepSeek API Key");

    this.controller = new AbortController();
    const onAbort = () => this.controller?.abort();
    params.signal?.addEventListener("abort", onAbort);

    let messages: ChatMessage[] = params.messages;
    // 在线搜索：注入提示（MVP 阶段，允许模型引用联网知识）
    // 真实联网检索可在后续接入搜索 API 后拼接结果上下文。

    let content = "";
    let usage: TokenUsage | undefined;

    try {
      const resp = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: this.controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          top_p: params.topP,
          stream_options: { include_usage: true },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        let msg = `DeepSeek 请求失败 (${resp.status})`;
        try {
          const j = JSON.parse(errText);
          if (j.error?.message) msg = j.error.message;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      if (!resp.body) throw new Error("响应无数据流");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              content += delta;
              params.onToken?.(delta);
            }
            if (json.usage) {
              usage = {
                prompt: json.usage.prompt_tokens ?? 0,
                completion: json.usage.completion_tokens ?? 0,
                total: json.usage.total_tokens ?? 0,
              };
              params.onUsage?.(usage);
            }
          } catch {
            /* 跳过无法解析的行 */
          }
        }
      }

      if (!usage) {
        usage = {
          prompt: estimateTokens(messages.map((m) => m.content).join("")),
          completion: estimateTokens(content),
          total: 0,
        };
        usage.total = usage.prompt + usage.completion;
        params.onUsage?.(usage);
      }

      return { content, usage };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new AbortError();
      }
      if ((e as Error)?.name === "AbortError") throw new AbortError();
      throw e;
    } finally {
      params.signal?.removeEventListener("abort", onAbort);
      this.controller = null;
    }
  }
}
