import { Injectable, Logger } from '@nestjs/common';
import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ProfileResponseDto,
  CalculatedMetricsDto,
  NutritionTargetDto,
} from './dto/profile-response.dto';
import { ProfileRepository, ProfileRow } from './profile.repository';
import {
  ageFromDob,
  calculateBMR,
  calculateTDEE,
  calculateTargets,
} from './nutrition-calculator';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly repo: ProfileRepository) {}

  // ═══════════════════════════════════════════════════════════════
  // GET /profile
  // ═══════════════════════════════════════════════════════════════

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.repo.findOrCreate(userId);
    const metrics = this.computeMetrics(profile);
    let activeTarget = await this.repo.findActiveTarget(userId);

    // Auto-migrate legacy targets or ensure activeTarget exists when profile is complete
    if (metrics && profile.fitnessGoal && profile.weightKg) {
      const expectedProtein = Math.round(profile.weightKg * 1.8);
      if (!activeTarget || Math.abs(activeTarget.dailyProtein - expectedProtein) > 5) {
        const { calorieTarget: dailyCalories, proteinG, carbsG, fatG } =
          calculateTargets(
            metrics.tdee,
            profile.fitnessGoal,
            profile.weightKg,
            profile.gender ?? undefined,
          );

        activeTarget = await this.repo.upsertNutritionTarget(
          userId,
          { dailyCalories, dailyProtein: proteinG, dailyCarbs: carbsG, dailyFat: fatG },
          profile.fitnessGoal,
        );
      }
    }

    return toResponseDto(profile, metrics, activeTarget);
  }

  // ═══════════════════════════════════════════════════════════════
  // PUT /profile
  // ═══════════════════════════════════════════════════════════════

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const profile = await this.repo.upsert(userId, buildUpdateData(dto));

    const metrics = this.computeMetrics(profile);
    let activeTarget: NutritionTargetDto | undefined;

    if (metrics && profile.fitnessGoal) {
      if (
        dto.dailyCalories !== undefined &&
        dto.dailyProtein !== undefined &&
        dto.dailyCarbs !== undefined &&
        dto.dailyFat !== undefined
      ) {
        activeTarget = await this.repo.upsertNutritionTarget(
          userId,
          {
            dailyCalories: Math.round(dto.dailyCalories),
            dailyProtein: Math.round(dto.dailyProtein),
            dailyCarbs: Math.round(dto.dailyCarbs),
            dailyFat: Math.round(dto.dailyFat),
          },
          profile.fitnessGoal,
        );
      } else {
        const { calorieTarget: dailyCalories, proteinG, carbsG, fatG } =
          calculateTargets(
            metrics.tdee,
            profile.fitnessGoal,
            profile.weightKg ?? undefined,
            profile.gender ?? undefined,
          );

        activeTarget = await this.repo.upsertNutritionTarget(
          userId,
          { dailyCalories, dailyProtein: proteinG, dailyCarbs: carbsG, dailyFat: fatG },
          profile.fitnessGoal,
        );
      }
    }

    this.logger.log(`Profile updated: userId=${userId}`);
    return toResponseDto(profile, metrics, activeTarget);
  }

  // ─── Exposed for unit testing ────────────────────────────────────────────

  calculateBMR   = calculateBMR;
  calculateTDEE  = calculateTDEE;
  calculateTargets = calculateTargets;

  // ─── Private helpers ─────────────────────────────────────────────────────

  private computeMetrics(profile: ProfileRow): CalculatedMetricsDto | undefined {
    const { weightKg, heightCm, dateOfBirth, gender, activityLevel, fitnessGoal } = profile;

    if (!weightKg || !heightCm || !dateOfBirth || !gender || !activityLevel || !fitnessGoal) {
      return undefined;
    }

    const bmr  = calculateBMR(weightKg, heightCm, ageFromDob(dateOfBirth), gender);
    const tdee = calculateTDEE(bmr, activityLevel);
    const { calorieTarget } = calculateTargets(tdee, fitnessGoal, weightKg, gender);

    return { bmr, tdee, calorieTarget };
  }
}

// ─── Module-level pure helpers (no class needed) ─────────────────────────────

function buildUpdateData(dto: UpdateProfileDto): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (dto.dateOfBirth  !== undefined) data.dateOfBirth  = new Date(dto.dateOfBirth);
  if (dto.gender       !== undefined) data.gender       = dto.gender;
  if (dto.heightCm     !== undefined) data.heightCm     = dto.heightCm;
  if (dto.weightKg     !== undefined) data.weightKg     = dto.weightKg;
  if (dto.activityLevel !== undefined) data.activityLevel = dto.activityLevel;
  if (dto.fitnessGoal  !== undefined) data.fitnessGoal  = dto.fitnessGoal;
  return data;
}

function toResponseDto(
  profile: ProfileRow,
  metrics: CalculatedMetricsDto | undefined,
  activeTarget: NutritionTargetDto | undefined,
): ProfileResponseDto {
  return {
    id:           profile.id,
    userId:       profile.userId,
    dateOfBirth:  profile.dateOfBirth?.toISOString().split('T')[0],
    gender:       profile.gender       ?? undefined,
    heightCm:     profile.heightCm     ?? undefined,
    weightKg:     profile.weightKg     ?? undefined,
    activityLevel: profile.activityLevel ?? undefined,
    fitnessGoal:  profile.fitnessGoal  ?? undefined,
    metrics,
    activeTarget,
    createdAt:    profile.createdAt.toISOString(),
    updatedAt:    profile.updatedAt.toISOString(),
  };
}
