import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private firestoreService: FirestoreService) {}

  async findAll(): Promise<any[]> {
    return this.firestoreService.findAll('categories', (ref) =>
      ref.where('isActive', '==', true).orderBy('sortOrder', 'asc'),
    );
  }

  async findTree(): Promise<any[]> {
    const categories = await this.firestoreService.findAll('categories', (ref) =>
      ref.where('parentId', '==', null).where('isActive', '==', true).orderBy('sortOrder', 'asc'),
    );

    // Load children for each category
    for (const category of categories) {
      category.children = await this.firestoreService.findAll('categories', (ref) =>
        ref.where('parentId', '==', category.id).where('isActive', '==', true).orderBy('sortOrder', 'asc'),
      );
    }

    return categories;
  }

  async findOne(id: string): Promise<any> {
    const category: any = await this.firestoreService.findById('categories', id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Load parent and children
    if (category.parentId) {
      category.parent = await this.firestoreService.findById('categories', category.parentId);
    }
    category.children = await this.firestoreService.findAll('categories', (ref) =>
      ref.where('parentId', '==', id),
    );

    return category;
  }

  async findBySlug(slug: string): Promise<any> {
    const category: any = await this.firestoreService.findOneBy('categories', 'slug', slug);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Load parent and children
    if (category.parentId) {
      category.parent = await this.firestoreService.findById('categories', category.parentId);
    }
    category.children = await this.firestoreService.findAll('categories', (ref) =>
      ref.where('parentId', '==', category.id),
    );

    return category;
  }

  async create(createDto: CreateCategoryDto): Promise<any> {
    return this.firestoreService.create('categories', {
      ...createDto,
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
      sortOrder: createDto.sortOrder || 0,
    });
  }

  async update(id: string, updateDto: UpdateCategoryDto): Promise<any> {
    await this.findOne(id); // Check if exists
    return this.firestoreService.update('categories', id, updateDto);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.firestoreService.update('categories', id, { isActive: false });
  }
}
