import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private firestoreService: FirestoreService) {}

  async create(userId: string, createDto: CreateReviewDto): Promise<any> {
    const { productId, rating, comment } = createDto;

    const product: any = await this.firestoreService.findById('products', productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if user already reviewed this product
    const existingReview = await this.firestoreService.collection('reviews')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .limit(1)
      .get();

    if (!existingReview.empty) {
      throw new BadRequestException('You have already reviewed this product');
    }

    // Check if user purchased this product
    const orders: any[] = await this.firestoreService.findAll('orders', (ref) =>
      ref.where('buyerId', '==', userId).where('status', '==', 'delivered'),
    );

    const hasPurchased = orders.some((order: any) =>
      order.items?.some((item: any) => item.productId === productId),
    );

    const review = await this.firestoreService.create('reviews', {
      userId,
      productId,
      rating,
      comment,
      isVerifiedPurchase: hasPurchased,
      isVisible: true,
    });

    // Update product rating
    await this.updateProductRating(productId);

    return review;
  }

  async findAll(productId: string): Promise<any[]> {
    const reviews: any[] = await this.firestoreService.findAll('reviews', (ref) =>
      ref.where('productId', '==', productId)
        .where('isVisible', '==', true)
        .orderBy('createdAt', 'desc'),
    );

    // Load user info
    for (const review of reviews) {
      try {
        if (review.userId) {
          const user = await this.firestoreService.findById('users', review.userId);
          review.user = user ? {
            id: user.id,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            avatar: user.avatar || null,
          } : null;
        } else {
          review.user = null;
        }
      } catch (error) {
        console.error(`Error loading user for review ${review.id}:`, error);
        review.user = null;
      }
    }

    return reviews;
  }

  async findOne(id: string): Promise<any> {
    const review: any = await this.firestoreService.findById('reviews', id);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.user = await this.firestoreService.findById('users', review.userId);
    review.product = await this.firestoreService.findById('products', review.productId);

    return review;
  }

  async update(id: string, userId: string, updateDto: UpdateReviewDto): Promise<any> {
    const review: any = await this.firestoreService.findById('reviews', id);

    if (!review || review.userId !== userId) {
      throw new NotFoundException('Review not found');
    }

    await this.firestoreService.update('reviews', id, updateDto);

    // Update product rating
    await this.updateProductRating(review.productId);

    return this.findOne(id);
  }

  async delete(id: string, userId: string): Promise<void> {
    const review: any = await this.firestoreService.findById('reviews', id);

    if (!review || review.userId !== userId) {
      throw new NotFoundException('Review not found');
    }

    const productId = review.productId;
    await this.firestoreService.delete('reviews', id);

    // Update product rating
    await this.updateProductRating(productId);
  }

  private async updateProductRating(productId: string): Promise<void> {
    const reviews: any[] = await this.firestoreService.findAll('reviews', (ref) =>
      ref.where('productId', '==', productId).where('isVisible', '==', true),
    );

    if (reviews.length === 0) {
      return;
    }

    const averageRating =
      reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length;

    await this.firestoreService.update('products', productId, {
      averageRating: Math.round(averageRating * 100) / 100,
      totalReviews: reviews.length,
    });
  }
}
