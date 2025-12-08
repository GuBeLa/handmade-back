import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateSellerProfileDto } from './dto/create-seller-profile.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';

@Injectable()
export class UsersService {
  constructor(private firestoreService: FirestoreService) {}

  async findById(id: string): Promise<any> {
    const user: any = await this.firestoreService.findById('users', id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Get seller profile if exists
    if (user.role === UserRole.SELLER) {
      const profile = await this.firestoreService.findOneBy('seller_profiles', 'userId', id);
      return { ...user, sellerProfile: profile };
    }
    
    return user;
  }

  async updateProfile(userId: string, updateDto: UpdateProfileDto): Promise<any> {
    const user: any = await this.findById(userId);
    return this.firestoreService.update('users', userId, updateDto);
  }

  async createSellerProfile(
    userId: string,
    createDto: CreateSellerProfileDto,
  ): Promise<any> {
    const user: any = await this.findById(userId);

    if (user.role !== UserRole.SELLER && user.role !== UserRole.ADMIN) {
      throw new BadRequestException('User must be a seller');
    }

    const existingProfile = await this.firestoreService.findOneBy(
      'seller_profiles',
      'userId',
      userId,
    );

    if (existingProfile) {
      throw new BadRequestException('Seller profile already exists');
    }

    const profile = await this.firestoreService.create('seller_profiles', {
      ...createDto,
      userId,
      moderationStatus: ModerationStatus.PENDING,
    });

    // Update user role
    await this.firestoreService.update('users', userId, {
      role: UserRole.SELLER,
    });

    return profile;
  }

  async updateSellerProfile(
    userId: string,
    updateDto: UpdateSellerProfileDto,
  ): Promise<any> {
    const profile: any = await this.firestoreService.findOneBy(
      'seller_profiles',
      'userId',
      userId,
    );

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.firestoreService.update('seller_profiles', profile.id, updateDto);
  }

  async getSellerProfile(userId: string): Promise<any> {
    const profile: any = await this.firestoreService.findOneBy(
      'seller_profiles',
      'userId',
      userId,
    );

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    const user = await this.findById(userId);
    return { ...profile, user };
  }

  async getSellerPublicProfile(sellerId: string): Promise<any> {
    const user: any = await this.findById(sellerId);
    
    if (!user) {
      throw new NotFoundException('Seller not found');
    }

    if (user.role !== UserRole.SELLER && user.role !== UserRole.ADMIN) {
      throw new BadRequestException('User is not a seller');
    }

    const profile: any = await this.firestoreService.findOneBy(
      'seller_profiles',
      'userId',
      sellerId,
    );

    // Return user and profile even if profile doesn't exist yet
    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
      sellerProfile: profile || null,
    };
  }

  async moderateSellerProfile(
    profileId: string,
    status: ModerationStatus,
    comment: string,
    moderatorId: string,
  ): Promise<any> {
    const profile: any = await this.firestoreService.findById('seller_profiles', profileId);

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.firestoreService.update('seller_profiles', profileId, {
      moderationStatus: status,
      moderationComment: comment,
      moderatedBy: moderatorId,
      moderatedAt: new Date(),
    });
  }
}
