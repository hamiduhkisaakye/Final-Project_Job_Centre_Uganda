import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../matching/embeddings.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private embeddings: EmbeddingsService,
  ) {}

  private async issueTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
      expiresIn: process.env.JWT_REFRESH_TTL || '30d',
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await argon2.hash(dto.password);

    // Companies start PENDING until an admin verifies them (Blueprint §3.1);
    // seekers are active immediately.
    const status = dto.role === 'COMPANY' ? 'PENDING' : 'ACTIVE';

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        status,
      },
    });

    if (dto.role === 'JOB_SEEKER') {
      await this.prisma.seekerProfile.create({
        data: { userId: user.id, fullName: dto.fullName },
      });
    } else {
      const baseSlug = slugify(dto.companyName || dto.fullName, { lower: true, strict: true });
      let slug = baseSlug;
      let n = 1;
      while (await this.prisma.company.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${++n}`;
      }
      const company = await this.prisma.company.create({
        data: {
          name: dto.companyName || dto.fullName,
          slug,
          verificationStatus: 'PENDING',
        },
      });
      await this.prisma.companyMember.create({
        data: { companyId: company.id, userId: user.id, memberRole: 'OWNER' },
      });
    }

    const tokens = await this.issueTokens(user);
    return { user: await this.me(user.id), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Incorrect email or password');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Incorrect email or password');

    if (user.status === 'SUSPENDED') throw new UnauthorizedException('This account has been suspended');
    if (user.status === 'DELETED') throw new UnauthorizedException('Incorrect email or password');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokens(user);
    return { user: await this.me(user.id), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
      });
    } catch {
      throw new UnauthorizedException('Session expired, please log in again');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new UnauthorizedException('Session expired, please log in again');
    }
    const tokens = await this.issueTokens(user);
    // Re-fetch with relations (not just the bare `user` row above) — this
    // is the payload the frontend's silent-refresh-on-mount/after-save
    // flow relies on to reflect anything just changed (uploaded resume,
    // updated logo, saved profile fields), so it has to be as complete as
    // GET /auth/me.
    return { user: await this.me(user.id), ...tokens };
  }

  async updateSeekerProfile(userId: string, data: Partial<{
    fullName: string; headline: string; about: string; location: string; willingToRelocate: boolean;
    yearsExperience: number; expectedSalaryMin: number; expectedSalaryMax: number;
    skills: string[]; resumeText: string;
  }>) {
    const profile = await this.prisma.seekerProfile.upsert({
      where: { userId },
      update: data as any,
      create: { userId, ...data } as any,
    });
    // Profile strength drives the dashboard meter (Blueprint §8.1): each
    // filled field is worth a slice of 100, weighted toward the fields
    // that most improve match quality (skills, resume text, headline).
    const weights: [keyof typeof profile, number][] = [
      ['fullName', 5], ['headline', 10], ['about', 10], ['location', 10], ['yearsExperience', 5],
      ['expectedSalaryMin', 10], ['resumeText', 25],
    ];
    let strength = weights.reduce((sum, [key, w]) => sum + (profile[key] ? w : 0), 0);
    const skills = (profile.skills as string[]) || [];
    strength += Math.min(25, skills.length * 5);
    await this.prisma.seekerProfile.update({ where: { userId }, data: { profileStrength: strength } });
    await this.embeddings.embedAndStoreSeekerProfile(userId, profile).catch(() => undefined);
    return { ...profile, profileStrength: strength };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { seekerProfile: true, companyMemberships: { include: { company: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return this.toPublicUser(user, user.seekerProfile, user.companyMemberships);
  }

  private toPublicUser(user: any, seekerProfile?: any, companyMemberships?: any[]) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      seekerProfile: seekerProfile || undefined,
      company: companyMemberships?.[0]?.company
        ? { ...companyMemberships[0].company, memberRole: companyMemberships[0].memberRole }
        : undefined,
    };
  }
}
