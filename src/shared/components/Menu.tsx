import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { type ReactNode } from 'react';

import { MENU_SURFACE } from './menuSurface';

// Shared dropdown-MENU primitive (T-nav-ia-reorg) — a Radix DropdownMenu with
// the app's one `MENU_SURFACE` chrome + fade. Use for menus of links / actions
// (Settings, Account) where selecting an item SHOULD close the surface. Radix
// stays uncontrolled, so native dismiss (item-select / outside-click / Escape)
// and the data-state fade-out come for free — nothing hand-rolled.
//
// `<Menu>` carries the open/close state; pass Radix Root props through it
// (`modal`, `defaultOpen`, `onOpenChange`). Trigger with `<MenuTrigger asChild>`,
// list rows as `<MenuItem asChild>`, wrap them in `<MenuContent>`.
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuItem = DropdownMenu.Item;

interface MenuContentProps {
  children: ReactNode;
  // Width + padding for the surface (defaults suit a link menu). MENU_SURFACE
  // supplies the chrome + fade; this is the per-menu sizing only.
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

export function MenuContent({
  children,
  className = 'min-w-[12rem] p-1',
  align = 'end',
  sideOffset = 6,
}: MenuContentProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={`${MENU_SURFACE} ${className}`}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}
