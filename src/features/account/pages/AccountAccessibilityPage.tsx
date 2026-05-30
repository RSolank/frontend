import { ContrastToggle } from '../../../shared/components/ContrastToggle';
import { DateFormatSelect } from '../../../shared/components/DateFormatSelect';
import { FocusRingToggle } from '../../../shared/components/FocusRingToggle';
import { LandingRouteSelect } from '../../../shared/components/LandingRouteSelect';
import { LinkUnderlineToggle } from '../../../shared/components/LinkUnderlineToggle';
import { MotionToggle } from '../../../shared/components/MotionToggle';
import { NumberFormatSelect } from '../../../shared/components/NumberFormatSelect';
import { PrivacyToggle } from '../../../shared/components/PrivacyToggle';
import { ThemeOptions } from '../../../shared/components/ThemeOptions';
import { ZoomSlider } from '../../../shared/components/ZoomSlider';

// Canonical edit surface for every on-device UX preference. Two
// groups:
//
//  1. Display & motion (theme / zoom / motion / privacy / contrast /
//     underline links / always-show focus) — toggles + sliders whose
//     effect is paint-time. The first four are shared with the
//     top-bar AccessibilityPopover (desktop) and the mobile drawer's
//     Accessibility section so users can flip them without leaving
//     their current page. The contrast / underline / focus toggles
//     are page-only for now to keep the popover compact; if usage
//     surfaces a need we can lift them later.
//
//  2. Data formatting (date format / numbers / default landing
//     route) — selects whose effect is read at format-time
//     (formatDate / formatMoney) or at navigation-time (post-login
//     redirect). Page-only by design — these aren't toggled mid-task.
//
// All seven shared-store controls (groups combined) persist
// frontend-only via Zustand `persist` ⇒ `localStorage`. No backend
// columns; preferences do NOT follow the user across devices. See
// CONTRIBUTING.md §6 "Accessibility vs Preferences" for the
// contract, and `docs/refactor/implementation_plan.md` "Backend
// follow-ups" for the future cross-device-sync work.
//
// Card-anchored layout (Batch 9 polish): breadcrumb reads
// "Account › Accessibility"; the first card is the first content
// element so it top-aligns with the sidebar's first NavLink.

export function AccountAccessibilityPage() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
          Display & motion
        </div>
        <ThemeOptions />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <ZoomSlider />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <MotionToggle />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <PrivacyToggle />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <ContrastToggle />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <LinkUnderlineToggle />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <FocusRingToggle />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
          Data formatting
        </div>
        <DateFormatSelect />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <NumberFormatSelect />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <LandingRouteSelect />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
        <p>
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            Tip:
          </strong>{' '}
          Theme, text size, motion, and privacy mask are also reachable
          from the top-bar Accessibility menu on desktop and the
          navigation drawer&rsquo;s Accessibility section on mobile, so
          you can toggle them without leaving your current page. All
          settings on this page persist to this browser only and do not
          follow you across devices.
        </p>
      </div>
    </div>
  );
}
