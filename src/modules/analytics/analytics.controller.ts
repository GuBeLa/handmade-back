import {
  Controller,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get dashboard statistics (Admin only)' })
  async getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }

  @Get('seller')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Get seller statistics' })
  async getSellerStats(@Request() req) {
    return this.analyticsService.getSellerStats(req.user.sub);
  }
}

