import { AlertTriangle, CheckCircle2, Clock, FileX, Timer } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import type { BillStatus } from '../api/queries';

// BE Phase 2.6 (`e7c05aa`) 5-state bill machine — visual treatment per
// state. Centralized so the TaxTrackerPage row + the BillDetailDialog
// title chip + the dashboard surfaces all read the same identity.
//
// Tone intent:
// - ACCRUING  → slate, in-progress (worker hasn't BILLED yet).
// - BILLED    → indigo, action expected (settle within grace window).
// - PAID      → emerald, terminal-happy.
// - OVERDUE   → amber, attention (past due_date but still settleable).
// - EXPIRED   → rose, terminal-bad (auto-EXPIREd by the stale worker).
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface BillStatusDescriptor {
  label: string;
  pillTone: string;
  icon: IconType;
  iconTone: string;
}

const FALLBACK: BillStatusDescriptor = {
  label: 'Unknown',
  pillTone:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  icon: Clock,
  iconTone: 'text-slate-400 dark:text-slate-500',
};

const BY_STATUS: Record<BillStatus, BillStatusDescriptor> = {
  ACCRUING: {
    label: 'Accruing',
    pillTone:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    icon: Clock,
    iconTone: 'text-slate-500 dark:text-slate-400',
  },
  BILLED: {
    label: 'Billed',
    pillTone:
      'bg-accent-100 text-accent-800 dark:bg-accent-950/40 dark:text-accent-200',
    icon: Timer,
    iconTone: 'text-accent-500 dark:text-accent-300',
  },
  PAID: {
    label: 'Paid',
    pillTone:
      'bg-success-100 text-success-700 dark:bg-success-950/50 dark:text-success-200',
    icon: CheckCircle2,
    iconTone: 'text-success-500 dark:text-success-300',
  },
  OVERDUE: {
    label: 'Overdue',
    pillTone:
      'bg-warning-100 text-warning-800 dark:bg-warning-950/40 dark:text-warning-200',
    icon: AlertTriangle,
    iconTone: 'text-warning-500 dark:text-warning-300',
  },
  EXPIRED: {
    label: 'Expired',
    pillTone:
      'bg-danger-100 text-danger-700 dark:bg-danger-950/50 dark:text-danger-200',
    icon: FileX,
    iconTone: 'text-danger-500 dark:text-danger-300',
  },
};

export function billStatusDescriptor(status: string): BillStatusDescriptor {
  return BY_STATUS[status as BillStatus] ?? FALLBACK;
}

// Compact status pill used on bill list rows + the detail title.
export function BillStatusPill({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  const d = billStatusDescriptor(status);
  return (
    <span
      data-testid={`bill-status-${status}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${d.pillTone} ${className}`}
    >
      <d.icon aria-hidden="true" className={`h-3 w-3 ${d.iconTone}`} />
      {d.label}
    </span>
  );
}

// Outstanding states accept the mark-paid action. PAID (settled) and
// EXPIRED (terminal) do not. ACCRUING bills are still being mutated
// by the worker — surfacing a Pay button against them invites a race;
// keep the action gated on the finalized states.
export function isPayable(status: string): boolean {
  return status === 'BILLED' || status === 'OVERDUE';
}

// Reverse of isPayable for the mark-unpaid affordance — only meaningful
// once the bill has been settled.
export function isUnpayable(status: string): boolean {
  return status === 'PAID';
}
