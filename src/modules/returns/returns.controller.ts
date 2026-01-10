import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';

@ApiTags('Returns')
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create return request' })
  async createReturn(@Request() req, @Body() createReturnDto: CreateReturnDto) {
    return this.returnsService.createReturn(req.user.sub, createReturnDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user return requests' })
  async getUserReturns(@Request() req) {
    if (req.user.role === UserRole.SELLER || req.user.role === UserRole.ADMIN) {
      // Sellers get their returns, admins get all
      if (req.user.role === UserRole.ADMIN) {
        return this.returnsService.getAllReturns(req.query.status as string);
      }
      return this.returnsService.getSellerReturns(req.user.sub);
    }
    return this.returnsService.getUserReturns(req.user.sub);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all return requests (admin only)' })
  async getAllReturns(@Query('status') status?: string) {
    return this.returnsService.getAllReturns(status);
  }

  @Get('seller')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller return requests' })
  async getSellerReturns(@Request() req) {
    return this.returnsService.getSellerReturns(req.user.sub);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get returns for an order' })
  async getReturnsByOrder(@Param('orderId') orderId: string, @Request() req) {
    return this.returnsService.getReturnsByOrder(orderId);
  }

  @Get('order/:orderId/eligibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if order is eligible for return' })
  async checkEligibility(@Param('orderId') orderId: string, @Request() req) {
    return this.returnsService.checkReturnEligibility(orderId, req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get return request by ID' })
  async getReturn(@Param('id') id: string, @Request() req) {
    return this.returnsService.getReturnById(id, req.user.sub, req.user.role);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update return status (seller/admin only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateReturnStatusDto,
    @Request() req,
  ) {
    return this.returnsService.updateReturnStatus(id, updateDto, req.user.sub, req.user.role);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel return request (buyer only)' })
  async cancelReturn(@Param('id') id: string, @Request() req) {
    return this.returnsService.cancelReturn(id, req.user.sub);
  }
}
