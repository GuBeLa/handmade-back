import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, Max, IsArray, IsDateString, IsBoolean } from 'class-validator';

export enum PromotionType {
  FLASH_SALE = 'flash_sale',
  SEASONAL = 'seasonal',
  CLEARANCE = 'clearance',
  NEW_ARRIVAL = 'new_arrival',
}

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PromotionType)
  @IsNotEmpty()
  type: PromotionType;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  products?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsString()
  @IsOptional()
  bannerImage?: string;

  @IsString()
  @IsOptional()
  bannerText?: string;
}
