import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { SubmitQuestionnaireDto } from './dto/questionnaire.dto';
import { TextRecommendationRequestDto } from './dto/text-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('questionnaire')
  @ApiOperation({ summary: 'Get questionnaire questions' })
  async getQuestionnaire() {
    return {
      questions: this.recommendationsService.getQuestionnaireQuestions(),
    };
  }

  @Post('recommend')
  @ApiOperation({ summary: 'Get product recommendations based on questionnaire' })
  async getRecommendations(@Body() questionnaireDto: SubmitQuestionnaireDto) {
    return this.recommendationsService.getRecommendations(questionnaireDto);
  }

  @Post('recommend/authenticated')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized recommendations (authenticated)' })
  async getPersonalizedRecommendations(
    @Request() req,
    @Body() questionnaireDto: SubmitQuestionnaireDto,
  ) {
    return this.recommendationsService.getRecommendations(
      questionnaireDto,
      req.user.sub,
    );
  }

  @Post('recommend/text')
  @ApiOperation({ summary: 'Get product recommendations based on natural language text' })
  async getRecommendationsFromText(@Body() textDto: TextRecommendationRequestDto) {
    return this.recommendationsService.getRecommendationsFromText(textDto);
  }

  @Post('recommend/text/authenticated')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized recommendations from text (authenticated)' })
  async getPersonalizedRecommendationsFromText(
    @Request() req,
    @Body() textDto: TextRecommendationRequestDto,
  ) {
    return this.recommendationsService.getRecommendationsFromText(
      textDto,
      req.user.sub,
    );
  }
}

