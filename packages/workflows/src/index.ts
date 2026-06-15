/**
 * n8n workflow contracts. n8n is the edge-automation fabric (webhooks/glue), not
 * the agent brain. Each contract describes a workflow's trigger, payload, and the
 * internal API endpoint(s) it calls, so the JSON exports under ../n8n can be
 * imported and wired without guessing the interface. No business invariants live
 * in n8n — those stay in code with tests.
 */

export type WorkflowTrigger =
  | { kind: 'webhook'; path: string }
  | { kind: 'cron'; schedule: string };

export interface WorkflowContract {
  /** Stable slug; matches the JSON file name under ../n8n. */
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  /** Internal API endpoints this workflow calls. */
  calls: string[];
  /** Shape of the inbound payload (documentation; validated in code). */
  payloadShape: Record<string, string>;
}

export const WORKFLOWS: WorkflowContract[] = [
  {
    name: 'proposal-notify',
    description: 'Notify operators in Slack when an agent_action is proposed.',
    trigger: { kind: 'webhook', path: '/n8n/proposal-notify' },
    calls: ['(slack notify)'],
    payloadShape: { event_name: 'string', tenant_id: 'uuid', agent_action_id: 'uuid' },
  },
  {
    name: 'crm-sync-schedule',
    description: 'Cron: trigger CRM sync per connected tenant.',
    trigger: { kind: 'cron', schedule: '0 * * * *' },
    calls: ['POST /jobs/crm-sync'],
    payloadShape: { tenant_id: 'uuid' },
  },
  {
    name: 'reply-ingest-route',
    description: 'Prototype: normalize an inbound email reply and forward to the API.',
    trigger: { kind: 'webhook', path: '/n8n/reply-ingest' },
    calls: ['POST /webhooks/inbound-lead'],
    payloadShape: { tenant_id: 'uuid', conversation_ref: 'string', reply_text_ref: 'string' },
  },
];
