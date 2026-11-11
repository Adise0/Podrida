// Client-side checks mirroring the backend's Joi rules (backend/src/data/joiObjects/joiTypes.ts),
// so forms can complain before sending. The API still validates everything.
const usernameMinLength = 3;
const usernameMaxLength = 24;
const nameMaxLength = 50;
const passwordMinLength = 8;
const passwordMaxBytes = 72; // bcrypt ignores anything past 72 bytes.

export function validateUsername(value: string): string | null {
  if (!value) return "Pick a username";
  if (value.length < usernameMinLength) return `At least ${usernameMinLength} characters`;
  if (value.length > usernameMaxLength) return `At most ${usernameMaxLength} characters`;
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) return "Only letters, numbers, _ and -";
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value) return "Enter your email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "That doesn't look like an email";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Enter a password";
  if (value.length < passwordMinLength) return `At least ${passwordMinLength} characters`;
  if (new TextEncoder().encode(value).length > passwordMaxBytes) return "That password is too long";
  return null;
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  return password === confirmation ? null : "The passwords don't match";
}

export function validateName(value: string, label: string): string | null {
  if (!value.trim()) return `Enter your ${label}`;
  if (value.trim().length > nameMaxLength) return `At most ${nameMaxLength} characters`;
  return null;
}

// Keeps only the errors that are set, so `Object.keys(errors).length` tells if the form is valid.
export function collectErrors<Field extends string>(
  checks: Record<Field, string | null>,
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};

  (Object.keys(checks) as Field[]).forEach((field) => {
    const error = checks[field];
    if (error) errors[field] = error;
  });

  return errors;
}
