import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { Subscription, SubscriptionPlan, SellerProfile } from '../../common/types/firestore.types';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Timestamp } from 'firebase-admin/firestore';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private firestoreService: FirestoreService,
    private notificationsService: NotificationsService,
  ) {
    this.initializePlansIfNeeded();
  }

  /**
   * Initialize default subscription plans if they don't exist (only when Firestore is available)
   */
  private async initializePlansIfNeeded(): Promise<void> {
    if (!this.firestoreService.isAvailable()) {
      this.logger.warn('Firestore not configured; subscription plans will not be loaded.');
      return;
    }
    try {
      const existingPlans = await this.firestoreService.findAll<SubscriptionPlan>('subscription_plans');
      if (existingPlans.length > 0) {
        return; // Plans already exist
      }

      const defaultPlans: Array<Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>> = [
        {
          name: 'ძირითადი',
          nameEn: 'Basic',
          planType: 'basic',
          price: 0,
          currency: 'GEL',
          billingCycle: 'monthly',
          features: [
            'ძირითადი ფუნქციები',
            '10% საკომისიო',
            'პროდუქტების გამოქვეყნება',
            'ძირითადი სტატისტიკა',
          ],
          featuresEn: [
            'Basic features',
            '10% commission',
            'Product listings',
            'Basic statistics',
          ],
          commissionRate: 10,
          maxProducts: 50,
          maxPromotions: 0,
          isActive: true,
          order: 1,
        },
        {
          name: 'პრემიუმ',
          nameEn: 'Premium',
          planType: 'premium',
          price: 9,
          currency: 'GEL',
          billingCycle: 'monthly',
          features: [
            'ყველა ძირითადი ფუნქცია',
            '8% საკომისიო',
            'უკეთესი ხილვადობა',
            'გაფართოებული ანალიტიკა',
            'პროდუქტის პრომოცია',
            'Featured listings',
            '100+ პროდუქტი',
            '5 პრომოცია თვეში',
          ],
          featuresEn: [
            'All basic features',
            '8% commission',
            'Better visibility',
            'Advanced analytics',
            'Product promotion',
            'Featured listings',
            '100+ products',
            '5 promotions per month',
          ],
          commissionRate: 8,
          maxProducts: 100,
          maxPromotions: 5,
          isActive: true,
          order: 2,
        },
        {
          name: 'ბიზნეს',
          nameEn: 'Business',
          planType: 'business',
          price: 29,
          currency: 'GEL',
          billingCycle: 'monthly',
          features: [
            'ყველა პრემიუმ ფუნქცია',
            '6% საკომისიო',
            'ულიმიტო პროდუქტები',
            'ულიმიტო პრომოციები',
            'Email მარკეტინგი',
            'პრიორიტეტული მხარდაჭერა',
            'პრიორიტეტული ჩვენება',
            'API წვდომა',
          ],
          featuresEn: [
            'All premium features',
            '6% commission',
            'Unlimited products',
            'Unlimited promotions',
            'Email marketing',
            'Priority support',
            'Priority listing',
            'API access',
          ],
          commissionRate: 6,
          maxProducts: undefined, // Unlimited
          maxPromotions: undefined, // Unlimited
          isActive: true,
          order: 3,
        },
      ];

      for (const planData of defaultPlans) {
        const planToCreate: any = {
          ...planData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        await this.firestoreService.create<SubscriptionPlan>('subscription_plans', planToCreate);
      }

      this.logger.log('Default subscription plans initialized');
    } catch (error) {
      this.logger.error('Error initializing subscription plans:', error?.message ?? error);
    }
  }

  /**
   * Get all subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const plans = await this.firestoreService.findAll<SubscriptionPlan>('subscription_plans');
    return plans
      .filter((plan) => plan.isActive !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get a single subscription plan
   */
  async getPlan(planType: string): Promise<SubscriptionPlan> {
    const plans = await this.firestoreService.findAll<SubscriptionPlan>('subscription_plans');
    const plan = plans.find((p) => p.planType === planType && p.isActive !== false);
    
    if (!plan) {
      throw new NotFoundException(`Subscription plan '${planType}' not found`);
    }
    
    return plan;
  }

  /**
   * Get seller's current subscription
   */
  async getSellerSubscription(sellerId: string): Promise<Subscription | null> {
    const subscriptions = await this.firestoreService.findManyBy<Subscription>(
      'subscriptions',
      'sellerId',
      sellerId,
    );

    // Get active subscription
    const activeSubscription = subscriptions.find(
      (sub) => sub.status === 'active' || sub.status === 'pending',
    );

    return activeSubscription || null;
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    sellerId: string,
    createDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    // Check if seller already has an active subscription
    const existingSubscription = await this.getSellerSubscription(sellerId);
    if (existingSubscription && existingSubscription.status === 'active') {
      throw new BadRequestException('Seller already has an active subscription');
    }

    // Get plan details
    const plan = await this.getPlan(createDto.plan);

    // Calculate dates
    const now = new Date();
    const billingCycle = createDto.billingCycle || 'monthly';
    const endDate = new Date(now);
    
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const nextBillingDate = new Date(endDate);

    // Create subscription
    const subscriptionData: any = {
      sellerId,
      plan: createDto.plan,
      status: 'pending', // Will be set to 'active' after payment confirmation
      amount: plan.price,
      currency: plan.currency,
      billingCycle,
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(endDate),
      nextBillingDate: Timestamp.fromDate(nextBillingDate),
      autoRenew: createDto.autoRenew !== false,
      paymentMethod: createDto.paymentMethod,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const subscription = await this.firestoreService.create<Subscription>('subscriptions', subscriptionData);

    // Update seller profile
    const profile = await this.firestoreService.findOneBy<SellerProfile>(
      'seller_profiles',
      'userId',
      sellerId,
    );

    if (profile) {
      await this.firestoreService.update<SellerProfile>('seller_profiles', profile.id, {
        subscriptionPlan: createDto.plan,
        subscriptionStatus: 'pending',
        subscriptionExpiresAt: Timestamp.fromDate(endDate),
        updatedAt: Timestamp.now(),
      });
    }

    this.logger.log(`Subscription created for seller ${sellerId}: ${createDto.plan}`);

    return subscription;
  }

  /**
   * Activate subscription (after payment confirmation)
   */
  async activateSubscription(subscriptionId: string, paymentGatewaySubscriptionId?: string): Promise<Subscription> {
    const subscription = await this.firestoreService.findById<Subscription>(
      'subscriptions',
      subscriptionId,
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Update subscription
    const updated = await this.firestoreService.update<Subscription>(
      'subscriptions',
      subscriptionId,
      {
        status: 'active',
        paymentGatewaySubscriptionId,
        updatedAt: Timestamp.now(),
      },
    );

    // Update seller profile
    const profile = await this.firestoreService.findOneBy<SellerProfile>(
      'seller_profiles',
      'userId',
      subscription.sellerId,
    );

    if (profile) {
      await this.firestoreService.update<SellerProfile>('seller_profiles', profile.id, {
        subscriptionPlan: subscription.plan,
        subscriptionStatus: 'active',
        subscriptionExpiresAt: subscription.endDate,
        updatedAt: Timestamp.now(),
      });

      // Recalculate badges (premium badge)
      const { UsersService } = await import('../users/users.service');
      // Note: This would require dependency injection, but for now we'll handle it differently
    }

    // Send notification
    await this.notificationsService.create({
      userId: subscription.sellerId,
      type: 'subscription_activated',
      title: 'Subscription Activated',
      message: `Your ${subscription.plan} subscription has been activated successfully!`,
      link: '/seller/subscription',
    });

    this.logger.log(`Subscription activated: ${subscriptionId}`);

    return updated;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, sellerId: string): Promise<Subscription> {
    const subscription = await this.firestoreService.findById<Subscription>(
      'subscriptions',
      subscriptionId,
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.sellerId !== sellerId) {
      throw new BadRequestException('Access denied');
    }

    if (subscription.status === 'cancelled') {
      throw new BadRequestException('Subscription is already cancelled');
    }

    // Update subscription
    const updated = await this.firestoreService.update<Subscription>(
      'subscriptions',
      subscriptionId,
      {
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        autoRenew: false,
        updatedAt: Timestamp.now(),
      },
    );

    // Update seller profile (keep current plan until expiry)
    const profile = await this.firestoreService.findOneBy<SellerProfile>(
      'seller_profiles',
      'userId',
      sellerId,
    );

    if (profile) {
      await this.firestoreService.update<SellerProfile>('seller_profiles', profile.id, {
        subscriptionStatus: 'cancelled',
        updatedAt: Timestamp.now(),
      });
    }

    // Send notification
    await this.notificationsService.create({
      userId: sellerId,
      type: 'subscription_cancelled',
      title: 'Subscription Cancelled',
      message: 'Your subscription has been cancelled. It will remain active until the end of the billing period.',
      link: '/seller/subscription',
    });

    this.logger.log(`Subscription cancelled: ${subscriptionId}`);

    return updated;
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    sellerId: string,
    updateDto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.firestoreService.findById<Subscription>(
      'subscriptions',
      subscriptionId,
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.sellerId !== sellerId) {
      throw new BadRequestException('Access denied');
    }

    const updated = await this.firestoreService.update<Subscription>(
      'subscriptions',
      subscriptionId,
      {
        ...updateDto,
        updatedAt: Timestamp.now(),
      },
    );

    return updated;
  }

  /**
   * Check if seller has premium features
   */
  async hasPremiumFeature(sellerId: string, feature: string): Promise<boolean> {
    const subscription = await this.getSellerSubscription(sellerId);
    
    if (!subscription || subscription.status !== 'active') {
      return false;
    }

    const plan = await this.getPlan(subscription.plan);

    // Check feature based on plan
    switch (feature) {
      case 'product_promotion':
        return subscription.plan === 'premium' || subscription.plan === 'business';
      case 'featured_listings':
        return subscription.plan === 'premium' || subscription.plan === 'business';
      case 'advanced_analytics':
        return subscription.plan === 'premium' || subscription.plan === 'business';
      case 'email_marketing':
        return subscription.plan === 'business';
      case 'priority_support':
        return subscription.plan === 'business';
      case 'unlimited_products':
        return subscription.plan === 'business';
      case 'unlimited_promotions':
        return subscription.plan === 'business';
      default:
        return false;
    }
  }

  /**
   * Get commission rate for seller
   */
  async getCommissionRate(sellerId: string): Promise<number> {
    const subscription = await this.getSellerSubscription(sellerId);
    
    if (!subscription || subscription.status !== 'active') {
      return 10; // Default commission for basic plan
    }

    const plan = await this.getPlan(subscription.plan);
    return plan.commissionRate;
  }

  /**
   * Check subscription expiry and update status
   */
  async checkExpiredSubscriptions(): Promise<void> {
    const subscriptions = await this.firestoreService.findAll<Subscription>('subscriptions');
    const now = new Date();

    for (const subscription of subscriptions) {
      if (subscription.status === 'active' && subscription.endDate) {
        const endDate = subscription.endDate?.toDate ? subscription.endDate.toDate() : (subscription.endDate ? new Date(subscription.endDate) : null);
        
        if (endDate && endDate < now) {
          // Subscription expired
          await this.firestoreService.update<Subscription>('subscriptions', subscription.id, {
            status: 'expired',
            updatedAt: Timestamp.now(),
          });

          // Update seller profile
          const profile = await this.firestoreService.findOneBy<SellerProfile>(
            'seller_profiles',
            'userId',
            subscription.sellerId,
          );

          if (profile) {
            await this.firestoreService.update<SellerProfile>('seller_profiles', profile.id, {
              subscriptionPlan: 'basic',
              subscriptionStatus: 'expired',
              updatedAt: Timestamp.now(),
            });
          }

          // Send notification
          await this.notificationsService.create({
            userId: subscription.sellerId,
            type: 'subscription_expired',
            title: 'Subscription Expired',
            message: 'Your subscription has expired. Please renew to continue enjoying premium features.',
            link: '/seller/subscription',
          });

          this.logger.log(`Subscription expired: ${subscription.id}`);
        }
      }
    }
  }
}
