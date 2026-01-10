import { IsString, IsNotEmpty, IsOptional, IsEnum, IsIn } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(['order', 'payment', 'delivery', 'return', 'seller', 'account', 'technical', 'other'])
  category: 'order' | 'payment' | 'delivery' | 'return' | 'seller' | 'account' | 'technical' | 'other';

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}
