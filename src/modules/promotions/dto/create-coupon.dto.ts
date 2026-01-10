import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, Max, IsArray, IsDateString, IsBoolean } from 'class-validator';

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  FREE_SHIPPING = 'free_shipping',
  BUY_X_GET_Y = 'buy_x_get_y',
}

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(CouponType)
  @IsNotEmpty()
  type: CouponType;

  @IsNumber()
  @Min(0)
  value: number; // Percentage (0-100) or fixed amount

  @IsNumber()
  @Min(0)
  @IsOptional()
  minPurchase?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxDiscount?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @IsDateString()
  @IsNotEmpty()
  validFrom: string;

  @IsDateString()
  @IsNotEmpty()
  validUntil: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  applicableCategories?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  applicableProducts?: string[];

  @IsNumber()
  @Min(1)
  @IsOptional()
  buyXQuantity?: number; // For buy_x_get_y type

  @IsNumber()
  @Min(1)
  @IsOptional()
  getYQuantity?: number; // For buy_x_get_y type

  @IsString()
  @IsOptional()
  description?: string;
}
