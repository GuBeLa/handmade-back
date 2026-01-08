import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { ProductsModule } from '../products/products.module';
import { FirestoreModule } from '../../common/services/firestore.module';

@Module({
  imports: [ProductsModule, FirestoreModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}

