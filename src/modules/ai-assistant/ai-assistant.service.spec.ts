import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantRepository } from './ai-assistant.repository';
import { ContextService } from './services/context.service';
import { PromptService } from './services/prompt.service';
import { LlmService } from './services/llm.service';
import { FullAiContextSnapshot } from './interfaces/ai-assistant.interface';
import { AiQuotaService } from '../ai/ai-quota.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';

describe('AiAssistantService', () => {
  let service: AiAssistantService;
  let repository: jest.Mocked<AiAssistantRepository>;
  let contextService: jest.Mocked<ContextService>;
  let promptService: PromptService;
  let llmService: jest.Mocked<LlmService>;

  const mockUserId = 'user-test-123';
  const mockNow = new Date('2026-11-05T10:00:00Z');

  const mockContextSnapshot: FullAiContextSnapshot = {
    todayNutrition: {
      date: '2026-11-05',
      caloriesConsumed: 1400,
      caloriesTarget: 2000,
      caloriesRemaining: 600,
      proteinConsumed: 80,
      proteinTarget: 130,
      carbsConsumed: 160,
      carbsTarget: 220,
      fatConsumed: 45,
      fatTarget: 65,
      mealsLoggedCount: 1,
      meals: [
        {
          id: 'meal-1',
          name: 'Chicken Rice',
          mealType: 'LUNCH',
          calories: 650,
          protein: 42,
          carbs: 75,
          fat: 16,
          items: ['Steamed Rice', 'Grilled Chicken'],
        },
      ],
    },
    profile: {
      name: 'Alex Nguyen',
      gender: 'MALE',
      age: 24,
      heightCm: 175,
      currentWeightKg: 70,
      targetWeightKg: 68,
      bmi: 22.9,
      activityLevel: 'MODERATE',
      fitnessGoal: 'WEIGHT_LOSS',
    },
    progress: {
      recentWeights: [{ date: '2026-11-04', weightKg: 70.2 }],
      recentDailyCalories: [{ date: '2026-11-04', calories: 1950, protein: 75, carbs: 210, fat: 55 }],
    },
  };

  const mockActiveConversation = {
    id: 'conv-101',
    title: 'How much protein left today?',
    messages: [
      {
        id: 'msg-1',
        role: 'USER' as const,
        content: 'How much protein left today?',
        createdAt: mockNow.toISOString(),
      },
      {
        id: 'msg-2',
        role: 'ASSISTANT' as const,
        content: 'You still need 50g of protein to reach your 130g target today.',
        createdAt: new Date(mockNow.getTime() + 1000).toISOString(),
      },
    ],
  };

  beforeEach(async () => {
    const mockRepo = {
      getActiveConversationWithMessages: jest.fn().mockResolvedValue(mockActiveConversation),
      getOrCreateConversation: jest.fn().mockResolvedValue(mockActiveConversation),
      startNewConversation: jest.fn().mockResolvedValue({
        id: 'conv-new-1',
        title: null,
        messages: [],
      }),
      listConversations: jest.fn().mockResolvedValue([
        {
          id: 'conv-101',
          title: 'How much protein left today?',
          isActive: true,
          lastMessageAt: mockNow.toISOString(),
        },
      ]),
      activateConversation: jest.fn().mockResolvedValue(mockActiveConversation),
      saveMessagePair: jest.fn().mockResolvedValue({
        userMessage: {
          id: 'msg-user-new',
          role: 'USER',
          content: 'Can I eat this apple?',
          createdAt: new Date().toISOString(),
        },
        assistantMessage: {
          id: 'msg-asst-new',
          role: 'ASSISTANT',
          content: 'Yes! An average apple has about 95 kcal and 25g carbs, perfectly fitting your 600 remaining calories.',
          createdAt: new Date().toISOString(),
        },
      }),
    };

    const mockCtx = {
      buildUserNutritionContext: jest.fn().mockResolvedValue(mockContextSnapshot),
    };

    const mockLlm = {
      generateHybridResponse: jest.fn().mockResolvedValue({
        text: 'Yes! An average apple has about 95 kcal and 25g carbs, perfectly fitting your 600 remaining calories.',
        totalTokens: 180,
      }),
    };

    const mockAiQuota = {
      assertCanChat: jest.fn().mockResolvedValue(undefined),
      getUserDailyQuota: jest.fn().mockResolvedValue({
        isPro: false,
        planName: 'Free',
        chats: { used: 1, limit: 5, remaining: 4 },
        scans: { used: 0, limit: 3, remaining: 3 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAssistantService,
        PromptService,
        {
          provide: AiAssistantRepository,
          useValue: mockRepo,
        },
        {
          provide: ContextService,
          useValue: mockCtx,
        },
        {
          provide: LlmService,
          useValue: mockLlm,
        },
        {
          provide: AiQuotaService,
          useValue: mockAiQuota,
        },
        {
          provide: CloudinaryService,
          useValue: {
            uploadImage: jest.fn().mockResolvedValue('https://res.cloudinary.com/nutraai/meals/mock.jpg'),
          },
        },
      ],
    }).compile();

    service = module.get<AiAssistantService>(AiAssistantService);
    repository = module.get(AiAssistantRepository);
    contextService = module.get(ContextService);
    promptService = module.get<PromptService>(PromptService);
    llmService = module.get(LlmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(promptService).toBeDefined();
  });

  describe('getAssistantContext', () => {
    it('should return context snapshot and active conversation with messages', async () => {
      const result = await service.getAssistantContext(mockUserId);

      expect(contextService.buildUserNutritionContext).toHaveBeenCalledWith(mockUserId);
      expect(repository.getActiveConversationWithMessages).toHaveBeenCalledWith(mockUserId, 40);
      expect(result.todayNutrition.caloriesConsumed).toBe(1400);
      expect(result.profile.name).toBe('Alex Nguyen');
      expect(result.activeConversation?.id).toBe('conv-101');
      expect(result.activeConversation?.messages).toHaveLength(2);
    });
  });

  describe('startNewConversation', () => {
    it('should archive past active conversation and return fresh conversation', async () => {
      const result = await service.startNewConversation(mockUserId, { title: 'Fresh Session' });

      expect(repository.startNewConversation).toHaveBeenCalledWith(mockUserId, 'Fresh Session');
      expect(result.activeConversation?.id).toBe('conv-new-1');
      expect(result.activeConversation?.messages).toEqual([]);
    });
  });

  describe('listConversations', () => {
    it('should return the user conversation history', async () => {
      const list = await service.listConversations(mockUserId);

      expect(repository.listConversations).toHaveBeenCalledWith(mockUserId);
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('How much protein left today?');
    });
  });

  describe('openConversation', () => {
    it('should activate conversation and return nutrition context and messages', async () => {
      const result = await service.openConversation(mockUserId, 'conv-101');

      expect(repository.activateConversation).toHaveBeenCalledWith(mockUserId, 'conv-101');
      expect(result.activeConversation?.id).toBe('conv-101');
    });

    it('should throw NotFoundException if conversation does not exist', async () => {
      repository.activateConversation.mockResolvedValueOnce(null);

      await expect(service.openConversation(mockUserId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('sendChatMessage', () => {
    it('should handle standard text message and return AI reply with todayNutrition', async () => {
      const response = await service.sendChatMessage(mockUserId, {
        message: 'Can I eat this apple?',
        conversationId: 'conv-101',
      });

      expect(contextService.buildUserNutritionContext).toHaveBeenCalledWith(mockUserId);
      expect(repository.getOrCreateConversation).toHaveBeenCalledWith(
        mockUserId,
        'conv-101',
        'Can I eat this apple?',
      );
      expect(llmService.generateHybridResponse).toHaveBeenCalled();
      expect(repository.saveMessagePair).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-101',
          userContent: 'Can I eat this apple?',
          assistantContent: expect.stringContaining('apple'),
        }),
      );
      expect(response.conversationId).toBe('conv-101');
      expect(response.assistantMessage.content).toContain('apple');
      expect(response.todayNutrition.caloriesConsumed).toBe(1400);
      expect(response.contextUpdated).toBe(false);
    });

    it('should pass multimodal image attachment to prompt builder', async () => {
      await service.sendChatMessage(mockUserId, {
        message: 'What is this meal?',
        conversationId: 'conv-101',
        imageBase64: 'base64sampledata...',
        mimeType: 'image/jpeg',
      });

      expect(llmService.generateHybridResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              parts: expect.arrayContaining([
                { text: 'What is this meal?' },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: 'base64sampledata...',
                  },
                },
              ]),
            }),
          ]),
        }),
      );
    });

    it('should re-fetch nutrition context if tool mutated state (e.g. quick_log_meal)', async () => {
      llmService.generateHybridResponse.mockImplementationOnce(async (params) => {
        params.onContextMutated();
        return {
          text: 'Logged your chicken salad with 350 kcal.',
          totalTokens: 220,
        };
      });

      const updatedContextSnapshot = {
        ...mockContextSnapshot,
        todayNutrition: {
          ...mockContextSnapshot.todayNutrition,
          caloriesConsumed: 1750,
          caloriesRemaining: 250,
        },
      };

      contextService.buildUserNutritionContext
        .mockResolvedValueOnce(mockContextSnapshot)
        .mockResolvedValueOnce(updatedContextSnapshot);

      const response = await service.sendChatMessage(mockUserId, {
        message: 'Log my chicken salad for lunch',
      });

      expect(response.contextUpdated).toBe(true);
      expect(response.todayNutrition.caloriesConsumed).toBe(1750);
      expect(response.todayNutrition.caloriesRemaining).toBe(250);
    });
  });

  describe('PromptService', () => {
    it('should build hybrid system instruction including calories, protein and user profile', () => {
      const instruction = promptService.buildHybridSystemInstruction(mockContextSnapshot);

      expect(instruction).toContain('Alex Nguyen');
      expect(instruction).toContain('1400 / 2000 kcal');
      expect(instruction).toContain('80g / 130g');
      expect(instruction).toContain('Chicken Rice');
      expect(instruction).toContain('OPERATING GUIDELINES (HYBRID ARCHITECTURE)');
      expect(instruction).toContain('When to use Tools vs. Injected Context');
    });

    it('should format conversation history into Gemini format', () => {
      const contents = promptService.buildConversationContents(
        mockActiveConversation.messages as any,
        'Next question',
      );

      expect(contents.length).toBe(3);
      expect(contents[0].role).toBe('user');
      expect(contents[1].role).toBe('model');
      expect(contents[2].role).toBe('user');
      expect(contents[2].parts[0].text).toBe('Next question');
    });
  });
});
