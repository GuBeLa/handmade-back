import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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
  private readonly flittBaseUrl: string;
  private readonly flittTestMode: boolean;
  private flittSDKInstance: any = null;

  constructor(private configService: ConfigService) {
    this.flittMerchantId = this.configService.get<string>('FLITT_MERCHANT_ID') || '';
    this.flittPaymentKey = this.configService.get<string>('FLITT_PAYMENT_KEY') || '';
    this.flittCreditPrivateKey = this.configService.get<string>('FLITT_CREDIT_PRIVATE_KEY') || '';
    this.flittBaseUrl = this.configService.get<string>('FLITT_BASE_URL') || 'https://api.flitt.ge';
    this.flittTestMode = this.configService.get<string>('FLITT_TEST_MODE') === 'true';
    
    // Log configuration (without sensitive data)
    if (!this.flittMerchantId || !this.flittPaymentKey || !this.flittCreditPrivateKey) {
      console.warn('⚠️ Flitt credentials not fully configured. Please check environment variables.');
    } else {
      console.log('✅ Flitt Payment Service initialized:', {
        merchantId: this.flittMerchantId.substring(0, 4) + '...',
        baseUrl: this.flittBaseUrl,
        testMode: this.flittTestMode,
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
          // Initialize Flitt SDK with credentials
          // According to Flitt Node.js SDK documentation
          // Try different initialization patterns based on SDK structure
          if (typeof SDK === 'function') {
            this.flittSDKInstance = new SDK({
              merchantId: this.flittMerchantId,
              secretKey: this.flittCreditPrivateKey,
              apiKey: this.flittPaymentKey,
              testMode: this.flittTestMode,
            });
          } else if (SDK.default && typeof SDK.default === 'function') {
            this.flittSDKInstance = new SDK.default({
              merchantId: this.flittMerchantId,
              secretKey: this.flittCreditPrivateKey,
              apiKey: this.flittPaymentKey,
              testMode: this.flittTestMode,
            });
          } else {
            // SDK might be an object with methods, use it directly
            this.flittSDKInstance = SDK;
          }
        } catch (error) {
          console.warn('Failed to initialize Flitt SDK, will use direct API calls:', error);
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
      const orderData = {
        merchant_id: this.flittMerchantId,
        order_id: dto.orderId,
        order_desc: dto.description,
        amount: amountInTetri,
        currency: dto.currency.toUpperCase(),
        callback_url: `${apiBaseUrl}/payments/flitt/callback`,
        ...(dto.customerPhone && { customer_phone: dto.customerPhone }),
        ...(dto.customerEmail && { customer_email: dto.customerEmail }),
      };

      // Generate signature for Flitt API
      const signature = this.generateFlittSignature(orderData);

      // Make API call to Flitt
      const response = await axios.post(
        `${this.flittBaseUrl}/api/v1/payment/create`,
        {
          ...orderData,
          signature,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.flittPaymentKey}`,
          },
        }
      );

      if (response.data && response.data.token) {
        return {
          token: response.data.token,
          orderId: dto.orderId,
          paymentUrl: response.data.payment_url,
        };
      }

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
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 
                            error.response.data?.error || 
                            `Flitt API error: ${error.response.status}`;
        throw new BadRequestException(errorMessage);
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
      const response = await axios.get(
        `${this.flittBaseUrl}/api/v1/payment/status/${dto.transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.flittPaymentKey}`,
          },
        }
      );

      if (response.data) {
        const status = response.data.status;
        const isSuccess = status === 'approved' || status === 'success' || status === 'completed';

        return {
          status: isSuccess ? 'completed' : status,
          transactionId: dto.transactionId,
          orderId: response.data.order_id,
          amount: response.data.amount ? response.data.amount / 100 : null,
        };
      }

      throw new InternalServerErrorException('Failed to verify payment');
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
   * Flitt uses HMAC-SHA256 signature for request verification
   * According to Flitt documentation
   */
  private generateFlittSignature(data: any): string {
    const crypto = require('crypto');
    
    // Sort keys and create signature string
    const sortedKeys = Object.keys(data).sort();
    const signatureString = sortedKeys
      .map(key => `${key}=${data[key]}`)
      .join('&');
    
    // Generate HMAC-SHA256 signature using credit private key
    const signature = crypto
      .createHmac('sha256', this.flittCreditPrivateKey)
      .update(signatureString)
      .digest('hex');
    
    return signature;
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
