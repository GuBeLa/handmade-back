import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import * as XLSX from 'xlsx';

@Injectable()
export class ProductsService {
  constructor(private firestoreService: FirestoreService) {}

  private toSlug(text: string): string {
    if (!text?.trim()) return '';
    return text
      .trim()
      .toLowerCase()
      .replace(/[\u10A0-\u10FF]/g, '') // remove Georgian for ASCII-only URL
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || '';
  }

  private async ensureUniqueSlug(baseSlug: string, excludeProductId?: string): Promise<string> {
    let slug = baseSlug;
    let attempts = 0;
    const maxAttempts = 100;
    while (attempts < maxAttempts) {
      const existing = await this.firestoreService.findOneBy('products', 'slug', slug);
      if (!existing || (excludeProductId && existing.id === excludeProductId)) return slug;
      slug = `${baseSlug}-${Date.now().toString(36)}${attempts > 0 ? attempts : ''}`;
      attempts++;
    }
    return `${baseSlug}-${Date.now()}`;
  }

  async create(sellerId: string, createDto: CreateProductDto): Promise<any> {
    const customSlug = createDto.slug?.trim().replace(/[^a-z0-9-]/gi, '-').replace(/(^-|-$)/g, '');
    const baseSlug = customSlug || this.toSlug(createDto.title) || 'product';
    const slug = await this.ensureUniqueSlug(
      baseSlug.length >= 2 ? baseSlug : `${baseSlug}-${Date.now().toString(36)}`,
    );

    // Calculate discountPercentage and isOnSale if discountPrice is provided
    const productData: any = {
      ...createDto,
      slug,
      sellerId,
      moderationStatus: ModerationStatus.PENDING,
      averageRating: 0,
      totalReviews: 0,
      totalSales: 0,
      views: 0,
      clicks: 0,
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
        categoryId: categoryIdParam,
        sellerId,
        minPrice,
        maxPrice,
        region,
        material,
        minRating,
        search,
        isFeatured,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filterDto;

      const categoryId = categoryIdParam ?? (filterDto as any).category;

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
      if (categoryId && String(p.categoryId || '') !== String(categoryId)) return false;
      if (sellerId && p.sellerId !== sellerId) return false;
      if (minPrice !== undefined && p.price < minPrice) return false;
      if (maxPrice !== undefined && p.price > maxPrice) return false;
      if (material && p.material !== material) return false;
      if (minRating !== undefined && (p.averageRating || 0) < minRating) return false;
      if (isFeatured && p.isFeatured !== true) return false;
      
      return true;
    });
    
    // Sort
    const mult = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'views') {
      products.sort((a: any, b: any) => mult * ((b.views || 0) - (a.views || 0)));
    } else if (sortBy === 'totalSales') {
      products.sort((a: any, b: any) => mult * ((b.totalSales || 0) - (a.totalSales || 0)));
    } else {
      products.sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds * 1000 || 0;
        return mult * (bTime - aTime);
      });
    }

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

  /** Returns all active products (all moderation statuses) for admin moderation list. Excludes soft-deleted (isActive: false). */
  async findAllForModeration(): Promise<{ products: any[]; total: number }> {
    try {
      const allProducts = await this.firestoreService.findAll('products');
      if (!allProducts || allProducts.length === 0) {
        return { products: [], total: 0 };
      }
      const activeProducts = allProducts.filter((p: any) => p.isActive !== false);
      const products = [...activeProducts].sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds * 1000 || 0;
        return bTime - aTime;
      });
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
      return { products, total: products.length };
    } catch (error: any) {
      console.error('❌ Error in ProductsService.findAllForModeration:', error);
      throw new Error(`Failed to fetch products for moderation: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<any> {
    const product: any = await this.firestoreService.findById('products', id);

    if (!product || product.isActive === false) {
      throw new NotFoundException('Product not found');
    }

    // Backfill slug for legacy products that don't have one
    let updateData: any = { views: (product.views || 0) + 1 };
    if (!product.slug || typeof product.slug !== 'string' || product.slug.length < 2) {
      const baseSlug = this.toSlug(product.title || 'product') || 'product';
      const newSlug = await this.ensureUniqueSlug(`${baseSlug}-${id.slice(-8)}`, id);
      updateData.slug = newSlug;
    }

    await this.firestoreService.update('products', id, updateData);
    if (updateData.slug) product.slug = updateData.slug;

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

  async incrementClicks(id: string): Promise<void> {
    const product: any = await this.firestoreService.findById('products', id);
    if (!product) return;
    await this.firestoreService.update('products', id, {
      clicks: (product.clicks || 0) + 1,
    });
  }

  async findBySlug(slug: string): Promise<any> {
    const product: any = await this.firestoreService.findOneBy('products', 'slug', slug);

    if (!product || product.isActive === false) {
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
    const { images, variants, discountPrice, price, slug: slugUpdate, ...updateData } = updateDto;

    // Calculate discountPercentage and isOnSale if discountPrice is provided
    const finalUpdateData: any = { ...updateData };

    if (slugUpdate !== undefined && slugUpdate.trim()) {
      const newSlug = await this.ensureUniqueSlug(slugUpdate.trim(), id);
      finalUpdateData.slug = newSlug;
    }
    
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

  async delete(id: string, userId: string, role?: UserRole): Promise<void> {
    const product: any = await this.firestoreService.findById('products', id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isAdminOrModerator = role === UserRole.ADMIN || role === UserRole.MODERATOR;
    if (!isAdminOrModerator && product.sellerId !== userId) {
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

  /** Returns only active products for the seller (excludes soft-deleted). */
  async getSellerProducts(sellerId: string): Promise<any[]> {
    const all: any[] = await this.firestoreService.findAll('products', (ref) =>
      ref.where('sellerId', '==', sellerId).orderBy('createdAt', 'desc'),
    );
    const products = all.filter((p: any) => p.isActive !== false);

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

  /** Expected Excel columns: title, description, categoryId, price, discountPrice, stock, material, weight, dimensions, careInstructions, image1..image5 (required), image6..image10 (optional) */
  async importFromExcel(
    sellerId: string,
    buffer: Buffer,
  ): Promise<{ created: number; errors: { row: number; message: string }[] }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows || rows.length < 2) {
      throw new BadRequestException('Excel ფაილი უნდა შეიცავდეს სათაურის row-ს და მინიმუმ ერთ მონაცემთა row-ს');
    }
    const headers = (rows[0] as any[]).map((h) => String(h || '').trim().toLowerCase());
    const dataRows = rows.slice(1);
    const created: number[] = [];
    const errors: { row: number; message: string }[] = [];
    const getCol = (key: string): number => {
      const i = headers.indexOf(key.toLowerCase());
      return i >= 0 ? i : -1;
    };
    const idx = {
      title: getCol('title'),
      description: getCol('description'),
      categoryId: getCol('categoryid'),
      price: getCol('price'),
      discountPrice: getCol('discountprice'),
      stock: getCol('stock'),
      material: getCol('material'),
      weight: getCol('weight'),
      dimensions: getCol('dimensions'),
      careInstructions: getCol('careinstructions'),
      image1: getCol('image1'),
      image2: getCol('image2'),
      image3: getCol('image3'),
      image4: getCol('image4'),
      image5: getCol('image5'),
    };
    const imageCols = [getCol('image6'), getCol('image7'), getCol('image8'), getCol('image9'), getCol('image10')].filter((i) => i >= 0);
    if (idx.title < 0 || idx.description < 0 || idx.categoryId < 0 || idx.price < 0 || idx.image1 < 0 || idx.image2 < 0 || idx.image3 < 0 || idx.image4 < 0 || idx.image5 < 0) {
      throw new BadRequestException(
        'Excel-ში აუცილებელი სვეტებია: title, description, categoryId, price, image1, image2, image3, image4, image5. გამოიყენეთ ჩამოტვირთული შაბლონი.',
      );
    }
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[];
      const rowNum = i + 2;
      const get = (col: number) => (col >= 0 && row[col] !== undefined && row[col] !== null ? String(row[col]).trim() : '');
      const getNum = (col: number) => {
        const v = col >= 0 ? row[col] : undefined;
        if (v === undefined || v === null || v === '') return undefined;
        const n = Number(v);
        return isNaN(n) ? undefined : n;
      };
      const title = get(idx.title);
      const description = get(idx.description);
      const categoryId = get(idx.categoryId);
      const priceVal = getNum(idx.price);
      const discountPriceVal = getNum(idx.discountPrice);
      const stockVal = getNum(idx.stock);
      const images: string[] = [
        get(idx.image1),
        get(idx.image2),
        get(idx.image3),
        get(idx.image4),
        get(idx.image5),
      ].filter((url) => url && url.startsWith('http'));
      imageCols.forEach((col) => {
        const url = get(col);
        if (url && url.startsWith('http')) images.push(url);
      });
      if (!title || title.length < 3) {
        errors.push({ row: rowNum, message: 'სახელი (title) აუცილებელია, მინიმუმ 3 სიმბოლო' });
        continue;
      }
      if (!description || description.length < 10) {
        errors.push({ row: rowNum, message: 'აღწერა (description) აუცილებელია, მინიმუმ 10 სიმბოლო' });
        continue;
      }
      if (!categoryId) {
        errors.push({ row: rowNum, message: 'categoryId აუცილებელია' });
        continue;
      }
      if (priceVal === undefined || priceVal < 0) {
        errors.push({ row: rowNum, message: 'ფასი (price) უნდა იყოს 0 ან მეტი' });
        continue;
      }
      if (images.length < 5) {
        errors.push({ row: rowNum, message: 'საჭიროა მინიმუმ 5 სურათის URL (image1–image5)' });
        continue;
      }
      try {
        await this.create(sellerId, {
          title,
          description,
          categoryId,
          price: priceVal,
          discountPrice: discountPriceVal !== undefined && discountPriceVal >= 0 && discountPriceVal < priceVal ? discountPriceVal : undefined,
          stock: stockVal !== undefined && stockVal >= 0 ? Math.floor(stockVal) : 0,
          material: get(idx.material) || undefined,
          weight: get(idx.weight) || undefined,
          dimensions: get(idx.dimensions) || undefined,
          careInstructions: get(idx.careInstructions) || undefined,
          images,
        });
        created.push(rowNum);
      } catch (err: any) {
        errors.push({ row: rowNum, message: err?.message || 'პროდუქტის შექმნა ვერ მოხერხდა' });
      }
    }
    return { created: created.length, errors };
  }

  getExcelTemplate(): Buffer {
    const headers = [
      'title',
      'description',
      'categoryId',
      'price',
      'discountPrice',
      'stock',
      'material',
      'weight',
      'dimensions',
      'careInstructions',
      'image1',
      'image2',
      'image3',
      'image4',
      'image5',
      'image6',
      'image7',
      'image8',
      'image9',
      'image10',
    ];
    const exampleRow = [
      'პროდუქტის სახელი',
      'პროდუქტის დეტალური აღწერა (მინ. 10 სიმბოლო)',
      'კატეგორიის ID (იხ. კატეგორიების სია)',
      29.99,
      24.99,
      10,
      'ბამბა',
      '200გ',
      '20x30 სმ',
      'ხელით სარეცხი',
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
      'https://example.com/photo3.jpg',
      'https://example.com/photo4.jpg',
      'https://example.com/photo5.jpg',
      '',
      '',
      '',
      '',
      '',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'პროდუქტები');
    const instructionRows = [
      ['სვეტის სახელი', 'აღწერა', 'სავალდებულო?'],
      ['title', 'პროდუქტის სახელი (მინ. 3 სიმბოლო)', 'დიახ'],
      ['description', 'აღწერა (მინ. 10 სიმბოლო)', 'დიახ'],
      ['categoryId', 'კატეგორიის ID – აიღეთ საიტიდან კატეგორიების სიიდან', 'დიახ'],
      ['price', 'ფასი (₾)', 'დიახ'],
      ['discountPrice', 'ფასდაკლებული ფასი (₾)', 'არა'],
      ['stock', 'მარაგის რაოდენობა', 'არა (0 იგულისხმება)'],
      ['material', 'მასალა', 'არა'],
      ['weight', 'წონა', 'არა'],
      ['dimensions', 'ზომები', 'არა'],
      ['careInstructions', 'მოვლის ინსტრუქცია', 'არა'],
      ['image1 ... image5', 'სურათების URL-ები (მინ. 5) – უნდა იყოს https://', 'დიახ'],
      ['image6 ... image10', 'დამატებითი სურათების URL-ები', 'არა'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionRows);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'ინსტრუქცია');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
