import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateSellerProfileDto } from './dto/create-seller-profile.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.sub);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Request() req, @Body() updateDto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.sub, updateDto);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.sub, changePasswordDto);
  }

  @Post('seller-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create seller profile' })
  async createSellerProfile(
    @Request() req,
    @Body() createDto: CreateSellerProfileDto,
  ) {
    return this.usersService.createSellerProfile(req.user.sub, createDto);
  }

  @Get('seller-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user seller profile' })
  async getSellerProfile(@Request() req) {
    return this.usersService.getSellerProfile(req.user.sub);
  }

  @Put('seller-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update seller profile' })
  async updateSellerProfile(
    @Request() req,
    @Body() updateDto: UpdateSellerProfileDto,
  ) {
    return this.usersService.updateSellerProfile(req.user.sub, updateDto);
  }

  @Get('sellers/:id')
  @ApiOperation({ summary: 'Get public seller profile with follow status (optional auth)' })
  async getPublicSellerProfile(@Param('id') sellerId: string, @Request() req?: any) {
    const userId = req?.user?.sub;
    if (userId) {
      return this.usersService.getSellerPublicProfileWithFollowStatus(sellerId, userId);
    }
    return this.usersService.getSellerPublicProfile(sellerId);
  }

  @Post('seller-profiles/:id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moderate seller profile (Admin only)' })
  async moderateSellerProfile(
    @Param('id') profileId: string,
    @Body() body: { status: string; comment: string },
    @Request() req,
  ) {
    return this.usersService.moderateSellerProfile(
      profileId,
      body.status as any,
      body.comment,
      req.user.sub,
    );
  }

  @Post('sellers/:id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a seller' })
  async followSeller(@Param('id') sellerId: string, @Request() req) {
    return this.usersService.followSeller(req.user.sub, sellerId);
  }

  @Post('sellers/:id/unfollow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a seller' })
  async unfollowSeller(@Param('id') sellerId: string, @Request() req) {
    return this.usersService.unfollowSeller(req.user.sub, sellerId);
  }

  @Get('sellers/:id/follow-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if following a seller' })
  async getFollowStatus(@Param('id') sellerId: string, @Request() req) {
    const isFollowing = await this.usersService.isFollowingSeller(req.user.sub, sellerId);
    return { isFollowing };
  }

  @Get('followed-sellers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of followed sellers' })
  async getFollowedSellers(@Request() req) {
    return this.usersService.getFollowedSellers(req.user.sub);
  }

