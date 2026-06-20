import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/renderWithProviders';
import type { ActivityFeedItem } from '../api/activityFeed';

import { ActivityCallout } from './ActivityCallout';

// Spy on the hard-ack mutation while keeping the rest of the module
// real (the component also imports `itemsToSeenRefs`).
const mutate = vi.fn();
vi.mock('../api/activityFeed', async (orig) => {
  const actual = await orig<typeof import('../api/activityFeed')>();
  return {
    ...actual,
    useMarkActivitySeenMutation: () => ({ mutate }),
  };
});

const ITEM: ActivityFeedItem = {
  uid: 7,
  kind: 'bill_overdue',
  event_class: 'alert',
  domain: 'taxation',
  subject_type: 'bill',
  subject_id: '42',
  priority: 1,
  state: 'active',
  summary: 'A committee bill is overdue',
  created_at: '2026-06-20T00:00:00Z',
  refreshed_at: '2026-06-20T00:00:00Z',
  aggregate_count: 1,
};

describe('ActivityCallout', () => {
  afterEach(() => {
    mutate.mockClear();
  });

  it('renders the summary and the subjectMeta deep-link', () => {
    renderWithProviders(<ActivityCallout item={ITEM} testId="cb" />);
    expect(screen.getByText('A committee bill is overdue')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View bill/ });
    expect(link).toHaveAttribute('href', '/consumption-tax?bill=42');
  });

  it('hard-acks on dismiss with the item ref', () => {
    renderWithProviders(<ActivityCallout item={ITEM} testId="cb" />);
    fireEvent.click(screen.getByTestId('cb-dismiss'));
    expect(mutate).toHaveBeenCalledWith({
      refs: [{ kind: 'bill_overdue', subject_type: 'bill', subject_id: '42' }],
      hard: true,
    });
  });

  it('omits the CTA when the subject has no deep-link target', () => {
    renderWithProviders(
      <ActivityCallout
        item={{ ...ITEM, subject_type: 'unknown_subject' }}
        testId="cb"
      />
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // Dismiss is still available.
    expect(screen.getByTestId('cb-dismiss')).toBeInTheDocument();
  });
});
