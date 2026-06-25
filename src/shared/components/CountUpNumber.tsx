import { useCountUp } from '../motion';

// Shared count-up number — a singular metric that animates from a baseline to
// its value as the second beat (gated on the card landing via `useCountUp`,
// self-settles + snaps under reduced motion, framer-free).
//
// FOR HEADLINE / SUMMARY figures only — a hero figure, a "spent this week"
// total, a count. NEVER a list/table of values: many numbers counting at once
// reads as a slot machine and delays reading; list numbers ride their
// container's entrance instead.
//
// During the tween whole units render (no cents flicker); the exact value
// (decimals included) shows at rest — equality holds because `useCountUp`
// ends precisely on `value`.
export function CountUpNumber({
  value,
  format,
  className = '',
  testId,
}: {
  value: number;
  // Formats the displayed number (e.g. a money formatter). Defaults to a
  // rounded-integer string (counts).
  format?: (n: number) => string;
  className?: string;
  testId?: string;
}) {
  const animated = useCountUp(value);
  const display = animated === value ? value : Math.round(animated);
  return (
    <span className={className} data-testid={testId}>
      {format ? format(display) : String(Math.round(display))}
    </span>
  );
}
