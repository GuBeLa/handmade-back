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
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvDvPYVrYCG6akztcgNTh
1M13Bvd03HePSJ2t8aXEMyvnBiaL4SoTyt5eBAevf4TV1vBw7kpEZGmllwJCWT6J
LVqTNGYPUY0lyZmlOAYQRrJEg9vbHp2iljjzjeeVmPGdn8CUHrpb9Y52XXD2TEYg
yYCSNKTNGttlAeU5qbHmglr1WZ5nuCa+v4VKmXZZU3r2eucFzOgjHm9DXA/hJNkO
3/PVregXWFjmC26Zmiv6FAbE3iibgwTFDAuTFyXogw4boOTDSzjZvpeEWXcB7rfr
oLZfA9nLTQPR7jopEDq5OKKbyuJ7xugPC1eaYu94zFtcRg5CUFHrA/3obVkDGXBM
LwIDAQAB
-----END PUBLIC KEY-----`;
  return {
    clientId,
    clientSecret,
    tokenUrl,
    apiBaseUrl,
    callbackPublicKeyPem,
  };
}
