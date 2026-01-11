import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private firestoreService: FirestoreService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, createDto: CreateReviewDto): Promise<any> {
    const { productId, rating, comment, images } = createDto;
    
    // Normalize images: if empty array or undefined, set to undefined
    const normalizedImages = images && Array.isArray(images) && images.length > 0 ? images : undefined;

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

    // Build review data object, excluding undefined fields
    const reviewData: any = {
      userId,
      productId,
      rating,
      isVerifiedPurchase: hasPurchased,
      isVisible: true,
    };

    // Only include comment if it's defined and not empty
    if (comment && typeof comment === 'string' && comment.trim().length > 0) {
      reviewData.comment = comment.trim();
    } else {
      reviewData.comment = null; // Use null instead of undefined for Firestore
    }

    // Only include images if it's defined and has content
    if (normalizedImages && Array.isArray(normalizedImages) && normalizedImages.length > 0) {
      reviewData.images = normalizedImages;
    }
    // Note: We don't include images field at all if it's undefined/empty - Firestore will not store it

    const review = await this.firestoreService.create('reviews', reviewData);

    // Update product rating
    await this.updateProductRating(productId);

    // Send notification to seller
    if (product.sellerId) {
      try {
        const user: any = await this.firestoreService.findById('users', userId);
        const userName = user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.email || 'Someone';

        await this.notificationsService.create({
          userId: product.sellerId,
          type: 'review',
          title: 'New Review',
          message: `${userName} left a ${rating}-star review on "${product.title}"`,
          link: `/products/${productId}`,
        });
      } catch (error) {
        console.error('Failed to send review notification:', error);
        // Don't fail review creation if notification fails
      }
    }

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

  async replyToReview(reviewId: string, sellerId: string, replyDto: ReplyReviewDto): Promise<any> {
    const review: any = await this.firestoreService.findById('reviews', reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Get product to verify seller
    const product: any = await this.firestoreService.findById('products', review.productId);
    if (!product || product.sellerId !== sellerId) {
      throw new BadRequestException('You can only reply to reviews on your own products');
    }

    // Check if already replied
    if (review.sellerReply) {
      throw new BadRequestException('You have already replied to this review');
    }

    // Update review with seller reply
    await this.firestoreService.update('reviews', reviewId, {
      sellerReply: replyDto.reply,
      sellerReplyAt: new Date(),
    });

    // Send notification to review author
    try {
      const seller: any = await this.firestoreService.findById('users', sellerId);
      const sellerName = seller?.firstName && seller?.lastName
        ? `${seller.firstName} ${seller.lastName}`
        : seller?.email || 'Seller';

      await this.notificationsService.create({
        userId: review.userId,
        type: 'review_reply',
        title: 'Seller Replied',
        message: `${sellerName} replied to your review on "${product.title}"`,
        link: `/products/${review.productId}`,
      });
    } catch (error) {
      console.error('Failed to send reply notification:', error);
      // Don't fail reply if notification fails
    }

    return this.findOne(reviewId);
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
