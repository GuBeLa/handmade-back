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
  latitude?: number;
  longitude?: number;
  profilePicture?: string;
  coverPhoto?: string;
  workingHours?: {
    [key: string]: {
      open: string;
      close: string;
      closed: boolean;
    };
  };
  phone?: string;
  email?: string;
  website?: string;
  socialMedia?: any;
  categories?: string[];
  isActive: boolean;
  isVerified?: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
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
  discountPercentage?: number;
  isOnSale?: boolean;
  saleStartDate?: Date;
  saleEndDate?: Date;
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
  discount?: number;
  freeShipping?: boolean;
  couponCode?: string;
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
  images?: string[]; // Array of image URLs
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

export interface SupportTicket {
  id: string;
  userId: string;
  ticketNumber: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'order' | 'payment' | 'delivery' | 'return' | 'seller' | 'account' | 'technical' | 'other';
  orderId?: string;
  productId?: string;
  responses: Array<{
    id: string;
    userId: string;
    message: string;
    isAdmin: boolean;
    createdAt: any;
  }>;
  assignedTo?: string;
  resolvedAt?: Date;
  createdAt: any;
  updatedAt: any;
}

export interface FAQCategory {
  id: string;
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface FAQ {
  id: string;
  categoryId: string;
  question: string;
  questionEn?: string;
  answer: string;
  answerEn?: string;
  order: number;
  views: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Return {
  id: string;
  returnNumber: string;
  orderId: string;
  userId: string;
  sellerId: string;
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
  reason: 'defective' | 'wrong_product' | 'size_doesnt_fit' | 'color_mismatch' | 'other';
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_transit' | 'refunded' | 'cancelled';
  requestedAt: any;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  refundAmount?: number;
  trackingNumber?: string;
  isRefunded: boolean;
  refundedAt?: Date;
  createdAt: any;
  updatedAt: any;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
  value: number; // Percentage (0-100) or fixed amount
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  validFrom: any; // Firestore Timestamp or Date
  validUntil: any; // Firestore Timestamp or Date
  isActive: boolean;
  applicableCategories?: string[];
  applicableProducts?: string[];
  buyXQuantity?: number; // For buy_x_get_y type
  getYQuantity?: number; // For buy_x_get_y type
  description?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Promotion {
  id: string;
  title: string;
  description?: string;
  type: 'flash_sale' | 'seasonal' | 'clearance' | 'new_arrival';
  discountPercentage: number;
  products?: string[];
  categories?: string[];
  startDate: any; // Firestore Timestamp or Date
  endDate: any; // Firestore Timestamp or Date
  isActive: boolean;
  bannerImage?: string;
  bannerText?: string;
  createdAt: any;
  updatedAt: any;
}
