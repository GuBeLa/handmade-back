import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { ExpensesService } from '../expenses/expenses.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private firestoreService: FirestoreService,
    private expensesService: ExpensesService,
  ) {}

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

  async getSellerStats(sellerId: string, month?: number, year?: number) {
    const now = new Date();
    const selectedMonth = month !== undefined ? month : now.getMonth();
    const selectedYear = year !== undefined ? year : now.getFullYear();
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

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
      return createdAt >= startOfMonth && createdAt <= endOfMonth;
    });

    const totalSales = orders
      .filter((o: any) => o.isPaid)
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const monthlySales = monthlyOrders
      .filter((o: any) => o.isPaid)
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    // Get expenses for the selected month
    const monthlyExpenses = await this.expensesService.getTotalExpenses(sellerId, selectedMonth, selectedYear);
    const totalExpenses = await this.expensesService.getTotalExpenses(sellerId);

    // Calculate net income
    const monthlyNetIncome = monthlySales - monthlyExpenses;
    const totalNetIncome = totalSales - totalExpenses;

    // ნახვები და კლიკები — seller-ის პროდუქტებიდან
    const totalViews = sellerProducts.reduce((sum: number, p: any) => sum + (p.views || 0), 0);
    const totalClicks = sellerProducts.reduce((sum: number, p: any) => sum + (p.clicks || 0), 0);

    return {
      totalProducts: sellerProducts.length,
      totalSales,
      monthlySales,
      totalOrders: orders.length,
      monthlyOrders: monthlyOrders.length,
      monthlyExpenses,
      totalExpenses,
      monthlyNetIncome,
      totalNetIncome,
      totalViews,
      totalClicks,
      month: selectedMonth,
      year: selectedYear,
    };
  }
}
