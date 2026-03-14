import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PurchaseEventTicketDto } from './dto/purchase-event-ticket.dto';
import { OrdersService } from '../orders/orders.service';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create event (seller)' })
  async create(@Request() req: any, @Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(req.user.sub, createEventDto);
  }

  @Post(':id/purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase event tickets (creates order)' })
  async purchase(
    @Param('id') id: string,
    @Body() dto: PurchaseEventTicketDto,
    @Request() req: any,
  ) {
    return this.ordersService.createEventOrder(req.user.sub, id, dto.quantity);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my events (seller)' })
  async getMyEvents(@Request() req: any) {
    return this.eventsService.findMyEvents(req.user.sub);
  }

  @Get('share-preview/:id')
  @ApiOperation({ summary: 'HTML share preview for social (OG image = event cover)' })
  async sharePreview(@Param('id') id: string, @Res() res: Response) {
    return this.eventsService.getSharePreviewHtml(id, res);
  }

  @Get()
  @ApiOperation({ summary: 'List events (public)' })
  async list(
    @Query('sellerId') sellerId?: string,
    @Query('status') status?: string,
    @Query('isMasterclass') isMasterclass?: string,
  ) {
    const filters: any = {};
    if (sellerId) filters.sellerId = sellerId;
    if (status) filters.status = status;
    if (isMasterclass !== undefined) filters.isMasterclass = isMasterclass === 'true';
    return this.eventsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID (public)' })
  async getOne(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.findById(id, req.user?.sub, req.user?.role);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Request() req: any,
  ) {
    return this.eventsService.update(id, updateEventDto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete event' })
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.eventsService.delete(id, req.user.sub, req.user.role);
    return { message: 'Event deleted' };
  }
}
