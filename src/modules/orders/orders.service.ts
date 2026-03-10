import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { DeliveryMethod } from '../../common/enums/delivery-method.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../promotions/coupons.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class OrdersService {
  constructor(
    private firestoreService: FirestoreService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => CouponsService))
    private readonly couponsService: CouponsService,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  async create(buyerId: string, createDto: CreateOrderDto): Promise<any> {
    // Normalize nested delivery address to flat fields if provided
    if (createDto.deliveryAddressDetails) {
      const d = createDto.deliveryAddressDetails;
      const namePart = [d.firstName, d.lastName].filter(Boolean).join(' ');
      const addressParts = [d.street, d.city, d.region, d.postalCode].filter(Boolean);
      createDto.deliveryAddress = [namePart, addressParts.join(', ')].filter(Boolean).join(', ') || d.street;
      createDto.deliveryRegion = d.region;
      createDto.deliveryPhone = d.phone;
    }
    const { items, paymentMethod, deliveryMethod, deliveryAddress, ...deliveryInfo } = createDto;

    // Validate products and calculate totals
    let subtotal = 0;
    const orderItems: any[] = [];

    // Split payments (e.g. BOG) support max 10 recipient accounts per order
    const MAX_SHOPS_PER_ORDER = 10;
    const sellerIdsInOrder = new Set<string>();
    const stockUpdates: { productId: string; quantity: number; stock: number; totalSales: number }[] = [];

    for (const item of items) {
      const product: any = await this.firestoreService.findById('products', item.productId);

      if (!product || !product.isActive) {
        throw new BadRequestException(`Product ${item.productId} not found or inactive`);
      }

      if (product.sellerId) {
        sellerIdsInOrder.add(product.sellerId);
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
        sellerId: product.sellerId,
        status: OrderStatus.PENDING,
      };

      if (deliveryMethod === DeliveryMethod.PICKUP && product.sellerId) {
        try {
          const sellerProfile: any = await this.firestoreService.findOneBy(
            'seller_profiles',
            'userId',
            product.sellerId,
          );
          if (sellerProfile && sellerProfile.address) {
            orderItem.pickupLocation = sellerProfile.address;
            if (sellerProfile.shopName) {
              orderItem.pickupShopName = sellerProfile.shopName;
            }
          }
        } catch (error) {
          console.error('Error loading seller profile for pickup location:', error);
        }
      }

      if (item.variantSize) orderItem.variantSize = item.variantSize;
      if (item.variantColor) orderItem.variantColor = item.variantColor;

      orderItems.push(orderItem);
      stockUpdates.push({
        productId: product.id,
        quantity: item.quantity,
        stock: product.stock,
        totalSales: product.totalSales || 0,
      });
    }

    if (sellerIdsInOrder.size > MAX_SHOPS_PER_ORDER) {
      throw new BadRequestException(
        `შეკვეთაში მაქსიმუმ ${MAX_SHOPS_PER_ORDER} სხვადასხვა მაღაზიის ნივთი შეიძლება. გთხოვთ წაშალოთ ნივთები ან განახორციელოთ ცალკე შეკვეთა.`
      );
    }

    for (const u of stockUpdates) {
      await this.firestoreService.update('products', u.productId, {
        stock: u.stock - u.quantity,
        totalSales: u.totalSales + u.quantity,
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

    // Calculate delivery fee based on region and city
    let deliveryFee = this.calculateDeliveryFee(
      deliveryMethod,
      deliveryInfo.deliveryRegion,
      deliveryInfo.deliveryCity,
      deliveryInfo.isRural,
    );
    if (orderFreeShipping) {
      deliveryFee = 0;
    }

    // Calculate commission (based on subtotal before discount)
    // Get commission rate from subscription if available, otherwise use default
    let commissionRate = parseFloat(process.env.DEFAULT_COMMISSION_PERCENTAGE || '10') / 100;
    
    // Get seller ID from first product (assuming all products are from same seller)
    if (orderItems.length > 0) {
      const firstProduct: any = await this.firestoreService.findById('products', orderItems[0].productId);
      if (firstProduct?.sellerId) {
        try {
          const subscriptionRate = await this.subscriptionsService.getCommissionRate(firstProduct.sellerId);
          commissionRate = subscriptionRate / 100;
        } catch (error) {
          // If subscription service fails, use default rate
          console.error('Error getting commission rate from subscription:', error);
        }
      }
    }
    
    const commission = subtotal * commissionRate;

    // Loyalty points redemption (validate and compute discount before creating order)
    let loyaltyDiscount = 0;
    let loyaltyPointsUsed = 0;
    if (createDto.loyaltyPointsToRedeem && createDto.loyaltyPointsToRedeem > 0) {
      try {
        const validation = await this.loyaltyService.validateRedeem(
          buyerId,
          createDto.loyaltyPointsToRedeem,
          subtotal,
        );
        if (validation.allowedPoints > 0) {
          loyaltyDiscount = validation.discountAmount;
          loyaltyPointsUsed = validation.allowedPoints;
        }
      } catch (e) {
        // ignore invalid redeem
      }
    }

    // Calculate final total
    const total = Math.max(0, subtotal - couponDiscount - loyaltyDiscount + deliveryFee);

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Prepare order data
    const orderData: any = {
      orderNumber,
      buyerId,
      items: orderItems,
      subtotal,
      discount: couponDiscount,
      loyaltyPointsUsed: loyaltyPointsUsed || 0,
      loyaltyPointsEarned: 0, // set when order is delivered
      freeShipping: orderFreeShipping,
      deliveryFee,
      commission,
      total,
      paymentMethod,
      deliveryMethod,
      deliveryAddress,
      status: OrderStatus.PENDING,
      isPaid: false, // Set true by payment webhook (Flitt) or when COD delivered
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

    // Add pickup location if delivery method is PICKUP
    if (deliveryMethod === DeliveryMethod.PICKUP && createDto.pickupLocation) {
      orderData.pickupLocation = createDto.pickupLocation;
    }

    // Create order
    const order = await this.firestoreService.create('orders', orderData);

    // Deduct loyalty points and record history (after order is created so we have order.id)
    if (loyaltyPointsUsed > 0) {
      try {
        await this.loyaltyService.redeem(buyerId, order.id, loyaltyPointsUsed, subtotal);
      } catch (e) {
        console.error('Loyalty redeem failed after order create:', e);
        // Optionally revert order or leave as-is; for now we leave order with loyaltyPointsUsed
      }
    }

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
      // Award loyalty points (only once; order total already includes any loyalty discount)
      const pointsUsed = order.loyaltyPointsUsed ?? 0;
      if ((order.loyaltyPointsEarned ?? 0) === 0 && order.total != null) {
        try {
          const earned = await this.loyaltyService.earnForOrder(
            order.buyerId,
            id,
            order.total,
            pointsUsed,
          );
          if (earned > 0) {
            updateData.loyaltyPointsEarned = earned;
          }
        } catch (e) {
          console.error('Loyalty earnForOrder failed:', e);
        }
      }
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

  /**
   * Store BOG order id on our order (for callback lookup).
   */
  async setOrderBogOrderId(orderId: string, bogOrderId: string): Promise<void> {
    try {
      const order: any = await this.firestoreService.findById('orders', orderId);
      if (!order) return;
      await this.firestoreService.update('orders', orderId, { bogOrderId });
    } catch (e) {
      console.error('setOrderBogOrderId failed:', e);
    }
  }

  /**
   * Mark that BOG payment for this order is reservation-only (e.g. 5 GEL). Callback will set reservationFeePaid.
   */
  async setOrderBogReservationOnly(orderId: string, value: boolean): Promise<void> {
    try {
      const order: any = await this.firestoreService.findById('orders', orderId);
      if (!order) return;
      await this.firestoreService.update('orders', orderId, { bogReservationOnly: value });
    } catch (e) {
      console.error('setOrderBogReservationOnly failed:', e);
    }
  }

  /**
   * Mark order reservation fee as paid (for pay-on-site: 5 GEL paid by card, rest paid on pickup).
   */
  async setOrderReservationFeePaid(orderId: string): Promise<void> {
    try {
      const order: any = await this.firestoreService.findById('orders', orderId);
      if (!order) return;
      await this.firestoreService.update('orders', orderId, {
        reservationFeePaid: true,
        bogReservationOnly: false,
      });
    } catch (e) {
      console.error('setOrderReservationFeePaid failed:', e);
    }
  }

  /**
   * Find order by BOG order id (for callback).
   */
  async findByBogOrderId(bogOrderId: string): Promise<any | null> {
    return this.firestoreService.findOneBy('orders', 'bogOrderId', bogOrderId);
  }

  /**
   * Mark order as paid (called from Flitt or BOG webhook).
   */
  async setOrderPaid(orderId: string): Promise<void> {
    try {
      const order: any = await this.firestoreService.findById('orders', orderId);
      if (!order) {
        console.warn(`Flitt webhook: order not found: ${orderId}`);
        return;
      }
      await this.firestoreService.update('orders', orderId, {
        isPaid: true,
        status: OrderStatus.CONFIRMED,
      });
      console.log(`Order ${orderId} marked as paid (Flitt webhook).`);
    } catch (e) {
      console.error('setOrderPaid failed:', e);
    }
  }

  private calculateDeliveryFee(method: DeliveryMethod, region?: string, city?: string, isRural?: boolean): number {
    if (method === DeliveryMethod.PICKUP) {
      return 0;
    }

    // Regional delivery pricing for Georgia
    // Tbilisi: 5₾ (1-2 days)
    if (region?.toLowerCase() === 'tbilisi' || city?.toLowerCase() === 'tbilisi') {
      return 5;
    }

    // Batumi, Kutaisi: 8₾ (2-3 days)
    if (city && ['batumi', 'kutaisi'].includes(city.toLowerCase())) {
      return 8;
    }

    // Villages/Rural areas: 15₾ (5-7 days)
    if (isRural) {
      return 15;
    }

    // Other cities: 10₾ (3-5 days) - default
    return 10;

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
