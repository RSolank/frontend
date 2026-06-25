import { CountUpNumber } from '../../../../shared/components/CountUpNumber';
import { useMoneyFormatter } from '../../../../shared/hooks/useMoneyFormatter';

// The big animated money figure at the centre of every hero card — the
// money-formatted specialisation of the shared <CountUpNumber> primitive.
// Counts up from 0 on mount (tweens between values on a data refresh) and
// snaps under reduced motion, so the figure is always correct on first paint.
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
  return (
    <CountUpNumber
      value={value}
      format={money}
      className={`money block tabular-nums ${className}`}
      testId={testId}
    />
  );
}
