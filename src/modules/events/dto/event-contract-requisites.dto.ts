import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EventContractRequisitesDto {
  @ApiProperty({ description: 'ორგანიზაციის/პირის დასახელება' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'საიდენტიფიკაციო კოდი' })
  @IsString()
  @IsNotEmpty()
  idCode: string;

  @ApiProperty({ description: 'ორგანიზაციული ერთეული' })
  @IsString()
  @IsNotEmpty()
  organizationalUnit: string;

  @ApiProperty({ description: 'დირექტორის სახელი/გვარი' })
  @IsString()
  @IsNotEmpty()
  directorName: string;

  @ApiProperty({ description: 'ელ.ფოსტა' })
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'საკონტაქტო პირის სახელი/გვარი' })
  @IsString()
  @IsNotEmpty()
  contactPersonName: string;

  @ApiProperty({ description: 'საკონტაქტო ნომერი' })
  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @ApiProperty({ description: 'ანგარიშის ნომერი' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;
}
