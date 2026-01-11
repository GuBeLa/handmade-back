import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplyReviewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reply: string;
}
