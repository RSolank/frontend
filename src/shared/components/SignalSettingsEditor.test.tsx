import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CatalogResponse } from '../api/activityCatalog';

import { SignalSettingsEditor } from './SignalSettingsEditor';

const sampleCatalog: CatalogResponse = {
  entries: [
    {
      kind: 'bill_generated',
      event_class: 'notification',
      domain: 'tax',
      subject_type: 'bill',
      priority: 3,
      rank_order: 100,
      system_enabled: true,
      collapse_threshold: null,
      collapse_label: null,
    },
    {
      kind: 'budget_breached',
      event_class: 'alert',
      domain: 'budget',
      subject_type: 'budget',
      priority: 1,
      rank_order: 10,
      system_enabled: true,
      collapse_threshold: null,
      collapse_label: null,
    },
    {
      kind: 'deprecated_kind',
      event_class: 'notification',
      domain: 'auth',
      subject_type: 'session',
      priority: 3,
      rank_order: 500,
      system_enabled: false,
      collapse_threshold: null,
      collapse_label: null,
    },
  ],
};

describe('SignalSettingsEditor', () => {
  it('renders kinds grouped by domain with user-friendly labels', () => {
    const onToggle = vi.fn();
    render(
      <SignalSettingsEditor
        catalog={sampleCatalog}
        disabled={[]}
        viewerRole="user"
        onToggle={onToggle}
      />
    );

    expect(screen.getByText('Bill Generated')).toBeInTheDocument();
    expect(screen.getByText('Budget Breached')).toBeInTheDocument();
    expect(screen.getByText('Deprecated Kind')).toBeInTheDocument();
    // Domain headers rendered.
    expect(screen.getByText('Tax & bills')).toBeInTheDocument();
    expect(screen.getByText('Budgets')).toBeInTheDocument();
  });

  it('checkbox state matches the disabled list (enabled = NOT in disabled)', () => {
    const onToggle = vi.fn();
    render(
      <SignalSettingsEditor
        catalog={sampleCatalog}
        disabled={['budget_breached']}
        viewerRole="user"
        onToggle={onToggle}
      />
    );

    const billChk = screen.getByLabelText(/Enable Bill Generated/);
    const breachChk = screen.getByLabelText(/Enable Budget Breached/);
    expect(billChk).toBeChecked();
    expect(breachChk).not.toBeChecked();
  });

  it('clicking a toggle fires onToggle with (kind, next-enabled)', async () => {
    const onToggle = vi.fn();
    render(
      <SignalSettingsEditor
        catalog={sampleCatalog}
        disabled={[]}
        viewerRole="user"
        onToggle={onToggle}
      />
    );

    await userEvent.click(screen.getByLabelText(/Enable Bill Generated/));
    expect(onToggle).toHaveBeenCalledWith('bill_generated', false);
  });

  it('user-side cannot toggle a system-disabled kind (System off badge + disabled)', () => {
    const onToggle = vi.fn();
    render(
      <SignalSettingsEditor
        catalog={sampleCatalog}
        disabled={[]}
        viewerRole="user"
        onToggle={onToggle}
      />
    );

    expect(screen.getByText('System off')).toBeInTheDocument();
    const deprecatedChk = screen.getByLabelText(/Enable Deprecated Kind/);
    expect(deprecatedChk).toBeDisabled();
  });

  it('admin-side keeps the toggle interactive even on system-disabled kinds', () => {
    const onToggle = vi.fn();
    render(
      <SignalSettingsEditor
        catalog={sampleCatalog}
        disabled={[]}
        viewerRole="admin"
        onToggle={onToggle}
      />
    );

    const deprecatedChk = screen.getByLabelText(/Enable Deprecated Kind/);
    expect(deprecatedChk).not.toBeDisabled();
  });

  it('admin tune disclosure exposes priority + rank + system-enabled', async () => {
    const onToggle = vi.fn();
    const onTune = vi.fn();
    render(
      <SignalSettingsEditor
        catalog={sampleCatalog}
        disabled={[]}
        viewerRole="admin"
        onToggle={onToggle}
        onTune={onTune}
      />
    );

    // Each row has an "Advanced tuning" summary.
    const summaries = screen.getAllByText(/Advanced tuning/);
    expect(summaries.length).toBe(3);
  });

  it('renders an empty-state when catalog is empty', () => {
    const onToggle = vi.fn();
    render(
      <SignalSettingsEditor
        catalog={{ entries: [] }}
        disabled={[]}
        viewerRole="user"
        onToggle={onToggle}
      />
    );
    expect(
      screen.getByText('No signal kinds registered yet.')
    ).toBeInTheDocument();
  });
});
