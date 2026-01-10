import { IsString, IsNotEmpty } from 'class-validator';

export class AddResponseDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}
