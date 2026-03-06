import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { FirestoreModule } from '../../common/services/firestore.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [
    FirestoreModule,
    NotificationsModule,
    forwardRef(() => PromotionsModule),
    forwardRef(() => SubscriptionsModule),
    LoyaltyModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

