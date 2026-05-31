// BE Phase 2.4 (`77cffb3`) — Activity feed DTOs.
//
// The feed carries backend / worker-originated events (a bill went
// overdue, a budget breached) — never the ACK of an action the user
// already saw a 2xx for. `event_id` is stable
// (`{kind}:{subject_type}:{subject_id}`) so the FE keys list items
// + dedupes across polls. Ordering is by `value` (a server-owned
// decay/escalation score) — clients should preserve server order.
//
// Live event kinds at land: `bill_generated`, `bill_paid`. Registered
// (arrive as their tasks wire them): `bill_overdue`, `budget_breached`,
// `tax_mode_auto_disabled`, `statement_import_completed`,
// `statement_import_failed`, `recurring_*`,
// `account_deletion_grace_reminder`. The widget tolerates any subset.
export type ActivityPriority = 1 | 2 | 3;

export interface ActivityEvent {
  event_id: string;
  kind: string;
  priority: ActivityPriority;
  value: number;
  at: string;
  summary: string;
  subject_type: string;
  subject_id: string;
  state: string;
  source: string;
  meta: Record<string, unknown>;
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
  returned_count: number;
  has_more: boolean;
}

// `signal=soft` = render-time exposure (fires on the first render of
// each event in a session; safe to fire on every poll — BE dedupes).
// `signal=hard` = the user clicked the event (persists until source
// resolves; exits auto-mute).
export type SeenSignal = 'soft' | 'hard';

export interface SeenRequestPayload {
  events: string[];
  signal: SeenSignal;
}

export interface SeenResponse {
  updated: number;
}

// BE Phase 1.7 (`3252ca4`) — Expense trend rows. Per-(tag, bucket)
// stats over the last `n` buckets of the requested `period_type`.
// Stored grains (weekly / monthly) carry per-bucket anomaly stats;
// derived grains (quarterly / annual) leave them null.
export type TrendPeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface ExpenseTrendRow {
  tag_id: number;
  tag_name: string | null;
  period_type: TrendPeriod;
  period_start: string;
  period_end: string;
  total_count: number;
  total_debit: number;
  total_credit: number;
  net_expense: number;
  avg_net_expense: number | null;
  min_net_expense: number | null;
  max_net_expense: number | null;
}

export interface ExpenseTrendResponse {
  period_type: TrendPeriod;
  returned_count: number;
  rows: ExpenseTrendRow[];
}
