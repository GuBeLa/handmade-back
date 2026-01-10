import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsEnum(['open', 'in_progress', 'resolved', 'closed'])
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
