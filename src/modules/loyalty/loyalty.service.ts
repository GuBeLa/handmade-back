import { Injectable, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { LoyaltyPointsType } from '../../common/enums/loyalty-points-type.enum';

const COLLECTION_HISTORY = 'loyalty_points_history';

function getPointsPerGel(): number {
  return Math.max(0, parseFloat(process.env.LOYALTY_POINTS_PER_GEL || '1') || 1);
}

function getPointsPerGelDiscount(): number {
  return Math.max(1, parseFloat(process.env.LOYALTY_POINTS_PER_GEL_DISCOUNT || '100') || 100);
}

function getMaxRedeemPercent(): number {
  return Math.min(100, Math.max(0, parseFloat(process.env.LOYALTY_MAX_REDEEM_PERCENT || '25') || 25));
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly firestoreService: FirestoreService) {}

  async getBalance(userId: string): Promise<{ points: number }> {
    const user: any = await this.firestoreService.findById('users', userId);
    const points = user?.loyaltyPoints != null ? Number(user.loyaltyPoints) : 0;
    return { points };
  }

  async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: any[]; total: number }> {
    const all = await this.firestoreService.findManyBy<any>(
      COLLECTION_HISTORY,
      'userId',
      userId,
    );
    const sorted = all.sort((a, b) => {
      const aTime =
        (a as any).createdAt?.toDate?.()?.getTime?.() ??
        ((a as any).createdAt?.seconds ?? 0) * 1000;
      const bTime =
        (b as any).createdAt?.toDate?.()?.getTime?.() ??
        ((b as any).createdAt?.seconds ?? 0) * 1000;
      return bTime - aTime;
    });
    const start = (page - 1) * limit;
    const items = sorted.slice(start, start + limit).map((doc) => {
      const d = doc as any;
      let createdAt = d.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        createdAt = createdAt.toDate();
      } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
        createdAt = new Date(createdAt.seconds * 1000);
      }
      return { id: doc.id, ...d, createdAt };
    });
    return { items, total: sorted.length };
  }

  async validateRedeem(
    userId: string,
    pointsToRedeem: number,
    orderSubtotal: number,
  ): Promise<{
    valid: boolean;
    allowedPoints: number;
    discountAmount: number;
    maxRedeemPercent: number;
    pointsPerGelDiscount: number;
    message?: string;
  }> {
    const pointsPerGelDiscount = getPointsPerGelDiscount();
    const maxRedeemPercent = getMaxRedeemPercent();
    const { points: userPoints } = await this.getBalance(userId);

    const maxDiscountByPercent = (orderSubtotal * maxRedeemPercent) / 100;
    const maxPointsByPercent = Math.floor(maxDiscountByPercent * pointsPerGelDiscount);
    const allowedPoints = Math.min(
      Math.max(0, Math.floor(pointsToRedeem)),
      userPoints,
      maxPointsByPercent,
    );
    const discountAmount = allowedPoints / pointsPerGelDiscount;

    return {
      valid: allowedPoints > 0,
      allowedPoints,
      discountAmount,
      maxRedeemPercent,
      pointsPerGelDiscount,
      message:
        pointsToRedeem > userPoints
          ? 'Insufficient points'
          : pointsToRedeem > maxPointsByPercent
            ? `Maximum ${maxRedeemPercent}% of order can be paid with points`
            : undefined,
    };
  }

  /** Called when order is created: deduct points and record. Returns discount in GEL. */
  async redeem(
    userId: string,
    orderId: string,
    pointsToRedeem: number,
    orderSubtotal: number,
  ): Promise<{ discountAmount: number; pointsUsed: number }> {
    if (pointsToRedeem <= 0) {
      return { discountAmount: 0, pointsUsed: 0 };
    }
    const validation = await this.validateRedeem(userId, pointsToRedeem, orderSubtotal);
    if (validation.allowedPoints <= 0) {
      throw new BadRequestException(validation.message || 'Cannot redeem points');
    }
    const pointsUsed = validation.allowedPoints;
    const discountAmount = validation.discountAmount;

    const user: any = await this.firestoreService.findById('users', userId);
    const current = user?.loyaltyPoints != null ? Number(user.loyaltyPoints) : 0;
    if (current < pointsUsed) {
      throw new BadRequestException('Insufficient loyalty points');
    }
    await this.firestoreService.update('users', userId, {
      loyaltyPoints: current - pointsUsed,
    });
    await this.firestoreService.create(COLLECTION_HISTORY, {
      userId,
      amount: -pointsUsed,
      type: LoyaltyPointsType.REDEEM_ORDER,
      orderId,
      description: `Redeemed for order`,
    });
    return { discountAmount, pointsUsed };
  }

  /** Called when order status becomes DELIVERED: award points (only on amount that was not paid by points). */
  async earnForOrder(
    userId: string,
    orderId: string,
    orderTotal: number,
    loyaltyPointsUsed: number,
  ): Promise<number> {
    const pointsPerGel = getPointsPerGel();
    const pointsPerGelDiscount = getPointsPerGelDiscount();
    const amountEligibleForPoints = orderTotal - (loyaltyPointsUsed / pointsPerGelDiscount);
    if (amountEligibleForPoints <= 0) return 0;
    const pointsToEarn = Math.floor(amountEligibleForPoints * pointsPerGel);
    if (pointsToEarn <= 0) return 0;

    const user: any = await this.firestoreService.findById('users', userId);
    const current = user?.loyaltyPoints != null ? Number(user.loyaltyPoints) : 0;
    await this.firestoreService.update('users', userId, {
      loyaltyPoints: current + pointsToEarn,
    });
    await this.firestoreService.create(COLLECTION_HISTORY, {
      userId,
      amount: pointsToEarn,
      type: LoyaltyPointsType.EARN_ORDER,
      orderId,
      description: `Points from order`,
    });
    return pointsToEarn;
  }

  /** Called when return is refunded: deduct points that were earned for that order (full or partial). */
  async refundForReturn(
    userId: string,
    orderId: string,
    pointsToRefund: number,
    description?: string,
  ): Promise<void> {
    if (pointsToRefund <= 0) return;
    const user: any = await this.firestoreService.findById('users', userId);
    const current = user?.loyaltyPoints != null ? Number(user.loyaltyPoints) : 0;
    const newBalance = Math.max(0, current - pointsToRefund);
    await this.firestoreService.update('users', userId, {
      loyaltyPoints: newBalance,
    });
    await this.firestoreService.create(COLLECTION_HISTORY, {
      userId,
      amount: -pointsToRefund,
      type: LoyaltyPointsType.REFUND,
      orderId,
      description: description || 'Refund (return)',
    });
  }
}
