/**
 * Bank of Georgia (BOG) Online Payments API – portable service.
 * Docs: https://api.bog.ge/docs/sandbox/payments/introduction
 *
 * Flow: getAccessToken() → createOrder() → user redirects to redirectUrl → BOG calls callback → verifyCallback()
 */
import * as crypto from 'crypto';
import axios from 'axios';
import type { BogPaymentConfig } from './bog-payment.config';

export interface BogCreateOrderParams {
  /** Our internal order id (external_order_id in BOG). */
  externalOrderId: string;
  /** Full URL for server-to-server callback (HTTPS). */
  callbackUrl: string;
  /** Where to redirect user on success. */
  successUrl: string;
  /** Where to redirect user on failure. */
  failUrl: string;
  /** Total amount in GEL. */
  totalAmount: number;
  /** Basket items for BOG. */
  basket: Array<{
    product_id: string;
    description?: string;
    quantity: number;
    unit_price: number;
  }>;
  /** Optional: buyer full name. */
  buyerFullName?: string;
  /** Optional: buyer masked email. */
  buyerMaskedEmail?: string;
  /** Optional: buyer masked phone. */
  buyerMaskedPhone?: string;
  /** TTL in minutes (2–1440). Default 15. */
  ttlMinutes?: number;
}

export interface BogCreateOrderResult {
  /** BOG order id – store on our order as bogOrderId for callback lookup. */
  orderId: string;
  /** URL to redirect user to complete payment. */
  redirectUrl: string;
  /** Link to get payment details. */
  detailsUrl: string;
}

export class BogPaymentService {
  constructor(private readonly config: BogPaymentConfig) {}

  /**
   * Get OAuth2 access token (client_credentials).
   * Token should be cached and reused until expiry.
   */
  async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const res = await axios.post(
      this.config.tokenUrl,
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        timeout: 10000,
      }
    );
    const token = res.data?.access_token;
    if (!token) {
      throw new Error('BOG token response missing access_token');
    }
    return token;
  }

  /**
   * Create BOG ecommerce order. Returns redirect URL for the user.
   */
  async createOrder(accessToken: string, params: BogCreateOrderParams): Promise<BogCreateOrderResult> {
    const body = {
      callback_url: params.callbackUrl,
      external_order_id: params.externalOrderId,
      purchase_units: {
        currency: 'GEL',
        total_amount: params.totalAmount,
        basket: params.basket.map((b) => ({
          product_id: b.product_id,
          description: b.description || '',
          quantity: b.quantity,
          unit_price: b.unit_price,
        })),
      },
      redirect_urls: {
        success: params.successUrl,
        fail: params.failUrl,
      },
      ...(params.ttlMinutes != null && { ttl: params.ttlMinutes }),
      ...(params.buyerFullName && {
        buyer: {
          full_name: params.buyerFullName,
          ...(params.buyerMaskedEmail && { masked_email: params.buyerMaskedEmail }),
          ...(params.buyerMaskedPhone && { masked_phone: params.buyerMaskedPhone }),
        },
      }),
      payment_method: ['card'],
    };

    const url = `${this.config.apiBaseUrl}/payments/v1/ecommerce/orders`;
    const res = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'ka',
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    });

    const data = res.data;
    const id = data?.id;
    const redirectHref = data?._links?.redirect?.href;
    const detailsHref = data?._links?.details?.href;

    if (!id || !redirectHref) {
      throw new Error(`BOG create order failed: ${JSON.stringify(data)}`);
    }

    return {
      orderId: id,
      redirectUrl: redirectHref,
      detailsUrl: detailsHref || '',
    };
  }

  /**
   * Verify callback signature (Callback-Signature header).
   * BOG signs the raw request body with SHA256withRSA using their private key.
   * We verify with the public key. Must use raw body (string or Buffer), not parsed JSON.
   */
  verifyCallbackSignature(rawBody: Buffer | string, signature: string): boolean {
    if (!signature || !this.config.callbackPublicKeyPem) {
      return false;
    }
    try {
      const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
      const key = crypto.createPublicKey(this.config.callbackPublicKeyPem);
      const sigBuf = Buffer.from(signature, 'base64');
      return crypto.verify('RSA-SHA256', payload, key, sigBuf);
    } catch {
      return false;
    }
  }

  /**
   * Parse callback body and return BOG order id and payment status.
   * Call after verifyCallbackSignature(). Body is the parsed JSON.
   */
  parseCallbackBody(body: any): { bogOrderId: string; event: string; success: boolean } {
    const event = body?.event || '';
    const inner = body?.body || body;
    const bogOrderId = inner?.order_id || inner?.id || '';
    const status = (inner?.status || '').toLowerCase();
    const success = status === 'completed' || status === 'approved' || status === 'paid' || status === 'success';
    return { bogOrderId, event, success };
  }
}
