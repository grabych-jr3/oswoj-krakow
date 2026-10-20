/**
 * An expected failure the model should read and recover from (unknown symbol, address not found).
 * The AI SDK turns a thrown error into a tool-error part, so the model sees the message instead of inventing a result.
 */
export class ToolError extends Error {
  override name = "ToolError";
}
