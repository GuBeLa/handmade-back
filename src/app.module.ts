import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { FirestoreModule } from './common/services/firestore.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { BannersModule } from './modules/banners/banners.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { UploadModule } from './modules/upload/upload.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { SupportModule } from './modules/support/support.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SearchModule } from './modules/search/search.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    FirebaseModule,
    FirestoreModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    ReviewsModule,
    WishlistModule,
    NotificationsModule,
    ChatModule,
    BannersModule,
    AnalyticsModule,
    UploadModule,
    RecommendationsModule,
    SupportModule,
    ReturnsModule,
    PromotionsModule,
    ExpensesModule,
    SubscriptionsModule,
    SearchModule,
    PaymentsModule,
    LoyaltyModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

