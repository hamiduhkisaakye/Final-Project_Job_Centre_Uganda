import { Injectable } from '@nestjs/common';

export interface MatchReason {
  positive: boolean;
  text: string;
}

export interface MatchResult {
  score: number; // 0-100
  reasons: MatchReason[];
}

// Deterministic rules over structured fields (skills overlap, location,
// salary fit, seniority/years) — the 0-100 score + "why you match" reasons
// contract the UI expects. Phase 2 blends this with a real pgvector/OpenAI
// embedding similarity (see embeddings.service.ts) when both sides have one;
// this stays the fallback whenever an embedding is missing or the OpenAI
// key isn't configured, so scoring never breaks for want of a key.
@Injectable()
export class MatchingService {
  score(seeker: {
    skills?: string[];
    location?: string | null;
    yearsExperience?: number | null;
    expectedSalaryMin?: number | null;
    expectedSalaryMax?: number | null;
  }, job: {
    skills?: unknown;
    location: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
    seniority?: string | null;
  }, vectorSimilarity?: number | null): MatchResult {
    const reasons: MatchReason[] = [];
    let points = 0;
    let maxPoints = 0;

    // Skills overlap — 50 points
    const seekerSkills = new Set((seeker.skills || []).map((s) => s.toLowerCase().trim()));
    const jobSkills: string[] = Array.isArray(job.skills) ? (job.skills as string[]) : [];
    maxPoints += 50;
    if (jobSkills.length > 0) {
      const matched = jobSkills.filter((s) => seekerSkills.has(String(s).toLowerCase().trim()));
      const ratio = matched.length / jobSkills.length;
      points += Math.round(ratio * 50);
      if (matched.length > 0) {
        reasons.push({ positive: true, text: `${matched.length}/${jobSkills.length} required skills matched: ${matched.slice(0, 3).join(', ')}` });
      }
      const missing = jobSkills.filter((s) => !seekerSkills.has(String(s).toLowerCase().trim()));
      if (missing.length > 0) {
        reasons.push({ positive: false, text: `Missing: ${missing.slice(0, 2).join(', ')}` });
      }
    } else {
      points += 25; // neutral when the job lists no explicit skills
    }

    // Location — 25 points
    maxPoints += 25;
    if (seeker.location && job.location && seeker.location.toLowerCase().includes(job.location.toLowerCase().split(',')[0])) {
      points += 25;
      reasons.push({ positive: true, text: `Based in ${job.location}, no relocation needed` });
    } else {
      points += 8;
    }

    // Salary fit — 15 points
    maxPoints += 15;
    if (seeker.expectedSalaryMin && job.salaryMax) {
      if (seeker.expectedSalaryMin <= job.salaryMax) {
        points += 15;
      } else {
        points += 3;
        reasons.push({ positive: false, text: 'Your expected salary is above this role’s range' });
      }
    } else {
      points += 10;
    }

    // Experience — 10 points
    maxPoints += 10;
    if (seeker.yearsExperience != null) {
      points += 10;
      reasons.push({ positive: true, text: `${seeker.yearsExperience} years of experience` });
    } else {
      points += 4;
    }

    const ruleScore = Math.max(0, Math.min(100, Math.round((points / maxPoints) * 100)));

    // Blend in semantic similarity when we have it: 50/50 with the rule
    // score, so a strong resume/job-description match can lift a score the
    // rules alone would undersell (e.g. adjacent skills phrased differently),
    // while the rules still anchor the number when semantic similarity is
    // absent or the model is wrong about something structured (salary fit).
    let score = ruleScore;
    if (vectorSimilarity != null) {
      const semanticScore = Math.round(vectorSimilarity * 100);
      score = Math.max(0, Math.min(100, Math.round(0.5 * ruleScore + 0.5 * semanticScore)));
      if (vectorSimilarity >= 0.75) {
        reasons.unshift({ positive: true, text: 'Strong AI semantic match between your resume and this role' });
      }
    }

    return { score, reasons: reasons.slice(0, 4) };
  }
}
