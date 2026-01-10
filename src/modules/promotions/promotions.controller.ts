import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new promotion (Admin only)' })
  async createPromotion(@Body() createPromotionDto: CreatePromotionDto) {
    return this.promotionsService.createPromotion(createPromotionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all promotions' })
  async getAllPromotions() {
    return this.promotionsService.getAllPromotions();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active promotions' })
  async getActivePromotions() {
    return this.promotionsService.getActivePromotions();
  }

  @Get('flash-sales')
  @ApiOperation({ summary: 'Get active flash sales' })
  async getFlashSales() {
    return this.promotionsService.getFlashSales();
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get promotions by type' })
  async getPromotionsByType(@Param('type') type: 'flash_sale' | 'seasonal' | 'clearance' | 'new_arrival') {
    return this.promotionsService.getPromotionsByType(type);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get promotions for a specific product' })
  async getPromotionsForProduct(
    @Param('productId') productId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.promotionsService.getPromotionsForProduct(productId, categoryId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get promotion by ID' })
  async getPromotionById(@Param('id') id: string) {
    return this.promotionsService.getPromotionById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update promotion (Admin only)' })
  async updatePromotion(@Param('id') id: string, @Body() updateData: Partial<CreatePromotionDto>) {
    return this.promotionsService.updatePromotion(id, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete promotion (Admin only)' })
  async deletePromotion(@Param('id') id: string) {
    await this.promotionsService.deletePromotion(id);
    return { message: 'Promotion deleted successfully' };
  }
}
