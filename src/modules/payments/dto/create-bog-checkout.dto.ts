import { IsString, IsUrl, IsOptional, IsNumber, Min } from 'class-validator';
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

  @ApiProperty({ required: false, description: 'Fixed amount in GEL (e.g. 5 for reservation fee). If omitted, order total is used.' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amountInGel?: number;
}
