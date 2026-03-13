import { Injectable, BadRequestException, InternalServerErrorException, HttpException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePaymentTokenDto } from './dto/create-payment-token.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { OrdersService } from '../orders/orders.service';
import { FirestoreService } from '../../common/services/firestore.service';
import axios from 'axios';
import { BogPaymentService } from './bog/bog-payment.service';
import { getBogConfigFromEnv } from './bog/bog-payment.config';
import type { BogSplitPaymentEntry } from './bog/bog-payment.service';

/** BOG split allows max 10 accounts: 1 platform + up to 9 merchants. */
export const MAX_MERCHANTS_FOR_BOG_SPLIT = 9;

// Lazy load Flitt Node.js SDK
let FlittSDK: any = null;

const loadFlittSDK = () => {
  if (FlittSDK) {
    return FlittSDK;
  }
  
  try {
    // Try to require Flitt Node.js SDK (CommonJS module)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const flittModule = require('@flittpayments/flitt-node-js-sdk');
    FlittSDK = flittModule.default || flittModule.FlittSDK || flittModule;
    return FlittSDK;
  } catch (error) {
    console.warn('Flitt Node.js SDK not available. Using direct API calls.', error);
    return null;
  }
};

/** Strip surrounding quotes and any newline/CR from env value (Vercel/.env/Lambda) */
function stripEnvQuotes(value: string): string {
  let s = (value || '').replace(/\r\n/g, '').replace(/\n/g, '').replace(/\r/g, '').trim();
  if (s.length >= 2) {
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      s = s.slice(1, -1).trim();
    }
  }
  return s;
}

@Injectable()
export class PaymentsService {
  private readonly flittMerchantId: string;
  private readonly flittPaymentKey: string;
  private readonly flittCreditPrivateKey: string;
  /** Secret used for request signature — from Flitt Portal → Technical Settings → Secret key */
  private readonly flittSecretKey: string;
  private readonly flittBaseUrl: string;
  /** Webhook HMAC secret (x-signature header). Never trust webhook without this. */
  private readonly flittWebhookSecret: string;
  private flittSDKInstance: any = null;
  private readonly bogService: BogPaymentService;

  constructor(
    private configService: ConfigService,
    private readonly firestoreService: FirestoreService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {
    this.bogService = new BogPaymentService(getBogConfigFromEnv());
    this.flittMerchantId = stripEnvQuotes(this.configService.get<string>('FLITT_MERCHANT_ID') || '');
    this.flittWebhookSecret = stripEnvQuotes(this.configService.get<string>('FLITT_WEBHOOK_SECRET') || '');
    this.flittPaymentKey = stripEnvQuotes(this.configService.get<string>('FLITT_PAYMENT_KEY') || '');
    this.flittCreditPrivateKey = stripEnvQuotes(this.configService.get<string>('FLITT_CREDIT_PRIVATE_KEY') || '');
    // Checkout/token signature: Credit private key or Payment key (no FLITT_SECRET_KEY)
    const rawSecret =
      this.configService.get<string>('FLITT_CREDIT_PRIVATE_KEY') ||
      this.configService.get<string>('FLITT_PAYMENT_KEY') ||
      '';
    this.flittSecretKey = stripEnvQuotes(rawSecret);
    this.flittBaseUrl = (this.configService.get<string>('FLITT_BASE_URL') || 'https://pay.flitt.com').replace(/\/$/, '');

    if (!this.flittMerchantId || !this.flittSecretKey) {
      console.warn(
        '⚠️ Flitt: FLITT_MERCHANT_ID and one of FLITT_PAYMENT_KEY, FLITT_CREDIT_PRIVATE_KEY are required for payments.'
      );
    } else if (!this.flittWebhookSecret) {
      console.warn(
        '⚠️ Flitt: FLITT_WEBHOOK_SECRET is not set. Webhook (POST /payments/webhook) will reject all requests. Set it in Flitt Portal for x-signature HMAC verification.'
      );
    }
    if (this.flittMerchantId && this.flittSecretKey) {
      if (this.flittMerchantId !== '1549901' && this.flittSecretKey === 'test') {
        console.warn(
          '⚠️ Flitt: Merchant is not 1549901 but secret is "test". Use FLITT_PAYMENT_KEY or FLITT_CREDIT_PRIVATE_KEY from portal.'
        );
      }
      console.log('✅ Flitt Payment Service initialized:', {
        merchantId: this.flittMerchantId,
        baseUrl: this.flittBaseUrl,
        secretKeyLength: this.flittSecretKey.length,
      });
    }
  }

  /**
   * Get Flitt SDK instance (FlittPay from @flittpayments/flitt-node-js-sdk)
   * Uses FLITT_MERCHANT_ID and signature key (FLITT_PAYMENT_KEY or FLITT_CREDIT_PRIVATE_KEY).
   */
  private getFlittSDK(): any {
    if (!this.flittSDKInstance) {
      const SDK = loadFlittSDK();
      const merchantIdNum = parseInt(this.flittMerchantId, 10);
      if (SDK && !isNaN(merchantIdNum) && merchantIdNum > 0 && this.flittSecretKey) {
        try {
          console.log('Initializing Flitt Node.js SDK...');
          const FlittPay = typeof SDK === 'function' ? SDK : SDK.default || SDK.FlittSDK || SDK;
          if (typeof FlittPay !== 'function') {
            console.warn('⚠️ Flitt SDK export not found, will use direct API calls');
            return null;
          }
          const baseUrl = this.flittBaseUrl.replace(/^https?:\/\//, '');
          this.flittSDKInstance = new FlittPay({
            merchantId: merchantIdNum,
            secretKey: this.flittSecretKey,
            baseUrl,
          });
          console.log('✅ Flitt Node.js SDK initialized successfully');
        } catch (error: any) {
          console.warn('Failed to initialize Flitt SDK, will use direct API calls:', error.message);
          return null;
        }
      }
    }
    return this.flittSDKInstance;
  }

  /**
   * Build BOG split_payments from order: each merchant gets their share, platform gets commission.
   * Max 9 merchants + 1 platform = 10 accounts (BOG limit). Returns undefined if split cannot be applied.
   */
  private async buildBogSplitPayments(order: any): Promise<BogSplitPaymentEntry[] | undefined> {
    const bogConfig = getBogConfigFromEnv();
    if (!bogConfig.platformIban?.trim()) {
      return undefined;
    }
    const items = order.items || [];
    const subtotal = Number(order.subtotal) || 0;
    const commission = Number(order.commission) || 0;
    const total = Math.round(Number(order.total) * 100) / 100;
    if (subtotal <= 0 || total <= 0) return undefined;

    const bySeller = new Map<string, number>();
    for (const item of items) {
      const sid = item.sellerId;
      if (!sid) continue;
      const itemTotal = Number(item.total) ?? (Number(item.price) || 0) * (Number(item.quantity) || 1);
      bySeller.set(sid, (bySeller.get(sid) || 0) + itemTotal);
    }
    const sellerIds = Array.from(bySeller.keys());
    if (sellerIds.length === 0 || sellerIds.length > MAX_MERCHANTS_FOR_BOG_SPLIT) {
      return undefined;
    }

    const netToSellers = Math.max(0, total - commission);
    const subtotalMinusCommission = Math.max(0, subtotal - commission);
    if (subtotalMinusCommission <= 0) return undefined;

    const entries: BogSplitPaymentEntry[] = [];
    let remainingForSellers = Math.round(netToSellers * 100) / 100;

    for (const sellerId of sellerIds) {
      const sellerSubtotal = bySeller.get(sellerId) || 0;
      const share = (netToSellers * sellerSubtotal) / subtotalMinusCommission;
      const amount = Math.round(share * 100) / 100;
      const profile: any = await this.firestoreService.findOneBy('seller_profiles', 'userId', sellerId);
      const iban = profile?.iban?.trim();
      if (!iban) return undefined;
      const shopName = (profile?.shopName || 'Shop').slice(0, 20);
      const desc = `Order ${(order.orderNumber || order.id || '').slice(-8)} ${shopName}`.slice(0, 25);
      entries.push({ amount, iban, description: desc.replace(/[^0-9 \/\-?:().,'+a-zA-Z]/g, '') || 'Payment' });
      remainingForSellers -= amount;
    }
    const platformAmount = Math.round(commission * 100) / 100;
    const platformDesc = (bogConfig.platformSplitDescription || 'Platform commission').slice(0, 25);
    entries.push({
      amount: platformAmount,
      iban: bogConfig.platformIban.trim(),
      description: platformDesc.replace(/[^0-9 \/\-?:().,'+a-zA-Z]/g, '') || 'Commission',
    });

    const sum = entries.reduce((s, e) => s + e.amount, 0);
    const diff = Math.round((total - sum) * 100) / 100;
    if (Math.abs(diff) > 0.01 && entries.length >= 2) {
      entries[entries.length - 1].amount = Math.round((entries[entries.length - 1].amount + diff) * 100) / 100;
    }
    return entries;
  }

  /**
   * Create BOG (Bank of Georgia) card payment session.
   * Returns redirect URL; store bogOrderId on order for callback.
   * If amountInGel is provided (e.g. 5 for reservation), only that amount is charged and callback will set reservationFeePaid.
   */
  async createBogCheckoutSession(
    orderId: string,
    successUrl: string,
    failUrl: string,
    amountInGel?: number,
  ): Promise<{ redirectUrl: string }> {
    const order: any = await this.ordersService.findOne(orderId);
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    if (order.isPaid) {
      throw new BadRequestException('Order already paid');
    }
    const port = this.configService.get<string>('PORT') || '3005';
    const apiBaseUrl =
      this.configService.get<string>('API_BASE_URL') ||
      (process.env.NODE_ENV === 'production'
        ? this.configService.get<string>('API_BASE_URL') || 'https://handmade-back-seven.vercel.app/api'
        : `http://localhost:${port}/api`);
    const callbackUrl = `${apiBaseUrl.replace(/\/$/, '')}/payments/bog/callback`;

    let basket: { product_id: string; description: string; quantity: number; unit_price: number }[];
    let totalAmount: number;

    if (amountInGel != null && amountInGel > 0) {
      totalAmount = Math.round(Number(amountInGel) * 100) / 100;
      basket = [
        {
          product_id: `reservation-${orderId}`,
          description: 'ჯავშნის საფასური',
          quantity: 1,
          unit_price: totalAmount,
        },
      ];
      await this.ordersService.setOrderBogReservationOnly(orderId, true);
    } else {
      const rawItems = order.items || [];
      if (rawItems.length === 0) {
        throw new BadRequestException('Order has no items; cannot create BOG checkout');
      }
      basket = rawItems.map((item: any) => {
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const unitPrice = Number(item.price);
        const price = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
        return {
          product_id: String(item.productId || item.product?.id || 'item').slice(0, 255),
          description: (item.productTitle || item.product?.title || 'Product').slice(0, 255),
          quantity: qty,
          unit_price: Math.round(price * 100) / 100,
        };
      });
      const invalidItem = basket.find((b) => b.unit_price < 0 || !b.product_id);
      if (invalidItem) {
        throw new BadRequestException(
          'Order contains invalid item (missing product id or negative price); cannot create BOG checkout',
        );
      }
      totalAmount = Math.round(Number(order.total) * 100) / 100;
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new BadRequestException('Invalid order total');
    }

    let splitPayments: BogSplitPaymentEntry[] | undefined;
    if (amountInGel == null && order.items?.length) {
      splitPayments = await this.buildBogSplitPayments(order);
    }

    const token = await this.bogService.getAccessToken();
    const result = await this.bogService.createOrder(token, {
      externalOrderId: orderId,
      callbackUrl,
      successUrl,
      failUrl,
      totalAmount,
      basket,
      buyerFullName: order.buyer?.firstName
        ? [order.buyer.firstName, order.buyer.lastName].filter(Boolean).join(' ')
        : undefined,
      buyerMaskedEmail: order.buyer?.email,
      buyerMaskedPhone: order.buyer?.phone,
      ttlMinutes: 15,
      splitPayments,
    });

    if (!result?.redirectUrl) {
      throw new BadRequestException(
        'BOG payment session could not be created; missing redirect URL',
      );
    }
    await this.ordersService.setOrderBogOrderId(orderId, result.orderId);
    return { redirectUrl: result.redirectUrl };
  }

  /**
   * Handle BOG callback (POST from BOG). Verify signature then update order if payment success.
   */
  async handleBogCallback(rawBody: Buffer | string, signature: string): Promise<{ received: boolean }> {
    if (!this.bogService.verifyCallbackSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid BOG callback signature');
    }
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse((rawBody as Buffer).toString('utf8'));
    const { bogOrderId, success } = this.bogService.parseCallbackBody(body);
    if (success && bogOrderId) {
      const order = await this.ordersService.findByBogOrderId(bogOrderId);
      if (order?.id) {
        if (order.bogReservationOnly) {
          await this.ordersService.setOrderReservationFeePaid(order.id);
        } else {
          await this.ordersService.setOrderPaid(order.id);
        }
      }
    }
    return { received: true };
  }

  /**
   * Create Hosted Checkout session: returns checkoutUrl for WebView/redirect.
   * Flow: Front opens checkoutUrl → Flitt Hosted Checkout (cards, Apple Pay, Google Pay) → Webhook updates order.
   */
  async createHostedCheckoutSession(amount: number, orderId: string): Promise<{ checkoutUrl: string; orderId: string }> {
    const result = await this.createPaymentToken({
      amount,
      orderId,
      description: `Order ${orderId}`,
      currency: 'GEL',
      paymentMethod: PaymentMethod.FLITT,
    });
    const paymentUrl = (result as any).paymentUrl;
    const token = (result as any).token;
    const checkoutUrl =
      paymentUrl ||
      (token ? `${this.flittBaseUrl}/checkout?token=${encodeURIComponent(token)}` : '');
    if (!checkoutUrl) {
      throw new InternalServerErrorException('Flitt did not return checkout URL');
    }
    return { checkoutUrl, orderId };
  }

  /**
   * Create payment token for Flitt SDK
   * This token is used by mobile app to process payment
   * According to Flitt documentation: backend creates token, mobile app uses it
   */
  async createPaymentToken(dto: CreatePaymentTokenDto) {
    try {
      // Only Flitt payment method is supported for now
      if (dto.paymentMethod !== PaymentMethod.FLITT && 
          dto.paymentMethod !== PaymentMethod.GOOGLE_PAY && 
          dto.paymentMethod !== PaymentMethod.APPLE_PAY) {
        throw new BadRequestException(`Payment method ${dto.paymentMethod} is not yet supported`);
      }

      // Convert amount to tetri (smallest currency unit for GEL)
      const amountInTetri = Math.round(dto.amount * 100);

      // Get API base URL for callback
      const port = this.configService.get<string>('PORT') || '3005';
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? this.configService.get<string>('API_BASE_URL') || `https://handmade-back-seven.vercel.app/api`
        : `http://localhost:${port}/api`;

      // Try to use Flitt Node.js SDK first (same signature/request as official SDK)
      const sdk = this.getFlittSDK();
      if (sdk && typeof sdk.CheckoutToken === 'function') {
        try {
          // CheckoutToken(data) — params: order_id, order_desc, currency, amount, server_callback_url (https://github.com/flittpayments/node-js-sdk)
          const requestData: Record<string, string | number> = {
            order_id: dto.orderId,
            order_desc: dto.description,
            currency: dto.currency.toUpperCase(),
            amount: amountInTetri,
            server_callback_url: `${apiBaseUrl}/payments/flitt/callback`,
          };
          if (dto.customerPhone) requestData.customer_phone = dto.customerPhone;
          if (dto.customerEmail) requestData.sender_email = dto.customerEmail;

          const result = await sdk.CheckoutToken(requestData);
          if (result && result.token) {
            return {
              token: result.token,
              orderId: dto.orderId,
              ...(result.checkout_url && { paymentUrl: result.checkout_url }),
            };
          }
        } catch (sdkError: any) {
          console.warn('Flitt SDK CheckoutToken failed, falling back to direct API:', sdkError?.message || sdkError);
        }
      }

      // Fallback to direct API call if SDK is not available or fails (same params + signature as SDK)
      const merchantIdNum = parseInt(this.flittMerchantId, 10);
      if (!this.flittMerchantId || isNaN(merchantIdNum) || !this.flittSecretKey) {
        throw new BadRequestException(
          'Flitt credentials not configured. Set FLITT_MERCHANT_ID and FLITT_PAYMENT_KEY or FLITT_CREDIT_PRIVATE_KEY.'
        );
      }

      // Build params exactly as Flitt docs for checkout/token:
      // amount, currency, merchant_id, order_desc, order_id, server_callback_url (+ signature)
      const serverCallbackUrl = `${apiBaseUrl}/payments/flitt/callback`;
      const requestParams: Record<string, string | number | undefined> = {
        amount: amountInTetri, // minor units (e.g. tetri)
        currency: dto.currency.toUpperCase(),
        merchant_id: merchantIdNum,
        order_desc: dto.description,
        order_id: dto.orderId,
        server_callback_url: serverCallbackUrl,
        // Enable Open Banking (OPB) per Flitt docs when creating token
        // This lets checkout/token create an open banking payment
        payment_systems: 'opb',
        // For testing you can force demo bank: 'x'. For real banks: 'tbc', 'bog', 'liberty', 'credo'
        // payment_method: 'x',
      };

      const signature = this.generateFlittSignature(requestParams);
      requestParams.signature = signature;

      const requestBody = { request: requestParams };

      let response: any = null;
      try {
        console.log(`Calling Flitt API: ${this.flittBaseUrl}/api/checkout/token/ (body wrapped in "request")`);
        response = await axios.post(
          `${this.flittBaseUrl}/api/checkout/token/`,
          requestBody,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          }
        );
        if (response && response.data) {
          console.log(`✅ Flitt API responded successfully`);
        }
      } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.warn(`❌ Flitt API request failed:`, { status, error: errorData || error.message });
        throw error;
      }

      if (!response || !response.data) {
        console.error('❌ Flitt API did not return data');
        throw new InternalServerErrorException('Flitt API did not return data');
      }

      // Flitt API wraps success/error in a "response" object: { response: { token?, response_status, error_message? } }
      const flittResponse = response.data.response ?? response.data;
      const responseStatus = flittResponse?.response_status ?? flittResponse?.status;

      if (responseStatus === 'failure') {
        const errorMessage = flittResponse?.error_message ?? flittResponse?.error ?? 'Flitt API returned failure';
        const errorCode = flittResponse?.error_code;
        console.warn('Flitt API failure:', { errorMessage, errorCode, flittResponse });
        throw new BadRequestException(errorMessage);
      }

      // Token can be at response.response.token (official format) or response.token
      const token = flittResponse?.token ?? response.data.token;
      const paymentUrl = flittResponse?.payment_url ?? response.data.payment_url;

      if (token) {
        return {
          token,
          orderId: dto.orderId,
          ...(paymentUrl && { paymentUrl }),
        };
      }

      console.error('Flitt API response missing token. Full response:', JSON.stringify(response.data));
      throw new InternalServerErrorException('Failed to create payment token');
    } catch (error: any) {
      console.error('Failed to create Flitt payment token:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        flittBaseUrl: this.flittBaseUrl,
        hasMerchantId: !!this.flittMerchantId,
        hasPaymentKey: !!this.flittPaymentKey,
        hasCreditKey: !!this.flittCreditPrivateKey,
      });

      // Re-throw our own HTTP exceptions (e.g. BadRequest, InternalServer) as-is
      if (error instanceof HttpException) {
        throw error;
      }

      // Axios error with Flitt response body
      if (error.response?.data) {
        const data = error.response.data;
        const flittResp = data?.response ?? data;
        const errorMessage =
          data?.message ??
          flittResp?.error_message ??
          (typeof data?.error === 'string' ? data.error : null) ??
          (typeof flittResp?.error === 'string' ? flittResp.error : null) ??
          (error.response?.status != null ? `Flitt API error: ${error.response.status}` : null) ??
          error.message;
        if (errorMessage) {
          throw new BadRequestException(errorMessage);
        }
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new InternalServerErrorException(
          `Cannot connect to Flitt API at ${this.flittBaseUrl}. Please check FLITT_BASE_URL configuration.`
        );
      }
      
      throw new InternalServerErrorException(
        error.message || 'Failed to create payment token. Please check Flitt credentials and API configuration.'
      );
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(dto: VerifyPaymentDto) {
    try {
      if (dto.paymentMethod !== PaymentMethod.FLITT && 
          dto.paymentMethod !== PaymentMethod.GOOGLE_PAY && 
          dto.paymentMethod !== PaymentMethod.APPLE_PAY) {
        throw new BadRequestException(`Payment method ${dto.paymentMethod} is not yet supported`);
      }

      // Try to use Flitt SDK if available
      const sdk = this.getFlittSDK();
      
      if (sdk) {
        try {
          // Use Flitt SDK to get order status
          const status = await sdk.getOrderStatus(dto.transactionId);
          
          if (status) {
            const isSuccess = status.status === 'approved' || status.status === 'success' || status.status === 'completed';
            return {
              status: isSuccess ? 'completed' : status.status,
              transactionId: dto.transactionId,
              orderId: status.orderId,
              amount: status.amount ? status.amount / 100 : null,
            };
          }
        } catch (sdkError: any) {
          console.warn('Flitt SDK method failed, falling back to direct API:', sdkError.message);
        }
      }

      // Fallback to direct API call
      // Try different endpoint patterns
      const statusEndpoints = [
        `${this.flittBaseUrl}/api/payment/status/${dto.transactionId}`,
        `${this.flittBaseUrl}/payment/status/${dto.transactionId}`,
        `${this.flittBaseUrl}/api/v1/payment/status/${dto.transactionId}`,
      ];
      
      let response: any = null;
      let lastError: any = null;
      
      for (const endpoint of statusEndpoints) {
        try {
          console.log(`Trying Flitt status endpoint: ${endpoint}`);
          response = await axios.get(
            endpoint,
            {
              headers: {
                'Authorization': `Bearer ${this.flittPaymentKey}`,
              },
              timeout: 10000,
            }
          );
          
          if (response && response.data) {
            console.log(`✅ Successfully connected to Flitt status API at: ${endpoint}`);
            break;
          }
        } catch (error: any) {
          lastError = error;
          console.warn(`❌ Failed to connect to ${endpoint}:`, error.response?.status || error.message);
          continue;
        }
      }
      
      if (!response || !response.data) {
        throw lastError || new InternalServerErrorException('All Flitt status API endpoints failed');
      }

      const status = response.data.status;
      const isSuccess = status === 'approved' || status === 'success' || status === 'completed';

      return {
        status: isSuccess ? 'completed' : status,
        transactionId: dto.transactionId,
        orderId: response.data.order_id,
        amount: response.data.amount ? response.data.amount / 100 : null,
      };
    } catch (error: any) {
      console.error('Failed to verify payment:', error);
      
      if (error.response) {
        throw new BadRequestException(
          error.response.data?.message || 'Failed to verify payment'
        );
      }
      
      throw new InternalServerErrorException('Failed to verify payment');
    }
  }

  /**
   * Verify webhook signature from x-signature header (HMAC-SHA256 of raw body).
   * Use this when Flitt sends signature in header; never trust webhook without verification.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    if (!this.flittWebhookSecret || !signature) {
      return false;
    }
    const crypto = require('crypto');
    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const expected = crypto
      .createHmac('sha256', this.flittWebhookSecret)
      .update(payload)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  }

  /**
   * Handle Flitt payment callback/webhook (body already parsed).
   * For HMAC verification use handleFlittWebhookWithSignature(rawBody, signature) instead.
   */
  async handleFlittCallback(callbackData: any) {
    try {
      // Legacy: verify signature from body (when Flitt sends signature in payload)
      const isValid = this.verifyFlittSignature(callbackData);
      
      if (!isValid) {
        throw new BadRequestException('Invalid signature');
      }

      // Process callback data
      const status = callbackData.status || callbackData.order_status;
      const orderId = callbackData.order_id;
      const transactionId = callbackData.transaction_id || callbackData.order_id;

      const isSuccess =
        status === 'approved' || status === 'success' || status === 'completed' || status === 'paid';
      if (isSuccess && orderId) {
        await this.ordersService.setOrderPaid(String(orderId));
      }

      return {
        success: true,
        status,
        orderId,
        transactionId,
        amount: callbackData.amount ? callbackData.amount / 100 : null,
      };
    } catch (error: any) {
      console.error('Failed to handle Flitt callback:', error);
      throw error;
    }
  }

  /**
   * Process webhook payload after HMAC verification (x-signature).
   * Updates order to paid when status indicates success.
   */
  async processWebhookBody(body: any): Promise<{ success: true; status?: string; orderId?: string }> {
    const status = body.status || body.order_status;
    const orderId = body.order_id;
    const isSuccess =
      status === 'approved' || status === 'success' || status === 'completed' || status === 'paid' || status === 'SUCCESS';
    if (isSuccess && orderId) {
      await this.ordersService.setOrderPaid(String(orderId));
    }
    return { success: true, status, orderId };
  }

  /**
   * Generate signature for Flitt API request.
   * Per Flitt docs/support for checkout/token:
   *   secretKey|amount|currency|merchant_id|order_desc|order_id|server_callback_url
   */
  private generateFlittSignature(params: Record<string, string | number | undefined>): string {
    const crypto = require('crypto');
    const keysInOrder = [
      'amount',
      'currency',
      'merchant_id',
      'order_desc',
      'order_id',
      'server_callback_url',
    ] as const;

    const values: string[] = [];
    for (const k of keysInOrder) {
      const v = params[k];
      if (v === undefined || v === null || v === '') continue;
      values.push(String(v));
    }

    const tail = values.join('|');
    const signString = this.flittSecretKey + '|' + tail;
    const hash = crypto.createHash('sha1').update(signString, 'utf8').digest('hex');

    const secretLen = this.flittSecretKey.length;
    console.log('Flitt sign:', {
      paramKeys: keysInOrder.filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== ''),
      secretLen,
      signTail: tail,
    });
    if (secretLen === 4 && this.flittMerchantId !== '1549901') {
      console.warn(
        "⚠️ Flitt: secretLen=4 means secret is 'test'. Set FLITT_PAYMENT_KEY or FLITT_CREDIT_PRIVATE_KEY (32 chars)."
      );
    }
    return hash;
  }

  /**
   * Verify Flitt callback signature
   */
  private verifyFlittSignature(data: any): boolean {
    try {
      const receivedSignature = data.signature;
      if (!receivedSignature) {
        return false;
      }

      // Create data copy without signature
      const dataCopy = { ...data };
      delete dataCopy.signature;

      // Generate expected signature
      const expectedSignature = this.generateFlittSignature(dataCopy);

      // Compare signatures
      return receivedSignature === expectedSignature;
    } catch (error) {
      console.error('Error verifying Flitt signature:', error);
      return false;
    }
  }
}
