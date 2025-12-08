import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateDirectMessageDto } from './dto/create-direct-message.dto';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send message (order-based)' })
  async create(@Request() req, @Body() createDto: CreateMessageDto) {
    return this.chatService.create(req.user.sub, createDto);
  }

  @Post('direct')
  @ApiOperation({ summary: 'Send direct message (without order)' })
  async createDirect(@Request() req, @Body() createDto: CreateDirectMessageDto) {
    return this.chatService.createDirectMessage(req.user.sub, createDto);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get order messages' })
  async getOrderMessages(@Param('orderId') orderId: string, @Request() req) {
    return this.chatService.getOrderMessages(orderId, req.user.sub);
  }

  @Get('direct/:sellerId')
  @ApiOperation({ summary: 'Get direct messages with seller' })
  async getDirectMessages(@Param('sellerId') sellerId: string, @Request() req) {
    return this.chatService.getDirectMessages(sellerId, req.user.sub);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations' })
  async getConversations(@Request() req) {
    return this.chatService.getConversations(req.user.sub);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark message as read' })
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.chatService.markAsRead(id, req.user.sub);
  }
}

