import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';

export class CreatePaymentTokenDto {
  @ApiProperty({ description: 'Payment amount in GEL', example: 100.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Order ID', example: 'order_123' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Payment description', example: 'Order order_123' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Currency code', example: 'GEL' })
  @IsString()
  currency: string;

  @ApiProperty({ 
    description: 'Payment method', 
    enum: PaymentMethod,
    example: PaymentMethod.FLITT 
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Customer phone number', example: '+995123456789' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Customer email', example: 'customer@example.com' })
  @IsOptional()
  @IsString()
  customerEmail?: string;
}
