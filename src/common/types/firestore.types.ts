// Type definitions for Firestore documents
// These replace the old TypeORM entities

export interface User {
  id: string;
  email?: string;
  phone?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: 'buyer' | 'seller' | 'admin';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  refreshToken?: string;
  lastLoginAt?: Date;
  createdAt: any;
  updatedAt: any;
}

export interface SellerProfile {
  id: string;
  userId: string;
  shopName: string;
  description?: string;
  region: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  socialMedia?: any;
  isActive: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationComment?: string;
  moderatedBy?: string;
  moderatedAt?: Date;
  createdAt: any;
  updatedAt: any;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  categoryId: string;
  sellerId: string;
  images: Array<{ url: string; sortOrder: number }>;
  variants?: Array<any>;
  stock: number;
  material?: string;
  dimensions?: string;
  weight?: number;
  averageRating: number;
  totalReviews: number;
  totalSales: number;
  views: number;
  isActive: boolean;
  isFeatured: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationComment?: string;
  moderatedBy?: string;
  moderatedAt?: Date;
  createdAt: any;
  updatedAt: any;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  items: Array<{
    productId: string;
    productTitle: string;
    productImage?: string;
    price: number;
    quantity: number;
    total: number;
    variantSize?: string;
    variantColor?: string;
  }>;
  subtotal: number;
  deliveryFee: number;
  commission: number;
  total: number;
  paymentMethod: string;
  deliveryMethod: string;
  deliveryAddress?: any;
  status: string;
  isPaid: boolean;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  comment?: string;
  isVerifiedPurchase: boolean;
  isVisible: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Wishlist {
  id: string;
  userId: string;
  productId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: any;
  updatedAt: any;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  receiverId: string;
  message: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: any;
  updatedAt: any;
}

export interface Banner {
  id: string;
  title: string;
  image: string;
  link?: string;
  sortOrder: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

