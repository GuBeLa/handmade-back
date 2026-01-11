import { Module } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';
import { WishlistPublicController } from './wishlist-public.controller';
import { FirestoreModule } from '../../common/services/firestore.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FirestoreModule, NotificationsModule],
  controllers: [WishlistController, WishlistPublicController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
