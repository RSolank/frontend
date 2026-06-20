import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileWarning,
  Receipt,
  RefreshCw,
  UserX,
  type LucideIcon,
} from 'lucide-react';

// Single source of truth for activity kind → icon. Extracted from the
// bell modal (`ActivityFeedModal`) so every activity surface — the
// bell, the dashboard `ActivityCallout`s — imports the same mapping
// rather than forking it (a locked invariant of the activity feed:
// "import, don't fork"). The default `Bell` fallback means a new BE
// kind never breaks a consumer; it just renders the generic glyph.
export function iconForKind(kind: string): LucideIcon {
  if (kind === 'bill_generated') return Receipt;
  if (kind === 'bill_paid') return CheckCircle2;
  if (kind === 'bill_overdue') return Clock;
  if (kind === 'budget_breached') return AlertTriangle;
  if (kind === 'tax_mode_auto_disabled') return AlertCircle;
  if (kind === 'statement_import_completed') return CheckCircle2;
  if (kind === 'statement_import_failed') return FileWarning;
  if (kind.startsWith('recurring_')) return RefreshCw;
  if (kind === 'account_deletion_grace_reminder') return UserX;
  return Bell;
}
