import { Module, forwardRef } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { FirestoreModule } from '../../common/services/firestore.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [FirestoreModule, forwardRef(() => OrdersModule)],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
