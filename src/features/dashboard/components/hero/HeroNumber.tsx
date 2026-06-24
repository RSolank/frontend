import { useMoneyFormatter } from '../../../../shared/hooks/useMoneyFormatter';
import { useCountUp } from '../../../../shared/motion';

// The big animated money figure at the centre of every hero card. Counts up
// from 0 on mount (and tweens between values on a data refresh) via the shared
// `useCountUp`, which snaps to the final number under reduced motion — so the
// figure is always correct on first paint, motion or not.
//
// During the tween we render whole units (rounded) to avoid the cents
// flickering on every frame; at rest we show the exact value (decimals
// included). Equality holds because `useCountUp` ends precisely on `value`.
export function HeroNumber({
  value,
  className = '',
  testId,
}: {
  value: number;
  className?: string;
  testId?: string;
}) {
  const { money } = useMoneyFormatter();
  const animated = useCountUp(value);
  const display = animated === value ? value : Math.round(animated);

  return (
    <div className={`money tabular-nums ${className}`} data-testid={testId}>
      {money(display)}
    </div>
  );
}
