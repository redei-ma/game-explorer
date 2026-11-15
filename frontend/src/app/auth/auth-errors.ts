// The gateway limits login, registration and recovery together and answers 429 for all three
// (gateway/nginx.conf).
export const TOO_MANY_ATTEMPTS_MESSAGE = 'Troppi tentativi: riprova tra un minuto.';

// auth-service answers a locked account like a wrong password or code, so login and recovery
// mention the lock to everyone: a user with the right data would not know why it fails.
export const LOCKOUT_HINT =
  "Dopo troppi tentativi sbagliati l'account si blocca per qualche minuto.";

// Identity's codes for the password rules, used by registration and recovery, in the order the
// sentence lists them. The number repeats Identity's default option (auth-service Program.cs)
// only in the text: the server still decides.
const passwordRules: Record<string, string> = {
  PasswordTooShort: 'almeno 6 caratteri',
  PasswordRequiresDigit: 'un numero',
  PasswordRequiresLower: 'una lettera minuscola',
  PasswordRequiresUpper: 'una lettera maiuscola',
  PasswordRequiresNonAlphanumeric: 'un simbolo',
};

const italianList = new Intl.ListFormat('it');

// Shown under the password field before any submit, so the rules are known up front.
export const PASSWORD_RULES_HINT = `Deve avere ${italianList.format(Object.values(passwordRules))}.`;

export function isPasswordRule(code: string): boolean {
  return code in passwordRules;
}

// Identity sends one code per failed rule: they become one sentence, or null if none failed.
export function passwordRulesMessage(codes: string[]): string | null {
  const missing = Object.keys(passwordRules)
    .filter((code) => codes.includes(code))
    .map((code) => passwordRules[code]);
  return missing.length > 0 ? `La password deve avere ${italianList.format(missing)}.` : null;
}
