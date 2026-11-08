import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { AccountRepository } from './account.repository';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly repo: AccountRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  getMe(userId: string) {
    return this.repo.findUser(userId);
  }

  async uploadAvatar(userId: string, imageBase64: string) {
    let url: string;
    try {
      url = await this.cloudinary.uploadImage(imageBase64, 'nutraai/avatars');
    } catch (err) {
      this.logger.error(`Avatar upload failed: ${(err as Error).message}`);
      throw new BadRequestException('Could not upload avatar image');
    }
    return this.repo.updateAvatar(userId, url);
  }

  getPreferences(userId: string) {
    return this.repo.getPreferences(userId);
  }

  updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.repo.updatePreferences(userId, dto);
  }

  async exportData(userId: string) {
    const data = await this.repo.exportAll(userId);
    return { exportedAt: new Date().toISOString(), ...data };
  }

  async deleteAccount(userId: string) {
    await this.repo.softDelete(userId);
    this.logger.warn(`Account deactivated: userId=${userId}`);
    return { success: true };
  }
}

