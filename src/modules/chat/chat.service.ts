import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateDirectMessageDto } from './dto/create-direct-message.dto';

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

  async createDirectMessage(userId: string, createDto: CreateDirectMessageDto): Promise<any> {
    const { orderId, receiverId, message } = createDto;

    // Verify receiver exists and is a seller
    const receiver: any = await this.firestoreService.findById('users', receiverId);
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    // If orderId is provided, verify order exists and user has access
    if (orderId) {
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
        throw new ForbiddenException('You are not authorized to send messages for this order');
      }

      // Use order-based chat
      return this.firestoreService.create('chat_messages', {
        orderId,
        senderId: userId,
        receiverId,
        message,
        isRead: false,
      });
    }

    // Direct chat without order - verify receiver is seller
    if (receiver.role !== 'seller' && receiver.role !== 'admin') {
      throw new BadRequestException('You can only chat with sellers');
    }

    // Verify sender is not the same as receiver
    if (userId === receiverId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    // Create direct message
    return this.firestoreService.create('chat_messages', {
      orderId: null,
      senderId: userId,
      receiverId,
      message,
      isRead: false,
    });
  }

  async getDirectMessages(sellerId: string, userId: string): Promise<any[]> {
    // Get all messages between user and seller (both directions)
    // We'll filter for null orderId client-side since Firestore doesn't support null queries well
    const sentMessages: any[] = await this.firestoreService.findAll('chat_messages', (ref) =>
      ref
        .where('senderId', '==', userId)
        .where('receiverId', '==', sellerId),
    );

    const receivedMessages: any[] = await this.firestoreService.findAll('chat_messages', (ref) =>
      ref
        .where('senderId', '==', sellerId)
        .where('receiverId', '==', userId),
    );

    // Combine, filter for null orderId, and sort by createdAt
    const allMessages = [...sentMessages, ...receivedMessages]
      .filter((msg) => !msg.orderId || msg.orderId === null)
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || 0;
        const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || 0;
        return aTime - bTime;
      });

    // Load sender and receiver info
    for (const msg of allMessages) {
      if (!msg.sender) {
        msg.sender = await this.firestoreService.findById('users', msg.senderId);
      }
      if (!msg.receiver) {
        msg.receiver = await this.firestoreService.findById('users', msg.receiverId);
      }
    }

    return allMessages;
  }

  async getConversations(userId: string): Promise<any[]> {
    // Get all unique conversations (both as sender and receiver)
    const sentMessages: any[] = await this.firestoreService.findAll('chat_messages', (ref) =>
      ref.where('senderId', '==', userId),
    );

    const receivedMessages: any[] = await this.firestoreService.findAll('chat_messages', (ref) =>
      ref.where('receiverId', '==', userId),
    );

    // Combine all messages
    const allMessages = [...sentMessages, ...receivedMessages];

    // Group by conversation partner (seller or buyer)
    const conversationsMap = new Map<string, any>();

    for (const msg of allMessages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      
      if (!conversationsMap.has(partnerId)) {
        const partner = await this.firestoreService.findById('users', partnerId);
        conversationsMap.set(partnerId, {
          partnerId,
          partner: partner ? {
            id: partner.id,
            firstName: partner.firstName,
            lastName: partner.lastName,
            avatar: partner.avatar,
            role: partner.role,
          } : null,
          lastMessage: msg,
          unreadCount: 0,
          orderId: msg.orderId,
        });
      }

      const conversation = conversationsMap.get(partnerId);
      
      // Update last message if this one is newer
      const msgTime = msg.createdAt?.toMillis?.() || (msg.createdAt?.seconds ? msg.createdAt.seconds * 1000 : 0) || 0;
      const lastMsgTime = conversation.lastMessage.createdAt?.toMillis?.() || (conversation.lastMessage.createdAt?.seconds ? conversation.lastMessage.createdAt.seconds * 1000 : 0) || 0;
      
      if (msgTime > lastMsgTime) {
        conversation.lastMessage = msg;
      }

      // Count unread messages
      if (msg.receiverId === userId && !msg.isRead) {
        conversation.unreadCount++;
      }
    }

    // Convert to array and sort by last message time
    const conversations = Array.from(conversationsMap.values()).sort((a, b) => {
      const aTime = a.lastMessage.createdAt?.toMillis?.() || (a.lastMessage.createdAt?.seconds ? a.lastMessage.createdAt.seconds * 1000 : 0) || 0;
      const bTime = b.lastMessage.createdAt?.toMillis?.() || (b.lastMessage.createdAt?.seconds ? b.lastMessage.createdAt.seconds * 1000 : 0) || 0;
      return bTime - aTime; // Most recent first
    });

    return conversations;
  }
}
