import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';

interface QuestionInput {
  question: string;
  options: string[];
  correctIndex: number;
}

@Injectable()
export class AssessmentsService {
  constructor(
    private prisma: PrismaService,
    private companies: CompaniesService,
  ) {}

  private validateQuestions(questions: unknown) {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new BadRequestException('At least one question is required');
    }
    for (const q of questions as QuestionInput[]) {
      if (!q.question || typeof q.question !== 'string') {
        throw new BadRequestException('Each question needs text');
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new BadRequestException('Each question needs at least two options');
      }
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        throw new BadRequestException('correctIndex must point to a valid option');
      }
    }
  }

  async listForCompany(userId: string) {
    const company = await this.companies.myCompany(userId);
    return this.prisma.assessment.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    userId: string,
    dto: { title: string; description?: string; questions: QuestionInput[]; passScore?: number },
  ) {
    const company = await this.companies.myCompany(userId);
    this.validateQuestions(dto.questions);
    return this.prisma.assessment.create({
      data: {
        companyId: company.id,
        title: dto.title,
        description: dto.description,
        questions: dto.questions as any,
        passScore: dto.passScore ?? 60,
      },
    });
  }

  private async assertOwned(id: string, userId: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await this.companies.assertMember(assessment.companyId, userId);
    return assessment;
  }

  async update(
    userId: string,
    id: string,
    dto: Partial<{ title: string; description: string; questions: QuestionInput[]; passScore: number }>,
  ) {
    await this.assertOwned(id, userId);
    if (dto.questions) this.validateQuestions(dto.questions);
    return this.prisma.assessment.update({ where: { id }, data: dto as any });
  }

  // Seeker-facing view — strips correctIndex so answers aren't visible
  // client-side while someone is taking the assessment.
  async forSeeker(id: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const questions = (assessment.questions as unknown as QuestionInput[]).map(({ question, options }) => ({
      question,
      options,
    }));
    return {
      id: assessment.id,
      title: assessment.title,
      description: assessment.description,
      passScore: assessment.passScore,
      questions,
    };
  }

  async submitAttempt(seekerId: string, assessmentId: string, answers: number[]) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const questions = assessment.questions as unknown as QuestionInput[];
    if (!Array.isArray(answers) || answers.length !== questions.length) {
      throw new BadRequestException('Answer count must match question count');
    }

    const correct = questions.filter((q, i) => q.correctIndex === answers[i]).length;
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= assessment.passScore;

    return this.prisma.assessmentAttempt.upsert({
      where: { assessmentId_seekerId: { assessmentId, seekerId } },
      update: { answers: answers as any, score, passed, completedAt: new Date() },
      create: { assessmentId, seekerId, answers: answers as any, score, passed },
    });
  }

  async myAttempts(seekerId: string) {
    return this.prisma.assessmentAttempt.findMany({
      where: { seekerId },
      include: { assessment: { select: { id: true, title: true, passScore: true } } },
      orderBy: { completedAt: 'desc' },
    });
  }
}
