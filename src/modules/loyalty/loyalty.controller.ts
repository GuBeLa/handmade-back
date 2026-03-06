import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LoyaltyService } from './loyalty.service';
import { ValidateRedeemDto } from './dto/validate-redeem.dto';

@ApiTags('Loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current loyalty points balance' })
  async getBalance(@Request() req) {
    return this.loyaltyService.getBalance(req.user.sub);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get loyalty points history' })
  async getHistory(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.loyaltyService.getHistory(req.user.sub, pageNum, limitNum);
  }

  @Post('validate-redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate points redemption for checkout' })
  async validateRedeem(@Request() req, @Body() dto: ValidateRedeemDto) {
    return this.loyaltyService.validateRedeem(
      req.user.sub,
      dto.pointsToRedeem,
      dto.orderSubtotal,
    );
  }
}
