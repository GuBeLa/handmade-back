import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from '../../common/types/firestore.types';
import { Timestamp } from 'firebase-admin/firestore';
import { UserRole } from '../../common/enums/user-role.enum';

const EVENTS_COLLECTION = 'events';

/** Convert Firestore Timestamp to ISO string for API responses (avoids "Invalid Date" on clients). */
function timestampToIso(ts: any): string | null {
  if (ts == null) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toISOString();
  const sec = ts.seconds ?? ts._seconds;
  if (typeof sec === 'number') return new Date(sec * 1000).toISOString();
  return null;
}

/** Serialize event for API: startAt and doorsOpenAt as ISO strings. */
function toEventResponse(event: Event): Event {
  if (!event) return event;
  const out = { ...event } as any;
  if (event.startAt != null) {
    const iso = timestampToIso(event.startAt);
    if (iso) out.startAt = iso;
  }
  if (event.doorsOpenAt != null) {
    const iso = timestampToIso(event.doorsOpenAt);
    if (iso) out.doorsOpenAt = iso;
  }
  return out as Event;
}

/** Removes undefined values from an object (recursively). Firestore does not accept undefined. */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out = {} as T;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = v && typeof v === 'object' && !((v as object) instanceof Date) && !(v?.toMillis != null)
      ? stripUndefined(v as Record<string, any>) as T[keyof T]
      : v;
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
        stripUndefined(eventData) as Omit<Event, 'id' | 'createdAt' | 'updatedAt'>,
      );
      this.logger.log(`Event created: ${event.id} by seller: ${sellerId}`);
      return event;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating event: ${message}`, error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to create event');
    }
  }

  async findById(id: string, userId?: string, userRole?: string): Promise<Event> {
    const event = await this.firestoreService.findById<Event>(EVENTS_COLLECTION, id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return toEventResponse(event);
  }

  async findMyEvents(sellerId: string): Promise<Event[]> {
    const events = await this.firestoreService.findManyBy<Event>(
      EVENTS_COLLECTION,
      'sellerId',
      sellerId,
    );
    const sorted = events.sort((a, b) => {
      const aTime = a.startAt?.toMillis?.() ?? (typeof (a.startAt as any)?.seconds === 'number' ? (a.startAt as any).seconds * 1000 : 0);
      const bTime = b.startAt?.toMillis?.() ?? (typeof (b.startAt as any)?.seconds === 'number' ? (b.startAt as any).seconds * 1000 : 0);
      return aTime - bTime;
    });
    return sorted.map(toEventResponse);
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
    const sorted = events.sort((a, b) => {
      const aTime = a.startAt?.toMillis?.() ?? (typeof (a.startAt as any)?.seconds === 'number' ? (a.startAt as any).seconds * 1000 : 0);
      const bTime = b.startAt?.toMillis?.() ?? (typeof (b.startAt as any)?.seconds === 'number' ? (b.startAt as any).seconds * 1000 : 0);
      return aTime - bTime;
    });
    return sorted.map(toEventResponse);
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
    return toEventResponse(updated);
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

  /**
   * Returns HTML page for social share preview (Facebook, etc.).
   * og:image is set to the event's cover (poster1200x630 or poster1800x600).
   */
  async getSharePreviewHtml(eventId: string, res: Response): Promise<void> {
    let event: Event;
    try {
      event = await this.findById(eventId);
    } catch {
      res.status(404).setHeader('Content-Type', 'text/html').send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>ღონისძიება ვერ მოიძებნა</title></head><body><p>ღონისძიება ვერ მოიძებნა.</p></body></html>',
      );
      return;
    }
    const title = event.titleKa || 'ღონისძიება';
    const description =
      (event.descriptionKa || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || title;
    const imageUrl =
      event.poster1200x630 || event.poster1800x600 || '';
    const baseUrl = process.env.API_BASE_URL || 'https://handmade-back-seven.vercel.app/api';
    const canonicalUrl = `${baseUrl.replace(/\/$/, '')}/events/share-preview/${event.id}`;

    const html = `<!DOCTYPE html>
<html lang="ka">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:locale" content="ka_GE">
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ''}
  ${imageUrl ? `<meta property="og:image:width" content="1200">` : ''}
  ${imageUrl ? `<meta property="og:image:height" content="630">` : ''}
  <title>${escapeHtml(title)}</title>
  <script>window.location.href="${escapeHtml(process.env.SHOP_WEB_URL || 'https://arteli.store')}";</script>
  <noscript><p><a href="${escapeHtml(process.env.SHOP_WEB_URL || 'https://arteli.store')}">გადადი arteli.store-ზე</a></p></noscript>
</head>
<body><p>${escapeHtml(title)}</p></body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
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
    return toEventResponse(event);
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
