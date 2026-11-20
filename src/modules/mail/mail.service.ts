import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  buildEmailVerificationHtml,
  buildPasswordResetHtml,
} from './mail.templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    const port = this.config.get<number>('SMTP_PORT') || 587;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS')?.replace(/\s+/g, '');
    this.fromAddress =
      this.config.get<string>('SMTP_FROM')?.trim() ||
      (user ? `NutrAI <${user}>` : 'NutrAI <no-reply@nutrai.app>');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP Mailer configured (${host}:${port} as ${user})`);
    } else {
      this.transporter = null;
      this.logger.warn('SMTP_USER / SMTP_PASS not configured — emails will be logged only.');
    }
  }

  async sendEmailVerification(params: {
    to: string;
    name?: string | null;
    code: string;
    expiresMinutes: number;
  }): Promise<boolean> {
    const subject = `${params.code} is your NutrAI verification code`;
    const html = buildEmailVerificationHtml({
      name: params.name,
      code: params.code,
      expiresMinutes: params.expiresMinutes,
    });
    const text = `Welcome to NutrAI!\n\nYour email verification code is: ${params.code}\nThis code expires in ${params.expiresMinutes} minutes.\n\nIf you did not create a NutrAI account, you can ignore this email.`;

    return this.send({ to: params.to, subject, html, text });
  }

  async sendPasswordReset(params: {
    to: string;
    name?: string | null;
    code: string;
    expiresMinutes: number;
  }): Promise<boolean> {
    const subject = `${params.code} — Reset your NutrAI password`;
    const html = buildPasswordResetHtml({
      name: params.name,
      code: params.code,
      expiresMinutes: params.expiresMinutes,
    });
    const text = `Reset your NutrAI password\n\nYour 6-digit password reset code is: ${params.code}\nThis code expires in ${params.expiresMinutes} minutes.\n\nIf you did not request a password reset, you can safely ignore this email.`;

    return this.send({ to: params.to, subject, html, text });
  }

  private async send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(`[DEV MAIL FALLBACK] To: ${options.to} | Subject: ${options.subject}`);
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      this.logger.log(`Email sent to ${options.to} (messageId=${info.messageId})`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}

