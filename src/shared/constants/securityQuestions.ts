// Shared list of canonical security questions for the
// account-recovery flow. Surfaced on RegisterForm + AccountSecurityPage
// — one source so the two pages can never drift.
//
// Backend stores the user's chosen question free-form, so this list is
// purely a UX scaffold; we can extend it without coordinating with BE.
export const SECURITY_QUESTIONS: readonly string[] = [
  'What was the name of your first school?',
  'What is the name of your favorite childhood friend?',
  'What is your mother’s maiden name?',
  'What was the name of your first pet?',
  'What city were you born in?',
  'What is your favorite teacher’s name?',
];
