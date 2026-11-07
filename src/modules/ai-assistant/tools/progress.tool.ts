import { Injectable } from '@nestjs/common';
import { ProgressService } from '../../progress/progress.service';

@Injectable()
export class ProgressTool {
  constructor(private readonly progressService: ProgressService) {}

  getDeclarations() {
    return [
      {
        name: 'log_body_weight',
        description:
          'Log or update the user’s body weight in kilograms when the user explicitly asks to record or update their weight.',
        parameters: {
          type: 'OBJECT',
          properties: {
            weightKg: {
              type: 'NUMBER',
              description: 'Body weight in kilograms (e.g. 68.5)',
            },
            note: {
              type: 'STRING',
              description: 'Optional note for the weight entry',
            },
          },
          required: ['weightKg'],
        },
      },
    ];
  }

  /**
   * Logs or updates the user's body weight and recalculates nutrition targets accordingly
   */
  async logBodyWeight(userId: string, args: { weightKg: number; note?: string }) {
    const weightKg = Number(args.weightKg);
    if (!weightKg || weightKg < 20 || weightKg > 300) {
      return { error: 'Invalid weight value. Must be between 20 and 300 kg.' };
    }

    const logged = await this.progressService.logWeight(userId, {
      weightKg,
      note: args.note ? String(args.note) : 'Logged via NutraAI Assistant',
    });

    return {
      success: true,
      weightKg: logged.weightKg,
      date: logged.date,
    };
  }
}

