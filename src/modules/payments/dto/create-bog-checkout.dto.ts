import { IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBogCheckoutDto {
  @ApiProperty({ description: 'Our order ID (from POST /orders)' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'URL to redirect user after successful payment' })
  @IsString()
  @IsUrl()
  successUrl: string;

  @ApiProperty({ description: 'URL to redirect user after failed payment' })
  @IsString()
  @IsUrl()
  failUrl: string;
}
