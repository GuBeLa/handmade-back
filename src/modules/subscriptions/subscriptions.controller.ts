import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all subscription plans' })
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('plans/:planType')
  @ApiOperation({ summary: 'Get a single subscription plan' })
  async getPlan(@Param('planType') planType: string) {
    return this.subscriptionsService.getPlan(planType);
  }

  @Get('seller')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller\'s current subscription' })
  async getSellerSubscription(@Request() req) {
    return this.subscriptionsService.getSellerSubscription(req.user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subscription' })
  async createSubscription(@Request() req, @Body() createDto: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(req.user.sub, createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update subscription' })
  async updateSubscription(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.updateSubscription(id, req.user.sub, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancelSubscription(@Param('id') id: string, @Request() req) {
    return this.subscriptionsService.cancelSubscription(id, req.user.sub);
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate subscription (Admin only - after payment confirmation)' })
  async activateSubscription(
    @Param('id') id: string,
    @Body() body: { paymentGatewaySubscriptionId?: string },
  ) {
    return this.subscriptionsService.activateSubscription(id, body.paymentGatewaySubscriptionId);
  }

  @Get('features/:feature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if seller has access to a premium feature' })
  async hasPremiumFeature(@Param('feature') feature: string, @Request() req) {
    const hasAccess = await this.subscriptionsService.hasPremiumFeature(req.user.sub, feature);
    return { hasAccess, feature };
  }

  @Get('commission-rate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get commission rate for seller based on subscription' })
  async getCommissionRate(@Request() req) {
    const rate = await this.subscriptionsService.getCommissionRate(req.user.sub);
    return { commissionRate: rate };
  }
}
