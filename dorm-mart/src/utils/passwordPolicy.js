export const MAX_PASSWORD_LEN = 64;

export const hasLower = (value) => /[a-z]/.test(value);
export const hasUpper = (value) => /[A-Z]/.test(value);
export const hasDigit = (value) => /\d/.test(value);
export const hasSpecial = (value) => /[^A-Za-z0-9]/.test(value);

export function buildPasswordPolicy(value) {
  return {
    minLen: value.length >= 8,
    lower: hasLower(value),
    upper: hasUpper(value),
    digit: hasDigit(value),
    special: hasSpecial(value),
    notTooLong: value.length <= MAX_PASSWORD_LEN,
  };
}
