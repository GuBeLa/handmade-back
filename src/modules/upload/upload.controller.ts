import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
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
    const url = await this.uploadService.uploadFile(file);
    return { url };
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
    const urls = await this.uploadService.uploadMultipleFiles(files);
    return { urls };
  }
}

