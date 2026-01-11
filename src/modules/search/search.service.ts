import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { Timestamp } from 'firebase-admin/firestore';

// Search-related types
interface SearchHistory {
  id: string;
  userId: string;
  queries: string[];
  createdAt: any;
  updatedAt: any;
}

interface PopularSearch {
  id: string;
  query: string;
  count: number;
  lastSearchedAt: any;
  createdAt: any;
  updatedAt: any;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private firestoreService: FirestoreService) {}

  /**
   * Get autocomplete suggestions based on search query
   */
  async getAutocompleteSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const searchTerm = query.toLowerCase().trim();
      
      // Get all products
      const allProducts = await this.firestoreService.findAll('products');
      
      // Extract unique suggestions from product titles and descriptions
      const suggestions = new Set<string>();
      
      allProducts.forEach((product: any) => {
        const title = product.title?.toLowerCase() || '';
        const description = product.description?.toLowerCase() || '';
        
        // Check if title or description contains search term
        if (title.includes(searchTerm) || description.includes(searchTerm)) {
          // Extract words that start with search term
          const words = `${title} ${description}`.split(/\s+/);
          words.forEach((word) => {
            if (word.startsWith(searchTerm) && word.length > searchTerm.length) {
              // Capitalize first letter
              const suggestion = word.charAt(0).toUpperCase() + word.slice(1);
              suggestions.add(suggestion);
            }
          });
        }
        
        // Also add full title if it starts with search term
        if (title.startsWith(searchTerm)) {
          const suggestion = product.title?.charAt(0).toUpperCase() + product.title?.slice(1);
          if (suggestion) {
            suggestions.add(suggestion);
          }
        }
      });
      
      // Get popular searches that match
      const popularSearches = await this.getPopularSearches(20);
      popularSearches.forEach((popular: any) => {
        if (popular.query.toLowerCase().includes(searchTerm)) {
          suggestions.add(popular.query);
        }
      });
      
      // Convert to array, sort, and limit
      return Array.from(suggestions)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Error getting autocomplete suggestions:', error);
      return [];
    }
  }

  /**
   * Save search query to user's search history
   */
  async saveSearchHistory(userId: string, query: string): Promise<void> {
    if (!query || query.trim().length < 2) {
      return;
    }

    try {
      const normalizedQuery = query.trim().toLowerCase();
      
      // Check if this search already exists for this user
      const existingHistory = await this.firestoreService.findOneBy('search_history', 'userId', userId);
      
      if (existingHistory) {
        // Update existing history - add query if not exists, or move to top
        const historyQueries = (existingHistory as any).queries || [];
        const existingIndex = historyQueries.findIndex((q: string) => q.toLowerCase() === normalizedQuery);
        
        if (existingIndex >= 0) {
          // Remove from current position
          historyQueries.splice(existingIndex, 1);
        }
        
        // Add to beginning (most recent)
        historyQueries.unshift(normalizedQuery);
        
        // Keep only last 20 searches
        const limitedQueries = historyQueries.slice(0, 20);
        
        await this.firestoreService.update('search_history', (existingHistory as any).id, {
          queries: limitedQueries,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Create new history
        await this.firestoreService.create('search_history', {
          userId,
          queries: [normalizedQuery],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      
      // Update popular searches
      await this.incrementPopularSearch(normalizedQuery);
    } catch (error) {
      this.logger.error('Error saving search history:', error);
    }
  }

  /**
   * Get user's search history
   */
  async getSearchHistory(userId: string, limit: number = 10): Promise<string[]> {
    try {
      const history = await this.firestoreService.findOneBy('search_history', 'userId', userId);
      if (!history || !(history as any).queries) {
        return [];
      }
      return (history as any).queries.slice(0, limit);
    } catch (error) {
      this.logger.error('Error getting search history:', error);
      return [];
    }
  }

  /**
   * Clear user's search history
   */
  async clearSearchHistory(userId: string): Promise<void> {
    try {
      const history = await this.firestoreService.findOneBy('search_history', 'userId', userId);
      if (history) {
        await this.firestoreService.update('search_history', (history as any).id, {
          queries: [],
          updatedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      this.logger.error('Error clearing search history:', error);
    }
  }

  /**
   * Get popular searches
   */
  async getPopularSearches(limit: number = 10): Promise<any[]> {
    try {
      const allPopular = await this.firestoreService.findAll('popular_searches');
      
      // Sort by count (descending), then by lastSearchedAt (descending)
      return allPopular
        .sort((a: any, b: any) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          const aTime = a.lastSearchedAt?.toMillis?.() || a.lastSearchedAt?._seconds * 1000 || 0;
          const bTime = b.lastSearchedAt?.toMillis?.() || b.lastSearchedAt?._seconds * 1000 || 0;
          return bTime - aTime;
        })
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Error getting popular searches:', error);
      return [];
    }
  }

  /**
   * Increment popular search count
   */
  private async incrementPopularSearch(query: string): Promise<void> {
    try {
      const normalizedQuery = query.trim().toLowerCase();
      
      // Find existing popular search
      const allPopular = await this.firestoreService.findAll('popular_searches');
      const existing = allPopular.find((p: any) => p.query.toLowerCase() === normalizedQuery);
      
      if (existing) {
        // Update existing
        await this.firestoreService.update('popular_searches', (existing as any).id, {
          count: (existing.count || 0) + 1,
          lastSearchedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      } else {
        // Create new
        await this.firestoreService.create('popular_searches', {
          query: normalizedQuery,
          count: 1,
          lastSearchedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      this.logger.error('Error incrementing popular search:', error);
    }
  }
}
