import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private firestoreService: FirestoreService) {}

  async create(createDto: CreateNotificationDto): Promise<any> {
    return this.firestoreService.create('notifications', createDto);
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
      readAt: new Date(),
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const notifications: any[] = await this.firestoreService.findAll('notifications', (ref) =>
      ref.where('userId', '==', userId).where('isRead', '==', false),
    );

    for (const notification of notifications) {
      await this.firestoreService.update('notifications', notification.id, {
        isRead: true,
        readAt: new Date(),
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
