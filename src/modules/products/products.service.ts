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

    // Calculate discountPercentage and isOnSale if discountPrice is provided
    const productData: any = {
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
    };

    // Calculate discount fields if discountPrice is provided
    if (createDto.discountPrice && createDto.discountPrice > 0 && createDto.discountPrice < createDto.price) {
      productData.discountPercentage = Math.round(((createDto.price - createDto.discountPrice) / createDto.price) * 100);
      productData.isOnSale = true;
    } else {
      productData.discountPercentage = null;
      productData.isOnSale = false;
    }

    const product = await this.firestoreService.create('products', productData);

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
      // Note: Badges are calculated in getSellerPublicProfile endpoint
      // For product detail, badges will be loaded via useProductDetail hook which calls getPublicSellerProfile
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

    // Extract images and variants separately to handle them differently
    const { images, variants, discountPrice, price, ...updateData } = updateDto;

    // Calculate discountPercentage and isOnSale if discountPrice is provided
    const finalUpdateData: any = { ...updateData };
    
    // Add price if provided
    if (price !== undefined) {
      finalUpdateData.price = price;
    }
    
    // Handle discountPrice if provided
    if (discountPrice !== undefined) {
      const basePrice = finalUpdateData.price !== undefined ? finalUpdateData.price : product.price;
      
      // If discountPrice is null or 0, clear discount fields
      if (discountPrice === null || discountPrice === 0) {
        finalUpdateData.discountPrice = null;
        finalUpdateData.discountPercentage = null;
        finalUpdateData.isOnSale = false;
      } 
      // If discountPrice is valid and less than base price, calculate discount
      else if (typeof discountPrice === 'number' && discountPrice > 0 && discountPrice < basePrice) {
        finalUpdateData.discountPrice = discountPrice;
        finalUpdateData.discountPercentage = Math.round(((basePrice - discountPrice) / basePrice) * 100);
        finalUpdateData.isOnSale = true;
      }
      // If discountPrice is invalid (>= basePrice), don't set discount
      // Leave discount fields unchanged if invalid
    }

    // Filter out undefined/null values from finalUpdateData before updating Firestore
    const filteredUpdateData = Object.fromEntries(
      Object.entries(finalUpdateData).filter(([, value]) => value !== undefined)
    );

    // Update product fields (excluding images and variants and undefined values)
    if (Object.keys(filteredUpdateData).length > 0) {
      await this.firestoreService.update('products', id, filteredUpdateData);
    }

    // Update images if provided - transform string[] to {url, sortOrder}[] format
    if (images && Array.isArray(images) && images.length > 0) {
      // Filter out invalid URLs
      const validImageUrls = images.filter((url: string) => {
        if (!url || typeof url !== 'string') {
          return false;
        }
        try {
          const urlObj = new URL(url);
          return ['http:', 'https:'].includes(urlObj.protocol);
        } catch {
          return false;
        }
      });

      if (validImageUrls.length > 0) {
        await this.firestoreService.update('products', id, {
          images: validImageUrls.map((url: string, index: number) => ({
            url,
            sortOrder: index,
          })),
        });
      }
    }

    // Update variants if provided
    if (variants !== undefined) {
      await this.firestoreService.update('products', id, {
        variants: Array.isArray(variants) ? variants : [],
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
