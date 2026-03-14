import { IsString, IsOptional, IsNumber, IsUrl, IsEmail, IsArray, IsBoolean, ValidateNested, Allow } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ContractRequisitesDto } from './contract-requisites.dto';

export class UpdateSellerProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopName?: string;

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
  profilePicture?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverPhoto?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  region?: string;

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
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

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

  @ApiProperty({ required: false })
  @IsOptional()
  workingHours?: any;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  /** IBAN for BOG split payments (GEL). Required for receiving split payouts. Max 25 chars in description. */
  @ApiProperty({ required: false, description: 'IBAN for receiving payments (e.g. GE00BG0000000000000000)' })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentDetails?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deliveryPolicy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  returnPolicy?: string;

  /** რეკვიზიტები ხელშეკრულებისთვის – ინახება ცალკე, გამოიყენება მასტერკლასების შექმნისას */
  @Allow()
  @ApiProperty({ required: false, type: ContractRequisitesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContractRequisitesDto)
  contractRequisites?: ContractRequisitesDto;
}

