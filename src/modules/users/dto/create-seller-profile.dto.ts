import { IsString, IsOptional, IsNumber, IsUrl, IsEmail, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ContractRequisitesDto } from './contract-requisites.dto';

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

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @ApiProperty()
  @IsString()
  paymentDetails: string;

  @ApiProperty()
  @IsString()
  deliveryPolicy: string;

  @ApiProperty()
  @IsString()
  returnPolicy: string;

  // Georgian ID numbers for business registration (required for verification)
  @ApiProperty()
  @IsString()
  personalId: string; // პირადი ნომერი (Personal ID)

  @ApiProperty()
  @IsString()
  identificationNumber: string; // საიდენტიფიკაციო ნომერი (საიდენტიფიკაციო N)

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessName?: string; // ბიზნესის სახელწოდება (თუ არის)

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  taxNumber?: string; // საგადასახადო ნომერი (თუ არის)

  /** IBAN for BOG split payments (GEL). Required for receiving split payouts. */
  @ApiProperty({ required: false, description: 'IBAN for receiving payments (e.g. GE00BG0000000000000000)' })
  @IsOptional()
  @IsString()
  iban?: string;

  /** რეკვიზიტები ხელშეკრულებისთვის – ინახება ცალკე, გამოიყენება ღონისძიებების შექმნისას */
  @ApiProperty({ required: false, type: ContractRequisitesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContractRequisitesDto)
  contractRequisites?: ContractRequisitesDto;
}

