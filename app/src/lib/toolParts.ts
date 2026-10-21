import type { UIMessage } from "ai";
import type { z } from "zod";
import { ToolOutputs, type ToolName } from "@/contracts/chat";

type MessagePart = UIMessage["parts"][number];

export type ToolPartState = "running" | "done" | "error";

/** A tool part of an assistant message with its output checked against the contract (PLAN.md §5.3). */
export type ParsedToolPart = {
  [K in ToolName]: { id: string; name: K; state: ToolPartState; output: z.infer<(typeof ToolOutputs)[K]> | null };
}[ToolName];

const isToolName = (name: string): name is ToolName => Object.hasOwn(ToolOutputs, name);

// Outputs never change once available, so each one is validated only once while the answer streams.
const parsed = new Map<string, unknown>();

/** Tool part of a UI message, or null for text and unknown tools. Invalid outputs become `output: null`. */
export function parseToolPart(part: MessagePart): ParsedToolPart | null {
  if (!part.type.startsWith("tool-") || !("toolCallId" in part)) return null;
  const name = part.type.slice("tool-".length);
  if (!isToolName(name)) return null;
  const id = part.toolCallId;
  if (part.state === "output-error") return { id, name, state: "error", output: null } as ParsedToolPart;
  if (part.state !== "output-available") return { id, name, state: "running", output: null } as ParsedToolPart;

  if (!parsed.has(id)) {
    const result = ToolOutputs[name].safeParse(part.output);
    if (!result.success) console.warn(`[chat] ${name} output does not match the contract`, result.error.issues.slice(0, 3));
    parsed.set(id, result.success ? result.data : null);
  }
  const output = parsed.get(id) ?? null;
  return { id, name, state: output ? "done" : "error", output } as ParsedToolPart;
}

export function toolParts(message: UIMessage): ParsedToolPart[] {
  return message.parts.flatMap((p) => parseToolPart(p) ?? []);
}
