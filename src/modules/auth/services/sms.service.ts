import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';

@Injectable()
export class SmsService {
  private client: twilio.Twilio;
  private verificationCodes: Map<string, { code: string; expiresAt: Date }> = new Map();

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    }
  }

  async sendVerificationCode(phone: string): Promise<void> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code with expiration (5 minutes)
    this.verificationCodes.set(phone, {
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // In production, send via Twilio
    if (this.client) {
      try {
        await this.client.messages.create({
          body: `Your verification code is: ${code}`,
          from: this.configService.get<string>('TWILIO_PHONE_NUMBER'),
          to: phone,
        });
      } catch (error) {
        console.error('SMS sending error:', error);
        // In development, log the code
        console.log(`Verification code for ${phone}: ${code}`);
      }
    } else {
      // Development mode - just log
      console.log(`Verification code for ${phone}: ${code}`);
    }
  }

  async verifyCode(phone: string, code: string): Promise<boolean> {
    const stored = this.verificationCodes.get(phone);

    if (!stored) {
      return false;
    }

    if (new Date() > stored.expiresAt) {
      this.verificationCodes.delete(phone);
      return false;
    }

    if (stored.code !== code) {
      return false;
    }

    // Code verified, remove it
    this.verificationCodes.delete(phone);
    return true;
  }
}

