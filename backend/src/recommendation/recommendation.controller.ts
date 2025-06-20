import { Controller, Get, Query, UseGuards, Request, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { RecommendationService } from './recommendation.service';
import { PersonalizedFeedQueryDto, FeedBatchDto } from './dto/recommendation.dto';
import { RequestUser, Public } from '../types';

/**
 * Controller for personalized recommendation endpoints
 */
@Controller('feed')
export class RecommendationController {
  private readonly logger = new Logger(RecommendationController.name);

  constructor(private readonly recommendationService: RecommendationService) {}

  /**
   * GET /feed/personalised?stage=N
   * Returns personalized product feed for authenticated user
   * 
   * @param query - Query parameters including stage and limit
   * @param req - Request object containing authenticated user
   * @returns FeedBatchDto with personalized products
   */
  @UseGuards(JwtAuthGuard)
  @Get('personalised')
  async getPersonalizedFeed(
    @Query() query: PersonalizedFeedQueryDto,
    @Request() req: RequestUser,
  ): Promise<FeedBatchDto> {
    const userId = req.user.sub;
    this.logger.log(`User ${userId} requested personalized feed, stage ${query.stage}, limit ${query.limit}`);

    try {
      const feed = await this.recommendationService.generatePersonalizedFeed(userId, query);
      
      this.logger.log(
        `Successfully generated feed for user ${userId}: ${feed.products.length} products`,
      );
      
      return feed;
    } catch (error) {
      this.logger.error(
        `Failed to generate feed for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * GET /feed/health
   * Health check endpoint for the recommendation system
   */
  @Public()
  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
} 