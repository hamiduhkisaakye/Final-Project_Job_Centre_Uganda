import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../matching/embeddings.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}
interface EducationEntry {
  id: string;
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: string;
  endYear?: string;
  description?: string;
}
interface CertificationEntry {
  id: string;
  name: string;
  issuer?: string;
  issueDate?: string;
  credentialUrl?: string;
}
interface LinkEntry {
  id: string;
  label: string;
  url: string;
}

// Flattens the Resume Builder's structured sections into the plain text
// that's actually embedded for semantic matching (matching/embeddings.
// service.ts) — resumeText is no longer hand-typed, so it's rebuilt from
// scratch on every save instead of merged/patched.
function buildResumeText(about?: string, experience: ExperienceEntry[] = [], education: EducationEntry[] = [], certifications: CertificationEntry[] = []): string {
  const parts: string[] = [];
  if (about) parts.push(about);
  for (const e of experience) {
    const period = `${e.startDate || ''} – ${e.current ? 'Present' : e.endDate || ''}`.trim();
    parts.push(`${e.title} at ${e.company}${period !== '–' ? ` (${period})` : ''}. ${e.description || ''}`.trim());
  }
  for (const ed of education) {
    const line = [ed.degree, ed.fieldOfStudy ? `in ${ed.fieldOfStudy}` : null].filter(Boolean).join(' ');
    parts.push(`${line}${line ? ' — ' : ''}${ed.school}${ed.endYear ? ` (${ed.endYear})` : ''}`.trim());
  }
  for (const c of certifications) {
    parts.push(`Certification: ${c.name}${c.issuer ? ` — ${c.issuer}` : ''}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

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
    skills: string[]; experience: ExperienceEntry[]; education: EducationEntry[];
    certifications: CertificationEntry[]; links: LinkEntry[];
    // Lives on User, not SeekerProfile — pulled out below before the
    // SeekerProfile upsert so it doesn't leak into that payload.
    phone: string;
  }>) {
    const { phone, ...profileData } = data;
    if (phone !== undefined) await this.prisma.user.update({ where: { id: userId }, data: { phone } });
    // resumeText is derived below, never accepted directly from the client
    // — the Resume Builder has no freeform resume-text field anymore.
    const payload = { ...profileData, resumeText: buildResumeText(profileData.about, profileData.experience, profileData.education, profileData.certifications) };
    const profile = await this.prisma.seekerProfile.upsert({
      where: { userId },
      update: payload as any,
      create: { userId, ...payload } as any,
    });
    // Profile strength drives the dashboard meter (Blueprint §8.1): each
    // filled field/section is worth a slice of 100, weighted toward the
    // sections that most improve match quality and recruiter trust.
    const weights: [keyof typeof profile, number][] = [
      ['fullName', 5], ['headline', 8], ['about', 8], ['location', 5], ['yearsExperience', 4],
      ['expectedSalaryMin', 5],
    ];
    let strength = weights.reduce((sum, [key, w]) => sum + (profile[key] ? w : 0), 0);
    const skills = (profile.skills as string[]) || [];
    strength += Math.min(20, skills.length * 4);
    const experience = (profile.experience as unknown[]) || [];
    strength += Math.min(25, experience.length * 12);
    const education = (profile.education as unknown[]) || [];
    strength += Math.min(10, education.length * 10);
    if (profile.videoResumeUrl) strength += 5;
    strength = Math.min(100, strength);
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
      phone: user.phone || undefined,
      role: user.role,
      status: user.status,
      seekerProfile: seekerProfile || undefined,
      company: companyMemberships?.[0]?.company
        ? { ...companyMemberships[0].company, memberRole: companyMemberships[0].memberRole }
        : undefined,
    };
  }
}
