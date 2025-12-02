import { IsString, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifySmsDto {
  @ApiProperty()
  @IsPhoneNumber('GE')
  phone: string;

  @ApiProperty()
  @IsString()
  code: string;
}

