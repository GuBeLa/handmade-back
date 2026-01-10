import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNotEmpty()
  quantity: number;
}

export class CreateReturnDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @IsEnum(['defective', 'wrong_product', 'size_doesnt_fit', 'color_mismatch', 'other'])
  reason: 'defective' | 'wrong_product' | 'size_doesnt_fit' | 'color_mismatch' | 'other';

  @IsOptional()
  @IsString()
  description?: string;
}
