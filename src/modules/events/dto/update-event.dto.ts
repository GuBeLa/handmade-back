import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ minLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(200, { message: 'აღწერა უნდა იყოს მინიმუმ 200 სიმბოლო' })
  descriptionKa?: string;

  @ApiPropertyOptional({ minLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(200, { message: 'აღწერა ინგლისურად მინ. 200 სიმბოლო' })
  descriptionEn?: string;
}
