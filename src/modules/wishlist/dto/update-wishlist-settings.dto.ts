import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWishlistSettingsDto {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  giftRegistryEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  giftRegistryMessage?: string;
}
