import { z } from "zod";
import { getAnthropicClient, getAnthropicModel } from "@/lib/ai/anthropic-client";
import {
  buildChatSearchUserContext,
  CHAT_SEARCH_SYSTEM_PROMPT,
  toAnthropicMessages,
} from "@/lib/ai/prompts/chat-search";
import { filterProperties } from "@/lib/filter-properties";
import { MOCK_PROPERTIES } from "@/lib/sanity/mock-properties";
import { EMPTY_CRITERIA, type SearchCriteria } from "@/lib/search-criteria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const RequestSchema = z.object({
  sessionId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      "sessionId は UUID v4 形式",
    ),
  messages: z.array(ChatMessageSchema).min(1).max(50),
  currentCriteria: z
    .object({
      prefecture: z.string().optional(),
      city: z.string().optional(),
      minRent: z.number().optional(),
      maxRent: z.number().optional(),
      minArea: z.number().optional(),
      maxArea: z.number().optional(),
      buildingTypes: z.array(z.string()).default([]),
      conditions: z.array(z.string()).default([]),
      businessCategoryRefs: z.array(z.string()).default([]),
      q: z.string().optional(),
    })
    .optional(),
});

type SseEvent =
  | { type: "criteria"; criteria: SearchCriteria }
  | { type: "message"; content: string }
  | { type: "results"; properties: ReturnType<typeof filterProperties> }
  | { type: "done" }
  | { type: "error"; error: string };

const encoder = new TextEncoder();

const writeEvent = (event: SseEvent): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

const parseClaudeCriteriaResponse = (
  text: string,
  fallback: SearchCriteria,
): { message: string; criteria: SearchCriteria } => {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\n([\s\S]*?)\n```/);
  try {
    const parsed = JSON.parse(fence?.[1] ?? trimmed) as {
      message?: string;
      extractedCriteria?: Partial<SearchCriteria>;
    };
    return {
      message: parsed.message ?? "条件を更新しました。",
      criteria: {
        ...fallback,
        ...(parsed.extractedCriteria ?? {}),
        buildingTypes: parsed.extractedCriteria?.buildingTypes ?? fallback.buildingTypes,
        conditions: parsed.extractedCriteria?.conditions ?? fallback.conditions,
        businessCategoryRefs:
          parsed.extractedCriteria?.businessCategoryRefs ?? fallback.businessCategoryRefs,
      },
    };
  } catch {
    return {
      message: trimmed.slice(0, 400) || "応答を解析できませんでした。",
      criteria: fallback,
    };
  }
};

export const POST = async (request: Request): Promise<Response> => {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = (await request.json()) as unknown;
    parsed = RequestSchema.parse(body);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "リクエスト形式が不正です",
        details: error instanceof Error ? error.message : error,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const currentCriteria: SearchCriteria = parsed.currentCriteria
    ? ({
        ...EMPTY_CRITERIA,
        ...parsed.currentCriteria,
        buildingTypes: parsed.currentCriteria.buildingTypes ?? EMPTY_CRITERIA.buildingTypes,
        conditions: parsed.currentCriteria.conditions ?? EMPTY_CRITERIA.conditions,
        businessCategoryRefs:
          parsed.currentCriteria.businessCategoryRefs ?? EMPTY_CRITERIA.businessCategoryRefs,
      } as unknown as SearchCriteria)
    : EMPTY_CRITERIA;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const client = getAnthropicClient();
        const completion = await client.messages.create({
          model: getAnthropicModel(),
          max_tokens: 1024,
          system: CHAT_SEARCH_SYSTEM_PROMPT,
          messages: [
            ...toAnthropicMessages(parsed.messages),
            {
              role: "user",
              content: buildChatSearchUserContext({ currentCriteria }),
            },
          ],
        });

        const textBlock = completion.content.find((block) => block.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          controller.enqueue(writeEvent({ type: "error", error: "応答にテキストがありません" }));
          controller.close();
          return;
        }

        const { message, criteria } = parseClaudeCriteriaResponse(textBlock.text, currentCriteria);

        controller.enqueue(writeEvent({ type: "criteria", criteria }));
        controller.enqueue(writeEvent({ type: "message", content: message }));

        const results = filterProperties(MOCK_PROPERTIES, criteria);
        controller.enqueue(writeEvent({ type: "results", properties: results }));
        controller.enqueue(writeEvent({ type: "done" }));
        controller.close();
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        controller.enqueue(writeEvent({ type: "error", error: errMessage }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
