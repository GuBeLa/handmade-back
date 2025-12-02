import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class ChatService {
  constructor(private firestoreService: FirestoreService) {}

  async create(userId: string, createDto: CreateMessageDto): Promise<any> {
    const { orderId, receiverId, message } = createDto;

    // Verify order exists
    const order: any = await this.firestoreService.findById('orders', orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if user is buyer or seller
    const isBuyer = order.buyerId === userId;
    
    // Get seller ID from order items
    let sellerId: string | null = null;
    if (order.items && order.items.length > 0) {
      const firstProduct: any = await this.firestoreService.findById('products', order.items[0].productId);
      sellerId = firstProduct?.sellerId || null;
    }

    const isSeller = sellerId === userId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('You are not authorized to send messages for this order');
    }

    // Determine receiver
    const actualReceiverId = isBuyer ? sellerId : order.buyerId;

    if (receiverId !== actualReceiverId) {
      throw new ForbiddenException('Invalid receiver');
    }

    return this.firestoreService.create('chat_messages', {
      orderId,
      senderId: userId,
      receiverId: actualReceiverId,
      message,
      isRead: false,
    });
  }

  async getOrderMessages(orderId: string, userId: string): Promise<any[]> {
    // Verify user has access to this order
    const order: any = await this.firestoreService.findById('orders', orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isBuyer = order.buyerId === userId;
    
    let sellerId: string | null = null;
    if (order.items && order.items.length > 0) {
      const firstProduct: any = await this.firestoreService.findById('products', order.items[0].productId);
      sellerId = firstProduct?.sellerId || null;
    }

    const isSeller = sellerId === userId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('You are not authorized to view messages for this order');
    }

    const messages: any[] = await this.firestoreService.findAll('chat_messages', (ref) =>
      ref.where('orderId', '==', orderId).orderBy('createdAt', 'asc'),
    );

    // Load sender and receiver info
    for (const msg of messages) {
      msg.sender = await this.firestoreService.findById('users', msg.senderId);
      msg.receiver = await this.firestoreService.findById('users', msg.receiverId);
    }

    return messages;
  }

  async markAsRead(messageId: string, userId: string): Promise<any> {
    const message: any = await this.firestoreService.findById('chat_messages', messageId);

    if (!message || message.receiverId !== userId) {
      throw new NotFoundException('Message not found');
    }

    return this.firestoreService.update('chat_messages', messageId, {
      isRead: true,
      readAt: new Date(),
    });
  }
}
