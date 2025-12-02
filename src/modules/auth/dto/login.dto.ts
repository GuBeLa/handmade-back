import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    required: false,
    description: 'Email address or phone number',
    example: 'user@example.com or +995555123456'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ 
    required: false,
    description: 'Email address or phone number',
    example: 'user@example.com or +995555123456'
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty()
  @IsString()
  password: string;
}

