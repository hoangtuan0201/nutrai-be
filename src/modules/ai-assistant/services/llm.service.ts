import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NutritionTool } from '../tools/nutrition.tool';
import { MealTool } from '../tools/meal.tool';
import { ProgressTool } from '../tools/progress.tool';

export interface ToolDispatchResult {
  result: any;
  mutatedContext: boolean;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey: string;
  private readonly primaryModel = 'gemini-flash-lite-latest';
  private readonly fallbackModel = 'gemini-2.5-flash';

  constructor(
    private readonly configService: ConfigService,
    private readonly nutritionTool: NutritionTool,
    private readonly mealTool: MealTool,
    private readonly progressTool: ProgressTool,
  ) {
    this.apiKey =
      this.configService.get<string>('GEMINI_API_SCANFOOD') ||
      this.configService.get<string>('GEMINI_API_KEY') ||
      '';
    if (!this.apiKey) {
      this.logger.warn('⚠️ GEMINI_API_SCANFOOD is not set in environment variables.');
    }
  }

  /**
   * Aggregates all Gemini Function Declarations across domain tool classes
   */
  getFunctionDeclarations() {
    return [
      ...this.nutritionTool.getDeclarations(),
      ...this.mealTool.getDeclarations(),
      ...this.progressTool.getDeclarations(),
    ];
  }

  /**
   * Executes Gemini conversation with support for up to 2 Hybrid Tool-Calling turns
   */
  async generateHybridResponse(params: {
    userId: string;
    systemInstructionText: string;
    contents: Array<{ role: string; parts: any[] }>;
    toolsExecuted: Array<{ name: string; args: Record<string, any>; resultSummary: any }>;
    attachedImageUrl?: string | null;
    attachedImageBase64?: string | null;
    onContextMutated: () => void;
  }): Promise<{ text: string; totalTokens: number }> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('Gemini AI API key is not configured on the server.');
    }

    const workingContents = [...params.contents];
    let totalTokens = 0;

    for (let turn = 0; turn < 2; turn++) {
      const payload: Record<string, any> = {
        systemInstruction: {
          parts: [{ text: params.systemInstructionText }],
        },
        contents: workingContents,
        tools: [
          {
            functionDeclarations: this.getFunctionDeclarations(),
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 900,
        },
      };

      const rawData = await this.callGeminiRawWithFallback(
        this.primaryModel,
        this.fallbackModel,
        payload,
      );

      totalTokens += Number(rawData?.usageMetadata?.totalTokenCount || 0);

      const candidateContent = rawData?.candidates?.[0]?.content;
      const parts: any[] = candidateContent?.parts || [];

      const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

      // Fast path (90%+ of queries): Direct answer from Layer 1 Context without tool calls
      if (functionCalls.length === 0) {
        const replyText = parts
          .map((p) => p.text || '')
          .join('')
          .trim();
        if (!replyText) {
          throw new Error('Gemini returned an empty response.');
        }
        return { text: replyText, totalTokens };
      }

      // Layer 2 path: Execute requested tool calls via domain tools
      workingContents.push({
        role: 'model',
        parts,
      });

      const functionResponseParts: any[] = [];
      for (const call of functionCalls) {
        const toolName = String(call.name || '');
        const toolArgs = (call.args || {}) as Record<string, any>;
        this.logger.log(`🔧 Executing Hybrid AI Tool: ${toolName} with args ${JSON.stringify(toolArgs)}`);

        const { result: toolResult, mutatedContext } = await this.dispatchTool(
          params.userId,
          toolName,
          toolArgs,
          {
            attachedImageUrl: params.attachedImageUrl,
            attachedImageBase64: params.attachedImageBase64,
          },
        );

        if (mutatedContext) {
          params.onContextMutated();
        }

        params.toolsExecuted.push({
          name: toolName,
          args: toolArgs,
          resultSummary: toolResult,
        });

        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: {
              result: toolResult,
            },
          },
        });
      }

      workingContents.push({
        role: 'user',
        parts: functionResponseParts,
      });
    }

    // Final synthesis call if loop exhausted tool turns
    const finalPayload = {
      systemInstruction: {
        parts: [{ text: params.systemInstructionText }],
      },
      contents: workingContents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 900,
      },
    };

    const finalData = await this.callGeminiRawWithFallback(
      this.primaryModel,
      this.fallbackModel,
      finalPayload,
    );
    totalTokens += Number(finalData?.usageMetadata?.totalTokenCount || 0);

    const finalText = (finalData?.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p.text || '')
      .join('')
      .trim();

    return {
      text: finalText || 'I have updated your records. How else can I help you today?',
      totalTokens,
    };
  }

  private async dispatchTool(
    userId: string,
    toolName: string,
    args: Record<string, any>,
    options?: {
      attachedImageUrl?: string | null;
      attachedImageBase64?: string | null;
    },
  ): Promise<ToolDispatchResult> {
    try {
      switch (toolName) {
        case 'get_nutrition_by_date_range': {
          const result = await this.nutritionTool.getNutritionByDateRange(
            userId,
            String(args.startDate || ''),
            args.endDate ? String(args.endDate) : undefined,
          );
          return { result, mutatedContext: false };
        }

        case 'search_food_database': {
          const result = await this.nutritionTool.searchFoods(String(args.query || ''));
          return { result, mutatedContext: false };
        }

        case 'quick_log_meal': {
          const result = await this.mealTool.quickLogMeal(userId, {
            mealType: args.mealType,
            name: String(args.name || 'Meal'),
            calories: Number(args.calories) || 0,
            protein: Number(args.protein) || 0,
            carbs: Number(args.carbs) || 0,
            fat: Number(args.fat) || 0,
            imageUrl: args.imageUrl || options?.attachedImageUrl || undefined,
            imageBase64: options?.attachedImageBase64 || undefined,
          });
          return { result, mutatedContext: Boolean(result?.success) };
        }

        case 'log_body_weight': {
          const result = await this.progressTool.logBodyWeight(userId, {
            weightKg: Number(args.weightKg),
            note: args.note ? String(args.note) : undefined,
          });
          return { result, mutatedContext: Boolean(result?.success) };
        }

        default:
          return {
            result: { error: `Unknown tool '${toolName}'.` },
            mutatedContext: false,
          };
      }
    } catch (err: any) {
      this.logger.warn(`Tool '${toolName}' execution error: ${err.message}`);
      return {
        result: { error: err.message || 'Failed to execute tool.' },
        mutatedContext: false,
      };
    }
  }

  private async callGeminiRawWithFallback(
    primary: string,
    fallback: string,
    payload: any,
  ): Promise<any> {
    try {
      return await this.executeGeminiRawRequest(primary, payload);
    } catch (primaryErr: any) {
      this.logger.warn(
        `Primary model ${primary} failed (${primaryErr.message}). Attempting fallback ${fallback}...`,
      );
      try {
        return await this.executeGeminiRawRequest(fallback, payload);
      } catch (fallbackErr: any) {
        if (payload.tools) {
          this.logger.warn(
            `Fallback model with tools failed (${fallbackErr.message}). Retrying with pure Direct Context Injection...`,
          );
          const { tools: _ignoredTools, ...payloadWithoutTools } = payload;
          return await this.executeGeminiRawRequest(primary, payloadWithoutTools);
        }
        throw fallbackErr;
      }
    }
  }

  private async executeGeminiRawRequest(modelName: string, payload: any): Promise<any> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    return data;
  }
}

