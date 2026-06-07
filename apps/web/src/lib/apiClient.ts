/**
 * Typed client for the approval-queue API. Framework-agnostic and dependency-free
 * so it compiles/tests under the base toolchain and can be imported by Next.js
 * server components or route handlers once the UI is scaffolded.
 *
 * A `fetch`-compatible function is injected (no reliance on a DOM lib), so the
 * same client works in the browser, in Next.js server code, and in tests.
 */

export interface FetchLike {
  (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<{
    status: number;
    json(): Promise<unknown>;
  }>;
}

export interface AgentActionView {
  id: string;
  action_type: string;
  risk_level: string;
  approval_status: string;
  execution_status: string;
  target_ref: string;
  evidence_refs: string[];
  draft: { subject_line: string; body: string; evidence_refs: string[] } | null;
}

export interface ApiClientOptions {
  baseUrl: string;
  tenantId: string;
  fetch: FetchLike;
}

export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  private headers(): Record<string, string> {
    return { 'content-type': 'application/json', 'x-tenant-id': this.opts.tenantId };
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.opts.fetch(`${this.opts.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json()) as T;
    if (res.status >= 400) {
      throw new ApiError(res.status, json);
    }
    return json;
  }

  listProposed(): Promise<{ actions: AgentActionView[] }> {
    return this.req('GET', '/agent-actions?status=proposed');
  }
  approve(id: string): Promise<AgentActionView> {
    return this.req('POST', `/agent-actions/${id}/approve`);
  }
  reject(id: string, reason?: string): Promise<AgentActionView> {
    return this.req('POST', `/agent-actions/${id}/reject`, { reason });
  }
  execute(id: string): Promise<AgentActionView> {
    return this.req('POST', `/agent-actions/${id}/execute`);
  }
  runMira(
    body: { objective?: string } = {},
  ): Promise<{ runId: string; proposedActionIds: string[] }> {
    return this.req('POST', '/agent-runs/mira', body);
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(`api error ${status}`);
    this.name = 'ApiError';
  }
}
