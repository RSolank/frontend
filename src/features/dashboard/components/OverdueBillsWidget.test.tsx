import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useDomainActivityQuery,
  type ActivityFeedItem,
} from '../../../shared/api/activityFeed';
import { renderWithProviders } from '../../../test/renderWithProviders';

import { OverdueBillsWidget } from './OverdueBillsWidget';

vi.mock('../../../shared/api/activityFeed', async (orig) => {
  const actual = await orig<typeof import('../../../shared/api/activityFeed')>();
  return { ...actual, useDomainActivityQuery: vi.fn() };
});

const mockDomain = vi.mocked(useDomainActivityQuery);
type DomainResult = ReturnType<typeof useDomainActivityQuery>;

function item(over: Partial<ActivityFeedItem>): ActivityFeedItem {
  return {
    uid: 1,
    kind: 'bill_overdue',
    event_class: 'alert',
    domain: 'taxation',
    subject_type: 'bill',
    subject_id: '9',
    priority: 1,
    state: 'active',
    summary: 'Bill #9 is overdue',
    created_at: '2026-06-20T00:00:00Z',
    refreshed_at: '2026-06-20T00:00:00Z',
    aggregate_count: 1,
    ...over,
  };
}

function withItems(items: ActivityFeedItem[]) {
  mockDomain.mockReturnValue({
    data: { items, has_more: false },
  } as unknown as DomainResult);
}

describe('OverdueBillsWidget', () => {
  beforeEach(() => mockDomain.mockReset());

  it('renders nothing when no bill is overdue', () => {
    withItems([]);
    const { container } = renderWithProviders(<OverdueBillsWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a callout per overdue bill', () => {
    withItems([
      item({ uid: 1, subject_id: '9', summary: 'Bill #9 is overdue' }),
      item({ uid: 2, subject_id: '10', summary: 'Bill #10 is overdue' }),
    ]);
    renderWithProviders(<OverdueBillsWidget />);
    expect(screen.getByTestId('dashboard-overdue-bills')).toBeInTheDocument();
    expect(screen.getByText('2 overdue')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-overdue-9')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-overdue-10')).toBeInTheDocument();
  });

  it('ignores non-overdue kinds in the taxation domain', () => {
    withItems([
      item({ uid: 1, subject_id: '9' }),
      item({
        uid: 2,
        kind: 'tax_mode_auto_disabled',
        subject_type: 'tax_settings',
        subject_id: 'me',
        summary: 'Auto mode off',
      }),
    ]);
    renderWithProviders(<OverdueBillsWidget />);
    expect(screen.getByText('1 overdue')).toBeInTheDocument();
    expect(screen.queryByText('Auto mode off')).not.toBeInTheDocument();
  });
});
