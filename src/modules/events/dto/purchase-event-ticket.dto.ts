import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseEventTicketDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}
