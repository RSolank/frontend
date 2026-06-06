import { useBrandingQuery } from './branding';

// Deploy-host capability flags. BE Phase 3.2 (Render free-tier deploy)
// disables some features that aren't free-tier-friendly — uploaded
// profile images need persistent storage (Render free has none), and
// statement-upload parsing is CPU-heavy enough that BE may want a
// safety valve.
//
// Source: `GET /api/v1/metadata/branding` carries an always-present
// `capabilities` object as of BE Phase 3.2 (`92fb2ba`). The optional
// chain + DEFAULTS fall-through below only fires when the localStorage
// cache predates the BE deploy; on a fresh fetch every flag has the
// real config value.
export interface Capabilities {
  profile_image_uploads_enabled: boolean;
  statement_upload_enabled: boolean;
}

const DEFAULTS: Capabilities = {
  profile_image_uploads_enabled: true,
  statement_upload_enabled: true,
};

export function useCapabilities(): Capabilities {
  const brand = useBrandingQuery().data;
  const caps = brand?.capabilities;
  return {
    profile_image_uploads_enabled:
      caps?.profile_image_uploads_enabled ??
      DEFAULTS.profile_image_uploads_enabled,
    statement_upload_enabled:
      caps?.statement_upload_enabled ?? DEFAULTS.statement_upload_enabled,
  };
}

// BE Phase 3.2 (`92fb2ba`) feature-disabled error contract. When a
// capability flag is off, the corresponding upload endpoint returns:
//   HTTP 403
//   { "detail": { "code": "feature_disabled",
//                 "feature": "profile_image_uploads" | "statement_upload" } }
//
// Discriminated from the `ACCOUNT_PENDING_DELETION` interceptor by
// shape: that one's `detail` is a STRING; this one's is an OBJECT.
// Both upload endpoints serve the same body, so a bookmarked deep-link
// or stale-tab POST gets the same 403 (idempotent — gating in the BE
// handler, not just the UI).
export type FeatureDisabledFeature =
  | 'profile_image_uploads'
  | 'statement_upload';

export interface FeatureDisabledDetail {
  code: 'feature_disabled';
  feature: FeatureDisabledFeature;
}

// Returns the parsed feature-disabled detail when `err` matches the
// 3.2 contract; null otherwise. Pass any caught error from a mutation
// or query — the discriminator is defensive across unknown shapes.
export function getFeatureDisabled(err: unknown): FeatureDisabledDetail | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { status?: unknown; detail?: unknown };
  if (e.status !== 403) return null;
  if (!e.detail || typeof e.detail !== 'object') return null;
  const d = e.detail as { code?: unknown; feature?: unknown };
  if (d.code !== 'feature_disabled') return null;
  if (d.feature !== 'profile_image_uploads' && d.feature !== 'statement_upload')
    return null;
  return { code: 'feature_disabled', feature: d.feature };
}

// User-facing copy keyed by feature. Used by both the inline upload
// error path and the deep-link/stale-tab path that hits a gated
// endpoint despite the UI being hidden.
export function featureDisabledMessage(
  feature: FeatureDisabledFeature
): string {
  switch (feature) {
    case 'profile_image_uploads':
      return 'Profile picture uploads are disabled on this deployment. Pick a preset or keep your initials.';
    case 'statement_upload':
      return 'Statement imports are disabled on this deployment. Add transactions manually instead.';
  }
}
