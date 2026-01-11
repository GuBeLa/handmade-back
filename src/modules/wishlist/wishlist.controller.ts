import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateWishlistSettingsDto } from './dto/update-wishlist-settings.dto';

@ApiTags('Wishlist')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get user wishlist' })
  async getUserWishlist(@Request() req) {
    return this.wishlistService.getUserWishlist(req.user.sub);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add product to wishlist' })
  async addToWishlist(@Request() req, @Param('productId') productId: string) {
    return this.wishlistService.addToWishlist(req.user.sub, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  async removeFromWishlist(@Request() req, @Param('productId') productId: string) {
    return this.wishlistService.removeFromWishlist(req.user.sub, productId);
  }

  @Get('check/:productId')
  @ApiOperation({ summary: 'Check if product is in wishlist' })
  async isInWishlist(@Request() req, @Param('productId') productId: string) {
    const isInWishlist = await this.wishlistService.isInWishlist(req.user.sub, productId);
    return { isInWishlist };
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get wishlist settings' })
  async getWishlistSettings(@Request() req) {
    return this.wishlistService.getWishlistSettings(req.user.sub);
  }

  @Post('settings')
  @ApiOperation({ summary: 'Update wishlist settings' })
  async updateWishlistSettings(@Request() req, @Body() updates: UpdateWishlistSettingsDto) {
    return this.wishlistService.updateWishlistSettings(req.user.sub, updates);
  }

  @Post('share')
  @ApiOperation({ summary: 'Share wishlist - get share URL' })
  async shareWishlist(@Request() req) {
    return this.wishlistService.shareWishlist(req.user.sub);
  }
}

