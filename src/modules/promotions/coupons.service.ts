import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { Coupon } from '../../common/types/firestore.types';
import { Timestamp } from 'firebase-admin/firestore';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private firestoreService: FirestoreService) {}

  /**
   * Create a new coupon
   */
  async createCoupon(createCouponDto: CreateCouponDto): Promise<Coupon> {
    try {
      // Check if coupon code already exists
      const existingCoupon = await this.firestoreService.findOneBy<Coupon>(
        'coupons',
        'code',
        createCouponDto.code.toUpperCase(),
      );

      if (existingCoupon) {
        throw new BadRequestException('Coupon code already exists');
      }

      // Validate dates
      const validFrom = new Date(createCouponDto.validFrom);
      const validUntil = new Date(createCouponDto.validUntil);

      if (validFrom >= validUntil) {
        throw new BadRequestException('Valid until date must be after valid from date');
      }

      // Validate value based on type
      if (createCouponDto.type === 'percentage' && (createCouponDto.value < 0 || createCouponDto.value > 100)) {
        throw new BadRequestException('Percentage value must be between 0 and 100');
      }

      if (createCouponDto.type === 'fixed' && createCouponDto.value <= 0) {
        throw new BadRequestException('Fixed value must be greater than 0');
      }

      // For buy_x_get_y type, validate quantities
      if (createCouponDto.type === 'buy_x_get_y') {
        if (!createCouponDto.buyXQuantity || !createCouponDto.getYQuantity) {
          throw new BadRequestException('buyXQuantity and getYQuantity are required for buy_x_get_y type');
        }
      }

      const couponData = {
        code: createCouponDto.code.toUpperCase(),
        type: createCouponDto.type,
        value: createCouponDto.value,
        minPurchase: createCouponDto.minPurchase,
        maxDiscount: createCouponDto.maxDiscount,
        usageLimit: createCouponDto.usageLimit,
        usedCount: 0,
        validFrom: Timestamp.fromDate(validFrom),
        validUntil: Timestamp.fromDate(validUntil),
        isActive: createCouponDto.isActive ?? true,
        applicableCategories: createCouponDto.applicableCategories || [],
        applicableProducts: createCouponDto.applicableProducts || [],
        buyXQuantity: createCouponDto.buyXQuantity,
        getYQuantity: createCouponDto.getYQuantity,
        description: createCouponDto.description,
      };

      const coupon = await this.firestoreService.create<Coupon>('coupons', couponData);

      this.logger.log(`Coupon created: ${coupon.id} with code: ${coupon.code}`);

      return coupon;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error creating coupon:', error);
      throw new BadRequestException('Failed to create coupon');
    }
  }

  /**
   * Validate and apply coupon
   */
  async validateAndApplyCoupon(applyCouponDto: ApplyCouponDto, userId?: string): Promise<{
    coupon: Coupon;
    discount: number;
    freeShipping: boolean;
    message: string;
  }> {
    try {
      const coupon = await this.firestoreService.findOneBy<Coupon>(
        'coupons',
        'code',
        applyCouponDto.code.toUpperCase(),
      );

      if (!coupon) {
        throw new NotFoundException('Coupon not found');
      }

      // Check if coupon is active
      if (!coupon.isActive) {
        throw new BadRequestException('Coupon is not active');
      }

      // Check if coupon is within validity period
      const now = new Date();
      const validFrom = (coupon.validFrom as any)?.toDate 
        ? (coupon.validFrom as any).toDate() 
        : coupon.validFrom instanceof Date 
        ? coupon.validFrom 
        : new Date(coupon.validFrom);
      const validUntil = (coupon.validUntil as any)?.toDate 
        ? (coupon.validUntil as any).toDate() 
        : coupon.validUntil instanceof Date 
        ? coupon.validUntil 
        : new Date(coupon.validUntil);

      if (now < validFrom) {
        throw new BadRequestException('Coupon is not yet valid');
      }

      if (now > validUntil) {
        throw new BadRequestException('Coupon has expired');
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        throw new BadRequestException('Coupon usage limit reached');
      }

      // Check minimum purchase
      if (coupon.minPurchase && applyCouponDto.subtotal < coupon.minPurchase) {
        throw new BadRequestException(
          `Minimum purchase amount of ${coupon.minPurchase} ₾ required for this coupon`,
        );
      }

      // Calculate discount based on type
      let discount = 0;
      let freeShipping = false;
      let message = '';

      switch (coupon.type) {
        case 'percentage':
          discount = (applyCouponDto.subtotal * coupon.value) / 100;
          if (coupon.maxDiscount) {
            discount = Math.min(discount, coupon.maxDiscount);
          }
          message = `${coupon.value}% off`;
          break;

        case 'fixed':
          discount = coupon.value;
          message = `${coupon.value} ₾ off`;
          break;

        case 'free_shipping':
          freeShipping = true;
          message = 'Free shipping';
          break;

        case 'buy_x_get_y':
          // This would be handled separately in cart/order logic
          message = `Buy ${coupon.buyXQuantity} Get ${coupon.getYQuantity}`;
          break;

        default:
          throw new BadRequestException('Invalid coupon type');
      }

      return {
        coupon,
        discount: Math.round(discount * 100) / 100, // Round to 2 decimal places
        freeShipping,
        message,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error validating coupon:', error);
      throw new BadRequestException('Failed to validate coupon');
    }
  }

  /**
   * Increment coupon usage count
   */
  async incrementCouponUsage(couponId: string): Promise<void> {
    try {
      const coupon = await this.firestoreService.findById<Coupon>('coupons', couponId);

      if (!coupon) {
        throw new NotFoundException('Coupon not found');
      }

      await this.firestoreService.update('coupons', couponId, {
        usedCount: (coupon.usedCount || 0) + 1,
      });

      this.logger.log(`Coupon usage incremented: ${couponId}`);
    } catch (error) {
      this.logger.error('Error incrementing coupon usage:', error);
      throw new BadRequestException('Failed to increment coupon usage');
    }
  }

  /**
   * Get all coupons (admin only)
   */
  async getAllCoupons(): Promise<Coupon[]> {
    try {
      const coupons = await this.firestoreService.findAll<Coupon>('coupons');
      return coupons.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      this.logger.error('Error fetching coupons:', error);
      throw new BadRequestException('Failed to fetch coupons');
    }
  }

  /**
   * Get active coupons
   */
  async getActiveCoupons(): Promise<Coupon[]> {
    try {
      const now = Timestamp.now();
      const coupons = await this.firestoreService.findManyBy<Coupon>('coupons', 'isActive', true);

      return coupons.filter((coupon) => {
        const validFrom = (coupon.validFrom as any)?.toDate 
          ? (coupon.validFrom as any).toDate() 
          : coupon.validFrom instanceof Date 
          ? coupon.validFrom 
          : new Date(coupon.validFrom);
        const validUntil = (coupon.validUntil as any)?.toDate 
          ? (coupon.validUntil as any).toDate() 
          : coupon.validUntil instanceof Date 
          ? coupon.validUntil 
          : new Date(coupon.validUntil);
        const nowDate = new Date();

        return nowDate >= validFrom && nowDate <= validUntil;
      });
    } catch (error) {
      this.logger.error('Error fetching active coupons:', error);
      throw new BadRequestException('Failed to fetch active coupons');
    }
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(couponId: string): Promise<Coupon> {
    try {
      const coupon = await this.firestoreService.findById<Coupon>('coupons', couponId);

      if (!coupon) {
        throw new NotFoundException('Coupon not found');
      }

      return coupon;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error fetching coupon:', error);
      throw new BadRequestException('Failed to fetch coupon');
    }
  }

  /**
   * Update coupon
   */
  async updateCoupon(couponId: string, updateData: Partial<CreateCouponDto>): Promise<Coupon> {
    try {
      const coupon = await this.firestoreService.findById<Coupon>('coupons', couponId);

      if (!coupon) {
        throw new NotFoundException('Coupon not found');
      }

      // If code is being updated, check if new code exists
      if (updateData.code && updateData.code !== coupon.code) {
        const existingCoupon = await this.firestoreService.findOneBy<Coupon>(
          'coupons',
          'code',
          updateData.code.toUpperCase(),
        );

        if (existingCoupon) {
          throw new BadRequestException('Coupon code already exists');
        }
      }

      const updatePayload: any = { ...updateData };

      if (updateData.validFrom) {
        updatePayload.validFrom = Timestamp.fromDate(new Date(updateData.validFrom));
      }

      if (updateData.validUntil) {
        updatePayload.validUntil = Timestamp.fromDate(new Date(updateData.validUntil));
      }

      if (updateData.code) {
        updatePayload.code = updateData.code.toUpperCase();
      }

      await this.firestoreService.update('coupons', couponId, updatePayload);

      return this.getCouponById(couponId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error updating coupon:', error);
      throw new BadRequestException('Failed to update coupon');
    }
  }

  /**
   * Delete coupon
   */
  async deleteCoupon(couponId: string): Promise<void> {
    try {
      const coupon = await this.firestoreService.findById<Coupon>('coupons', couponId);

      if (!coupon) {
        throw new NotFoundException('Coupon not found');
      }

      await this.firestoreService.delete('coupons', couponId);

      this.logger.log(`Coupon deleted: ${couponId}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error deleting coupon:', error);
      throw new BadRequestException('Failed to delete coupon');
    }
  }
}
