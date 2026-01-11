import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Timestamp } from 'firebase-admin/firestore';
import * as https from 'https';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(private firestoreService: FirestoreService) {}

  async create(createDto: CreateNotificationDto): Promise<any> {
    // Save notification to Firestore
    const notification = await this.firestoreService.create('notifications', {
      ...createDto,
      isRead: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Send push notification
    try {
      await this.sendPushNotification(createDto);
    } catch (error) {
      this.logger.error('Failed to send push notification:', error);
      // Don't fail the notification creation if push fails
    }

    return notification;
  }

  /**
   * Send push notification via Expo Push Notification Service
   */
  private async sendPushNotification(createDto: CreateNotificationDto): Promise<void> {
    // Get user's push token
    const user: any = await this.firestoreService.findById('users', createDto.userId);
    if (!user?.pushToken) {
      this.logger.warn(`No push token found for user ${createDto.userId}`);
      return;
    }

    // Determine user's language preference (default to Georgian)
    const userLanguage = user.language || 'ka';
    const title = userLanguage === 'ka' && createDto.titleKa ? createDto.titleKa : createDto.title;
    const message = userLanguage === 'ka' && createDto.messageKa ? createDto.messageKa : createDto.message;

    // Build deep link data
    const data: any = {
      type: createDto.type,
      link: createDto.link,
      ...createDto.data,
    };

    // Build notification payload
    const notificationPayload: any = {
      to: user.pushToken,
      sound: createDto.sound || 'default',
      title,
      body: message,
      data,
      priority: createDto.priority || 'high',
      channelId: 'default',
    };

    // Add image if provided
    if (createDto.image) {
      notificationPayload.image = createDto.image;
    }

    // Send via Expo Push Notification Service
    await this.sendExpoPush([notificationPayload]);
  }

  /**
   * Send push notifications via Expo Push Notification Service
   */
  private async sendExpoPush(messages: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(messages);

      const options = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(this.expoPushUrl, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            // Check for errors in response
            if (response.data && response.data.some((item: any) => item.status === 'error')) {
              this.logger.error('Expo push notification errors:', response.data);
              reject(new Error('Some push notifications failed'));
            } else {
              this.logger.log(`Successfully sent ${messages.length} push notification(s)`);
              resolve();
            }
          } else {
            reject(new Error(`Expo push API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error('Error sending push notification:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Send personalized notification with template
   */
  async sendPersonalizedNotification(
    userId: string,
    type: string,
    templateData: {
      productId?: string;
      productTitle?: string;
      productImage?: string;
      orderId?: string;
      orderNumber?: string;
      sellerName?: string;
      reviewId?: string;
      price?: number;
      discount?: number;
      [key: string]: any;
    },
    language: 'ka' | 'en' = 'ka',
  ): Promise<any> {
    const templates = this.getNotificationTemplates(type, templateData, language);
    
    return this.create({
      userId,
      type: type as any,
      title: templates.title,
      titleKa: language === 'ka' ? templates.title : undefined,
      message: templates.message,
      messageKa: language === 'ka' ? templates.message : undefined,
      link: templates.link,
      image: templates.image,
      data: templates.data,
      sound: templates.sound,
      priority: templates.priority,
    });
  }

  /**
   * Get notification templates based on type
   */
  private getNotificationTemplates(
    type: string,
    data: any,
    language: 'ka' | 'en',
  ): {
    title: string;
    message: string;
    link?: string;
    image?: string;
    data?: Record<string, any>;
    sound?: string;
    priority?: 'default' | 'normal' | 'high';
  } {
    const templates: Record<string, Record<string, any>> = {
      order: {
        ka: {
          title: 'ახალი შეკვეთა',
          message: data.orderNumber
            ? `თქვენი შეკვეთა #${data.orderNumber} დადასტურებულია`
            : 'თქვენი შეკვეთა დადასტურებულია',
          link: data.orderId ? `arteli://orders/${data.orderId}` : undefined,
          image: data.productImage,
          data: { type: 'order', orderId: data.orderId },
          sound: 'default',
          priority: 'high',
        },
        en: {
          title: 'New Order',
          message: data.orderNumber
            ? `Your order #${data.orderNumber} has been confirmed`
            : 'Your order has been confirmed',
          link: data.orderId ? `arteli://orders/${data.orderId}` : undefined,
          image: data.productImage,
          data: { type: 'order', orderId: data.orderId },
          sound: 'default',
          priority: 'high',
        },
      },
      message: {
        ka: {
          title: data.sellerName ? `შეტყობინება ${data.sellerName}-სგან` : 'ახალი შეტყობინება',
          message: data.message || 'თქვენ გაქვთ ახალი შეტყობინება',
          link: data.sellerId ? `arteli://chat/${data.sellerId}` : undefined,
          data: { type: 'message', sellerId: data.sellerId },
          sound: 'default',
          priority: 'high',
        },
        en: {
          title: data.sellerName ? `Message from ${data.sellerName}` : 'New Message',
          message: data.message || 'You have a new message',
          link: data.sellerId ? `arteli://chat/${data.sellerId}` : undefined,
          data: { type: 'message', sellerId: data.sellerId },
          sound: 'default',
          priority: 'high',
        },
      },
      review: {
        ka: {
          title: 'ახალი შეფასება',
          message: data.productTitle
            ? `თქვენს პროდუქტზე "${data.productTitle}" დაწერილია ახალი შეფასება`
            : 'თქვენს პროდუქტზე დაწერილია ახალი შეფასება',
          link: data.productId ? `arteli://products/${data.productId}` : undefined,
          image: data.productImage,
          data: { type: 'review', productId: data.productId, reviewId: data.reviewId },
          sound: 'default',
          priority: 'normal',
        },
        en: {
          title: 'New Review',
          message: data.productTitle
            ? `Your product "${data.productTitle}" has a new review`
            : 'Your product has a new review',
          link: data.productId ? `arteli://products/${data.productId}` : undefined,
          image: data.productImage,
          data: { type: 'review', productId: data.productId, reviewId: data.reviewId },
          sound: 'default',
          priority: 'normal',
        },
      },
      product: {
        ka: {
          title: data.productTitle || 'ახალი პროდუქტი',
          message: data.discount
            ? `ფასდაკლება! ${data.productTitle || 'პროდუქტი'} ახლა ${data.discount}% ფასდაკლებით`
            : `ნახეთ ახალი პროდუქტი: ${data.productTitle || ''}`,
          link: data.productId ? `arteli://products/${data.productId}` : undefined,
          image: data.productImage,
          data: { type: 'product', productId: data.productId },
          sound: 'default',
          priority: 'normal',
        },
        en: {
          title: data.productTitle || 'New Product',
          message: data.discount
            ? `Sale! ${data.productTitle || 'Product'} now ${data.discount}% off`
            : `Check out new product: ${data.productTitle || ''}`,
          link: data.productId ? `arteli://products/${data.productId}` : undefined,
          image: data.productImage,
          data: { type: 'product', productId: data.productId },
          sound: 'default',
          priority: 'normal',
        },
      },
      wishlist: {
        ka: {
          title: 'ფასის დაწევა',
          message: data.productTitle
            ? `თქვენი სურვილების სიის პროდუქტი "${data.productTitle}" ახლა ${data.discount || data.price}₾-ით იაფია`
            : 'თქვენი სურვილების სიის პროდუქტზე ფასი დაეცა',
          link: data.productId ? `arteli://products/${data.productId}` : undefined,
          image: data.productImage,
          data: { type: 'wishlist', productId: data.productId },
          sound: 'default',
          priority: 'high',
        },
        en: {
          title: 'Price Drop',
          message: data.productTitle
            ? `Wishlist item "${data.productTitle}" is now ${data.discount || data.price}₾ cheaper`
            : 'A wishlist item price has dropped',
          link: data.productId ? `arteli://products/${data.productId}` : undefined,
          image: data.productImage,
          data: { type: 'wishlist', productId: data.productId },
          sound: 'default',
          priority: 'high',
        },
      },
      promotion: {
        ka: {
          title: 'სპეციალური შეთავაზება',
          message: data.message || 'გაქვთ სპეციალური შეთავაზება',
          link: data.link || undefined,
          image: data.image,
          data: { type: 'promotion', ...data },
          sound: 'default',
          priority: 'normal',
        },
        en: {
          title: 'Special Offer',
          message: data.message || 'You have a special offer',
          link: data.link || undefined,
          image: data.image,
          data: { type: 'promotion', ...data },
          sound: 'default',
          priority: 'normal',
        },
      },
    };

    return templates[type]?.[language] || {
      title: language === 'ka' ? 'ახალი შეტყობინება' : 'New Notification',
      message: language === 'ka' ? 'თქვენ გაქვთ ახალი შეტყობინება' : 'You have a new notification',
      sound: 'default',
      priority: 'normal',
    };
  }

  async getUserNotifications(userId: string): Promise<any[]> {
    return this.firestoreService.findAll('notifications', (ref) =>
      ref.where('userId', '==', userId).orderBy('createdAt', 'desc').limit(50),
    );
  }

  async markAsRead(id: string, userId: string): Promise<any> {
    const notification: any = await this.firestoreService.findById('notifications', id);

    if (!notification || notification.userId !== userId) {
      return null;
    }

    return this.firestoreService.update('notifications', id, {
      isRead: true,
      readAt: Timestamp.now(),
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const notifications: any[] = await this.firestoreService.findAll('notifications', (ref) =>
      ref.where('userId', '==', userId).where('isRead', '==', false),
    );

    for (const notification of notifications) {
      await this.firestoreService.update('notifications', notification.id, {
        isRead: true,
        readAt: Timestamp.now(),
      });
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.firestoreService.findAll('notifications', (ref) =>
      ref.where('userId', '==', userId).where('isRead', '==', false),
    );

    return notifications.length;
  }
}
