import { Module, forwardRef } from '@nestjs/common';
import { FirestoreModule } from '../../common/services/firestore.module';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [FirestoreModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
