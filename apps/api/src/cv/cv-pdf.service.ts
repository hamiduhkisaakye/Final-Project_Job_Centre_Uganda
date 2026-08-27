import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import { createElement } from 'react';
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { PrismaService } from '../prisma/prisma.service';

// Same process.cwd()-relative resolution pattern uploads.controller.ts uses
// for LOCAL_STORAGE_DIR — the source file lives at apps/api/assets/logo.png
// and is committed to git, so no dist/-copy step or nest-cli asset config
// is needed.
const LOGO_PATH = path.resolve(process.cwd(), 'assets/logo.png');

const COLORS = {
  primary: '#1E5FBF',
  primaryPressed: '#174890',
  accent: '#FFC107',
  ink: '#333333',
  muted: '#6B7A8D',
  border: '#D7E3F2',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: COLORS.ink, paddingBottom: 40 },
  header: { backgroundColor: COLORS.primary, padding: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 90, height: 23 },
  headerLabel: { color: COLORS.white, fontSize: 9, letterSpacing: 2, fontFamily: 'Helvetica-Bold' },
  body: { paddingHorizontal: 36, paddingTop: 24 },
  name: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: COLORS.ink, marginBottom: 2 },
  headline: { fontSize: 12, color: COLORS.primary, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  metaItem: { fontSize: 9, color: COLORS.muted },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.primary, letterSpacing: 1, marginBottom: 6, marginTop: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 4 },
  paragraph: { fontSize: 10, lineHeight: 1.5, color: COLORS.ink },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillPill: { backgroundColor: '#EAF2FA', color: COLORS.primary, fontSize: 9, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 10 },
  footer: { position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: COLORS.muted },
});

interface CvUser {
  email: string;
}

interface CvProfile {
  fullName?: string | null;
  headline?: string | null;
  about?: string | null;
  location?: string | null;
  yearsExperience?: number | null;
  skills: unknown;
  resumeText?: string | null;
}

function buildCvDocument(user: CvUser, profile: CvProfile) {
  const skills = Array.isArray(profile.skills) ? (profile.skills as string[]) : [];
  const meta = [profile.location, profile.yearsExperience != null ? `${profile.yearsExperience} years experience` : null, user.email].filter(Boolean);

  return createElement(
    Document,
    { title: `${profile.fullName || 'Candidate'} - CV` },
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      createElement(
        View,
        { style: styles.header },
        createElement(Image, { src: LOGO_PATH, style: styles.logo }),
        createElement(Text, { style: styles.headerLabel }, 'CURRICULUM VITAE'),
      ),
      createElement(
        View,
        { style: styles.body },
        createElement(Text, { style: styles.name }, profile.fullName || 'Candidate'),
        profile.headline ? createElement(Text, { style: styles.headline }, profile.headline) : null,
        createElement(
          View,
          { style: styles.metaRow },
          ...meta.map((m, i) => createElement(Text, { style: styles.metaItem, key: i }, m as string)),
        ),
        profile.about
          ? createElement(
              View,
              null,
              createElement(Text, { style: styles.sectionTitle }, 'PROFESSIONAL SUMMARY'),
              createElement(Text, { style: styles.paragraph }, profile.about),
            )
          : null,
        skills.length > 0
          ? createElement(
              View,
              null,
              createElement(Text, { style: styles.sectionTitle }, 'SKILLS'),
              createElement(
                View,
                { style: styles.skillsWrap },
                ...skills.map((s, i) => createElement(Text, { style: styles.skillPill, key: i }, s)),
              ),
            )
          : null,
        profile.resumeText
          ? createElement(
              View,
              null,
              createElement(Text, { style: styles.sectionTitle }, 'EXPERIENCE & BACKGROUND'),
              createElement(Text, { style: styles.paragraph }, profile.resumeText),
            )
          : null,
      ),
      createElement(Text, { style: styles.footer, fixed: true }, 'Generated via Job Centre Uganda — jobcentre.ug'),
    ),
  );
}

@Injectable()
export class CvPdfService {
  constructor(private prisma: PrismaService) {}

  async generateForUser(userId: string): Promise<Buffer> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { seekerProfile: true },
    });
    if (!user?.seekerProfile) throw new NotFoundException('No profile found — complete your profile first.');

    return renderToBuffer(buildCvDocument({ email: user.email }, user.seekerProfile));
  }
}
