import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';

const storage = memoryStorage();

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('single')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload single file' })
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string }> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // Validate file size (already handled by multer, but double-check)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
    }

    try {
      const url = await this.uploadService.uploadFile(file);
      return { url };
    } catch (error) {
      console.error('❌ Error in uploadSingle controller:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Failed to upload file. Please try again later.',
      );
    }
  }

  @Post('multiple')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple files' })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    // Validate files
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate file count
    if (files.length > 20) {
      throw new BadRequestException('Maximum 20 files allowed');
    }

    // Validate each file
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type for ${file.originalname}. Allowed types: ${allowedMimeTypes.join(', ')}`,
        );
      }
      if (file.size > maxSize) {
        throw new BadRequestException(
          `File ${file.originalname} exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
        );
      }
    }

    try {
      const urls = await this.uploadService.uploadMultipleFiles(files);
      return { urls };
    } catch (error) {
      console.error('❌ Error in uploadMultiple controller:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Failed to upload files. Please try again later.',
      );
    }
  }
}

