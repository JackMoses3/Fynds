import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RecommendationService } from './recommendation.service';
import { SignalService } from './signal.service';
import { QdrantRecommendationService } from './qdrant-recommendation.service';
import { DatabaseService } from '../database/database.service';
import { PersonalizedFeedQueryDto } from './dto/recommendation.dto';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let signalService: SignalService;
  let qdrantService: QdrantRecommendationService;
  let dbService: DatabaseService;
  let cacheManager: any;

  const mockSignalService = {
    collectSignals: jest.fn(),
    scoreSignals: jest.fn(),
    detectColdStart: jest.fn(),
    getRecentViewingHistory: jest.fn(),
    getExcludedProducts: jest.fn(),
  };

  const mockQdrantService = {
    retrieveCandidatesFromQdrant: jest.fn(),
    ensureRetailerDiversity: jest.fn(),
    getRandomEligibleProducts: jest.fn(),
  };

  const mockDbService = {
    productItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: SignalService,
          useValue: mockSignalService,
        },
        {
          provide: QdrantRecommendationService,
          useValue: mockQdrantService,
        },
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    signalService = module.get<SignalService>(SignalService);
    qdrantService = module.get<QdrantRecommendationService>(QdrantRecommendationService);
    dbService = module.get<DatabaseService>(DatabaseService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePersonalizedFeed', () => {
    it('should return cached feed if available', async () => {
      const userId = 1;
      const query: PersonalizedFeedQueryDto = { stage: 0, limit: 20 };
      const cachedFeed = {
        batchMeta: { userId: 1, generatedAt: new Date().toISOString(), stage: 0, totalProcessed: 0, totalSuccessful: 0, totalFailed: 0 },
        products: [],
      };

      mockCacheManager.get.mockResolvedValue(cachedFeed);

      const result = await service.generatePersonalizedFeed(userId, query);

      expect(result).toEqual(cachedFeed);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`feed:${userId}:${query.stage}`);
      expect(mockSignalService.collectSignals).not.toHaveBeenCalled();
    });

    it('should generate new feed when cache is empty', async () => {
      const userId = 1;
      const query: PersonalizedFeedQueryDto = { stage: 0, limit: 20 };

      // Mock cache miss
      mockCacheManager.get.mockResolvedValue(null);

      // Mock signal collection
      mockSignalService.collectSignals.mockResolvedValue([]);
      mockSignalService.scoreSignals.mockResolvedValue([]);
      mockSignalService.detectColdStart.mockResolvedValue({
        isColdStart: false,
        userAgeDays: 10,
        totalInteractions: 50,
        onboardingWeightMultiplier: 1.0,
        randomQuota: 3,
      });
      mockSignalService.getRecentViewingHistory.mockResolvedValue([]);
      mockSignalService.getExcludedProducts.mockResolvedValue([]);

      // Mock Qdrant service
      mockQdrantService.retrieveCandidatesFromQdrant.mockResolvedValue([]);
      mockQdrantService.ensureRetailerDiversity.mockResolvedValue([]);
      mockQdrantService.getRandomEligibleProducts.mockResolvedValue([]);

      // Mock database queries
      mockDbService.user.findUnique.mockResolvedValue({
        clothingPreferences: 'both',
      });
      mockDbService.productItem.findMany.mockResolvedValue([]);

      const result = await service.generatePersonalizedFeed(userId, query);

      expect(result).toBeDefined();
      expect(result.batchMeta.userId).toBe(userId);
      expect(result.batchMeta.stage).toBe(query.stage);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });
}); 