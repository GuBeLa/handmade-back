import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { DeliveryMethod } from '../../common/enums/delivery-method.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private firestoreService: FirestoreService,
    private notificationsService: NotificationsService,
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

    // Calculate delivery fee
    const deliveryFee = this.calculateDeliveryFee(deliveryMethod, deliveryInfo.deliveryRegion);

    // Calculate commission
    const commissionRate = parseFloat(process.env.DEFAULT_COMMISSION_PERCENTAGE || '10') / 100;
    const commission = subtotal * commissionRate;

    const total = subtotal + deliveryFee;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const order = await this.firestoreService.create('orders', {
      orderNumber,
      buyerId,
      items: orderItems,
      subtotal,
      deliveryFee,
      commission,
      total,
      paymentMethod,
      deliveryMethod,
      deliveryAddress,
      ...deliveryInfo,
      status: OrderStatus.PENDING,
      isPaid: paymentMethod.includes('cod') ? false : true,
    });

    // Send notification
    await this.notificationsService.create({
      userId: buyerId,
      type: 'order',
      title: 'Order Placed',
      message: `Your order #${orderNumber} has been placed successfully`,
      link: `/orders/${order.id}`,
    });

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

    // Load buyer info
    for (const order of orders) {
      order.buyer = await this.firestoreService.findById('users', order.buyerId);
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

    // Send notification
    await this.notificationsService.create({
      userId: order.buyerId,
      type: 'order',
      title: 'Order Status Updated',
      message: `Your order #${order.orderNumber} status has been updated to ${status}`,
      link: `/orders/${order.id}`,
    });

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
