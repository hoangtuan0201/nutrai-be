import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AiAssistantRepository } from './ai-assistant.repository';
import { ContextService } from './services/context.service';
import { PromptService } from './services/prompt.service';
import { LlmService } from './services/llm.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  AiAssistantContextResponse,
  FullAiContextSnapshot,
  SendChatResponse,
} from './interfaces/ai-assistant.interface';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly repository: AiAssistantRepository,
    private readonly contextService: ContextService,
    private readonly promptService: PromptService,
    private readonly llmService: LlmService,
    private readonly aiQuotaService: AiQuotaService,
  ) {}

  /**
   * Returns Today's Nutrition Context Card data + User Profile + Active Chat History
   */
  async getAssistantContext(userId: string): Promise<AiAssistantContextResponse> {
    const [contextSnapshot, activeConversation] = await Promise.all([
      this.contextService.buildUserNutritionContext(userId),
      this.repository.getActiveConversationWithMessages(userId, 40),
    ]);

    return {
      todayNutrition: contextSnapshot.todayNutrition,
      profile: contextSnapshot.profile,
      activeConversation,
    };
  }

  /**
   * Starts a fresh conversation session and returns updated context
   */
  async startNewConversation(
    userId: string,
    dto?: CreateConversationDto,
  ): Promise<AiAssistantContextResponse> {
    const [contextSnapshot, activeConversation] = await Promise.all([
      this.contextService.buildUserNutritionContext(userId),
      this.repository.startNewConversation(userId, dto?.title),
    ]);

    return {
      todayNutrition: contextSnapshot.todayNutrition,
      profile: contextSnapshot.profile,
      activeConversation,
    };
  }

  /**
   * Lists past conversations for the History drawer
   */
  async listConversations(userId: string) {
    return this.repository.listConversations(userId);
  }

  /**
   * Re-opens a past conversation (becomes active) and returns fresh nutrition context + its messages
   */
  async openConversation(
    userId: string,
    conversationId: string,
  ): Promise<AiAssistantContextResponse> {
    const [contextSnapshot, conversation] = await Promise.all([
      this.contextService.buildUserNutritionContext(userId),
      this.repository.activateConversation(userId, conversationId),
    ]);

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    return {
      todayNutrition: contextSnapshot.todayNutrition,
      profile: contextSnapshot.profile,
      activeConversation: conversation,
    };
  }

  /**
   * Hybrid Chat Orchestrator:
   * 1. ContextService builds Layer 1 nutrition snapshot.
   * 2. PromptService builds System Instruction & conversation history.
   * 3. LlmService executes Gemini with Layer 2 Hybrid Tool Calling (NutritionTool, MealTool, ProgressTool).
   * 4. AiAssistantRepository persists USER + ASSISTANT messages and contextSnapshot.
   */
  async sendChatMessage(userId: string, dto: SendMessageDto): Promise<SendChatResponse> {
    // 0. Enforce daily chat quota: Free: 5/day, Pro: 50/day
    await this.aiQuotaService.assertCanChat(userId);

    const startTime = Date.now();
    const userText = dto.message.trim();

    const [initialContext, conversation] = await Promise.all([
      this.contextService.buildUserNutritionContext(userId),
      this.repository.getOrCreateConversation(userId, dto.conversationId, userText),
    ]);

    const systemInstructionText =
      this.promptService.buildHybridSystemInstruction(initialContext);
    const contents = this.promptService.buildConversationContents(
      conversation.messages || [],
      userText,
      dto.imageBase64
        ? { base64: dto.imageBase64, mimeType: dto.mimeType }
        : undefined,
    );

    const toolsExecuted: Array<{
      name: string;
      args: Record<string, any>;
      resultSummary: any;
    }> = [];
    let contextUpdated = false;
    let totalTokensUsed = 0;
    let assistantReplyText = '';

    try {
      const llmResult = await this.llmService.generateHybridResponse({
        userId,
        systemInstructionText,
        contents,
        toolsExecuted,
        onContextMutated: () => {
          contextUpdated = true;
        },
      });

      assistantReplyText = llmResult.text;
      totalTokensUsed = llmResult.totalTokens;
    } catch (err: any) {
      this.logger.error(`AI Assistant chat failed: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        `NutrAI Assistant is temporarily unavailable: ${err.message || 'Please try again.'}`,
      );
    }

    const finalContext: FullAiContextSnapshot = contextUpdated
      ? await this.contextService.buildUserNutritionContext(userId)
      : initialContext;

    if (toolsExecuted.length > 0) {
      finalContext.toolsExecuted = toolsExecuted;
    }

    const latencyMs = Date.now() - startTime;

    const saved = await this.repository.saveMessagePair({
      conversationId: conversation.id,
      userContent: userText,
      assistantContent: assistantReplyText,
      contextSnapshot: finalContext,
      tokensUsed: totalTokensUsed || null,
      latencyMs,
    });

    const updatedQuota = await this.aiQuotaService.getUserDailyQuota(userId);

    return {
      conversationId: conversation.id,
      userMessage: saved.userMessage,
      assistantMessage: saved.assistantMessage,
      todayNutrition: finalContext.todayNutrition,
      contextUpdated,
      quota: updatedQuota.chats,
    };
  }
}

