import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Req,
  Headers,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { RawBodyRequest } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreatePaymentTokenDto } from './dto/create-payment-token.dto';
import { CreateHostedCheckoutDto } from './dto/create-hosted-checkout.dto';
import { CreateBogCheckoutDto } from './dto/create-bog-checkout.dto';
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

  @Post('bog/create-checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create BOG card payment session; returns redirectUrl' })
  async createBogCheckout(@Request() req, @Body() dto: CreateBogCheckoutDto) {
    return this.paymentsService.createBogCheckoutSession(
      dto.orderId,
      dto.successUrl,
      dto.failUrl,
    );
  }

  @Post('bog/callback')
  @ApiOperation({ summary: 'BOG payment callback (server-to-server)' })
  async handleBogCallback(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('Callback-Signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? (req.body ? Buffer.from(JSON.stringify(req.body), 'utf8') : null);
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }
    return this.paymentsService.handleBogCallback(rawBody, signature || '');
  }
}
