import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { FirestoreService } from '../../common/services/firestore.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { SmsService } from './services/sms.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifySmsDto } from './dto/verify-sms.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private firestoreService: FirestoreService,
    private jwtService: JwtService,
    private smsService: SmsService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { phone, email, password, firstName, lastName } = registerDto;

    // Check if user exists
    if (phone) {
      const existingUser = await this.firestoreService.findOneBy('users', 'phone', phone);
      if (existingUser) {
        throw new BadRequestException('User with this phone already exists');
      }
    }

    if (email) {
      const existingUser = await this.firestoreService.findOneBy('users', 'email', email);
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }
    }

    // Hash password
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    // Create user
    const user = await this.firestoreService.create('users', {
      phone,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: UserRole.BUYER,
      isEmailVerified: false,
      isPhoneVerified: false,
      isActive: true,
    });

    // Send SMS verification code if phone provided
    if (phone) {
      await this.smsService.sendVerificationCode(phone);
    }

    return {
      message: 'Registration successful. Please verify your phone.',
      userId: (user as any).id,
    };
  }

  async verifySms(verifySmsDto: VerifySmsDto) {
    const { phone, code } = verifySmsDto;
    const isValid = await this.smsService.verifyCode(phone, code);

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    const user: any = await this.firestoreService.findOneBy('users', 'phone', phone);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.firestoreService.update('users', user.id, {
      isPhoneVerified: true,
    });

    const tokens = await this.generateTokens(user);
    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto) {
    const { phone, email, password } = loginDto;

    // Determine if identifier is email or phone
    const identifier = phone || email;
    if (!identifier) {
      throw new BadRequestException('Email or phone is required');
    }

    // Check if identifier is email (contains @) or phone
    const isEmail = identifier.includes('@');
    const searchField = isEmail ? 'email' : 'phone';

    const user: any = await this.firestoreService.findOneBy(
      'users',
      searchField,
      identifier,
    );

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.firestoreService.update('users', user.id, {
      lastLoginAt: new Date(),
    });

    const tokens = await this.generateTokens(user);
    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async validateUser(userId: string): Promise<any> {
    const user: any = await this.firestoreService.findById('users', userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return user;
  }

  async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

    await this.firestoreService.update('users', user.id, {
      refreshToken,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user: any = await this.firestoreService.findById('users', payload.sub);

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateOAuthUser(profile: any, provider: string) {
    const { id, email, firstName, lastName, picture } = profile;

    let user: any = await this.firestoreService.findOneBy('users', 'email', email) ||
               await this.firestoreService.findOneBy('users', `${provider}Id`, id);

    if (!user) {
      user = await this.firestoreService.create('users', {
        email,
        firstName,
        lastName,
        avatar: picture,
        [`${provider}Id`]: id,
        isEmailVerified: true,
        role: UserRole.BUYER,
        isActive: true,
      });
    } else {
      await this.firestoreService.update('users', user.id, {
        [`${provider}Id`]: id,
        avatar: picture || user.avatar,
      });
    }

    return this.generateTokens(user);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user: any = await this.firestoreService.findOneBy('users', 'email', email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token (in production, use crypto.randomBytes or similar)
    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'password-reset' },
      { expiresIn: '1h' },
    );

    // Store reset token in user document
    await this.firestoreService.update('users', user.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
    });

    // In production, send email with reset link
    // For now, we'll just return the token (remove this in production!)
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: ${process.env.FRONTEND_URL || 'http://localhost:3006'}/reset-password?token=${resetToken}`);

    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Remove this in production!
      token: resetToken, // Only for development
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'password-reset') {
        throw new BadRequestException('Invalid reset token');
      }

      const user: any = await this.firestoreService.findById('users', payload.sub);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Check if token matches and hasn't expired
      if (user.passwordResetToken !== token) {
        throw new BadRequestException('Invalid reset token');
      }

      if (user.passwordResetExpires && new Date(user.passwordResetExpires) < new Date()) {
        throw new BadRequestException('Reset token has expired');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password and clear reset token
      await this.firestoreService.update('users', user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      return {
        message: 'Password has been reset successfully',
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new BadRequestException('Invalid or expired reset token');
      }
      throw error;
    }
  }

  sanitizeUser(user: any) {
    const { password, refreshToken, passwordResetToken, passwordResetExpires, ...sanitized } = user;
    return sanitized;
  }
}
