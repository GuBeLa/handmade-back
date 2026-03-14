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
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';

const storage = memoryStorage();

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all products with filters' })
  async findAll(@Query() filterDto: ProductFilterDto) {
    return this.productsService.findAll(filterDto);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured products' })
  async getFeatured(@Query() filterDto: ProductFilterDto) {
    return this.productsService.findAll({ ...filterDto, isFeatured: true });
  }

  @Get('my-products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current seller products' })
  async getMyProducts(@Request() req) {
    return this.productsService.getSellerProducts(req.user.sub);
  }

  @Get('excel-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download Excel template for product import' })
  async getExcelTemplate(@Res() res: Response) {
    const buffer = this.productsService.getExcelTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.xlsx"');
    res.send(buffer);
  }

  @Post('import-excel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Import products from Excel file' })
  async importExcel(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('ატვირთეთ Excel ფაილი (.xlsx)');
    }
    return this.productsService.importFromExcel(req.user.sub, file.buffer);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get product by slug (SEO-friendly URL)' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Post(':id/click')
  @ApiOperation({ summary: 'Record product click (e.g. add to cart) — no auth' })
  async recordClick(@Param('id') id: string) {
    await this.productsService.incrementClicks(id);
    return { ok: true };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID (fallback for backward compatibility)' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create product (Seller only)' })
  async create(@Request() req, @Body() createDto: CreateProductDto) {
    return this.productsService.create(req.user.sub, createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product (Seller only)' })
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, req.user.sub, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product (Seller only)' })
  async delete(@Param('id') id: string, @Request() req) {
    return this.productsService.delete(id, req.user.sub);
  }

  @Post(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moderate product (Admin only)' })
  async moderateProduct(
    @Param('id') id: string,
    @Body() body: { status: string; comment: string },
    @Request() req,
  ) {
    return this.productsService.moderateProduct(
      id,
      body.status as any,
      body.comment,
      req.user.sub,
    );
  }
}

