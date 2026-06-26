import type { RecurringTemplateFormInput } from '../api/schemas';

interface Props {
  form: RecurringTemplateFormInput;
  onChange: (next: RecurringTemplateFormInput) => void;
}

const DAY_OF_WEEK_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// Renders the calendar-anchor input that matches the current cadence —
// day-of-week for WEEKLY, day-of-month for MONTHLY/YEARLY. WEEKLY's
// day codes follow ISO 8601 (0=Mon … 6=Sun) so the labels read in
// reading order. The schema's `formToCreatePayload` drops the
// not-applicable anchor before sending the wire body.
export function CadenceAnchorField({ form, onChange }: Props) {
  if (form.cadence === 'WEEKLY') {
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span className="form-label">Day of week</span>
        <select
          value={form.day_of_week}
          onChange={(e) => onChange({ ...form, day_of_week: e.target.value })}
          className="form-input"
        >
          <option value="">No anchor</option>
          {DAY_OF_WEEK_LABELS.map((label, idx) => (
            <option key={label} value={String(idx)}>
              {label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  // MONTHLY + YEARLY both anchor on day-of-month. YEARLY pulls the
  // month from next_due_date / anchor_date on the BE side.
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="form-label">Day of month</span>
      <input
        type="number"
        min="1"
        max="31"
        value={form.day_of_month}
        onChange={(e) => onChange({ ...form, day_of_month: e.target.value })}
        placeholder="1-31 (optional)"
        className="form-input"
      />
    </label>
  );
}
