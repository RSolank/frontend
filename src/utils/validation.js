export function validatePassword(password) {
  const trimmed = (password || '').trim();

  const requirements = {
    length: trimmed.length >= 8 && trimmed.length <= 64,
    uppercase: /[A-Z]/.test(trimmed),
    lowercase: /[a-z]/.test(trimmed),
    digit: /\d/.test(trimmed),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(trimmed),
  };

  const isValid = Object.values(requirements).every((v) => v === true);

  return { ...requirements, isValid };
}
