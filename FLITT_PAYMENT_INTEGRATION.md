# Flitt Payment Integration - Backend

ეს დოკუმენტაცია აღწერს როგორ უნდა ინტეგრირებული იყოს Flitt payment system backend-ში.

## მიმოხილვა

Flitt SDK-ს მიხედვით, payment flow ასეთია:
1. **Backend**: შექმნის payment token Flitt backend SDK-ს გამოყენებით
2. **Frontend**: მიიღებს token-ს და გამოიყენებს Flitt mobile SDK-ს payment-ის დასამუშავებლად
3. **Flitt SDK**: ამუშავებს payment-ს (card, Google Pay, Apple Pay) და აბრუნებს შედეგს

## Backend SDK ინსტალაცია

### Node.js

```bash
npm install @flittpayments/nodejs
```

ან

```bash
npm install flitt-nodejs-sdk
```

დოკუმენტაცია: https://docs.flitt.com/sdk-and-mobile/sdk/backend/node-js/

## Environment Variables

დაამატეთ შემდეგი ცვლადები `.env` ფაილში:

```env
FLITT_MERCHANT_ID=your-merchant-id
FLITT_SECRET_KEY=your-secret-key
FLITT_API_KEY=your-api-key
FLITT_TEST_MODE=true
```

## Payment Token Creation Endpoint

შექმენით endpoint payment token-ის შესაქმნელად:

### Route: `POST /api/payments/create-token`

**Request Body:**
```json
{
  "amount": 100.00,
  "orderId": "order_123",
  "description": "Order order_123",
  "currency": "GEL",
  "paymentMethod": "flitt" | "google_pay" | "apple_pay",
  "customerPhone": "+995123456789",
  "customerEmail": "customer@example.com"
}
```

**Response:**
```json
{
  "token": "payment_token_from_flitt",
  "orderId": "order_123"
}
```

### Implementation Example (NestJS)

```typescript
// payments.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-token')
  async createPaymentToken(@Body() createTokenDto: {
    amount: number;
    orderId: string;
    description: string;
    currency: string;
    paymentMethod: string;
    customerPhone?: string;
    customerEmail?: string;
  }) {
    return this.paymentsService.createPaymentToken(createTokenDto);
  }

  @Post('verify')
  async verifyPayment(@Body() verifyDto: {
    transactionId: string;
    paymentMethod: string;
  }) {
    return this.paymentsService.verifyPayment(verifyDto);
  }
}
```

```typescript
// payments.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Import Flitt SDK
// import { FlittSDK } from '@flittpayments/nodejs';
// or
// import FlittSDK from 'flitt-nodejs-sdk';

@Injectable()
export class PaymentsService {
  private flittSDK: any;

  constructor(private configService: ConfigService) {
    // Initialize Flitt SDK
    const merchantId = this.configService.get<string>('FLITT_MERCHANT_ID');
    const secretKey = this.configService.get<string>('FLITT_SECRET_KEY');
    const isTestMode = this.configService.get<string>('FLITT_TEST_MODE') === 'true';

    // Initialize Flitt SDK
    // this.flittSDK = new FlittSDK({
    //   merchantId,
    //   secretKey,
    //   testMode: isTestMode,
    // });
  }

  async createPaymentToken(dto: {
    amount: number;
    orderId: string;
    description: string;
    currency: string;
    paymentMethod: string;
    customerPhone?: string;
    customerEmail?: string;
  }) {
    try {
      // Convert amount to smallest currency unit (tetri for GEL)
      const amountInTetri = Math.round(dto.amount * 100);

      // Create payment order using Flitt backend SDK
      // Example:
      /*
      const order = await this.flittSDK.createOrder({
        amount: amountInTetri,
        currency: dto.currency.toUpperCase(),
        orderId: dto.orderId,
        description: dto.description,
        callbackUrl: `${this.configService.get('API_BASE_URL')}/payments/flitt/callback`,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
      });

      return {
        token: order.token,
        orderId: dto.orderId,
      };
      */

      // Placeholder - replace with actual Flitt SDK call
      return {
        token: `flitt_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        orderId: dto.orderId,
      };
    } catch (error) {
      console.error('Failed to create Flitt payment token:', error);
      throw new Error('Failed to create payment token');
    }
  }

  async verifyPayment(dto: {
    transactionId: string;
    paymentMethod: string;
  }) {
    try {
      // Verify payment status using Flitt SDK
      // Example:
      /*
      const status = await this.flittSDK.getOrderStatus(dto.transactionId);
      
      return {
        status: status.status, // 'approved', 'declined', 'processing', etc.
        transactionId: dto.transactionId,
      };
      */

      // Placeholder - replace with actual Flitt SDK call
      return {
        status: 'approved',
        transactionId: dto.transactionId,
      };
    } catch (error) {
      console.error('Failed to verify payment:', error);
      throw new Error('Failed to verify payment');
    }
  }
}
```

## Payment Callback/Webhook

Flitt გამოაგზავნის callback/webhook payment-ის დასრულების შემდეგ.

### Route: `POST /api/payments/flitt/callback`

```typescript
@Post('flitt/callback')
async handleFlittCallback(@Body() callbackData: any) {
  // Verify signature
  // Update order status
  // Process payment result
}
```

## Flitt Backend SDK Documentation

- Node.js: https://docs.flitt.com/sdk-and-mobile/sdk/backend/node-js/
- Python: https://docs.flitt.com/sdk-and-mobile/sdk/backend/python/
- PHP: https://docs.flitt.com/sdk-and-mobile/sdk/backend/php/
- C#: https://docs.flitt.com/sdk-and-mobile/sdk/backend/c-sharp/

## Testing

Flitt-ს აქვს test mode. გამოიყენეთ test credentials test mode-ში:
- Set `FLITT_TEST_MODE=true` in `.env`
- Use test merchant ID and keys

## Production

Production-ში:
- Set `FLITT_TEST_MODE=false`
- Use production merchant ID and keys
- Ensure callback/webhook URLs are accessible from Flitt servers
