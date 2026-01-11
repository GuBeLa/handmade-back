import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist (Public)')
@Controller('wishlist/public')
export class WishlistPublicController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get(':shareToken')
  @ApiOperation({ summary: 'Get public wishlist by share token' })
  async getPublicWishlist(@Param('shareToken') shareToken: string) {
    return this.wishlistService.getPublicWishlist(shareToken);
  }
}
