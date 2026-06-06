import { describe, expect, it } from 'vitest';

import { featureDisabledMessage, getFeatureDisabled } from './capabilities';

// `getFeatureDisabled` is the structural discriminator for the BE
// Phase 3.2 `feature_disabled` error contract (HTTP 403 + object
// detail). Has to coexist with the existing `ACCOUNT_PENDING_DELETION`
// interceptor (also 403, but with a STRING detail), so the typeof
// guard is load-bearing.

describe('getFeatureDisabled', () => {
  it('matches the 3.2 contract for profile_image_uploads', () => {
    expect(
      getFeatureDisabled({
        status: 403,
        detail: { code: 'feature_disabled', feature: 'profile_image_uploads' },
      })
    ).toEqual({ code: 'feature_disabled', feature: 'profile_image_uploads' });
  });

  it('matches the 3.2 contract for statement_upload', () => {
    expect(
      getFeatureDisabled({
        status: 403,
        detail: { code: 'feature_disabled', feature: 'statement_upload' },
      })
    ).toEqual({ code: 'feature_disabled', feature: 'statement_upload' });
  });

  it('passes through ACCOUNT_PENDING_DELETION (string detail) as null', () => {
    expect(
      getFeatureDisabled({
        status: 403,
        detail: 'ACCOUNT_PENDING_DELETION',
      })
    ).toBeNull();
  });

  it('returns null on non-403 errors', () => {
    expect(
      getFeatureDisabled({
        status: 401,
        detail: { code: 'feature_disabled', feature: 'statement_upload' },
      })
    ).toBeNull();
  });

  it('returns null on unknown feature names', () => {
    expect(
      getFeatureDisabled({
        status: 403,
        detail: { code: 'feature_disabled', feature: 'made_up_feature' },
      })
    ).toBeNull();
  });

  it('returns null on null / non-object errors', () => {
    expect(getFeatureDisabled(null)).toBeNull();
    expect(getFeatureDisabled(undefined)).toBeNull();
    expect(getFeatureDisabled('a string error')).toBeNull();
    expect(getFeatureDisabled(42)).toBeNull();
  });
});

describe('featureDisabledMessage', () => {
  it('returns distinct copy per feature', () => {
    expect(featureDisabledMessage('profile_image_uploads')).toMatch(
      /profile picture/i
    );
    expect(featureDisabledMessage('statement_upload')).toMatch(
      /statement imports/i
    );
  });
});
