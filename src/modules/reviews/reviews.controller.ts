import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create review' })
  async create(@Request() req, @Body() createDto: CreateReviewDto) {
    return this.reviewsService.create(req.user.sub, createDto);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get product reviews' })
  async findAll(@Param('productId') productId: string) {
    return this.reviewsService.findAll(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get review by ID' })
  async findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update review' })
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(id, req.user.sub, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete review' })
  async delete(@Param('id') id: string, @Request() req) {
    return this.reviewsService.delete(id, req.user.sub);
  }
}

