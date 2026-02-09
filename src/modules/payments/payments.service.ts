import { Injectable, BadRequestException, InternalServerErrorException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePaymentTokenDto } from './dto/create-payment-token.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import axios from 'axios';

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

/** Strip surrounding single/double quotes from env value (e.g. 'test' or "key" from .env/Lambda) */
function stripEnvQuotes(value: string): string {
  const s = (value || '').trim();
  if (s.length >= 2) {
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      return s.slice(1, -1).trim();
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
  private flittSDKInstance: any = null;

  constructor(private configService: ConfigService) {
    this.flittMerchantId = stripEnvQuotes(this.configService.get<string>('FLITT_MERCHANT_ID') || '');
    this.flittPaymentKey = stripEnvQuotes(this.configService.get<string>('FLITT_PAYMENT_KEY') || '');
    this.flittCreditPrivateKey = stripEnvQuotes(this.configService.get<string>('FLITT_CREDIT_PRIVATE_KEY') || '');
    // Checkout/token signature: use Secret key if set; else Credit private key (portal "Credit private key"); else Payment key
    const rawSecret =
      this.configService.get<string>('FLITT_SECRET_KEY') ||
      this.configService.get<string>('FLITT_CREDIT_PRIVATE_KEY') ||
      this.configService.get<string>('FLITT_PAYMENT_KEY') ||
      '';
    this.flittSecretKey = stripEnvQuotes(rawSecret);
    this.flittBaseUrl = (this.configService.get<string>('FLITT_BASE_URL') || 'https://pay.flitt.com').replace(/\/$/, '');

    if (!this.flittMerchantId || !this.flittSecretKey) {
      console.warn(
        '⚠️ Flitt: FLITT_MERCHANT_ID and one of FLITT_SECRET_KEY, FLITT_PAYMENT_KEY, FLITT_CREDIT_PRIVATE_KEY are required for payments.'
      );
    } else {
      if (this.flittMerchantId !== '1549901' && this.flittSecretKey === 'test') {
        console.warn(
          '⚠️ Flitt: Merchant is not 1549901 but FLITT_SECRET_KEY is "test". ' +
            'For your merchant you must set FLITT_SECRET_KEY from Flitt Portal → Technical Settings → Secret key. ' +
            'Otherwise you will get "Invalid signature" (1014).'
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
   * Uses FLITT_MERCHANT_ID and FLITT_SECRET_KEY from env (same as official SDK).
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
        ? this.configService.get<string>('API_BASE_URL') || `https://api.handmade-marketplace.ge/api`
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
          'Flitt credentials not configured. Set FLITT_MERCHANT_ID and FLITT_SECRET_KEY (from Flitt Portal → Technical Settings).'
        );
      }

      const requestParams: Record<string, string | number> = {
        amount: amountInTetri,
        currency: dto.currency.toUpperCase(),
        merchant_id: merchantIdNum,
        order_desc: dto.description,
        order_id: dto.orderId,
        server_callback_url: `${apiBaseUrl}/payments/flitt/callback`,
      };
      if (dto.customerPhone) {
        requestParams.customer_phone = dto.customerPhone;
      }
      if (dto.customerEmail) {
        requestParams.sender_email = dto.customerEmail;
      }

      const signature = this.generateFlittSignature(requestParams);
      requestParams.signature = signature;

      // Flitt expects root element "request" (docs: https://docs.flitt.com/api/request)
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
   * Handle Flitt payment callback/webhook
   */
  async handleFlittCallback(callbackData: any) {
    try {
      // Verify signature
      const isValid = this.verifyFlittSignature(callbackData);
      
      if (!isValid) {
        throw new BadRequestException('Invalid signature');
      }

      // Process callback data
      const status = callbackData.status || callbackData.order_status;
      const orderId = callbackData.order_id;
      const transactionId = callbackData.transaction_id || callbackData.order_id;

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
   * Generate signature for Flitt API request (matches official SDK util.js genSignature exactly)
   * https://github.com/flittpayments/node-js-sdk/blob/main/lib/util.js
   * Sign string: secret + '|' + Object.values(ordered).join('|'), keys sorted, exclude '' and signature keys.
   */
  private generateFlittSignature(params: Record<string, string | number>): string {
    const crypto = require('crypto');
    const ordered: Record<string, string | number> = {};
    Object.keys(params)
      .sort()
      .forEach((key) => {
        if (params[key] !== '' && key !== 'signature' && key !== 'response_signature_string') {
          ordered[key] = params[key];
        }
      });
    const signString = this.flittSecretKey + '|' + Object.values(ordered).join('|');
    const hash = crypto.createHash('sha1').update(signString, 'utf8').digest('hex');
    if (process.env.NODE_ENV !== 'production') {
      console.log('Flitt signature debug:', {
        paramKeys: Object.keys(ordered).sort(),
        signStringLength: signString.length,
        secretLength: this.flittSecretKey.length,
      });
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
