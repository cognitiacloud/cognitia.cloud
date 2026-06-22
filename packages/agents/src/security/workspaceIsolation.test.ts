import { describe, it, expect } from 'vitest';
import {
  assertWorkspaceRef,
  assertSandboxWorkspace,
  assertSameWorkspace,
  assertWorkspaceScoped,
  WorkspaceIsolationError,
  SANDBOX_WORKSPACE_ID,
  type WorkspaceRef,
} from './workspaceIsolation.js';

const SANDBOX: WorkspaceRef = { workspaceId: SANDBOX_WORKSPACE_ID, sandbox: true };

describe('assertWorkspaceRef', () => {
  it('accepts a well-formed ref', () => {
    expect(() => assertWorkspaceRef(SANDBOX)).not.toThrow();
  });

  it('fails closed on null / non-object', () => {
    expect(() => assertWorkspaceRef(null)).toThrow(WorkspaceIsolationError);
    expect(() => assertWorkspaceRef('budget_wheels_demo')).toThrow(WorkspaceIsolationError);
  });

  it('fails closed on missing or blank id', () => {
    expect(() => assertWorkspaceRef({ workspaceId: '', sandbox: true })).toThrow(
      /missing or blank workspaceId/,
    );
    expect(() => assertWorkspaceRef({ workspaceId: '   ', sandbox: true })).toThrow(
      WorkspaceIsolationError,
    );
    expect(() => assertWorkspaceRef({ sandbox: true })).toThrow(WorkspaceIsolationError);
  });

  it('fails closed on missing sandbox flag', () => {
    expect(() => assertWorkspaceRef({ workspaceId: 'x' })).toThrow(/missing sandbox flag/);
  });
});

describe('assertSandboxWorkspace', () => {
  it('accepts the sandbox tenant', () => {
    expect(() => assertSandboxWorkspace(SANDBOX)).not.toThrow();
  });

  it('rejects a non-sandbox workspace', () => {
    expect(() => assertSandboxWorkspace({ workspaceId: 'acme_corp', sandbox: false })).toThrow(
      /refusing non-sandbox/,
    );
  });

  it('rejects a spoofed sandbox flag over a real id', () => {
    // sandbox:true but a non-sandbox id must still be denied.
    expect(() => assertSandboxWorkspace({ workspaceId: 'acme_corp', sandbox: true })).toThrow(
      /not the sandbox tenant/,
    );
  });
});

describe('assertSameWorkspace', () => {
  it('accepts identical workspace ids', () => {
    expect(() => assertSameWorkspace(SANDBOX, { ...SANDBOX })).not.toThrow();
  });

  it('denies cross-tenant access (fail closed)', () => {
    const other: WorkspaceRef = { workspaceId: 'acme_corp', sandbox: false };
    expect(() => assertSameWorkspace(SANDBOX, other)).toThrow(/cross-tenant access denied/);
  });

  it('fails closed when either side is malformed', () => {
    expect(() => assertSameWorkspace(SANDBOX, { sandbox: true })).toThrow(WorkspaceIsolationError);
    expect(() => assertSameWorkspace({}, SANDBOX)).toThrow(WorkspaceIsolationError);
  });
});

describe('assertWorkspaceScoped', () => {
  it('returns the collection unchanged when all items belong to the workspace', () => {
    const rows = [
      { workspaceId: SANDBOX_WORKSPACE_ID, id: 'a' },
      { workspaceId: SANDBOX_WORKSPACE_ID, id: 'b' },
    ];
    expect(assertWorkspaceScoped(SANDBOX, rows)).toBe(rows);
  });

  it('accepts an empty collection', () => {
    expect(assertWorkspaceScoped(SANDBOX, [])).toEqual([]);
  });

  it('denies a leaked row from another tenant', () => {
    const rows = [
      { workspaceId: SANDBOX_WORKSPACE_ID, id: 'a' },
      { workspaceId: 'acme_corp', id: 'leaked' },
    ];
    expect(() => assertWorkspaceScoped(SANDBOX, rows)).toThrow(/not scoped workspace/);
  });

  it('denies a row missing its workspace id', () => {
    const rows = [{ workspaceId: '', id: 'a' }];
    expect(() => assertWorkspaceScoped(SANDBOX, rows)).toThrow(/missing workspaceId/);
  });
});
