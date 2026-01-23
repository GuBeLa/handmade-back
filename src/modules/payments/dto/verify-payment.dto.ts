import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Transaction ID', example: 'flitt_123456789' })
  @IsString()
  transactionId: string;

  @ApiProperty({ 
    description: 'Payment method', 
    enum: PaymentMethod,
    example: PaymentMethod.FLITT 
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
