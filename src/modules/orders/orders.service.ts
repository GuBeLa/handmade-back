import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { DeliveryMethod } from '../../common/enums/delivery-method.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../promotions/coupons.service';

@Injectable()
export class OrdersService {
  constructor(
    private firestoreService: FirestoreService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => CouponsService))
    private readonly couponsService: CouponsService,
  ) {}

  async create(buyerId: string, createDto: CreateOrderDto): Promise<any> {
    const { items, paymentMethod, deliveryMethod, deliveryAddress, ...deliveryInfo } = createDto;

    // Validate products and calculate totals
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const product: any = await this.firestoreService.findById('products', item.productId);

      if (!product || !product.isActive) {
        throw new BadRequestException(`Product ${item.productId} not found or inactive`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for product ${product.title}`);
      }

      const price = product.discountPrice || product.price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      const orderItem: any = {
        productId: product.id,
        productTitle: product.title,
        productImage: product.images?.[0]?.url,
        price,
        quantity: item.quantity,
        total: itemTotal,
      };

      // Only add variant fields if they exist
      if (item.variantSize) {
        orderItem.variantSize = item.variantSize;
      }
      if (item.variantColor) {
        orderItem.variantColor = item.variantColor;
      }

      orderItems.push(orderItem);

      // Update product stock
      await this.firestoreService.update('products', product.id, {
        stock: product.stock - item.quantity,
        totalSales: (product.totalSales || 0) + item.quantity,
      });
    }

    // Apply coupon discount if provided
    let couponDiscount = 0;
    let orderFreeShipping = false;
    let appliedCouponId: string | null = null;

    if (createDto.couponCode) {
      try {
        const couponResult = await this.couponsService.validateAndApplyCoupon(
          {
            code: createDto.couponCode,
            subtotal: subtotal,
          },
          buyerId,
        );
        couponDiscount = couponResult.discount || createDto.discount || 0;
        orderFreeShipping = couponResult.freeShipping || createDto.freeShipping || false;
        appliedCouponId = couponResult.coupon.id;
      } catch (error) {
        // If coupon validation fails, use provided discount values as fallback
        couponDiscount = createDto.discount || 0;
        orderFreeShipping = createDto.freeShipping || false;
      }
    } else {
      // Use provided discount values if no coupon code
      couponDiscount = createDto.discount || 0;
      orderFreeShipping = createDto.freeShipping || false;
    }

    // Calculate delivery fee
    let deliveryFee = this.calculateDeliveryFee(deliveryMethod, deliveryInfo.deliveryRegion);
    if (orderFreeShipping) {
      deliveryFee = 0;
    }

    // Calculate commission (based on subtotal before discount)
    const commissionRate = parseFloat(process.env.DEFAULT_COMMISSION_PERCENTAGE || '10') / 100;
    const commission = subtotal * commissionRate;

    // Calculate final total
    const total = Math.max(0, subtotal - couponDiscount + deliveryFee);

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Prepare order data
    const orderData: any = {
      orderNumber,
      buyerId,
      items: orderItems,
      subtotal,
      discount: couponDiscount,
      freeShipping: orderFreeShipping,
      deliveryFee,
      commission,
      total,
      paymentMethod,
      deliveryMethod,
      deliveryAddress,
      status: OrderStatus.PENDING,
      isPaid: paymentMethod.includes('cod') ? false : true,
    };

    // Only include couponCode if it exists and is not undefined
    if (createDto.couponCode) {
      orderData.couponCode = createDto.couponCode;
    }

    // Add deliveryInfo fields only if they are defined (filter out undefined values)
    Object.keys(deliveryInfo).forEach(key => {
      const value = (deliveryInfo as any)[key];
      if (value !== undefined && value !== null) {
        orderData[key] = value;
      }
    });

    // Create order
    const order = await this.firestoreService.create('orders', orderData);

    // Increment coupon usage count if coupon was applied
    if (appliedCouponId) {
      try {
        await this.couponsService.incrementCouponUsage(appliedCouponId);
      } catch (error) {
        // Log error but don't fail the order creation
        console.error('Failed to increment coupon usage:', error);
      }
    }

    // Send notification to buyer
    await this.notificationsService.create({
      userId: buyerId,
      type: 'order',
      title: 'Order Placed',
      message: `Your order #${orderNumber} has been placed successfully`,
      link: `/orders/${order.id}`,
    });

    // Send notification to seller(s) - get unique seller IDs from order items
    const sellerIds = new Set<string>();
    for (const item of orderItems) {
      const product: any = await this.firestoreService.findById('products', item.productId);
      if (product?.sellerId) {
        sellerIds.add(product.sellerId);
      }
    }

    // Send notification to each seller
    for (const sellerId of sellerIds) {
      await this.notificationsService.create({
        userId: sellerId,
        type: 'order',
        title: 'New Order',
        message: `You have a new order #${orderNumber}`,
        link: `/orders/${order.id}`,
      });
    }

    return this.findOne(order.id);
  }

  async findAll(buyerId?: string, sellerId?: string): Promise<any[]> {
    let queryRef: any = this.firestoreService.collection('orders');

    if (buyerId) {
      queryRef = queryRef.where('buyerId', '==', buyerId);
    }

    const snapshot = await queryRef.orderBy('createdAt', 'desc').get();
    let orders: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Filter by seller if needed
    if (sellerId) {
      const sellerProducts: any[] = await this.firestoreService.findAll('products', (ref) =>
        ref.where('sellerId', '==', sellerId),
      );
      const productIds = sellerProducts.map((p: any) => p.id);
      
      orders = orders.filter((order: any) => {
        return order.items?.some((item: any) => productIds.includes(item.productId));
      });
    }

    // Load buyer info and convert Timestamps to proper format
    for (const order of orders) {
      order.buyer = await this.firestoreService.findById('users', order.buyerId);
      
      // Convert Firestore Timestamps to Date objects for proper JSON serialization
      if (order.createdAt && typeof order.createdAt.toDate === 'function') {
        order.createdAt = order.createdAt.toDate();
      } else if (order.createdAt && typeof order.createdAt === 'object' && 'seconds' in order.createdAt) {
        order.createdAt = new Date(order.createdAt.seconds * 1000);
      }
      
      if (order.updatedAt && typeof order.updatedAt.toDate === 'function') {
        order.updatedAt = order.updatedAt.toDate();
      } else if (order.updatedAt && typeof order.updatedAt === 'object' && 'seconds' in order.updatedAt) {
        order.updatedAt = new Date(order.updatedAt.seconds * 1000);
      }
      
      // Convert other date fields if they exist
      if (order.shippedAt && typeof order.shippedAt.toDate === 'function') {
        order.shippedAt = order.shippedAt.toDate();
      }
      if (order.deliveredAt && typeof order.deliveredAt.toDate === 'function') {
        order.deliveredAt = order.deliveredAt.toDate();
      }
      if (order.cancelledAt && typeof order.cancelledAt.toDate === 'function') {
        order.cancelledAt = order.cancelledAt.toDate();
      }
    }

    return orders;
  }

  async findOne(id: string): Promise<any> {
    const order: any = await this.firestoreService.findById('orders', id);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Load buyer
    order.buyer = await this.firestoreService.findById('users', order.buyerId);

    // Load products for items
    if (order.items) {
      for (const item of order.items) {
        item.product = await this.firestoreService.findById('products', item.productId);
      }
    }

    // Convert Firestore Timestamps to Date objects for proper JSON serialization
    if (order.createdAt && typeof order.createdAt.toDate === 'function') {
      order.createdAt = order.createdAt.toDate();
    } else if (order.createdAt && typeof order.createdAt === 'object' && 'seconds' in order.createdAt) {
      order.createdAt = new Date(order.createdAt.seconds * 1000);
    }
    
    if (order.updatedAt && typeof order.updatedAt.toDate === 'function') {
      order.updatedAt = order.updatedAt.toDate();
    } else if (order.updatedAt && typeof order.updatedAt === 'object' && 'seconds' in order.updatedAt) {
      order.updatedAt = new Date(order.updatedAt.seconds * 1000);
    }
    
    // Convert other date fields if they exist
    if (order.shippedAt && typeof order.shippedAt?.toDate === 'function') {
      order.shippedAt = order.shippedAt.toDate();
    } else if (order.shippedAt && typeof order.shippedAt === 'object' && 'seconds' in order.shippedAt) {
      order.shippedAt = new Date(order.shippedAt.seconds * 1000);
    }
    
    if (order.deliveredAt && typeof order.deliveredAt?.toDate === 'function') {
      order.deliveredAt = order.deliveredAt.toDate();
    } else if (order.deliveredAt && typeof order.deliveredAt === 'object' && 'seconds' in order.deliveredAt) {
      order.deliveredAt = new Date(order.deliveredAt.seconds * 1000);
    }
    
    if (order.cancelledAt && typeof order.cancelledAt?.toDate === 'function') {
      order.cancelledAt = order.cancelledAt.toDate();
    } else if (order.cancelledAt && typeof order.cancelledAt === 'object' && 'seconds' in order.cancelledAt) {
      order.cancelledAt = new Date(order.cancelledAt.seconds * 1000);
    }

    return order;
  }

  async updateStatus(
    id: string,
    updateDto: UpdateOrderStatusDto,
    userId: string,
  ): Promise<any> {
    const order: any = await this.findOne(id);
    const { status } = updateDto;

    const updateData: any = { status };

    if (status === OrderStatus.SHIPPED) {
      updateData.shippedAt = new Date();
    } else if (status === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    } else if (status === OrderStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = updateDto.reason;

      // Restore stock
      if (order.items) {
        for (const item of order.items) {
          const product: any = await this.firestoreService.findById('products', item.productId);
          if (product) {
            await this.firestoreService.update('products', product.id, {
              stock: (product.stock || 0) + item.quantity,
              totalSales: (product.totalSales || 0) - item.quantity,
            });
          }
        }
      }
    }

    await this.firestoreService.update('orders', id, updateData);

    // Send notification to buyer
    await this.notificationsService.create({
      userId: order.buyerId,
      type: 'order',
      title: 'Order Status Updated',
      message: `Your order #${order.orderNumber} status has been updated to ${status}`,
      link: `/orders/${order.id}`,
    });

    // Send notification to seller(s) - get unique seller IDs from order items
    const sellerIds = new Set<string>();
    for (const item of order.items || []) {
      const product: any = await this.firestoreService.findById('products', item.productId);
      if (product?.sellerId) {
        sellerIds.add(product.sellerId);
      }
    }

    // Send notification to each seller
    for (const sellerId of sellerIds) {
      await this.notificationsService.create({
        userId: sellerId,
        type: 'order',
        title: 'Order Status Updated',
        message: `Order #${order.orderNumber} status has been updated to ${status}`,
        link: `/orders/${order.id}`,
      });
    }

    return this.findOne(id);
  }

  private calculateDeliveryFee(method: DeliveryMethod, region?: string): number {
    if (method === DeliveryMethod.PICKUP) {
      return 0;
    }

    if (
      method === DeliveryMethod.COURIER ||
      method === DeliveryMethod.COURIER_TBILISI ||
      method === DeliveryMethod.COURIER_BATUMI ||
      method === DeliveryMethod.COURIER_KUTAISI
    ) {
      return 10;
    }

    if (method === DeliveryMethod.GEORGIA_POST || method === DeliveryMethod.OTHER_LOGISTICS) {
      return 15;
    }

    return 0;
  }
}
