import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class UpdateReturnStatusDto {
  @IsEnum(['pending', 'approved', 'rejected', 'in_transit', 'refunded', 'cancelled'])
  status: 'pending' | 'approved' | 'rejected' | 'in_transit' | 'refunded' | 'cancelled';

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsNumber()
  refundAmount?: number;
}
