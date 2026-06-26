import * as RadixPopover from '@radix-ui/react-popover';
import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { MENU_SURFACE } from './menuSurface';

// Shared POPOVER primitive (T-nav-ia-reorg) — same `MENU_SURFACE` chrome + fade
// as <Menu>, but built on Radix Popover for surfaces that hold ARBITRARY
// controls (toggles, sliders) and must STAY OPEN while the user interacts —
// unlike a menu, which closes on item-select. Native dismiss (Escape /
// outside-click) and the data-state fade-out are built in, so the close logic
// is never hand-rolled (the source of the accessibility-popover stuck-open bug).
//
// IMPORTANT (bundle): `@radix-ui/react-popover` rides the same lazy chunk as the
// Radix menus — only import this primitive from a lazily-loaded surface so it
// never lands in the first-paint bundle (see AccessibilityPopoverSurface).
export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

interface PopoverContentProps
  extends ComponentPropsWithoutRef<typeof RadixPopover.Content> {
  children: ReactNode;
  // Width + padding for the surface (defaults suit a control popover).
  className?: string;
}

export function PopoverContent({
  children,
  className = 'w-80 py-1',
  align = 'end',
  sideOffset = 8,
  ...rest
}: PopoverContentProps) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        sideOffset={sideOffset}
        className={`${MENU_SURFACE} ${className}`}
        {...rest}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}
