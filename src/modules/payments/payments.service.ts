import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreatePaymentTokenDto } from './dto/create-payment-token.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentMethod } from '../../common/enums/payment-method.enum';

@Injectable()
export class PaymentsService {
  private readonly flittMerchantId: string;
  private readonly flittPaymentKey: string;
  private readonly flittCreditPrivateKey: string;
  private readonly flittBaseUrl: string;
  private readonly flittTestMode: boolean;

  constructor(private configService: ConfigService) {
    this.flittMerchantId = this.configService.get<string>('FLITT_MERCHANT_ID') || '';
    this.flittPaymentKey = this.configService.get<string>('FLITT_PAYMENT_KEY') || '';
    this.flittCreditPrivateKey = this.configService.get<string>('FLITT_CREDIT_PRIVATE_KEY') || '';
    this.flittBaseUrl = this.configService.get<string>('FLITT_BASE_URL') || 'https://api.flitt.ge';
    this.flittTestMode = this.configService.get<string>('FLITT_TEST_MODE') === 'true';
  }

  /**
   * Create payment token for Flitt SDK
   * This token is used by mobile app to process payment
   */
  async createPaymentToken(dto: CreatePaymentTokenDto) {
    try {
      // Only Flitt payment method is supported for now
      if (dto.paymentMethod !== PaymentMethod.FLITT) {
        throw new BadRequestException(`Payment method ${dto.paymentMethod} is not yet supported`);
      }

      // Convert amount to tetri (smallest currency unit for GEL)
      const amountInTetri = Math.round(dto.amount * 100);

      // Get API base URL for callback
      // Use the full backend URL for callback
      const port = this.configService.get<string>('PORT') || '3005';
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? this.configService.get<string>('API_BASE_URL') || `https://api.handmade-marketplace.ge/api`
        : `http://localhost:${port}/api`;

      // Create payment order using Flitt API
      // According to Flitt documentation, we need to create an order and get a token
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
      // Flitt uses signature for request verification
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
      
      if (error.response) {
        throw new BadRequestException(
          error.response.data?.message || 'Failed to create payment token'
        );
      }
      
      throw new InternalServerErrorException('Failed to create payment token');
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(dto: VerifyPaymentDto) {
    try {
      if (dto.paymentMethod !== PaymentMethod.FLITT) {
        throw new BadRequestException(`Payment method ${dto.paymentMethod} is not yet supported`);
      }

      // Get order status from Flitt API
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
   */
  private generateFlittSignature(data: any): string {
    const crypto = require('crypto');
    
    // Sort keys and create signature string
    const sortedKeys = Object.keys(data).sort();
    const signatureString = sortedKeys
      .map(key => `${key}=${data[key]}`)
      .join('&');
    
    // Generate HMAC-SHA256 signature
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
