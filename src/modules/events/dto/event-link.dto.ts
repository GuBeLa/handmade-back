import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EventLinkDto {
  @ApiProperty({ example: 'არტისტის ფეისბუქი' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 'https://facebook.com/artist' })
  @IsString()
  @IsUrl()
  url: string;
}
