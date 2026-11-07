import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  ChatMessageItem,
  FullAiContextSnapshot,
} from './interfaces/ai-assistant.interface';

@Injectable()
export class AiAssistantRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches raw user, profile, active nutrition target, 7-day meals, and recent weight logs in parallel
   */
  async fetchUserNutritionRawData(
    userId: string,
    sevenDaysAgoDate: Date,
    todayDate: Date,
  ) {
    const [user, profile, activeTarget, recentMeals, recentWeightLogs] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        }),
        this.prisma.userProfile.findUnique({
          where: { userId },
        }),
        this.prisma.nutritionTarget.findFirst({
          where: { userId, isActive: true },
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.meal.findMany({
          where: {
            userId,
            loggedDate: {
              gte: sevenDaysAgoDate,
              lte: todayDate,
            },
          },
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: [{ loggedDate: 'asc' }, { loggedAt: 'asc' }],
        }),
        this.prisma.weightLog.findMany({
          where: { userId },
          orderBy: [{ loggedDate: 'desc' }, { createdAt: 'desc' }],
          take: 10,
        }),
      ]);

    return { user, profile, activeTarget, recentMeals, recentWeightLogs };
  }

  /**
   * Retrieves the user's most recent active conversation along with its messages
   */
  async getActiveConversationWithMessages(
    userId: string,
    messageLimit = 40,
  ): Promise<{
    id: string | null;
    title: string | null;
    messages: ChatMessageItem[];
  }> {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { userId, isActive: true },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: messageLimit,
        },
      },
    });

    if (!conversation) {
      return { id: null, title: null, messages: [] };
    }

    return {
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages.map((m) => this.mapChatMessage(m)),
    };
  }

  /**
   * Helper: formats conversation title from first user message
   */
  private formatConversationTitle(text: string): string {
    const singleLine = text.trim().split('\n')[0].trim();
    if (!singleLine) return 'Food Consultation';
    return singleLine.length > 70 ? singleLine.slice(0, 67) + '...' : singleLine;
  }

  /**
   * Gets an existing conversation by ID (belonging to user) or creates/fetches the active conversation
   */
  async getOrCreateConversation(
    userId: string,
    conversationId?: string,
    initialTitle?: string,
  ) {
    if (conversationId) {
      const found = await this.prisma.chatConversation.findFirst({
        where: { id: conversationId, userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20,
          },
        },
      });
      if (found) {
        if ((!found.title || found.title === 'Untitled chat' || found.title === 'Nutrition Coaching') && initialTitle) {
          const cleanTitle = this.formatConversationTitle(initialTitle);
          await this.prisma.chatConversation.update({
            where: { id: found.id },
            data: { title: cleanTitle },
          });
          found.title = cleanTitle;
        }
        return found;
      }
    }

    const active = await this.prisma.chatConversation.findFirst({
      where: { userId, isActive: true },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
    });

    if (active) {
      if ((!active.title || active.title === 'Untitled chat' || active.title === 'Nutrition Coaching') && initialTitle) {
        const cleanTitle = this.formatConversationTitle(initialTitle);
        await this.prisma.chatConversation.update({
          where: { id: active.id },
          data: { title: cleanTitle },
        });
        active.title = cleanTitle;
      }
      return active;
    }

    const cleanTitle = initialTitle ? this.formatConversationTitle(initialTitle) : null;
    return this.prisma.chatConversation.create({
      data: {
        userId,
        title: cleanTitle,
        isActive: true,
        lastMessageAt: new Date(),
      },
      include: {
        messages: true,
      },
    });
  }

  /**
   * Archives current active conversation(s) so user starts a fresh session
   */
  async startNewConversation(userId: string, title?: string) {
    await this.prisma.chatConversation.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const created = await this.prisma.chatConversation.create({
      data: {
        userId,
        title: title ? title.slice(0, 80) : null,
        isActive: true,
      },
    });

    return {
      id: created.id,
      title: created.title,
      messages: [],
    };
  }

  /**
   * Saves the User question and Assistant reply into ChatMessage table and updates ChatConversation
   */
  async saveMessagePair(params: {
    conversationId: string;
    userContent: string;
    assistantContent: string;
    contextSnapshot: FullAiContextSnapshot;
    tokensUsed?: number | null;
    latencyMs?: number | null;
  }): Promise<{ userMessage: ChatMessageItem; assistantMessage: ChatMessageItem }> {
    const now = new Date();
    const assistantCreatedAt = new Date(now.getTime() + 10);

    const currentConv = await this.prisma.chatConversation.findUnique({
      where: { id: params.conversationId },
      select: { title: true },
    });

    const needsTitle =
      !currentConv?.title ||
      currentConv.title === 'Untitled chat' ||
      currentConv.title === 'Nutrition Coaching';

    const newTitle = needsTitle
      ? this.formatConversationTitle(params.userContent)
      : undefined;

    const [userMsg, assistantMsg] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId: params.conversationId,
          role: 'USER',
          content: params.userContent,
          createdAt: now,
        },
      }),
      this.prisma.chatMessage.create({
        data: {
          conversationId: params.conversationId,
          role: 'ASSISTANT',
          content: params.assistantContent,
          contextSnapshot: params.contextSnapshot as unknown as Prisma.InputJsonValue,
          tokensUsed: params.tokensUsed ?? null,
          latencyMs: params.latencyMs ?? null,
          createdAt: assistantCreatedAt,
        },
      }),
      this.prisma.chatConversation.update({
        where: { id: params.conversationId },
        data: {
          lastMessageAt: assistantCreatedAt,
          isActive: true,
          ...(newTitle ? { title: newTitle } : {}),
        },
      }),
    ]);

    return {
      userMessage: this.mapChatMessage(userMsg),
      assistantMessage: this.mapChatMessage(assistantMsg),
    };
  }

  /**
   * Lists the user's past conversations (only those containing messages) for the History drawer.
   * If a conversation lacks a title, falls back to the user's first question.
   */
  async listConversations(userId: string, limit = 50) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: { userId, messages: { some: {} } },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        isActive: true,
        lastMessageAt: true,
        createdAt: true,
        messages: {
          where: { role: 'USER' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { content: true },
        },
      },
    });

    return conversations.map((c) => {
      let title = c.title;
      if (!title || title === 'Untitled chat' || title === 'Nutrition Coaching') {
        const firstUserMsg = c.messages?.[0]?.content;
        if (firstUserMsg) {
          title = this.formatConversationTitle(firstUserMsg);
        }
      }
      return {
        id: c.id,
        title: title || 'Food Consultation',
        isActive: c.isActive,
        lastMessageAt: (c.lastMessageAt ?? c.createdAt).toISOString(),
      };
    });
  }

  /**
   * Opens a past conversation: marks it as the single active conversation and returns its messages
   */
  async activateConversation(
    userId: string,
    conversationId: string,
    messageLimit = 40,
  ): Promise<{ id: string; title: string | null; messages: ChatMessageItem[] } | null> {
    const found = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!found) return null;

    await this.prisma.$transaction([
      this.prisma.chatConversation.updateMany({
        where: { userId, isActive: true, id: { not: conversationId } },
        data: { isActive: false },
      }),
      this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: { isActive: true },
      }),
    ]);

    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: messageLimit,
        },
      },
    });

    return {
      id: conversationId,
      title: conversation?.title ?? null,
      messages: (conversation?.messages || []).map((m) => this.mapChatMessage(m)),
    };
  }

  private mapChatMessage(m: {
    id: string;
    role: string;
    content: string;
    contextSnapshot: Prisma.JsonValue;
    tokensUsed: number | null;
    latencyMs: number | null;
    createdAt: Date;
  }): ChatMessageItem {
    let toolsUsed: string[] | undefined;
    if (
      m.contextSnapshot &&
      typeof m.contextSnapshot === 'object' &&
      !Array.isArray(m.contextSnapshot)
    ) {
      const snap = m.contextSnapshot as Record<string, any>;
      if (Array.isArray(snap.toolsExecuted) && snap.toolsExecuted.length > 0) {
        toolsUsed = snap.toolsExecuted.map((t: any) => String(t.name));
      }
    }

    return {
      id: m.id,
      role: m.role as 'USER' | 'ASSISTANT' | 'SYSTEM',
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      latencyMs: m.latencyMs,
      tokensUsed: m.tokensUsed,
      ...(toolsUsed ? { toolsUsed } : {}),
    };
  }
}

