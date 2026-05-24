import { zodResolver } from '@hookform/resolvers/zod';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

// Pattern future feature batches will use: a single Zod schema doubles
// as the TS type for request bodies (via `z.infer`) AND as the
// react-hook-form resolver. This file just verifies the three packages
// compose under the new TS / Vite stack — feature-level schemas live in
// each feature's api/schemas.ts from Batch 2 onwards.

describe('react-hook-form + zod + @hookform/resolvers (Batch 0 smoke)', () => {
  const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
  });

  type LoginInput = z.infer<typeof loginSchema>;

  it('zod parses valid input', () => {
    const parsed = loginSchema.parse({
      email: 'a@b.test',
      password: 'longenough',
    });
    expectTypeOf(parsed).toEqualTypeOf<LoginInput>();
    expect(parsed.email).toBe('a@b.test');
  });

  it('zod rejects invalid input', () => {
    expect(() =>
      loginSchema.parse({ email: 'not-an-email', password: 'x' })
    ).toThrow();
  });

  it('zodResolver returns a callable resolver fn', () => {
    const resolver = zodResolver(loginSchema);
    expect(typeof resolver).toBe('function');
  });
});
