import { Link } from 'react-router-dom';

import { ContrastToggle } from './ContrastToggle';
import { MotionToggle } from './MotionToggle';
import { PrivacyToggle } from './PrivacyToggle';
import { ThemeOptions } from './ThemeOptions';
import { ZoomSlider } from './ZoomSlider';

// Pulled out of `<AccessibilityPopover>` so the 5 toggle components
// + their Tailwind chrome live in a lazy chunk loaded only when the
// user actually opens the popover. Frees ~1.5 kB gz from the
// first-paint bundle (CONTRIBUTING.md §3 ratchet, Platform FE
// Batch 5).
interface AccessibilityPanelProps {
  onClose?: () => void;
  // The desktop popover wants the "More accessibility settings →"
  // link at the bottom; the mobile drawer already renders a
  // dedicated "Accessibility" header link directly above this
  // panel, so it suppresses the trailing link to avoid the
  // duplicate-CTA pattern.
  showMoreLink?: boolean;
}

export function AccessibilityPanel({
  onClose,
  showMoreLink = true,
}: AccessibilityPanelProps) {
  return (
    <>
      <ThemeOptions />
      <ZoomSlider />
      <MotionToggle />
      <PrivacyToggle />
      <ContrastToggle />
      {showMoreLink && (
        <div className="mt-1 border-t border-slate-100 px-4 py-2 dark:border-slate-800">
          <Link
            to="/account/accessibility"
            onClick={onClose}
            className="text-xs font-medium text-accent-600 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none dark:text-accent-400 dark:hover:text-accent-300"
          >
            More accessibility settings →
          </Link>
        </div>
      )}
    </>
  );
}

export default AccessibilityPanel;
