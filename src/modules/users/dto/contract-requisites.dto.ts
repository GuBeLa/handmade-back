import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Contract requisites for events (stored on seller profile, used when creating events). */
export class ContractRequisitesDto {
  @ApiPropertyOptional({ description: 'ორგანიზაციის/პირის დასახელება' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'საიდენტიფიკაციო კოდი' })
  @IsOptional()
  @IsString()
  idCode?: string;

  @ApiPropertyOptional({ description: 'ორგანიზაციული ერთეული' })
  @IsOptional()
  @IsString()
  organizationalUnit?: string;

  @ApiPropertyOptional({ description: 'დირექტორის სახელი/გვარი' })
  @IsOptional()
  @IsString()
  directorName?: string;

  @ApiPropertyOptional({ description: 'ელ.ფოსტა' })
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'საკონტაქტო პირის სახელი/გვარი' })
  @IsOptional()
  @IsString()
  contactPersonName?: string;

  @ApiPropertyOptional({ description: 'საკონტაქტო ნომერი' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'ანგარიშის ნომერი' })
  @IsOptional()
  @IsString()
  accountNumber?: string;
}
