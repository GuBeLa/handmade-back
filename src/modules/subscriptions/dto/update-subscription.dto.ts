import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSubscriptionDto {
  @ApiProperty({ 
    description: 'Subscription status',
    enum: ['active', 'cancelled', 'expired', 'pending', 'past_due'],
    required: false
  })
  @IsEnum(['active', 'cancelled', 'expired', 'pending', 'past_due'])
  @IsOptional()
  status?: 'active' | 'cancelled' | 'expired' | 'pending' | 'past_due';

  @ApiProperty({ 
    description: 'Auto-renew subscription',
    required: false
  })
  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;
}
