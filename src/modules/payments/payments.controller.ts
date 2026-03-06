import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Req,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { RawBodyRequest } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreatePaymentTokenDto } from './dto/create-payment-token.dto';
import { CreateHostedCheckoutDto } from './dto/create-hosted-checkout.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Create Hosted Checkout session – returns checkoutUrl for WebView/redirect.
   * Flow: Backend creates session → Front opens checkoutUrl → Flitt Hosted Checkout (cards, Apple Pay, Google Pay) → Webhook updates order.
   */
  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Hosted Checkout session (returns checkoutUrl)' })
  async createHostedCheckout(@Request() req, @Body() dto: CreateHostedCheckoutDto) {
    return this.paymentsService.createHostedCheckoutSession(dto.amount, dto.orderId);
  }

  @Post('create-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment token for Flitt SDK' })
  async createPaymentToken(@Request() req, @Body() createTokenDto: CreatePaymentTokenDto) {
    return this.paymentsService.createPaymentToken(createTokenDto);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify payment status' })
  async verifyPayment(@Request() req, @Body() verifyDto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(verifyDto);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Flitt payment webhook (HMAC x-signature required)' })
  async webhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      throw new UnauthorizedException('Missing raw body or x-signature');
    }
    const isValid = this.paymentsService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }
    await this.paymentsService.processWebhookBody(req.body);
    return { received: true };
  }

  @Post('flitt/callback')
  @ApiOperation({ summary: 'Flitt payment callback (legacy)' })
  async handleFlittCallback(@Body() callbackData: any) {
    return this.paymentsService.handleFlittCallback(callbackData);
  }
}
