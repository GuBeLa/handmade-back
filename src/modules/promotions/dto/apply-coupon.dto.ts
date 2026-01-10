import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @Min(0)
  subtotal: number; // Cart subtotal to validate against minPurchase
}
