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

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send message' })
  async create(@Request() req, @Body() createDto: CreateMessageDto) {
    return this.chatService.create(req.user.sub, createDto);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get order messages' })
  async getOrderMessages(@Param('orderId') orderId: string, @Request() req) {
    return this.chatService.getOrderMessages(orderId, req.user.sub);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark message as read' })
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.chatService.markAsRead(id, req.user.sub);
  }
}

