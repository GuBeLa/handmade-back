import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateRedeemDto {
  @ApiProperty({ description: 'Points to redeem' })
  @IsNumber()
  @Min(0)
  pointsToRedeem: number;

  @ApiProperty({ description: 'Order subtotal in GEL' })
  @IsNumber()
  @Min(0)
  orderSubtotal: number;
}
