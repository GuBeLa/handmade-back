import { IsString, IsNumber, IsOptional, Min, Max, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false, type: [String], description: 'Array of image URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

