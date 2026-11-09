// The gateway limits login, registration and recovery together and answers 429 for all three
// (gateway/nginx.conf).
export const TOO_MANY_ATTEMPTS_MESSAGE = 'Troppi tentativi: riprova tra un minuto.';
