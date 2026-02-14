import { IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHostedCheckoutDto {
  @ApiProperty({ description: 'Payment amount in GEL', example: 50 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Order ID (from created order)', example: 'ORD-123' })
  @IsString()
  orderId: string;
}
