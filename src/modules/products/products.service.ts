import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';

@Injectable()
export class ProductsService {
  constructor(private firestoreService: FirestoreService) {}

  async create(sellerId: string, createDto: CreateProductDto): Promise<any> {
    // Generate slug
    const slug = createDto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const product = await this.firestoreService.create('products', {
      ...createDto,
      slug: `${slug}-${Date.now()}`,
      sellerId,
      moderationStatus: ModerationStatus.PENDING,
      averageRating: 0,
      totalReviews: 0,
      totalSales: 0,
      views: 0,
      isActive: true,
      isFeatured: false,
    });

    // Save images as subcollection or array
    if (createDto.images && createDto.images.length > 0) {
      await this.firestoreService.update('products', (product as any).id, {
        images: createDto.images.map((url, index) => ({
          url,
          sortOrder: index,
        })),
      });
    }

    // Save variants
    if (createDto.variants && createDto.variants.length > 0) {
      await this.firestoreService.update('products', (product as any).id, {
        variants: createDto.variants,
      });
    }

    return this.findOne((product as any).id);
  }

  async findAll(filterDto: ProductFilterDto): Promise<{ products: any[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        categoryId,
        sellerId,
        minPrice,
        maxPrice,
        region,
        material,
        minRating,
        search,
        isFeatured,
      } = filterDto;

      // Get all products and filter in memory to avoid composite index requirements
      // This is acceptable for small to medium datasets
      let allProducts = await this.firestoreService.findAll('products');
      
      // If no products found, return empty result
      if (!allProducts || allProducts.length === 0) {
        return { products: [], total: 0 };
      }
    
    // Filter products in memory
    let products = allProducts.filter((p: any) => {
      // Basic filters
      if (p.isActive !== true) return false;
      if (p.moderationStatus !== ModerationStatus.APPROVED) return false;
      
      // Additional filters
      if (categoryId && p.categoryId !== categoryId) return false;
      if (sellerId && p.sellerId !== sellerId) return false;
      if (minPrice !== undefined && p.price < minPrice) return false;
      if (maxPrice !== undefined && p.price > maxPrice) return false;
      if (material && p.material !== material) return false;
      if (minRating !== undefined && (p.averageRating || 0) < minRating) return false;
      if (isFeatured && p.isFeatured !== true) return false;
      
      return true;
    });
    
    // Sort by createdAt (descending)
    products.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds * 1000 || 0;
      return bTime - aTime;
    });

    // Filter by search (client-side for now, can be optimized with Algolia)
    if (search) {
      products = products.filter(
        (p) =>
          p.title?.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase()),
      );
    }

    // Filter by region (requires seller profile lookup)
    if (region) {
      const sellerIds = await this.getSellerIdsByRegion(region);
      products = products.filter((p) => sellerIds.includes(p.sellerId));
    }

    const total = products.length;
    const skip = (page - 1) * limit;
    products = products.slice(skip, skip + limit);

    // Load related data
    for (const product of products) {
      product.category = await this.firestoreService.findById('categories', product.categoryId);
      const seller = await this.firestoreService.findById('users', product.sellerId);
      if (seller) {
        product.seller = seller;
        product.seller.sellerProfile = await this.firestoreService.findOneBy(
          'seller_profiles',
          'userId',
          seller.id,
        );
      }
    }

      return { products, total };
    } catch (error: any) {
      console.error('❌ Error in ProductsService.findAll:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<any> {
    const product: any = await this.firestoreService.findById('products', id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Increment views
    await this.firestoreService.update('products', id, {
      views: (product.views || 0) + 1,
    });

    // Load related data
    product.category = await this.firestoreService.findById('categories', product.categoryId);
    const seller: any = await this.firestoreService.findById('users', product.sellerId);
    if (seller) {
      product.seller = seller;
      product.seller.sellerProfile = await this.firestoreService.findOneBy(
        'seller_profiles',
        'userId',
        seller.id,
      );
    }

    return product;
  }

  async findBySlug(slug: string): Promise<any> {
    const product: any = await this.firestoreService.findOneBy('products', 'slug', slug);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Increment views
    await this.firestoreService.update('products', product.id, {
      views: (product.views || 0) + 1,
    });

    return this.findOne(product.id);
  }

  async update(id: string, sellerId: string, updateDto: UpdateProductDto): Promise<any> {
    const product: any = await this.firestoreService.findById('products', id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.sellerId !== sellerId) {
      throw new BadRequestException('You can only update your own products');
    }

    await this.firestoreService.update('products', id, updateDto);

    // Update images if provided
    if (updateDto.images) {
      await this.firestoreService.update('products', id, {
        images: updateDto.images.map((url, index) => ({
          url,
          sortOrder: index,
        })),
      });
    }

    // Update variants if provided
    if (updateDto.variants) {
      await this.firestoreService.update('products', id, {
        variants: updateDto.variants,
      });
    }

    return this.findOne(id);
  }

  async delete(id: string, sellerId: string): Promise<void> {
    const product: any = await this.firestoreService.findById('products', id);

    if (!product || product.sellerId !== sellerId) {
      throw new NotFoundException('Product not found');
    }

    await this.firestoreService.update('products', id, { isActive: false });
  }

  async moderateProduct(
    id: string,
    status: ModerationStatus,
    comment: string,
    moderatorId: string,
  ): Promise<any> {
    const product: any = await this.firestoreService.findById('products', id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.firestoreService.update('products', id, {
      moderationStatus: status,
      moderationComment: comment,
      moderatedBy: moderatorId,
      moderatedAt: new Date(),
    });
  }

  async getSellerProducts(sellerId: string): Promise<any[]> {
    const products: any[] = await this.firestoreService.findAll('products', (ref) =>
      ref.where('sellerId', '==', sellerId).orderBy('createdAt', 'desc'),
    );

    // Load categories
    for (const product of products) {
      product.category = await this.firestoreService.findById('categories', product.categoryId);
    }

    return products;
  }

  private async getSellerIdsByRegion(region: string): Promise<string[]> {
    const profiles: any[] = await this.firestoreService.findAll('seller_profiles', (ref) =>
      ref.where('region', '==', region),
    );
    return profiles.map((p: any) => p.userId);
  }
}
