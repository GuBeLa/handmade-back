import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  ORDER = 'order',
  MESSAGE = 'message',
  REVIEW = 'review',
  REVIEW_REPLY = 'review_reply',
  PRODUCT = 'product',
  PROMOTION = 'promotion',
  WISHLIST = 'wishlist',
  PRICE_DROP = 'price_drop',
  RETURN = 'return',
  SUBSCRIPTION_ACTIVATED = 'subscription_activated',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  FOLLOW = 'follow',
  SYSTEM = 'system',
}

export class CreateNotificationDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType | string; // Allow string for backward compatibility

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  titleKa?: string; // Georgian title

  @ApiProperty()
  @IsString()
  message: string;

  @ApiProperty()
  @IsString()
  messageKa?: string; // Georgian message

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>; // Deep linking data

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sound?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  priority?: 'default' | 'normal' | 'high';
}

