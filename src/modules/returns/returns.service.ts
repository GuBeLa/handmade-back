import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { Return, Order } from '../../common/types/firestore.types';
import { Timestamp } from 'firebase-admin/firestore';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);
  private readonly RETURN_WINDOW_DAYS = 14; // 14 days return window

  constructor(
    private firestoreService: FirestoreService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Create a return request
   */
  async createReturn(userId: string, createReturnDto: CreateReturnDto): Promise<Return> {
    try {
      // Get the order
      const order = await this.firestoreService.findById<Order>('orders', createReturnDto.orderId);
      
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Check if order belongs to user
      if (order.buyerId !== userId) {
        throw new BadRequestException('Access denied');
      }

      // Check if order is delivered
      if (order.status !== 'delivered' && order.status !== 'completed') {
        throw new BadRequestException('Return can only be requested for delivered orders');
      }

      // Check if order was delivered within return window (14 days)
      if (order.deliveredAt) {
        const deliveredDate = order.deliveredAt.toDate ? order.deliveredAt.toDate() : new Date(order.deliveredAt);
        const daysSinceDelivery = (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceDelivery > this.RETURN_WINDOW_DAYS) {
          throw new BadRequestException(
            `Return window has expired. Returns must be requested within ${this.RETURN_WINDOW_DAYS} days of delivery`,
          );
        }
      }

      // Check if return already exists for this order
      const existingReturns = await this.firestoreService.findManyBy<Return>(
        'returns',
        'orderId',
        createReturnDto.orderId,
      );
      
      const activeReturn = existingReturns.find(
        (r) => r.status === 'pending' || r.status === 'approved' || r.status === 'in_transit',
      );
      
      if (activeReturn) {
        throw new BadRequestException('An active return request already exists for this order');
      }

      // Validate return items
      const returnItems: any[] = [];
      let refundAmount = 0;

      for (const returnItem of createReturnDto.items) {
        const orderItem = order.items.find((item) => item.productId === returnItem.productId);
        
        if (!orderItem) {
          throw new BadRequestException(`Product ${returnItem.productId} not found in order`);
        }

        if (returnItem.quantity > orderItem.quantity) {
          throw new BadRequestException(
            `Return quantity cannot exceed ordered quantity for product ${orderItem.productTitle}`,
          );
        }

        // Check if this item has already been returned
        const alreadyReturnedQuantity = existingReturns.reduce((sum, ret) => {
          const retItem = ret.items.find((i) => i.productId === returnItem.productId);
          return sum + (retItem?.quantity || 0);
        }, 0);

        if (alreadyReturnedQuantity + returnItem.quantity > orderItem.quantity) {
          throw new BadRequestException(
            `Total returned quantity for product ${orderItem.productTitle} cannot exceed ordered quantity`,
          );
        }

        returnItems.push({
          ...orderItem,
          quantity: returnItem.quantity,
          total: orderItem.price * returnItem.quantity,
        });

        refundAmount += orderItem.price * returnItem.quantity;
      }

      // Get seller ID from order items (assuming all items are from same seller or first item's seller)
      const firstProduct = await this.firestoreService.findById('products', returnItems[0].productId);
      const sellerId = firstProduct?.sellerId || order.buyerId; // Fallback if no seller

      // Generate return number
      const returnNumber = await this.generateReturnNumber();

      // Create return request
      const returnRequest = await this.firestoreService.create<Return>('returns', {
        returnNumber,
        orderId: createReturnDto.orderId,
        userId,
        sellerId,
        items: returnItems,
        reason: createReturnDto.reason,
        description: createReturnDto.description,
        status: 'pending',
        requestedAt: Timestamp.now(),
        refundAmount,
        isRefunded: false,
      });

      // Send notification to seller
      await this.notificationsService.create({
        userId: sellerId,
        type: 'return',
        title: 'New Return Request',
        message: `Return request #${returnNumber} has been submitted for order #${order.orderNumber}`,
        link: `/returns/${returnRequest.id}`,
      });

      // Send notification to buyer
      await this.notificationsService.create({
        userId,
        type: 'return',
        title: 'Return Request Submitted',
        message: `Your return request #${returnNumber} has been submitted successfully`,
        link: `/returns/${returnRequest.id}`,
      });

      this.logger.log(`Return request created: ${returnRequest.id} by user: ${userId}`);

      return returnRequest;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error creating return request:', error);
      throw new BadRequestException('Failed to create return request');
    }
  }

  /**
   * Get return requests for a user
   */
  async getUserReturns(userId: string): Promise<Return[]> {
    try {
      const returns = await this.firestoreService.findManyBy<Return>('returns', 'userId', userId);

      // Sort by requested date (newest first)
      return returns.sort((a, b) => {
        const aTime = a.requestedAt?.toMillis?.() || 0;
        const bTime = b.requestedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      this.logger.error('Error fetching user returns:', error);
      throw new BadRequestException('Failed to fetch returns');
    }
  }

  /**
   * Get return requests for a seller
   */
  async getSellerReturns(sellerId: string): Promise<Return[]> {
    try {
      const returns = await this.firestoreService.findManyBy<Return>('returns', 'sellerId', sellerId);

      // Sort by requested date (newest first)
      return returns.sort((a, b) => {
        const aTime = a.requestedAt?.toMillis?.() || 0;
        const bTime = b.requestedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      this.logger.error('Error fetching seller returns:', error);
      throw new BadRequestException('Failed to fetch returns');
    }
  }

  /**
   * Get a single return by ID
   */
  async getReturnById(returnId: string, userId?: string, role?: string): Promise<Return> {
    try {
      const returnRequest = await this.firestoreService.findById<Return>('returns', returnId);

      if (!returnRequest) {
        throw new NotFoundException('Return request not found');
      }

      // Check if user has access
      if (userId && role !== 'admin') {
        if (returnRequest.userId !== userId && returnRequest.sellerId !== userId) {
          throw new BadRequestException('Access denied');
        }
      }

      return returnRequest;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error fetching return:', error);
      throw new BadRequestException('Failed to fetch return');
    }
  }

  /**
   * Get returns for an order
   */
  async getReturnsByOrder(orderId: string): Promise<Return[]> {
    try {
      const returns = await this.firestoreService.findManyBy<Return>('returns', 'orderId', orderId);

      // Sort by requested date (newest first)
      return returns.sort((a, b) => {
        const aTime = a.requestedAt?.toMillis?.() || 0;
        const bTime = b.requestedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      this.logger.error('Error fetching returns for order:', error);
      throw new BadRequestException('Failed to fetch returns');
    }
  }

  /**
   * Update return status (seller or admin only)
   */
  async updateReturnStatus(
    returnId: string,
    updateDto: UpdateReturnStatusDto,
    userId: string,
    role?: string,
  ): Promise<Return> {
    try {
      const returnRequest = await this.getReturnById(returnId, userId, role);

      // Check permissions (seller or admin)
      if (role !== 'admin' && returnRequest.sellerId !== userId) {
        throw new BadRequestException('Only seller or admin can update return status');
      }

      const updateData: any = {
        status: updateDto.status,
        updatedAt: Timestamp.now(),
      };

      // Handle status-specific updates
      if (updateDto.status === 'approved' && !returnRequest.approvedAt) {
        updateData.approvedAt = Timestamp.now();
        
        // Send notification to buyer
        await this.notificationsService.create({
          userId: returnRequest.userId,
          type: 'return',
          title: 'Return Approved',
          message: `Your return request #${returnRequest.returnNumber} has been approved`,
          link: `/returns/${returnId}`,
        });
      } else if (updateDto.status === 'rejected') {
        updateData.rejectedAt = Timestamp.now();
        if (updateDto.rejectionReason) {
          updateData.rejectionReason = updateDto.rejectionReason;
        }
        
        // Send notification to buyer
        await this.notificationsService.create({
          userId: returnRequest.userId,
          type: 'return',
          title: 'Return Rejected',
          message: `Your return request #${returnRequest.returnNumber} has been rejected`,
          link: `/returns/${returnId}`,
        });
      } else if (updateDto.status === 'refunded') {
        updateData.refundedAt = Timestamp.now();
        updateData.isRefunded = true;
        if (updateDto.refundAmount !== undefined) {
          updateData.refundAmount = updateDto.refundAmount;
        } else if (returnRequest.refundAmount) {
          updateData.refundAmount = returnRequest.refundAmount;
        }
        
        // Send notification to buyer
        await this.notificationsService.create({
          userId: returnRequest.userId,
          type: 'return',
          title: 'Refund Processed',
          message: `Refund for return request #${returnRequest.returnNumber} has been processed`,
          link: `/returns/${returnId}`,
        });
      }

      if (updateDto.trackingNumber) {
        updateData.trackingNumber = updateDto.trackingNumber;
      }

      const updated = await this.firestoreService.update<Return>('returns', returnId, updateData);

      this.logger.log(`Return status updated: ${returnId} to ${updateDto.status}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error updating return status:', error);
      throw new BadRequestException('Failed to update return status');
    }
  }

  /**
   * Cancel return request (buyer only)
   */
  async cancelReturn(returnId: string, userId: string): Promise<Return> {
    try {
      const returnRequest = await this.getReturnById(returnId, userId);

      // Check if user is the buyer
      if (returnRequest.userId !== userId) {
        throw new BadRequestException('Only buyer can cancel return request');
      }

      // Check if return can be cancelled
      if (returnRequest.status === 'refunded' || returnRequest.status === 'cancelled') {
        throw new BadRequestException('Cannot cancel return in current status');
      }

      const updateData: any = {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      };

      const updated = await this.firestoreService.update<Return>('returns', returnId, updateData);

      // Send notification to seller
      await this.notificationsService.create({
        userId: returnRequest.sellerId,
        type: 'return',
        title: 'Return Cancelled',
        message: `Return request #${returnRequest.returnNumber} has been cancelled by buyer`,
        link: `/returns/${returnId}`,
      });

      this.logger.log(`Return cancelled: ${returnId} by user: ${userId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error cancelling return:', error);
      throw new BadRequestException('Failed to cancel return');
    }
  }

  /**
   * Check if order is eligible for return
   */
  async checkReturnEligibility(orderId: string, userId: string): Promise<{
    eligible: boolean;
    reason?: string;
    daysRemaining?: number;
  }> {
    try {
      const order = await this.firestoreService.findById<Order>('orders', orderId);

      if (!order) {
        return { eligible: false, reason: 'Order not found' };
      }

      if (order.buyerId !== userId) {
        return { eligible: false, reason: 'Access denied' };
      }

      if (order.status !== 'delivered' && order.status !== 'completed') {
        return { eligible: false, reason: 'Order must be delivered before requesting return' };
      }

      if (!order.deliveredAt) {
        return { eligible: false, reason: 'Delivery date not found' };
      }

      const deliveredDate = order.deliveredAt.toDate ? order.deliveredAt.toDate() : new Date(order.deliveredAt);
      const daysSinceDelivery = (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24);
      const daysRemaining = Math.max(0, this.RETURN_WINDOW_DAYS - daysSinceDelivery);

      if (daysSinceDelivery > this.RETURN_WINDOW_DAYS) {
        return {
          eligible: false,
          reason: `Return window has expired. Returns must be requested within ${this.RETURN_WINDOW_DAYS} days of delivery`,
        };
      }

      // Check if there's an active return
      const existingReturns = await this.firestoreService.findManyBy<Return>(
        'returns',
        'orderId',
        orderId,
      );
      
      const activeReturn = existingReturns.find(
        (r) => r.status === 'pending' || r.status === 'approved' || r.status === 'in_transit',
      );
      
      if (activeReturn) {
        return { eligible: false, reason: 'An active return request already exists for this order' };
      }

      return { eligible: true, daysRemaining: Math.ceil(daysRemaining) };
    } catch (error) {
      this.logger.error('Error checking return eligibility:', error);
      return { eligible: false, reason: 'Error checking eligibility' };
    }
  }

  /**
   * Generate unique return number
   */
  private async generateReturnNumber(): Promise<string> {
    const prefix = 'RET';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Get all returns (admin only)
   */
  async getAllReturns(status?: string): Promise<Return[]> {
    try {
      let returns: Return[];

      if (status) {
        returns = await this.firestoreService.findManyBy<Return>('returns', 'status', status);
      } else {
        returns = await this.firestoreService.findAll<Return>('returns');
      }

      // Sort by requested date (newest first)
      return returns.sort((a, b) => {
        const aTime = a.requestedAt?.toMillis?.() || 0;
        const bTime = b.requestedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      this.logger.error('Error fetching all returns:', error);
      throw new BadRequestException('Failed to fetch returns');
    }
  }
}
