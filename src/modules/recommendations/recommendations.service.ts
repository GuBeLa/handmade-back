import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../common/services/firestore.service';
import { ProductsService } from '../products/products.service';
import { SubmitQuestionnaireDto } from './dto/questionnaire.dto';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private firestoreService: FirestoreService,
    private productsService: ProductsService,
  ) {}

  /**
   * Get AI-based product recommendations based on questionnaire answers
   */
  async getRecommendations(
    questionnaireDto: SubmitQuestionnaireDto,
    userId?: string,
  ): Promise<{ products: any[]; total: number; reasoning?: string }> {
    try {
      // Extract preferences from questionnaire
      const preferences = this.extractPreferences(questionnaireDto.answers);
      
      // Get all approved products
      const allProducts = await this.firestoreService.findAll('products');
      const approvedProducts = allProducts.filter(
        (p: any) =>
          p.isActive === true &&
          p.moderationStatus === ModerationStatus.APPROVED,
      );

      if (approvedProducts.length === 0) {
        return { products: [], total: 0 };
      }

      // Score products based on preferences
      const scoredProducts = this.scoreProducts(approvedProducts, preferences);

      // Sort by score (highest first)
      scoredProducts.sort((a, b) => b.score - a.score);

      // Get top recommendations
      const limit = questionnaireDto.limit || 10;
      const recommendedProducts = scoredProducts
        .slice(0, limit)
        .map((item) => item.product);

      // Generate reasoning (simplified AI-like explanation)
      const reasoning = this.generateReasoning(preferences, recommendedProducts);

      return {
        products: recommendedProducts,
        total: recommendedProducts.length,
        reasoning,
      };
    } catch (error) {
      this.logger.error('Error getting recommendations:', error);
      throw error;
    }
  }

  /**
   * Extract user preferences from questionnaire answers
   */
  private extractPreferences(answers: any[]): any {
    const preferences: any = {
      categories: [],
      priceRange: { min: 0, max: Infinity },
      materials: [],
      styles: [],
      occasions: [],
      colors: [],
      budget: 'medium',
    };

    answers.forEach((answer) => {
      const { questionId, answer: value } = answer;

      // Category preferences
      if (questionId === 'category' || questionId === 'categories') {
        if (Array.isArray(value)) {
          preferences.categories = value;
        } else {
          preferences.categories = [value];
        }
      }

      // Price range
      if (questionId === 'price_range' || questionId === 'budget') {
        if (typeof value === 'string') {
          switch (value.toLowerCase()) {
            case 'low':
            case 'budget':
              preferences.priceRange = { min: 0, max: 50 };
              preferences.budget = 'low';
              break;
            case 'medium':
            case 'moderate':
              preferences.priceRange = { min: 20, max: 150 };
              preferences.budget = 'medium';
              break;
            case 'high':
            case 'premium':
            case 'luxury':
              preferences.priceRange = { min: 100, max: Infinity };
              preferences.budget = 'high';
              break;
          }
        } else if (typeof value === 'number') {
          preferences.priceRange = { min: 0, max: value };
        }
      }

      // Materials
      if (questionId === 'material' || questionId === 'materials') {
        if (Array.isArray(value)) {
          preferences.materials = value;
        } else {
          preferences.materials = [value];
        }
      }

      // Styles
      if (questionId === 'style' || questionId === 'styles') {
        if (Array.isArray(value)) {
          preferences.styles = value;
        } else {
          preferences.styles = [value];
        }
      }

      // Occasions
      if (questionId === 'occasion' || questionId === 'occasions') {
        if (Array.isArray(value)) {
          preferences.occasions = value;
        } else {
          preferences.occasions = [value];
        }
      }

      // Colors
      if (questionId === 'color' || questionId === 'colors') {
        if (Array.isArray(value)) {
          preferences.colors = value;
        } else {
          preferences.colors = [value];
        }
      }
    });

    return preferences;
  }

  /**
   * Score products based on user preferences
   */
  private scoreProducts(products: any[], preferences: any): Array<{ product: any; score: number }> {
    return products.map((product) => {
      let score = 0;

      // Category match (high weight)
      if (preferences.categories.length > 0) {
        if (preferences.categories.includes(product.categoryId)) {
          score += 30;
        }
      } else {
        // If no category preference, give base score
        score += 10;
      }

      // Price range match (high weight)
      if (
        product.price >= preferences.priceRange.min &&
        product.price <= preferences.priceRange.max
      ) {
        score += 25;
      } else if (product.price < preferences.priceRange.min) {
        score += 5; // Below budget is okay
      } else {
        score -= 10; // Above budget is penalized
      }

      // Material match (medium weight)
      if (preferences.materials.length > 0 && product.material) {
        const productMaterial = product.material.toLowerCase();
        if (
          preferences.materials.some((m: string) =>
            productMaterial.includes(m.toLowerCase()),
          )
        ) {
          score += 15;
        }
      }

      // Rating boost (medium weight)
      if (product.averageRating) {
        score += product.averageRating * 5; // 0-25 points for rating
      }

      // Popularity boost (low weight)
      if (product.totalSales) {
        score += Math.min(product.totalSales / 10, 10); // Max 10 points
      }

      // Reviews boost (low weight)
      if (product.totalReviews) {
        score += Math.min(product.totalReviews / 5, 5); // Max 5 points
      }

      // Ensure non-negative score
      score = Math.max(0, score);

      return { product, score };
    });
  }

  /**
   * Generate human-readable reasoning for recommendations
   */
  private generateReasoning(preferences: any, products: any[]): string {
    const reasons: string[] = [];

    if (preferences.categories.length > 0) {
      reasons.push(`კატეგორია: ${preferences.categories.join(', ')}`);
    }

    if (preferences.budget) {
      const budgetText =
        preferences.budget === 'low'
          ? 'ბიუჯეტური'
          : preferences.budget === 'high'
            ? 'პრემიუმ'
            : 'საშუალო';
      reasons.push(`ბიუჯეტი: ${budgetText}`);
    }

    if (preferences.materials.length > 0) {
      reasons.push(`მასალა: ${preferences.materials.join(', ')}`);
    }

    if (products.length > 0) {
      reasons.push(`ნაპოვნია ${products.length} რეკომენდაცია`);
    }

    return reasons.join(' | ') || 'პერსონალიზებული რეკომენდაციები';
  }

  /**
   * Get predefined questionnaire questions
   */
  getQuestionnaireQuestions(): any[] {
    return [
      {
        id: 'category',
        type: 'multiple_choice',
        question: 'რა კატეგორიის პროდუქტები გაინტერესებთ?',
        options: [
          'ყველა',
          'სამკაულები',
          'ტანსაცმელი',
          'აქსესუარები',
          'სახლის დეკორი',
          'ხელნაკეთი ნივთები',
        ],
        required: false,
      },
      {
        id: 'budget',
        type: 'single_choice',
        question: 'რა ბიუჯეტი გაქვთ?',
        options: [
          { value: 'low', label: '50₾-მდე (ბიუჯეტური)' },
          { value: 'medium', label: '50-150₾ (საშუალო)' },
          { value: 'high', label: '150₾-ზე მეტი (პრემიუმ)' },
        ],
        required: true,
      },
      {
        id: 'material',
        type: 'multiple_choice',
        question: 'რა მასალა გირჩევნიათ?',
        options: [
          'ყველა',
          'ხე',
          'ლითონი',
          'ქსოვილი',
          'კერამიკა',
          'მინა',
          'ქვა',
        ],
        required: false,
      },
      {
        id: 'style',
        type: 'multiple_choice',
        question: 'რა სტილი გირჩევნიათ?',
        options: [
          'კლასიკური',
          'თანამედროვე',
          'ვინტაჟი',
          'მინიმალისტური',
          'ექსპერიმენტული',
        ],
        required: false,
      },
      {
        id: 'occasion',
        type: 'multiple_choice',
        question: 'რისთვის გჭირდებათ?',
        options: [
          'ყოველდღიური გამოყენება',
          'სპეციალური ღონისძიება',
          'საჩუქარი',
          'კოლექცია',
          'სახლის დეკორაცია',
        ],
        required: false,
      },
    ];
  }
}

