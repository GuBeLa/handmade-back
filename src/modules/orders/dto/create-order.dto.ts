import {
  IsArray,
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';
import { DeliveryMethod } from '../../../common/enums/delivery-method.enum';

export class OrderItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  variantSize?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  variantColor?: string;
}

/** Nested delivery address; when provided, deliveryAddress/deliveryRegion/deliveryPhone are derived from it */
export class DeliveryAddressDetailsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty()
  @IsString()
  street: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  region: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ required: false, description: 'Ignored here; use top-level paymentMethod' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ enum: DeliveryMethod })
  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  /** Full address string. Optional if deliveryAddressDetails is provided. */
  @ApiProperty({ required: false })
  @ValidateIf((o) => !o.deliveryAddressDetails)
  @IsString()
  deliveryAddress?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => !o.deliveryAddressDetails)
  @IsString()
  deliveryRegion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deliveryCity?: string;

  /** Phone for delivery. Optional if deliveryAddressDetails is provided. */
  @ApiProperty({ required: false })
  @ValidateIf((o) => !o.deliveryAddressDetails)
  @IsString()
  deliveryPhone?: string;

  /** Nested address; when set, deliveryAddress/deliveryRegion/deliveryPhone are built from this */
  @ApiProperty({ required: false, type: () => DeliveryAddressDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDetailsDto)
  deliveryAddressDetails?: DeliveryAddressDetailsDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deliveryNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deliveryRegionId?: string; // Region ID for pricing calculation

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deliveryCityId?: string; // City ID for pricing calculation

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  isRural?: boolean; // Whether delivery is to a rural area/village

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  freeShipping?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pickupLocation?: string; // Pickup location if deliveryMethod is PICKUP

  @ApiProperty({ required: false, description: 'Loyalty points to redeem for this order' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyPointsToRedeem?: number;
}

