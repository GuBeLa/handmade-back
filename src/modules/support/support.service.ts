import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddResponseDto } from './dto/add-response.dto';
import { SupportTicket, FAQCategory, FAQ } from '../../common/types/firestore.types';
import { Timestamp } from 'firebase-admin/firestore';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private firestoreService: FirestoreService) {}

  /**
   * Create a new support ticket
   */
  async createTicket(userId: string, createTicketDto: CreateTicketDto): Promise<SupportTicket> {
    try {
      // Generate ticket number
      const ticketNumber = await this.generateTicketNumber();

      const ticketData = {
        userId,
        ticketNumber,
        subject: createTicketDto.subject,
        message: createTicketDto.message,
        status: 'open' as const,
        priority: createTicketDto.priority || 'medium',
        category: createTicketDto.category,
        orderId: createTicketDto.orderId,
        productId: createTicketDto.productId,
        responses: [],
      };

      const ticket = await this.firestoreService.create<SupportTicket>(
        'support_tickets',
        ticketData,
      );

      this.logger.log(`Support ticket created: ${ticket.id} by user: ${userId}`);

      return ticket;
    } catch (error) {
      this.logger.error('Error creating support ticket:', error);
      throw new BadRequestException('Failed to create support ticket');
    }
  }

  /**
   * Get all tickets for a user
   */
  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    try {
      const tickets = await this.firestoreService.findManyBy<SupportTicket>(
        'support_tickets',
        'userId',
        userId,
      );

      // Sort by created date (newest first)
      return tickets.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      this.logger.error('Error fetching user tickets:', error);
      throw new BadRequestException('Failed to fetch tickets');
    }
  }

  /**
   * Get a single ticket by ID
   */
  async getTicketById(ticketId: string, userId?: string): Promise<SupportTicket> {
    try {
      const ticket = await this.firestoreService.findById<SupportTicket>(
        'support_tickets',
        ticketId,
      );

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      // Check if user has access to this ticket
      if (userId && ticket.userId !== userId) {
        // TODO: Check if user is admin
        throw new BadRequestException('Access denied');
      }

      return ticket;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error fetching ticket:', error);
      throw new BadRequestException('Failed to fetch ticket');
    }
  }

  /**
   * Update a ticket
   */
  async updateTicket(
    ticketId: string,
    updateTicketDto: UpdateTicketDto,
    userId?: string,
  ): Promise<SupportTicket> {
    try {
      const ticket = await this.getTicketById(ticketId, userId);

      // Check if user has permission to update
      if (userId && ticket.userId !== userId) {
        // TODO: Check if user is admin
        throw new BadRequestException('Access denied');
      }

      const updateData: any = {
        ...updateTicketDto,
        updatedAt: Timestamp.now(),
      };

      // If status is resolved, set resolvedAt
      if (updateTicketDto.status === 'resolved' && !ticket.resolvedAt) {
        updateData.resolvedAt = Timestamp.now();
      }

      const updated = await this.firestoreService.update<SupportTicket>(
        'support_tickets',
        ticketId,
        updateData,
      );

      this.logger.log(`Support ticket updated: ${ticketId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error updating ticket:', error);
      throw new BadRequestException('Failed to update ticket');
    }
  }

  /**
   * Add a response to a ticket
   */
  async addResponse(
    ticketId: string,
    userId: string,
    addResponseDto: AddResponseDto,
    isAdmin: boolean = false,
  ): Promise<SupportTicket> {
    try {
      const ticket = await this.getTicketById(ticketId);

      // Check if user has permission to respond
      if (!isAdmin && ticket.userId !== userId) {
        throw new BadRequestException('Access denied');
      }

      // Check if ticket is closed
      if (ticket.status === 'closed') {
        throw new BadRequestException('Cannot add response to closed ticket');
      }

      const response = {
        id: Date.now().toString(),
        userId,
        message: addResponseDto.message,
        isAdmin,
        createdAt: Timestamp.now(),
      };

      const responses = [...(ticket.responses || []), response];

      // Update ticket status if admin responded
      const updateData: any = {
        responses,
        updatedAt: Timestamp.now(),
      };

      if (isAdmin && ticket.status === 'open') {
        updateData.status = 'in_progress';
      }

      const updated = await this.firestoreService.update<SupportTicket>(
        'support_tickets',
        ticketId,
        updateData,
      );

      this.logger.log(`Response added to ticket: ${ticketId}`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error adding response:', error);
      throw new BadRequestException('Failed to add response');
    }
  }

  /**
   * Initialize default FAQ categories if collection is empty
   */
  private async initializeFAQCategoriesIfNeeded(): Promise<void> {
    try {
      this.logger.log('Checking if FAQ categories need initialization...');
      const existingCategories = await this.firestoreService.findAll<FAQCategory>('faq_categories');
      this.logger.log(`Found ${existingCategories.length} existing FAQ categories`);
      
      if (existingCategories.length > 0) {
        this.logger.log('FAQ categories already exist, skipping initialization');
        return; // Categories already exist
      }

      this.logger.log('No FAQ categories found, initializing default categories...');
      // Create default FAQ categories
      const defaultCategories = [
        {
          id: 'orders',
          title: 'შეკვეთები',
          titleEn: 'Orders',
          description: 'შეკვეთების შესახებ ხშირად დასმული კითხვები',
          descriptionEn: 'Frequently asked questions about orders',
          icon: 'receipt-outline',
          order: 1,
          isActive: true,
        },
        {
          id: 'payments',
          title: 'გადახდები',
          titleEn: 'Payments',
          description: 'გადახდის მეთოდებისა და პროცესების შესახებ',
          descriptionEn: 'About payment methods and processes',
          icon: 'card-outline',
          order: 2,
          isActive: true,
        },
        {
          id: 'delivery',
          title: 'მიტანა',
          titleEn: 'Delivery',
          description: 'მიტანის მეთოდები, ხარჯები და დრო',
          descriptionEn: 'Delivery methods, costs and timing',
          icon: 'car-outline',
          order: 3,
          isActive: true,
        },
        {
          id: 'returns',
          title: 'დაბრუნება/გაცვლა',
          titleEn: 'Returns/Exchanges',
          description: 'დაბრუნებისა და გაცვლის პოლიტიკა',
          descriptionEn: 'Return and exchange policy',
          icon: 'swap-horizontal-outline',
          order: 4,
          isActive: true,
        },
        {
          id: 'sellers',
          title: 'მაღაზიებისთვის',
          titleEn: 'For Sellers',
          description: 'ინფორმაცია მაღაზიებისთვის',
          descriptionEn: 'Information for sellers',
          icon: 'storefront-outline',
          order: 5,
          isActive: true,
        },
        {
          id: 'account',
          title: 'ანგარიშის მართვა',
          titleEn: 'Account Management',
          description: 'ანგარიშის პარამეტრები და მართვა',
          descriptionEn: 'Account settings and management',
          icon: 'person-outline',
          order: 6,
          isActive: true,
        },
      ];

      // Create categories in Firestore with specific IDs
      for (const category of defaultCategories) {
        try {
          const { id, ...categoryData } = category;
          this.logger.log(`Creating FAQ category: ${id} - ${category.title}`);
          await this.firestoreService.createWithId('faq_categories', id, categoryData);
          this.logger.log(`Successfully created FAQ category: ${id}`);
        } catch (categoryError: any) {
          this.logger.error(`Failed to create FAQ category ${category.id}:`, categoryError.message);
        }
      }

      this.logger.log(`Completed initialization of ${defaultCategories.length} default FAQ categories`);
    } catch (error) {
      this.logger.error('Error initializing FAQ categories:', error);
      // Don't throw - allow the method to continue even if initialization fails
    }
  }

  /**
   * Get all FAQ categories
   */
  async getFAQCategories(): Promise<FAQCategory[]> {
    try {
      // Initialize categories if collection is empty
      await this.initializeFAQCategoriesIfNeeded();

      const categories = await this.firestoreService.findAll<FAQCategory>('faq_categories');
      this.logger.log(`Found ${categories.length} FAQ categories in database`);

      // Filter active categories and sort by order
      const activeCategories = categories
        .filter((cat) => cat.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      this.logger.log(`Returning ${activeCategories.length} active FAQ categories`);
      return activeCategories;
    } catch (error) {
      this.logger.error('Error fetching FAQ categories:', error);
      throw new BadRequestException('Failed to fetch FAQ categories');
    }
  }

  /**
   * Initialize/Update default FAQs
   */
  private async initializeFAQsIfNeeded(): Promise<void> {
    try {
      this.logger.log('Checking if FAQs need initialization...');
      const existingFAQs = await this.firestoreService.findAll<FAQ>('faqs');
      
      // Only initialize if collection is empty (to avoid performance issues)
      if (existingFAQs.length === 0) {
        this.logger.log('No FAQs found, initializing default FAQs...');
        // Import FAQs from seed file
        const { seedFAQs } = await import('../../scripts/seed-faqs');
        await seedFAQs();
        this.logger.log('FAQs initialized successfully');
      } else {
        this.logger.log(`Found ${existingFAQs.length} existing FAQs, skipping initialization`);
      }
    } catch (error) {
      this.logger.error('Error initializing FAQs:', error);
      // Don't throw - allow the method to continue even if initialization fails
    }
  }

  /**
   * Get FAQs by category
   */
  async getFAQsByCategory(categoryId?: string): Promise<FAQ[]> {
    try {
      // Initialize FAQs if needed (only on first call or when collection is empty)
      const allFAQs = await this.firestoreService.findAll<FAQ>('faqs');
      if (allFAQs.length === 0) {
        await this.initializeFAQsIfNeeded();
      }

      let faqs: FAQ[];

      if (categoryId) {
        faqs = await this.firestoreService.findManyBy<FAQ>('faqs', 'categoryId', categoryId);
      } else {
        faqs = await this.firestoreService.findAll<FAQ>('faqs');
      }

      // Filter active FAQs and sort by order
      return faqs
        .filter((faq) => faq.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      this.logger.error('Error fetching FAQs:', error);
      throw new BadRequestException('Failed to fetch FAQs');
    }
  }

  /**
   * Get a single FAQ by ID
   */
  async getFAQById(faqId: string): Promise<FAQ> {
    try {
      const faq = await this.firestoreService.findById<FAQ>('faqs', faqId);

      if (!faq) {
        throw new NotFoundException('FAQ not found');
      }

      // Increment views
      await this.firestoreService.update('faqs', faqId, {
        views: (faq.views || 0) + 1,
        updatedAt: Timestamp.now(),
      });

      return {
        ...faq,
        views: (faq.views || 0) + 1,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error fetching FAQ:', error);
      throw new BadRequestException('Failed to fetch FAQ');
    }
  }

  /**
   * Search FAQs
   */
  async searchFAQs(query: string): Promise<FAQ[]> {
    try {
      const allFAQs = await this.firestoreService.findAll<FAQ>('faqs');
      const searchTerm = query.toLowerCase();

      // Filter active FAQs and search in question and answer
      const results = allFAQs.filter(
        (faq) =>
          faq.isActive !== false &&
          (faq.question?.toLowerCase().includes(searchTerm) ||
            faq.answer?.toLowerCase().includes(searchTerm) ||
            faq.questionEn?.toLowerCase().includes(searchTerm) ||
            faq.answerEn?.toLowerCase().includes(searchTerm)),
      );

      // Sort by relevance (simple: order by order field)
      return results.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      this.logger.error('Error searching FAQs:', error);
      throw new BadRequestException('Failed to search FAQs');
    }
  }

  /**
   * Generate unique ticket number
   */
  private async generateTicketNumber(): Promise<string> {
    const prefix = 'TKT';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Get all tickets (admin only)
   */
  async getAllTickets(status?: string): Promise<SupportTicket[]> {
    try {
      let tickets: SupportTicket[];

      if (status) {
        tickets = await this.firestoreService.findManyBy<SupportTicket>(
          'support_tickets',
          'status',
          status,
        );
      } else {
        tickets = await this.firestoreService.findAll<SupportTicket>('support_tickets');
      }

      // Sort by created date (newest first)
      return tickets.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      this.logger.error('Error fetching all tickets:', error);
      throw new BadRequestException('Failed to fetch tickets');
    }
  }

  /**
   * Force refresh FAQ categories and FAQs (Admin only)
   */
  async refreshFAQs(): Promise<{ message: string; categoriesUpdated: number; faqsUpdated: number }> {
    try {
      this.logger.log('Force refreshing FAQ categories and FAQs...');
      
      // Force update categories
      await this.initializeFAQCategoriesIfNeeded();
      
      // Force update FAQs by running seed script
      const { seedFAQs } = await import('../../scripts/seed-faqs');
      await seedFAQs();
      
      const categories = await this.firestoreService.findAll<FAQCategory>('faq_categories');
      const faqs = await this.firestoreService.findAll<FAQ>('faqs');
      
      this.logger.log(`FAQ refresh completed: ${categories.length} categories, ${faqs.length} FAQs`);
      
      return {
        message: 'FAQs refreshed successfully',
        categoriesUpdated: categories.length,
        faqsUpdated: faqs.length,
      };
    } catch (error) {
      this.logger.error('Error refreshing FAQs:', error);
      throw new BadRequestException('Failed to refresh FAQs');
    }
  }
}
