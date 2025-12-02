import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';

@Injectable()
export class WishlistService {
  constructor(private firestoreService: FirestoreService) {}

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

    return this.firestoreService.create('wishlist', { userId, productId });
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
}
