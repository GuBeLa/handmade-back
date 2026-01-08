import { IsString, IsOptional, IsArray, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionnaireAnswerDto {
  @ApiProperty({ description: 'Question ID' })
  @IsString()
  questionId: string;

  @ApiProperty({ description: 'Answer value (can be string, number, or array)' })
  answer: string | number | string[];

  @ApiPropertyOptional({ description: 'Additional context' })
  @IsOptional()
  @IsString()
  context?: string;
}

export class SubmitQuestionnaireDto {
  @ApiProperty({ description: 'Questionnaire answers', type: [QuestionnaireAnswerDto] })
  @IsArray()
  answers: QuestionnaireAnswerDto[];

  @ApiPropertyOptional({ description: 'Maximum number of recommendations', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

