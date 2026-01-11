import { Controller, Get, Post, Delete, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('autocomplete')
  @ApiOperation({ summary: 'Get autocomplete suggestions' })
  async getAutocomplete(@Query('q') query: string, @Query('limit') limit?: number) {
    return {
      suggestions: await this.searchService.getAutocompleteSuggestions(query || '', limit),
    };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user search history' })
  async getSearchHistory(@Request() req, @Query('limit') limit?: number) {
    return {
      history: await this.searchService.getSearchHistory(req.user.sub, limit),
    };
  }

  @Post('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save search query to history' })
  async saveSearchHistory(@Request() req, @Body() body: { query: string }) {
    await this.searchService.saveSearchHistory(req.user.sub, body.query);
    return { success: true };
  }

  @Delete('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear user search history' })
  async clearSearchHistory(@Request() req) {
    await this.searchService.clearSearchHistory(req.user.sub);
    return { success: true };
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular searches' })
  async getPopularSearches(@Query('limit') limit?: number) {
    return {
      popular: await this.searchService.getPopularSearches(limit),
    };
  }
}
