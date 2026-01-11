import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { FirestoreModule } from '../../common/services/firestore.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FirestoreModule, NotificationsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
