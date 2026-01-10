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
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new coupon (Admin only)' })
  async createCoupon(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.createCoupon(createCouponDto);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate and apply a coupon code' })
  async validateCoupon(@Body() applyCouponDto: ApplyCouponDto, @Request() req: any) {
    return this.couponsService.validateAndApplyCoupon(applyCouponDto, req.user?.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all coupons (Admin only)' })
  async getAllCoupons() {
    return this.couponsService.getAllCoupons();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active coupons' })
  async getActiveCoupons() {
    return this.couponsService.getActiveCoupons();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coupon by ID' })
  async getCouponById(@Param('id') id: string) {
    return this.couponsService.getCouponById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update coupon (Admin only)' })
  async updateCoupon(@Param('id') id: string, @Body() updateData: Partial<CreateCouponDto>) {
    return this.couponsService.updateCoupon(id, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete coupon (Admin only)' })
  async deleteCoupon(@Param('id') id: string) {
    await this.couponsService.deleteCoupon(id);
    return { message: 'Coupon deleted successfully' };
  }
}
