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

@Injectable()
export class PaymentsService {
  private readonly flittMerchantId: string;
  private readonly flittPaymentKey: string;
  private readonly flittCreditPrivateKey: string;
  /** Secret key for request signature (Flitt "payment secret key" from Technical Settings). Use FLITT_SECRET_KEY or FLITT_CREDIT_PRIVATE_KEY. */
  private readonly flittSignatureSecret: string;
  private readonly flittBaseUrl: string;
  private readonly flittTestMode: boolean;
  private flittSDKInstance: any = null;

  constructor(private configService: ConfigService) {
    this.flittMerchantId = this.configService.get<string>('FLITT_MERCHANT_ID') || '';
    this.flittPaymentKey = this.configService.get<string>('FLITT_PAYMENT_KEY') || '';
    this.flittCreditPrivateKey = this.configService.get<string>('FLITT_CREDIT_PRIVATE_KEY') || '';
    // Signature: use FLITT_SECRET_KEY (Flitt portal "Secret key" / "test secret key for purchases") if set, else FLITT_CREDIT_PRIVATE_KEY
    const secretKey = this.configService.get<string>('FLITT_SECRET_KEY') || this.flittCreditPrivateKey;
    this.flittSignatureSecret = (secretKey || '').trim();
    this.flittBaseUrl = this.configService.get<string>('FLITT_BASE_URL') || 'https://pay.flitt.com';
    this.flittTestMode = this.configService.get<string>('FLITT_TEST_MODE') === 'true';

    if (!this.flittMerchantId || !this.flittPaymentKey || !this.flittCreditPrivateKey) {
      console.warn('⚠️ Flitt credentials not fully configured. Please check environment variables.');
    } else {
      console.log('✅ Flitt Payment Service initialized:', {
        merchantId: this.flittMerchantId.substring(0, 4) + '...',
        baseUrl: this.flittBaseUrl,
        testMode: this.flittTestMode,
        signatureKeySource: this.configService.get<string>('FLITT_SECRET_KEY') ? 'FLITT_SECRET_KEY' : 'FLITT_CREDIT_PRIVATE_KEY',
      });
    }
  }

  /**
   * Get Flitt SDK instance
   */
  private getFlittSDK(): any {
    if (!this.flittSDKInstance) {
      const SDK = loadFlittSDK();
      if (SDK) {
        try {
          console.log('Initializing Flitt Node.js SDK...');
          // Initialize Flitt SDK with credentials
          // According to Flitt Node.js SDK documentation
          // Try different initialization patterns based on SDK structure
          let initialized = false;
          
          if (typeof SDK === 'function') {
            this.flittSDKInstance = new SDK({
              merchantId: this.flittMerchantId,
              secretKey: this.flittCreditPrivateKey,
              apiKey: this.flittPaymentKey,
              testMode: this.flittTestMode,
            });
            initialized = true;
          } else if (SDK.default && typeof SDK.default === 'function') {
            this.flittSDKInstance = new SDK.default({
              merchantId: this.flittMerchantId,
              secretKey: this.flittCreditPrivateKey,
              apiKey: this.flittPaymentKey,
              testMode: this.flittTestMode,
            });
            initialized = true;
          } else if (SDK.FlittSDK && typeof SDK.FlittSDK === 'function') {
            this.flittSDKInstance = new SDK.FlittSDK({
              merchantId: this.flittMerchantId,
              secretKey: this.flittCreditPrivateKey,
              apiKey: this.flittPaymentKey,
              testMode: this.flittTestMode,
            });
            initialized = true;
          } else if (SDK.createOrder || SDK.getOrderStatus) {
            // SDK might be an object with methods, use it directly
            this.flittSDKInstance = SDK;
            initialized = true;
          }
          
          if (initialized) {
            console.log('✅ Flitt Node.js SDK initialized successfully');
          } else {
            console.warn('⚠️ Flitt SDK structure unknown, will use direct API calls');
            return null;
          }
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

      // Try to use Flitt Node.js SDK if available
      const sdk = this.getFlittSDK();
      
      if (sdk) {
        try {
          // Use Flitt SDK to create payment token
          // According to Flitt Node.js SDK documentation
          const orderData = {
            amount: amountInTetri,
            currency: dto.currency.toUpperCase(),
            orderId: dto.orderId,
            description: dto.description,
            callbackUrl: `${apiBaseUrl}/payments/flitt/callback`,
            ...(dto.customerPhone && { customerPhone: dto.customerPhone }),
            ...(dto.customerEmail && { customerEmail: dto.customerEmail }),
          };

          // Create order using Flitt SDK
          const result = await sdk.createOrder(orderData);
          
          if (result && result.token) {
            return {
              token: result.token,
              orderId: dto.orderId,
              paymentUrl: result.paymentUrl,
            };
          }
        } catch (sdkError: any) {
          console.warn('Flitt SDK method failed, falling back to direct API:', sdkError.message);
        }
      }

      // Fallback to direct API call if SDK is not available or fails
      // Flitt API requires: 1) body wrapped in "request", 2) signature = SHA1(secret|param1|param2|...) with params in alphabetic order
      // Docs: https://docs.flitt.com/api/request and https://docs.flitt.com/api/building-signature
      const merchantIdNum = parseInt(this.flittMerchantId, 10);
      if (isNaN(merchantIdNum)) {
        throw new BadRequestException('Invalid FLITT_MERCHANT_ID: must be a number');
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
        requestParams.customer_email = dto.customerEmail;
      }

      const signature = this.generateFlittSignature(requestParams);
      requestParams.signature = signature;

      // Flitt expects root element "request" (docs: https://docs.flitt.com/api/request)
      const requestBody = { request: requestParams };

      let response: any = null;
      try {
        console.log(`Calling Flitt API: ${this.flittBaseUrl}/api/checkout/token (body wrapped in "request")`);
        response = await axios.post(
          `${this.flittBaseUrl}/api/checkout/token`,
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
   * Generate signature for Flitt API request
   * Flitt uses SHA1(secret_key|param1|param2|...) with params in alphabetic order, empty excluded.
   * Secret = "payment secret key" from Flitt Technical Settings (test: "test"). Docs: https://docs.flitt.com/api/building-signature
   */
  private generateFlittSignature(params: Record<string, string | number>): string {
    const crypto = require('crypto');
    const secretKey = this.flittSignatureSecret;

    const sortedKeys = Object.keys(params).filter(k => k !== 'signature').sort();
    const parts: string[] = [secretKey];
    for (const key of sortedKeys) {
      const v = params[key];
      // Include 0; exclude only empty string, null, undefined (per Flitt: "parameter with value 0 is not null")
      if (v !== '' && v !== undefined && v !== null) {
        parts.push(String(v));
      }
    }
    const signatureString = parts.join('|');
    if (this.flittTestMode) {
      console.log('Flitt signature params (keys):', sortedKeys.join(', '));
    }
    const hash = crypto.createHash('sha1').update(signatureString, 'utf8').digest('hex');
    return hash.toLowerCase();
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
