import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannersService {
  constructor(private firestoreService: FirestoreService) {}

  async findAll(): Promise<any[]> {
    const now = new Date();
    return this.firestoreService.findAll('banners', (ref) =>
      ref.where('isActive', '==', true).orderBy('sortOrder', 'asc'),
    );
  }

  async findOne(id: string): Promise<any> {
    const banner = await this.firestoreService.findById('banners', id);
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return banner;
  }

  async create(createDto: CreateBannerDto): Promise<any> {
    return this.firestoreService.create('banners', {
      ...createDto,
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
      sortOrder: createDto.sortOrder || 0,
    });
  }

  async update(id: string, updateDto: UpdateBannerDto): Promise<any> {
    const banner = await this.findOne(id);
    return this.firestoreService.update('banners', id, updateDto);
  }

  async remove(id: string): Promise<void> {
    const banner = await this.findOne(id);
    await this.firestoreService.update('banners', id, { isActive: false });
  }
}
