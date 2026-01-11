import { IsEnum, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({ 
    description: 'Subscription plan type',
    enum: ['basic', 'premium', 'business'],
    example: 'premium'
  })
  @IsEnum(['basic', 'premium', 'business'])
  @IsNotEmpty()
  plan: 'basic' | 'premium' | 'business';

  @ApiProperty({ 
    description: 'Billing cycle',
    enum: ['monthly', 'yearly'],
    example: 'monthly',
    default: 'monthly'
  })
  @IsEnum(['monthly', 'yearly'])
  @IsOptional()
  billingCycle?: 'monthly' | 'yearly';

  @ApiProperty({ 
    description: 'Payment method',
    example: 'tbc_pay'
  })
  @IsOptional()
  paymentMethod?: string;

  @ApiProperty({ 
    description: 'Auto-renew subscription',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;
}
