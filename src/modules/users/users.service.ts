import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateSellerProfileDto } from './dto/create-seller-profile.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

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

    // Return null if profile doesn't exist instead of throwing error
    // This allows the frontend to handle the case where seller hasn't created a profile yet
    if (!profile) {
      return null;
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

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<any> {
    const user: any = await this.findById(userId);

    if (!user.password) {
      throw new BadRequestException('User does not have a password set');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Update password
    await this.firestoreService.update('users', userId, {
      password: hashedPassword,
    });

    return {
      message: 'Password changed successfully',
    };
  }

  async followSeller(userId: string, sellerId: string): Promise<any> {
    // Verify seller exists and is a seller
    const seller: any = await this.findById(sellerId);
    if (!seller || (seller.role !== UserRole.SELLER && seller.role !== UserRole.ADMIN)) {
      throw new BadRequestException('Invalid seller');
    }

    if (userId === sellerId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // Check if already following
    const existingFollow = await this.firestoreService.findOneByTwoFields(
      'seller_follows',
      'userId',
      userId,
      'sellerId',
      sellerId,
    );

    if (existingFollow) {
      throw new BadRequestException('Already following this seller');
    }

    // Create follow relationship
    const follow = await this.firestoreService.create('seller_follows', {
      userId,
      sellerId,
      createdAt: new Date(),
    });

    // Update seller profile followers count
    const sellerProfile: any = await this.firestoreService.findOneBy(
      'seller_profiles',
      'userId',
      sellerId,
    );

    if (sellerProfile) {
      const currentFollowers = sellerProfile.followersCount || 0;
      await this.firestoreService.update('seller_profiles', sellerProfile.id, {
        followersCount: currentFollowers + 1,
      });
    }

    return {
      message: 'Successfully followed seller',
      follow,
    };
  }

  async unfollowSeller(userId: string, sellerId: string): Promise<any> {
    // Find and delete follow relationship
    const follow: any = await this.firestoreService.findOneByTwoFields(
      'seller_follows',
      'userId',
      userId,
      'sellerId',
      sellerId,
    );

    if (!follow) {
      throw new NotFoundException('Not following this seller');
    }

    await this.firestoreService.delete('seller_follows', follow.id);

    // Update seller profile followers count
    const sellerProfile: any = await this.firestoreService.findOneBy(
      'seller_profiles',
      'userId',
      sellerId,
    );

    if (sellerProfile) {
      const currentFollowers = sellerProfile.followersCount || 0;
      await this.firestoreService.update('seller_profiles', sellerProfile.id, {
        followersCount: Math.max(0, currentFollowers - 1),
      });
    }

    return {
      message: 'Successfully unfollowed seller',
    };
  }

  async isFollowingSeller(userId: string, sellerId: string): Promise<boolean> {
    const follow = await this.firestoreService.findOneByTwoFields(
      'seller_follows',
      'userId',
      userId,
      'sellerId',
      sellerId,
    );
    return !!follow;
  }

  async getFollowedSellers(userId: string): Promise<any[]> {
    const follows = await this.firestoreService.findManyBy('seller_follows', 'userId', userId);

    const sellers = await Promise.all(
      follows.map(async (follow: any) => {
        const seller: any = await this.findById(follow.sellerId);
        const sellerProfile: any = await this.firestoreService.findOneBy(
          'seller_profiles',
          'userId',
          follow.sellerId,
        );

        return {
          id: seller.id,
          firstName: seller.firstName,
          lastName: seller.lastName,
          email: seller.email,
          phone: seller.phone,
          avatar: seller.avatar,
          sellerProfile: sellerProfile || null,
        };
      }),
    );

    return sellers;
  }

  async getSellerPublicProfileWithFollowStatus(sellerId: string, userId?: string): Promise<any> {
    const profile = await this.getSellerPublicProfile(sellerId);
    
    if (userId) {
      const isFollowing = await this.isFollowingSeller(userId, sellerId);
      return {
        ...profile,
        isFollowing,
      };
    }

    return {
      ...profile,
      isFollowing: false,
    };
  }
}
