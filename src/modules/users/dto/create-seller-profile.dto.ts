import { IsString, IsOptional, IsNumber, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSellerProfileDto {
  @ApiProperty()
  @IsString()
  shopName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverPhoto?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiProperty()
  @IsString()
  region: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  facebookUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;
}

