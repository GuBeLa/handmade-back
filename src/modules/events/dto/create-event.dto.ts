import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsUrl,
  IsNumber,
  Min,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventLinkDto } from './event-link.dto';
import { EventContractRequisitesDto } from './event-contract-requisites.dto';

export class CreateEventDto {
  @ApiProperty({ example: 'ღონისძიების სახელი ქართულად' })
  @IsString()
  @IsNotEmpty()
  titleKa: string;

  @ApiPropertyOptional({ example: 'Event name in English' })
  @IsOptional()
  @IsString()
  titleEn?: string;

  @ApiProperty({ description: 'აღწერა ქართულად (მინ. 200 სიმბოლო)', minLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MinLength(200, { message: 'აღწერა უნდა იყოს მინიმუმ 200 სიმბოლო' })
  descriptionKa: string;

  @ApiPropertyOptional({ description: 'აღწერა ინგლისურად (მინ. 200 სიმბოლო თუ მითითებული)' })
  @IsOptional()
  @ValidateIf((o) => o.descriptionEn && o.descriptionEn.length > 0)
  @IsString()
  @MinLength(200, { message: 'აღწერა ინგლისურად უნდა იყოს მინიმუმ 200 სიმბოლო' })
  descriptionEn?: string;

  @ApiPropertyOptional({ description: 'პოსტერის URL 1200x630' })
  @IsOptional()
  @IsString()
  @IsUrl()
  poster1200x630?: string;

  @ApiPropertyOptional({ description: 'ბანერის URL 1800x600' })
  @IsOptional()
  @IsString()
  @IsUrl()
  poster1800x600?: string;

  @ApiProperty({ description: 'კარების გახსნის დრო (ISO 8601)' })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  doorsOpenAt: string;

  @ApiProperty({ description: 'ღონისძიების დაწყების დრო (ISO 8601)' })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  startAt: string;

  @ApiProperty({ description: 'ლოკაცია - Google Maps ლინკი' })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  locationUrl: string;

  @ApiPropertyOptional({
    description: 'ასაკობრივი შეზღუდვა',
    example: { childrenAllowed: true, freeEntryUntilAge: 12 },
  })
  @IsOptional()
  childrenAllowed?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeEntryUntilAge?: number;

  @ApiPropertyOptional({ description: 'დამხმარე ლინკები', type: [EventLinkDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventLinkDto)
  links?: EventLinkDto[];

  @ApiProperty({ description: 'ბილეთის ფასი (₾)' })
  @IsNumber()
  @Min(0)
  ticketPrice: number;

  @ApiProperty({ description: 'ბილეთების რაოდენობა' })
  @IsNumber()
  @Min(1)
  ticketQuantity: number;

  @ApiProperty({ type: EventContractRequisitesDto })
  @ValidateNested()
  @Type(() => EventContractRequisitesDto)
  contractRequisites: EventContractRequisitesDto;

  @ApiPropertyOptional({ description: 'მასტერკლასი' })
  @IsOptional()
  @IsBoolean()
  isMasterclass?: boolean;

  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional()
  @IsString()
  status?: 'draft' | 'published';
}
