import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUrl,
  Min,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProductVariantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sku?: string;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  titleEn?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  material?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  weight?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dimensions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  careInstructions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  careInstructionsEn?: string;

  @ApiProperty({ type: [String], minItems: 5 })
  @IsArray()
  @ArrayMinSize(5)
  @IsUrl({}, { each: true })
  images: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiProperty({ type: [ProductVariantDto], required: false })
  @IsOptional()
  @IsArray()
  variants?: ProductVariantDto[];
}

