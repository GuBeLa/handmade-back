import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { FirestoreModule } from '../../common/services/firestore.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FirestoreModule, NotificationsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
