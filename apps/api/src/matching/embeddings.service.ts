import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small'; // 1536 dims — matches vector(1536) in schema.prisma

// Wraps OpenAI's embeddings API for the pgvector-based matching layer. If
// OPENAI_API_KEY isn't set (or a call fails), every method here is a no-op —
// callers fall back to the Phase-1 deterministic score, so the app keeps
// working without a key. Set OPENAI_API_KEY in apps/api/.env to turn it on.
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private warnedMissingKey = false;

  constructor(private prisma: PrismaService) {}

  get enabled(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private async embed(text: string): Promise<number[] | null> {
    if (!this.enabled) {
      if (!this.warnedMissingKey) {
        this.logger.warn('OPENAI_API_KEY not set — semantic matching disabled, falling back to rule-based scoring only.');
        this.warnedMissingKey = true;
      }
      return null;
    }
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: MODEL, input: trimmed.slice(0, 8000) }),
      });
      if (!res.ok) {
        this.logger.warn(`OpenAI embeddings request failed: ${res.status} ${await res.text().catch(() => '')}`);
        return null;
      }
      const data = await res.json();
      return data?.data?.[0]?.embedding ?? null;
    } catch (err) {
      this.logger.warn(`OpenAI embeddings request errored: ${(err as Error).message}`);
      return null;
    }
  }

  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  jobText(job: { title: string; description: string; category: string; location: string; skills?: unknown }): string {
    const skills = Array.isArray(job.skills) ? (job.skills as string[]).join(', ') : '';
    return `${job.title}\nCategory: ${job.category}\nLocation: ${job.location}\nSkills: ${skills}\n\n${job.description}`;
  }

  seekerText(profile: {
    headline?: string | null;
    about?: string | null;
    location?: string | null;
    skills?: unknown;
    resumeText?: string | null;
  }): string {
    const skills = Array.isArray(profile.skills) ? (profile.skills as string[]).join(', ') : '';
    return [profile.headline, `Location: ${profile.location || ''}`, `Skills: ${skills}`, profile.about, profile.resumeText]
      .filter(Boolean)
      .join('\n');
  }

  // Fire-and-await, but never throws — a failed embedding call should never
  // block a job publish or profile save.
  async embedAndStoreJob(jobId: string, job: { title: string; description: string; category: string; location: string; skills?: unknown }) {
    const embedding = await this.embed(this.jobText(job));
    if (!embedding) return;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "Job" SET embedding = $1::vector WHERE id = $2`,
      this.toVectorLiteral(embedding),
      jobId,
    );
  }

  async embedAndStoreSeekerProfile(
    userId: string,
    profile: { headline?: string | null; about?: string | null; location?: string | null; skills?: unknown; resumeText?: string | null },
  ) {
    const embedding = await this.embed(this.seekerText(profile));
    if (!embedding) return;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "SeekerProfile" SET embedding = $1::vector WHERE "userId" = $2`,
      this.toVectorLiteral(embedding),
      userId,
    );
  }

  // Cosine similarity (0-1, higher = closer) between one seeker's stored
  // embedding and one job's stored embedding, computed in Postgres. Returns
  // null if either side has no embedding yet (new job/profile, or embeddings
  // disabled) — callers treat null as "fall back to rule-based score only".
  async similarity(seekerUserId: string, jobId: string): Promise<number | null> {
    if (!this.enabled) return null;
    const rows = await this.prisma.$queryRawUnsafe<{ similarity: number | null }[]>(
      `SELECT 1 - (s.embedding <=> j.embedding) AS similarity
       FROM "SeekerProfile" s, "Job" j
       WHERE s."userId" = $1 AND j.id = $2 AND s.embedding IS NOT NULL AND j.embedding IS NOT NULL`,
      seekerUserId,
      jobId,
    );
    return rows[0]?.similarity ?? null;
  }

  // Cosine similarity between one seeker and every published job with an
  // embedding, most-similar first — used to blend into recommendations.
  async similarityToAllJobs(seekerUserId: string): Promise<Map<string, number>> {
    if (!this.enabled) return new Map();
    const rows = await this.prisma.$queryRawUnsafe<{ id: string; similarity: number }[]>(
      `SELECT j.id, 1 - (j.embedding <=> s.embedding) AS similarity
       FROM "Job" j, "SeekerProfile" s
       WHERE s."userId" = $1 AND s.embedding IS NOT NULL AND j.embedding IS NOT NULL AND j.status = 'PUBLISHED'`,
      seekerUserId,
    );
    return new Map(rows.map((r) => [r.id, r.similarity]));
  }
}
