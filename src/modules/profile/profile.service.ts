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
  recalculateTargetWithWeightChange,
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

    if (!activeTarget && metrics && profile.fitnessGoal) {
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

    return toResponseDto(profile, metrics, activeTarget);
  }

  // ═══════════════════════════════════════════════════════════════
  // PUT /profile
  // ═══════════════════════════════════════════════════════════════

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const oldProfile = await this.repo.findOrCreate(userId);
    const existingTarget = await this.repo.findActiveTarget(userId);
    const profile = await this.repo.upsert(userId, buildUpdateData(dto));

    const metrics = this.computeMetrics(profile);
    let activeTarget: NutritionTargetDto | undefined;

    const goalOrActivityChanged =
      (dto.fitnessGoal !== undefined && dto.fitnessGoal !== oldProfile.fitnessGoal) ||
      (dto.activityLevel !== undefined && dto.activityLevel !== oldProfile.activityLevel);

    const recalculated = recalculateTargetWithWeightChange(
      oldProfile,
      profile,
      existingTarget,
      goalOrActivityChanged,
    );

    if (recalculated) {
      activeTarget = await this.repo.upsertNutritionTarget(
        userId,
        recalculated,
        profile.fitnessGoal ?? FitnessGoal.MAINTENANCE,
      );
    } else {
      activeTarget = existingTarget;
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
    const { calorieTarget } = calculateTargets(
      tdee,
      fitnessGoal,
      weightKg ?? undefined,
      gender ?? undefined,
    );

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
  if (dto.targetWeightKg !== undefined) data.targetWeightKg = dto.targetWeightKg;
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
    targetWeightKg: (profile as any).targetWeightKg ?? undefined,
    activityLevel: profile.activityLevel ?? undefined,
    fitnessGoal:  profile.fitnessGoal  ?? undefined,
    metrics,
    activeTarget,
    createdAt:    profile.createdAt.toISOString(),
    updatedAt:    profile.updatedAt.toISOString(),
  };
}
