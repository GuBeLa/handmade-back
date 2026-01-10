import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { Promotion } from '../../common/types/firestore.types';
import { Timestamp } from 'firebase-admin/firestore';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private firestoreService: FirestoreService) {}

  /**
   * Create a new promotion
   */
  async createPromotion(createPromotionDto: CreatePromotionDto): Promise<Promotion> {
    try {
      // Validate dates
      const startDate = new Date(createPromotionDto.startDate);
      const endDate = new Date(createPromotionDto.endDate);

      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }

      // Validate discount percentage
      if (createPromotionDto.discountPercentage < 0 || createPromotionDto.discountPercentage > 100) {
        throw new BadRequestException('Discount percentage must be between 0 and 100');
      }

      const promotionData = {
        title: createPromotionDto.title,
        description: createPromotionDto.description,
        type: createPromotionDto.type,
        discountPercentage: createPromotionDto.discountPercentage,
        products: createPromotionDto.products || [],
        categories: createPromotionDto.categories || [],
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        isActive: createPromotionDto.isActive ?? true,
        bannerImage: createPromotionDto.bannerImage,
        bannerText: createPromotionDto.bannerText,
      };

      const promotion = await this.firestoreService.create<Promotion>('promotions', promotionData);

      this.logger.log(`Promotion created: ${promotion.id} - ${promotion.title}`);

      return promotion;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error creating promotion:', error);
      throw new BadRequestException('Failed to create promotion');
    }
  }

  /**
   * Get all promotions
   */
  async getAllPromotions(): Promise<Promotion[]> {
    try {
      const promotions = await this.firestoreService.findAll<Promotion>('promotions');
      return promotions.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      this.logger.error('Error fetching promotions:', error);
      throw new BadRequestException('Failed to fetch promotions');
    }
  }

  /**
   * Get active promotions
   */
  async getActivePromotions(): Promise<Promotion[]> {
    try {
      const now = new Date();
      const promotions = await this.firestoreService.findManyBy<Promotion>('promotions', 'isActive', true);

      return promotions.filter((promotion) => {
        const startDate = (promotion.startDate as any)?.toDate 
          ? (promotion.startDate as any).toDate() 
          : promotion.startDate instanceof Date 
          ? promotion.startDate 
          : new Date(promotion.startDate);
        const endDate = (promotion.endDate as any)?.toDate 
          ? (promotion.endDate as any).toDate() 
          : promotion.endDate instanceof Date 
          ? promotion.endDate 
          : new Date(promotion.endDate);

        return now >= startDate && now <= endDate;
      });
    } catch (error) {
      this.logger.error('Error fetching active promotions:', error);
      throw new BadRequestException('Failed to fetch active promotions');
    }
  }

  /**
   * Get flash sales
   */
  async getFlashSales(): Promise<Promotion[]> {
    try {
      const promotions = await this.getActivePromotions();
      return promotions.filter((promotion) => promotion.type === 'flash_sale');
    } catch (error) {
      this.logger.error('Error fetching flash sales:', error);
      throw new BadRequestException('Failed to fetch flash sales');
    }
  }

  /**
   * Get promotions by type
   */
  async getPromotionsByType(type: 'flash_sale' | 'seasonal' | 'clearance' | 'new_arrival'): Promise<Promotion[]> {
    try {
      const promotions = await this.getActivePromotions();
      return promotions.filter((promotion) => promotion.type === type);
    } catch (error) {
      this.logger.error('Error fetching promotions by type:', error);
      throw new BadRequestException('Failed to fetch promotions by type');
    }
  }

  /**
   * Get promotions for a product
   */
  async getPromotionsForProduct(productId: string, categoryId?: string): Promise<Promotion[]> {
    try {
      const promotions = await this.getActivePromotions();

      return promotions.filter((promotion) => {
        // Check if product is in promotion products list
        if (promotion.products && promotion.products.length > 0) {
          return promotion.products.includes(productId);
        }

        // Check if product category is in promotion categories list
        if (categoryId && promotion.categories && promotion.categories.length > 0) {
          return promotion.categories.includes(categoryId);
        }

        // If no specific products or categories, promotion applies to all
        return !promotion.products || promotion.products.length === 0;
      });
    } catch (error) {
      this.logger.error('Error fetching promotions for product:', error);
      throw new BadRequestException('Failed to fetch promotions for product');
    }
  }

  /**
   * Get promotion by ID
   */
  async getPromotionById(promotionId: string): Promise<Promotion> {
    try {
      const promotion = await this.firestoreService.findById<Promotion>('promotions', promotionId);

      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }

      return promotion;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error fetching promotion:', error);
      throw new BadRequestException('Failed to fetch promotion');
    }
  }

  /**
   * Update promotion
   */
  async updatePromotion(promotionId: string, updateData: Partial<CreatePromotionDto>): Promise<Promotion> {
    try {
      const promotion = await this.firestoreService.findById<Promotion>('promotions', promotionId);

      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }

      const updatePayload: any = { ...updateData };

      if (updateData.startDate) {
        updatePayload.startDate = Timestamp.fromDate(new Date(updateData.startDate));
      }

      if (updateData.endDate) {
        updatePayload.endDate = Timestamp.fromDate(new Date(updateData.endDate));
      }

      await this.firestoreService.update('promotions', promotionId, updatePayload);

      return this.getPromotionById(promotionId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error updating promotion:', error);
      throw new BadRequestException('Failed to update promotion');
    }
  }

  /**
   * Delete promotion
   */
  async deletePromotion(promotionId: string): Promise<void> {
    try {
      const promotion = await this.firestoreService.findById<Promotion>('promotions', promotionId);

      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }

      await this.firestoreService.delete('promotions', promotionId);

      this.logger.log(`Promotion deleted: ${promotionId}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error deleting promotion:', error);
      throw new BadRequestException('Failed to delete promotion');
    }
  }
}
