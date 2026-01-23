import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { Timestamp } from 'firebase-admin/firestore';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';

@Injectable()
export class WishlistService {
  constructor(
    private firestoreService: FirestoreService,
    private notificationsService: NotificationsService,
  ) {}

  async addToWishlist(userId: string, productId: string): Promise<any> {
    const product = await this.firestoreService.findById('products', productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if already in wishlist
    const existing = await this.firestoreService.collection('wishlist')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return { id: existing.docs[0].id, ...existing.docs[0].data() };
    }

    // Get current price
    const currentPrice = product.discountPrice || product.price;

    return this.firestoreService.create('wishlist', {
      userId,
      productId,
      notificationsEnabled: true,
      priceWhenAdded: currentPrice,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const items = await this.firestoreService.collection('wishlist')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .get();

    if (items.empty) {
      throw new NotFoundException('Wishlist item not found');
    }

    await this.firestoreService.delete('wishlist', items.docs[0].id);
  }

  async getUserWishlist(userId: string): Promise<any[]> {
    const items: any[] = await this.firestoreService.findAll('wishlist', (ref) =>
      ref.where('userId', '==', userId).orderBy('createdAt', 'desc'),
    );

    // Load products
    for (const item of items) {
      item.product = await this.firestoreService.findById('products', item.productId);
      if (item.product) {
        item.product.category = await this.firestoreService.findById(
          'categories',
          item.product.categoryId,
        );
      }
    }

    return items;
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const items = await this.firestoreService.collection('wishlist')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .limit(1)
      .get();

    return !items.empty;
  }

  /**
   * Get or create wishlist settings
   */
  async getWishlistSettings(userId: string): Promise<any> {
    const settings = await this.firestoreService.findOneBy('wishlist_settings', 'userId', userId);
    
    if (!settings) {
      // Create default settings
      const shareToken = crypto.randomBytes(16).toString('hex');
      return this.firestoreService.create('wishlist_settings', {
        userId,
        isPublic: false,
        shareToken,
        notificationsEnabled: true,
        giftRegistryEnabled: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    return settings;
  }

  /**
   * Update wishlist settings
   */
  async updateWishlistSettings(userId: string, updates: {
    isPublic?: boolean;
    notificationsEnabled?: boolean;
    giftRegistryEnabled?: boolean;
    giftRegistryMessage?: string;
  }): Promise<any> {
    const settings = await this.getWishlistSettings(userId);
    
    // Generate new share token if making public
    if (updates.isPublic && !settings.isPublic) {
      updates['shareToken'] = crypto.randomBytes(16).toString('hex');
    }

    return this.firestoreService.update('wishlist_settings', settings.id, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Get public wishlist by share token
   */
  async getPublicWishlist(shareToken: string): Promise<any> {
    const settings = await this.firestoreService.collection('wishlist_settings')
      .where('shareToken', '==', shareToken)
      .where('isPublic', '==', true)
      .limit(1)
      .get();

    if (settings.empty) {
      throw new NotFoundException('Wishlist not found or not public');
    }

    const setting = settings.docs[0].data();
    const userId = setting.userId;

    // Get wishlist items
    const items = await this.getUserWishlist(userId);

    // Get user info (limited)
    const user = await this.firestoreService.findById('users', userId);
    const userInfo = {
      firstName: user?.firstName,
      lastName: user?.lastName,
      avatar: user?.avatar,
    };

    return {
      user: userInfo,
      items,
      giftRegistryEnabled: setting.giftRegistryEnabled,
      giftRegistryMessage: setting.giftRegistryMessage,
    };
  }

  /**
   * Share wishlist - returns share URL
   */
  async shareWishlist(userId: string): Promise<{ shareUrl: string; shareToken: string }> {
    const settings = await this.getWishlistSettings(userId);
    
    // Make public if not already
    if (!settings.isPublic) {
      await this.updateWishlistSettings(userId, { isPublic: true });
    }

    const shareUrl = `https://arteli.store/wishlist/${settings.shareToken}`;
    return {
      shareUrl,
      shareToken: settings.shareToken,
    };
  }

  /**
   * Check for price drops and send notifications
   */
  async checkPriceDrops(): Promise<void> {
    const allWishlistItems = await this.firestoreService.findAll('wishlist', (ref) =>
      ref.where('notificationsEnabled', '==', true),
    );

    for (const item of allWishlistItems) {
      if (!item.priceWhenAdded) continue;

      const product = await this.firestoreService.findById('products', item.productId);
      if (!product || !product.isActive) continue;

      const currentPrice = product.discountPrice || product.price;
      const priceWhenAdded = item.priceWhenAdded;

      // Check if price dropped (at least 5% or 5 GEL)
      const priceDrop = priceWhenAdded - currentPrice;
      const priceDropPercent = (priceDrop / priceWhenAdded) * 100;

      if (priceDrop > 0 && (priceDropPercent >= 5 || priceDrop >= 5)) {
        // Send notification
        await this.notificationsService.create({
          userId: item.userId,
          type: 'price_drop',
          title: 'ფასი დაეცა!',
          message: `${product.title} - ფასი დაეცა ${priceDrop.toFixed(2)}₾-ით (${priceDropPercent.toFixed(1)}%)`,
          link: `/product/${product.id}`,
        });

        // Update priceWhenAdded
        await this.firestoreService.update('wishlist', item.id, {
          priceWhenAdded: currentPrice,
          updatedAt: Timestamp.now(),
        });
      }
    }
  }
}
