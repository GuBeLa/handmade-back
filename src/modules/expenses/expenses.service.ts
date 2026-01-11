import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Timestamp } from 'firebase-admin/firestore';

@Injectable()
export class ExpensesService {
  constructor(private firestoreService: FirestoreService) {}

  async create(sellerId: string, createDto: CreateExpenseDto): Promise<any> {
    const expenseDate = createDto.date ? new Date(createDto.date) : new Date();
    const expenseData: any = {
      sellerId,
      category: createDto.category,
      description: createDto.description,
      amount: createDto.amount,
      date: Timestamp.fromDate(expenseDate),
    };

    return this.firestoreService.create('expenses', expenseData);
  }

  async findAll(sellerId: string, month?: number, year?: number): Promise<any[]> {
    if (month !== undefined && year !== undefined) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      const expenses = await this.firestoreService.findAll('expenses', (ref) =>
        ref
          .where('sellerId', '==', sellerId)
          .where('date', '>=', Timestamp.fromDate(startDate))
          .where('date', '<=', Timestamp.fromDate(endDate))
          .orderBy('date', 'desc')
      );
      return expenses;
    } else {
      const expenses = await this.firestoreService.findAll('expenses', (ref) =>
        ref
          .where('sellerId', '==', sellerId)
          .orderBy('date', 'desc')
      );
      return expenses;
    }
  }

  async findOne(id: string, sellerId: string): Promise<any> {
    const expense: any = await this.firestoreService.findById('expenses', id);
    
    if (!expense || expense.sellerId !== sellerId) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  async update(id: string, sellerId: string, updateDto: UpdateExpenseDto): Promise<any> {
    const expense: any = await this.firestoreService.findById('expenses', id);
    
    if (!expense || expense.sellerId !== sellerId) {
      throw new NotFoundException('Expense not found');
    }

    const updateData: any = {
      ...updateDto,
      updatedAt: new Date(),
    };

    if (updateDto.date) {
      updateData.date = Timestamp.fromDate(new Date(updateDto.date));
    }

    await this.firestoreService.update('expenses', id, updateData);
    return this.findOne(id, sellerId);
  }

  async delete(id: string, sellerId: string): Promise<void> {
    const expense: any = await this.firestoreService.findById('expenses', id);
    
    if (!expense || expense.sellerId !== sellerId) {
      throw new NotFoundException('Expense not found');
    }

    await this.firestoreService.delete('expenses', id);
  }

  async getTotalExpenses(sellerId: string, month?: number, year?: number): Promise<number> {
    const expenses = await this.findAll(sellerId, month, year);
    return expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
  }
}
