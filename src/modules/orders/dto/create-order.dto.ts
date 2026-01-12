import {
  IsArray,
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  ArrayMinSize,
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

  @ApiProperty()
  @IsString()
  deliveryAddress: string;

  @ApiProperty()
  @IsString()
  deliveryRegion: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deliveryCity?: string;

  @ApiProperty()
  @IsString()
  deliveryPhone: string;

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
}

