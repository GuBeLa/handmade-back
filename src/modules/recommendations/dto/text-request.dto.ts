import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TextRecommendationRequestDto {
  @ApiProperty({ 
    description: 'Natural language request for product recommendations',
    example: 'მინდა ტყავის საჩუქარი ბიჭისთვის, ბიუჯეტი 50 ლარი'
  })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Maximum number of recommendations', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

