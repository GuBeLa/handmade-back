import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AddResponseDto } from './dto/add-response.dto';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create support ticket' })
  async createTicket(@Request() req, @Body() createTicketDto: CreateTicketDto) {
    return this.supportService.createTicket(req.user.sub, createTicketDto);
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user support tickets' })
  async getUserTickets(@Request() req) {
    return this.supportService.getUserTickets(req.user.sub);
  }

  @Get('tickets/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all support tickets (admin only)' })
  async getAllTickets(@Query('status') status?: string) {
    return this.supportService.getAllTickets(status);
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get support ticket by ID' })
  async getTicket(@Param('id') id: string, @Request() req) {
    return this.supportService.getTicketById(id, req.user.sub);
  }

  @Put('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update support ticket' })
  async updateTicket(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Request() req,
  ) {
    return this.supportService.updateTicket(id, updateTicketDto, req.user.sub);
  }

  @Post('tickets/:id/response')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add response to support ticket' })
  async addResponse(
    @Param('id') id: string,
    @Body() addResponseDto: AddResponseDto,
    @Request() req,
  ) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    return this.supportService.addResponse(id, req.user.sub, addResponseDto, isAdmin);
  }

  @Get('faq/categories')
  @ApiOperation({ summary: 'Get FAQ categories' })
  async getFAQCategories() {
    return this.supportService.getFAQCategories();
  }

  @Get('faq')
  @ApiOperation({ summary: 'Get FAQs by category' })
  async getFAQs(@Query('categoryId') categoryId?: string) {
    return this.supportService.getFAQsByCategory(categoryId);
  }

  @Get('faq/search')
  @ApiOperation({ summary: 'Search FAQs' })
  async searchFAQs(@Query('q') query: string) {
    if (!query) {
      return [];
    }
    return this.supportService.searchFAQs(query);
  }

  @Get('faq/:id')
  @ApiOperation({ summary: 'Get FAQ by ID' })
  async getFAQ(@Param('id') id: string) {
    return this.supportService.getFAQById(id);
  }

  @Post('faq/refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Force refresh FAQ categories and FAQs (Admin only)' })
  async refreshFAQs() {
    return this.supportService.refreshFAQs();
  }
}
