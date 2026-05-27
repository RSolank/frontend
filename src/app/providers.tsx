import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Suspense, useEffect, type ReactNode } from 'react';

import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { applyContrast, useContrastStore } from '../shared/state/contrast.store';
import {
  applyFocusRing,
  useFocusRingStore,
} from '../shared/state/focusRing.store';
import {
  applyLinkUnderline,
  useLinkUnderlineStore,
} from '../shared/state/linkUnderline.store';
import { applyMotion, useMotionStore } from '../shared/state/motion.store';
import {
  applyPrivacyMask,
  usePrivacyStore,
} from '../shared/state/privacy.store';
import { applyTheme, useThemeStore } from '../shared/state/theme.store';
import { applyZoom, useZoomStore } from '../shared/state/zoom.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function ThemeBridge() {
  const mode = useThemeStore((s) => s.mode);

  // Re-apply on every mode change.
  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  // While in 'system' mode, follow OS preference changes live.
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mode]);

  return null;
}

function ZoomBridge() {
  const zoom = useZoomStore((s) => s.zoom);
  useEffect(() => {
    applyZoom(zoom);
  }, [zoom]);
  return null;
}

function MotionBridge() {
  const reduced = useMotionStore((s) => s.reducedMotion);
  useEffect(() => {
    applyMotion(reduced);
  }, [reduced]);
  return null;
}

function PrivacyBridge() {
  const mask = usePrivacyStore((s) => s.mask);
  useEffect(() => {
    applyPrivacyMask(mask);
  }, [mask]);
  return null;
}

function ContrastBridge() {
  const high = useContrastStore((s) => s.high);
  useEffect(() => {
    applyContrast(high);
  }, [high]);
  return null;
}

function LinkUnderlineBridge() {
  const underline = useLinkUnderlineStore((s) => s.underline);
  useEffect(() => {
    applyLinkUnderline(underline);
  }, [underline]);
  return null;
}

function FocusRingBridge() {
  const alwaysVisible = useFocusRingStore((s) => s.alwaysVisible);
  useEffect(() => {
    applyFocusRing(alwaysVisible);
  }, [alwaysVisible]);
  return null;
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeBridge />
        <ZoomBridge />
        <MotionBridge />
        <PrivacyBridge />
        <ContrastBridge />
        <LinkUnderlineBridge />
        <FocusRingBridge />
        <Suspense fallback={null}>{children}</Suspense>
        {import.meta.env.DEV ? (
          <ReactQueryDevtools initialIsOpen={false} />
        ) : null}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
