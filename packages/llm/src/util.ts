/** Clamp a number into the 0–100 score range. */
export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/** Extract the first JSON object from an LLM text response. */
export function parseJsonResponse<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON object in LLM response: ${text.slice(0, 120)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}
