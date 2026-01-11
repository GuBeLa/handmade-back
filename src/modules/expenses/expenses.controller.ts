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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@ApiTags('Expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create expense' })
  async create(@Request() req, @Body() createDto: CreateExpenseDto) {
    return this.expensesService.create(req.user.sub, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get seller expenses' })
  async findAll(
    @Request() req,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const monthNum = month ? parseInt(month, 10) : undefined;
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.expensesService.findAll(req.user.sub, monthNum, yearNum);
  }

  @Get('total')
  @ApiOperation({ summary: 'Get total expenses' })
  async getTotal(
    @Request() req,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const monthNum = month ? parseInt(month, 10) : undefined;
    const yearNum = year ? parseInt(year, 10) : undefined;
    const total = await this.expensesService.getTotalExpenses(req.user.sub, monthNum, yearNum);
    return { total };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.expensesService.findOne(id, req.user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update expense' })
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, req.user.sub, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete expense' })
  async delete(@Param('id') id: string, @Request() req) {
    return this.expensesService.delete(id, req.user.sub);
  }
}
