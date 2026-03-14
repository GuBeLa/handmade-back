import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from '../../common/types/firestore.types';
import { Timestamp } from 'firebase-admin/firestore';
import { UserRole } from '../../common/enums/user-role.enum';

const EVENTS_COLLECTION = 'events';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private firestoreService: FirestoreService) {}

  private buildEventData(
    dto: CreateEventDto | UpdateEventDto,
    sellerId: string,
    isUpdate = false,
  ): Partial<Event> {
    const data: any = {
      ...(isUpdate ? (dto as UpdateEventDto) : dto),
    };

    if (!isUpdate) {
      data.sellerId = sellerId;
    }

    if ('childrenAllowed' in dto || 'freeEntryUntilAge' in dto) {
      data.ageRestriction = {
        childrenAllowed: (dto as any).childrenAllowed ?? false,
        ...((dto as any).freeEntryUntilAge != null && (dto as any).freeEntryUntilAge >= 0
          ? { freeEntryUntilAge: (dto as any).freeEntryUntilAge }
          : {}),
      };
      delete data.childrenAllowed;
      delete data.freeEntryUntilAge;
    }

    if (dto.doorsOpenAt) data.doorsOpenAt = Timestamp.fromDate(new Date(dto.doorsOpenAt));
    if (dto.startAt) data.startAt = Timestamp.fromDate(new Date(dto.startAt));

    return data;
  }

  async create(sellerId: string, createEventDto: CreateEventDto): Promise<Event> {
    try {
      const eventData = this.buildEventData(createEventDto, sellerId, false) as Omit<
        Event,
        'id' | 'createdAt' | 'updatedAt'
      >;
      const event = await this.firestoreService.create<Event>(
        EVENTS_COLLECTION,
        eventData,
      );
      this.logger.log(`Event created: ${event.id} by seller: ${sellerId}`);
      return event;
    } catch (error) {
      this.logger.error('Error creating event:', error);
      throw new BadRequestException('Failed to create event');
    }
  }

  async findById(id: string, userId?: string, userRole?: string): Promise<Event> {
    const event = await this.firestoreService.findById<Event>(EVENTS_COLLECTION, id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async findMyEvents(sellerId: string): Promise<Event[]> {
    const events = await this.firestoreService.findManyBy<Event>(
      EVENTS_COLLECTION,
      'sellerId',
      sellerId,
    );
    return events.sort((a, b) => {
      const aTime = a.startAt?.toMillis?.() ?? 0;
      const bTime = b.startAt?.toMillis?.() ?? 0;
      return aTime - bTime;
    });
  }

  async findAll(filters?: { sellerId?: string; status?: string; isMasterclass?: boolean }): Promise<Event[]> {
    let events: Event[];
    if (filters?.sellerId) {
      events = await this.firestoreService.findManyBy<Event>(
        EVENTS_COLLECTION,
        'sellerId',
        filters.sellerId,
      );
    } else {
      events = await this.firestoreService.findAll<Event>(EVENTS_COLLECTION);
    }
    if (filters?.status) {
      events = events.filter((e) => e.status === filters.status);
    }
    if (filters?.isMasterclass != null) {
      events = events.filter((e) => !!e.isMasterclass === !!filters.isMasterclass);
    }
    return events.sort((a, b) => {
      const aTime = a.startAt?.toMillis?.() ?? 0;
      const bTime = b.startAt?.toMillis?.() ?? 0;
      return aTime - bTime;
    });
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    sellerId: string,
    userRole: string,
  ): Promise<Event> {
    const event = await this.firestoreService.findById<Event>(EVENTS_COLLECTION, id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.sellerId !== sellerId && userRole !== UserRole.ADMIN && userRole !== UserRole.MODERATOR) {
      throw new ForbiddenException('You can only update your own events');
    }
    const updateData = this.buildEventData(updateEventDto, sellerId, true);
    if (updateEventDto.doorsOpenAt)
      (updateData as any).doorsOpenAt = Timestamp.fromDate(new Date(updateEventDto.doorsOpenAt));
    if (updateEventDto.startAt)
      (updateData as any).startAt = Timestamp.fromDate(new Date(updateEventDto.startAt));
    const updated = await this.firestoreService.update<Event>(
      EVENTS_COLLECTION,
      id,
      updateData,
    );
    this.logger.log(`Event updated: ${id}`);
    return updated;
  }

  async delete(id: string, sellerId: string, userRole: string): Promise<void> {
    const event = await this.firestoreService.findById<Event>(EVENTS_COLLECTION, id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.sellerId !== sellerId && userRole !== UserRole.ADMIN && userRole !== UserRole.MODERATOR) {
      throw new ForbiddenException('You can only delete your own events');
    }
    await this.firestoreService.delete(EVENTS_COLLECTION, id);
    this.logger.log(`Event deleted: ${id}`);
  }

  /** Get event for purchase: must be published and have enough tickets. */
  async getEventForPurchase(eventId: string): Promise<Event> {
    const event = await this.firestoreService.findById<Event>(EVENTS_COLLECTION, eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.status !== 'published') {
      throw new BadRequestException('This event is not available for purchase');
    }
    const sold = event.ticketsSold ?? 0;
    const available = (event.ticketQuantity ?? 0) - sold;
    if (available <= 0) {
      throw new BadRequestException('No tickets available for this event');
    }
    return event;
  }

  /** Reserve tickets (call when order is created). */
  async reserveTickets(eventId: string, quantity: number): Promise<void> {
    const event = await this.firestoreService.findById<Event>(EVENTS_COLLECTION, eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    const sold = event.ticketsSold ?? 0;
    const available = (event.ticketQuantity ?? 0) - sold;
    if (available < quantity) {
      throw new BadRequestException('Not enough tickets available');
    }
    await this.firestoreService.update<Event>(EVENTS_COLLECTION, eventId, {
      ticketsSold: sold + quantity,
    } as Partial<Event>);
    this.logger.log(`Reserved ${quantity} tickets for event ${eventId}`);
  }

  /** Release tickets (call when order is cancelled). */
  async releaseTickets(eventId: string, quantity: number): Promise<void> {
    const event = await this.firestoreService.findById<Event>(EVENTS_COLLECTION, eventId);
    if (!event) return;
    const sold = event.ticketsSold ?? 0;
    const newSold = Math.max(0, sold - quantity);
    await this.firestoreService.update<Event>(EVENTS_COLLECTION, eventId, {
      ticketsSold: newSold,
    } as Partial<Event>);
    this.logger.log(`Released ${quantity} tickets for event ${eventId}`);
  }
}
