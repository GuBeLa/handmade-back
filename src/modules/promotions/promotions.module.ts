import { Module, forwardRef } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { FirestoreModule } from '../../common/services/firestore.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FirestoreModule, NotificationsModule],
  controllers: [CouponsController, PromotionsController],
  providers: [CouponsService, PromotionsService],
  exports: [CouponsService, PromotionsService],
})
export class PromotionsModule {}
