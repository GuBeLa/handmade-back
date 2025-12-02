import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class AnalyticsService {
  constructor(private firestoreService: FirestoreService) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get all orders
    const allOrders: any[] = await this.firestoreService.findAll('orders');
    const monthlyOrders = allOrders.filter((o: any) => {
      const createdAt = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return createdAt >= startOfMonth;
    });
    const yearlyOrders = allOrders.filter((o: any) => {
      const createdAt = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return createdAt >= startOfYear;
    });

    const paidOrders = allOrders.filter((o: any) => o.isPaid);
    const monthlyPaidOrders = monthlyOrders.filter((o: any) => o.isPaid);
    const yearlyPaidOrders = yearlyOrders.filter((o: any) => o.isPaid);

    const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const monthlyRevenue = monthlyPaidOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const yearlyRevenue = yearlyPaidOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    const products = await this.firestoreService.findAll('products', (ref) =>
      ref.where('isActive', '==', true),
    );

    const users = await this.firestoreService.findAll('users', (ref) =>
      ref.where('role', '==', 'buyer'),
    );

    const sellers = await this.firestoreService.findAll('users', (ref) =>
      ref.where('role', '==', 'seller'),
    );

    const pendingOrders = allOrders.filter((o: any) => o.status === OrderStatus.PENDING);

    return {
      totalOrders: allOrders.length,
      totalRevenue,
      monthlyOrders: monthlyOrders.length,
      monthlyRevenue,
      yearlyOrders: yearlyOrders.length,
      yearlyRevenue,
      totalProducts: products.length,
      totalUsers: users.length,
      totalSellers: sellers.length,
      pendingOrders: pendingOrders.length,
    };
  }

  async getSellerStats(sellerId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get seller products
    const sellerProducts: any[] = await this.firestoreService.findAll('products', (ref) =>
      ref.where('sellerId', '==', sellerId),
    );

    const productIds = sellerProducts.map((p: any) => p.id);

    // Get orders with seller's products
    const allOrders: any[] = await this.firestoreService.findAll('orders');
    const orders = allOrders.filter((order: any) =>
      order.items?.some((item: any) => productIds.includes(item.productId)),
    );

    const monthlyOrders = orders.filter((o: any) => {
      const createdAt = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return createdAt >= startOfMonth;
    });

    const totalSales = orders
      .filter((o: any) => o.isPaid)
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const monthlySales = monthlyOrders
      .filter((o: any) => o.isPaid)
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    return {
      totalProducts: sellerProducts.length,
      totalSales,
      monthlySales,
      totalOrders: orders.length,
      monthlyOrders: monthlyOrders.length,
    };
  }
}
