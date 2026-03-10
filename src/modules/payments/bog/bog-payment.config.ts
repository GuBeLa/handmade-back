/**
 * BOG (Bank of Georgia) Payment API configuration.
 * Portable: copy this and bog-payment.service to another project and set env vars.
 *
 * Sandbox: https://api.bog.ge/docs/sandbox/payments/introduction
 * Test credentials: client_id (Public Key) 10000164, client_secret (Secret Key) zQ4z2Isfz4Pm
 */
export interface BogPaymentConfig {
  /** OAuth2 client_id (Public Key from BOG). Sandbox: 10000164 */
  clientId: string;
  /** OAuth2 client_secret (Secret Key from BOG). Never expose to frontend. */
  clientSecret: string;
  /** OAuth2 token URL. Sandbox: https://oauth2-sandbox.bog.ge/auth/realms/bog/protocol/openid-connect/token */
  tokenUrl: string;
  /** Payments API base URL (no trailing slash). Sandbox: https://api-sandbox.bog.ge */
  apiBaseUrl: string;
  /** Public key (PEM) for callback signature verification (SHA256withRSA). From BOG docs or env. */
  callbackPublicKeyPem: string;
}

export function getBogConfigFromEnv(): BogPaymentConfig {
  const clientId = process.env.BOG_CLIENT_ID || process.env.BOG_PUBLIC_KEY || '10000164';
  const clientSecret = process.env.BOG_CLIENT_SECRET || process.env.BOG_SECRET_KEY || 'zQ4z2Isfz4Pm';
  const isSandbox = process.env.BOG_SANDBOX !== 'false';
  const tokenUrl =
    process.env.BOG_TOKEN_URL ||
    (isSandbox
      ? 'https://oauth2-sandbox.bog.ge/auth/realms/bog/protocol/openid-connect/token'
      : 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token');
  const apiBaseUrl =
    process.env.BOG_API_BASE_URL ||
    (isSandbox ? 'https://api-sandbox.bog.ge' : 'https://api.bog.ge');
  const callbackPublicKeyPem =
    process.env.BOG_CALLBACK_PUBLIC_KEY_PEM ||
    `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqczfAuhtxw2iF68kS0Hy
bGSv0ZlDAjsXh6VC8avDl3Vxa9qCn6Pzl37Tl2Z21WodiISLeXdhCtOMTeLNUBeb
CYD31y2/MwnhLYqlCk2bOh29fyPc1iT5Eu/k/1IaNRrK9/UVZaTkhOMeEm+aL4y8
5XsE4UjqftEmwrAdbO2G4cCpuoMC9ZXG9gAdr2BFN6i2Vt9eCen5Poj7E1ik7s8T
GyzploVV0NflhwBGeWnvQANUQGr87gsP5k2JG1z5EwnMybJQ7i3XT726rJMaV6QW
sY5hP72Mtv1I1zL2d9FXm9FWOzbpcXCyxuEBXvqqOHzogri8C7KRRYKyk97Ri7D6
8wIDAQAB
-----END PUBLIC KEY-----`;
  return {
    clientId,
    clientSecret,
    tokenUrl,
    apiBaseUrl,
    callbackPublicKeyPem,
  };
}
