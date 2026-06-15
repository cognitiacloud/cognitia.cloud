import type { ZodType } from 'zod';
import type { RiskLevel } from '@cognitia/core';

/**
 * A typed tool. Side-effect tools (`sideEffect: true`) cannot execute directly —
 * the runtime only lets them PROPOSE actions through the ActionLedger. Read/score
 * tools may run inline.
 */
export interface ToolDefinition<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  riskLevel: RiskLevel;
  sideEffect: boolean;
}

export class DirectExecutionForbiddenError extends Error {
  constructor(toolName: string) {
    super(`tool "${toolName}" has side effects and must propose an action, not execute directly`);
    this.name = 'DirectExecutionForbiddenError';
  }
}

/** Registry of typed tools with the propose-only guarantee for side effects. */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Guard used by the runtime: throws if a side-effect tool is run directly. */
  assertDirectlyExecutable(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`unknown tool: ${name}`);
    if (tool.sideEffect) throw new DirectExecutionForbiddenError(name);
  }
}
