import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { SystemChip } from '../../../shared/components/SystemChip';
import { highlightClass } from '../../../shared/utils/highlight';
import { formatAliasesDisplay } from '../../beneficiaries/api/aliases';
import { groupRules, type RuleGroup } from '../api/grouping';
import type { CategorizationRule } from '../api/queries';
import { formatTagAssignment, type FlatTag } from '../api/ruleUtils';

// Visible-row caps for each band before the "Show N more" disclosure
// appears. Singletons are TIGHTER than groups because each singleton
// card costs ~140px to render a single rule, while a collapsed group
// card costs ~80px to represent N rules — so pixels-per-rule for
// groups is ~4-7× lower. 5 + 6 keeps the page's first paint to ~1.5
// viewports on a typical laptop. Bump in place if usage shows the
// defaults too tight; the test suite asserts the math.
const SINGLETON_VISIBLE_CAP = 5;
const GROUP_VISIBLE_CAP = 6;

interface GroupedRulesListProps {
  rules: CategorizationRule[];
  flatTags: FlatTag[];
  isUserRule: (rule: CategorizationRule) => boolean;
  onEdit: (rule: CategorizationRule) => void;
  // Group key to force-open + highlight after a save (auto-expand
  // destination + brief ring). Pass `null` to clear.
  highlightedGroupKey: string | null;
  highlightedRuleUid: number | null;
}

interface ChipProps {
  label: string;
  primary?: boolean;
  small?: boolean;
}

function Chip({ label, primary = false, small = false }: ChipProps) {
  const pad = small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  const color = primary
    ? 'bg-success-50 text-success-700 border-success-200 dark:bg-success-950/40 dark:text-success-300 dark:border-success-900/50'
    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${pad} font-semibold ${color}`}
    >
      {label}
      {primary && (
        <span className="bg-success-700 rounded-sm px-1 py-px text-[10px] font-bold tracking-wide text-white uppercase">
          Primary
        </span>
      )}
    </span>
  );
}

// One rule rendered inside an expanded multi-rule group. Compact:
// beneficiary + aliases on one line, ⋯ on the right that opens the
// rule's view/edit modal (delete lives in the modal header per the
// DetailModal convention). Each rule's *own* primary chip is shown so
// the user can tell rules apart when the group representative was
// tie-broken to a parent.
function GroupedRuleRow({
  rule,
  flatTags,
  onEdit,
  isHighlighted,
}: {
  rule: CategorizationRule;
  flatTags: FlatTag[];
  onEdit: (rule: CategorizationRule) => void;
  isHighlighted: boolean;
}) {
  const aliasText = formatAliasesDisplay(rule.beneficiary_aliases);
  const primaryId = rule.tag_ids?.[0];
  return (
    <li
      id={`rule-row-${rule.uid}`}
      className={`rounded-md border border-slate-100 bg-white px-3 py-2 transition-shadow dark:border-slate-800 dark:bg-slate-900 ${highlightClass(isHighlighted)}`}
    >
      {/* Top row: beneficiary name + ⋯ trigger on the same line at
          every viewport. min-w-0 on the name lets it wrap inside its
          allotted width instead of pushing the button to a new line.
          shrink-0 on the trigger pins it right. */}
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium break-words text-slate-800 dark:text-slate-100">
            {rule.beneficiary_name}
          </span>
          {rule.is_system && <SystemChip />}
        </span>
        <button
          type="button"
          onClick={() => onEdit(rule)}
          aria-label={`View / edit rule for ${rule.beneficiary_name}`}
          title="View / edit"
          className="focus-visible:ring-accent-500 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <MoreHorizontal aria-hidden size={16} />
        </button>
      </div>
      {/* Second row: metadata (aliases + primary chip + notes). Hidden
          when there's nothing to show so the row stays compact. */}
      {(aliasText || primaryId != null || rule.notes) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {aliasText && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {aliasText}
            </span>
          )}
          {primaryId != null && (
            <Chip
              label={formatTagAssignment(primaryId, flatTags)}
              primary
              small
            />
          )}
          {rule.notes && (
            <span
              className="text-xs text-slate-500 italic dark:text-slate-400"
              title={rule.notes}
            >
              “{rule.notes}”
            </span>
          )}
        </div>
      )}
    </li>
  );
}

// Standalone-card render for a single-rule group (matches the
// pre-grouping card from Batch 6 so the no-grouping case looks
// identical).
function SingleRuleCard({
  rule,
  flatTags,
  isUserRule,
  onEdit,
  isHighlighted,
}: {
  rule: CategorizationRule;
  flatTags: FlatTag[];
  isUserRule: (rule: CategorizationRule) => boolean;
  onEdit: (rule: CategorizationRule) => void;
  isHighlighted: boolean;
}) {
  const aliasText = formatAliasesDisplay(rule.beneficiary_aliases);
  const userRule = isUserRule(rule);
  return (
    <li
      id={`rule-row-${rule.uid}`}
      className={`rounded-lg border border-slate-200 p-4 transition-shadow dark:border-slate-800 ${highlightClass(isHighlighted)}`}
    >
      {/* `flex` (not flex-wrap) + `min-w-0` on the name + `shrink-0`
          on the trigger pins ⋯ to the top line at every viewport. The
          rule_name wraps inside its allotted width rather than pushing
          the trigger to a new line. Delete lives in the modal header
          per the DetailModal convention. */}
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-base font-semibold break-words text-slate-900 dark:text-slate-100">
            {rule.rule_name}
          </span>
          {rule.is_system && <SystemChip />}
        </span>
        <button
          type="button"
          onClick={() => onEdit(rule)}
          aria-label={`View / edit rule ${rule.rule_name}`}
          title="View / edit"
          className="focus-visible:ring-accent-500 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <MoreHorizontal aria-hidden size={16} />
        </button>
      </div>
      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Beneficiary:
        </span>{' '}
        {rule.beneficiary_name}
        {aliasText && (
          <>
            <br />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Aliases:
            </span>{' '}
            <span className="text-slate-400 dark:text-slate-500">
              {aliasText}
            </span>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Tags:
        </span>
        {(rule.tag_ids || []).map((tid, idx) => (
          <Chip
            key={tid}
            label={formatTagAssignment(tid, flatTags)}
            primary={idx === 0}
            small
          />
        ))}
      </div>
      {rule.notes && (
        <p className="mt-2 text-sm text-slate-500 italic dark:text-slate-400">
          &ldquo;{rule.notes}&rdquo;
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        Created by: {userRule ? `User ${rule.created_by}` : 'System'}
      </p>
    </li>
  );
}

function MultiRuleGroupCard({
  group,
  flatTags,
  onEdit,
  highlightedRuleUid,
  forceOpen,
}: {
  group: RuleGroup;
  flatTags: FlatTag[];
  onEdit: (rule: CategorizationRule) => void;
  highlightedRuleUid: number | null;
  forceOpen: boolean;
}) {
  const [userOpen, setUserOpen] = useState(false);
  const open = forceOpen || userOpen;

  const headerChips = [
    { id: group.representativePrimary, primary: true },
    ...group.otherTagIds.map((id) => ({ id, primary: false })),
  ];

  return (
    <li className="rounded-lg border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setUserOpen((v) => !v)}
        aria-expanded={open}
        className="focus-visible:ring-accent-500 flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:outline-none dark:hover:bg-slate-800/40"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {headerChips.map(({ id, primary }) => (
            <Chip
              key={id}
              label={formatTagAssignment(id, flatTags)}
              primary={primary}
              small
            />
          ))}
          <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
            Applied to {group.rules.length} beneficiaries
          </span>
        </div>
        <ChevronRight
          aria-hidden="true"
          size={18}
          className={`shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      {open && (
        <ul className="grid list-none gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
          {group.rules.map((r) => (
            <GroupedRuleRow
              key={r.uid}
              rule={r}
              flatTags={flatTags}
              onEdit={onEdit}
              isHighlighted={highlightedRuleUid === r.uid}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <li className="-mb-1 list-none pt-1">
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {label}{' '}
        <span className="font-medium text-slate-400 dark:text-slate-500">
          ({count})
        </span>
      </h3>
    </li>
  );
}

function ShowMoreToggle({
  hiddenCount,
  expanded,
  onToggle,
}: {
  hiddenCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onToggle}
        className="text-accent-700 hover:bg-accent-50 focus-visible:ring-accent-500 dark:text-accent-300 dark:hover:bg-accent-950/40 w-full rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        {expanded ? 'Show fewer' : `Show ${hiddenCount} more`}
      </button>
    </li>
  );
}

export function GroupedRulesList({
  rules,
  flatTags,
  isUserRule,
  onEdit,
  highlightedGroupKey,
  highlightedRuleUid,
}: GroupedRulesListProps) {
  const groups = groupRules(rules, flatTags);
  const singletons = groups.filter((g) => g.rules.length === 1);
  const multis = groups.filter((g) => g.rules.length > 1);

  const [singletonsExpanded, setSingletonsExpanded] = useState(false);
  const [groupsExpanded, setGroupsExpanded] = useState(false);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">
        No rules found.
      </p>
    );
  }

  // Sub-headings always render for any band that has entries — even
  // when the page holds only singletons or only groups. Rationale:
  // the seed data alone produces a mixed list, and the anchor reads
  // as cleaner information architecture than a flat unlabeled stack.
  // Pattern stays consistent regardless of data shape.

  const visibleSingletons = singletonsExpanded
    ? singletons
    : singletons.slice(0, SINGLETON_VISIBLE_CAP);
  const visibleMultis = groupsExpanded
    ? multis
    : multis.slice(0, GROUP_VISIBLE_CAP);

  return (
    <ul className="grid list-none gap-3 p-0">
      {singletons.length > 0 && (
        <>
          <SectionHeading label="Standalone rules" count={singletons.length} />

          {visibleSingletons.map((g) => (
            <SingleRuleCard
              key={g.key}
              // `singletons` is filtered for length === 1, so
              // g.rules[0] is always defined; non-null assertion
              // keeps TS strict-mode happy without the runtime
              // check.
              rule={g.rules[0]!}
              flatTags={flatTags}
              isUserRule={isUserRule}
              onEdit={onEdit}
              isHighlighted={highlightedRuleUid === g.rules[0]!.uid}
            />
          ))}
          {singletons.length > SINGLETON_VISIBLE_CAP && (
            <ShowMoreToggle
              hiddenCount={singletons.length - SINGLETON_VISIBLE_CAP}
              expanded={singletonsExpanded}
              onToggle={() => setSingletonsExpanded((v) => !v)}
            />
          )}
        </>
      )}
      {multis.length > 0 && (
        <>
          <SectionHeading label="Grouped rules" count={multis.length} />

          {visibleMultis.map((g) => (
            <MultiRuleGroupCard
              key={g.key}
              group={g}
              flatTags={flatTags}
              onEdit={onEdit}
              highlightedRuleUid={highlightedRuleUid}
              forceOpen={highlightedGroupKey === g.key}
            />
          ))}
          {multis.length > GROUP_VISIBLE_CAP && (
            <ShowMoreToggle
              hiddenCount={multis.length - GROUP_VISIBLE_CAP}
              expanded={groupsExpanded}
              onToggle={() => setGroupsExpanded((v) => !v)}
            />
          )}
        </>
      )}
    </ul>
  );
}
