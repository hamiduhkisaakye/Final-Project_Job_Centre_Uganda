import { Injectable } from '@nestjs/common';

export interface MatchReason {
  positive: boolean;
  text: string;
}

export interface MatchResult {
  score: number; // 0-100
  reasons: MatchReason[];
}

// Job-title qualifiers that shouldn't count toward or against a role
// match — "Marketing Officer" and "Senior Marketing Officer" are the same
// role at a different level, so stripping these lets the word-overlap
// comparison below see past the seniority prefix instead of scoring them
// as unrelated.
const ROLE_QUALIFIERS = new Set([
  'senior', 'junior', 'lead', 'head', 'chief', 'assistant', 'associate', 'principal',
  'deputy', 'intern', 'trainee', 'graduate', 'entry', 'level', 'i', 'ii', 'iii', 'iv',
  'vp', 'director', 'vice', 'of', 'and', 'the', 'a', 'an', 'for', 'to', 'in', 'at', 'on', 'with',
]);

function roleWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s&/-]/g, ' ')
      .split(/[\s/&-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 1 && !ROLE_QUALIFIERS.has(w)),
  );
}

// Intersection-over-union of the two words sets — 0 when nothing in
// common, 1 when the (qualifier-stripped) titles are identical.
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  return intersection / new Set([...a, ...b]).size;
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
    headline?: string | null;
    experience?: { title?: string }[] | null;
  }, job: {
    skills?: unknown;
    location: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
    seniority?: string | null;
    title?: string;
    category?: string;
  }, vectorSimilarity?: number | null): MatchResult {
    const reasons: MatchReason[] = [];
    let points = 0;
    let maxPoints = 0;

    // Skills overlap — 35 points. Was 50, dialed back so skills alone
    // can't dominate the score — see the role-title bucket below, added
    // specifically so a candidate who's held this exact role before isn't
    // undersold just because their listed skills are phrased differently.
    const seekerSkills = new Set((seeker.skills || []).map((s) => s.toLowerCase().trim()));
    const jobSkills: string[] = Array.isArray(job.skills) ? (job.skills as string[]) : [];
    maxPoints += 35;
    if (jobSkills.length > 0) {
      const matched = jobSkills.filter((s) => seekerSkills.has(String(s).toLowerCase().trim()));
      const ratio = matched.length / jobSkills.length;
      points += Math.round(ratio * 35);
      if (matched.length > 0) {
        reasons.push({ positive: true, text: `${matched.length}/${jobSkills.length} required skills matched: ${matched.slice(0, 3).join(', ')}` });
      }
      const missing = jobSkills.filter((s) => !seekerSkills.has(String(s).toLowerCase().trim()));
      if (missing.length > 0) {
        reasons.push({ positive: false, text: `Missing: ${missing.slice(0, 2).join(', ')}` });
      }
    } else {
      points += 18; // neutral when the job lists no explicit skills
    }

    // Role/title similarity — 20 points. Compares the job's title (and,
    // more loosely, its category) against the seeker's headline and every
    // past Experience entry's title, after stripping seniority qualifiers
    // ("Senior", "Junior", "Lead"…) so "Marketing Officer" correctly reads
    // as the same role as "Senior Marketing Officer" rather than unrelated
    // strings. Deterministic word-overlap (Jaccard), not an embedding —
    // keeps the "why you match" reason legible and explainable.
    maxPoints += 20;
    const jobTitleWords = roleWords(job.title || '');
    const jobCategoryWords = roleWords(job.category || '');
    const candidateRoles = [seeker.headline, ...(seeker.experience || []).map((e) => e?.title)].filter(
      (r): r is string => !!r && r.trim().length > 0,
    );
    let bestRoleOverlap = 0;
    let bestRoleLabel = '';
    for (const role of candidateRoles) {
      const words = roleWords(role);
      // A title match is a much stronger signal than merely sharing a
      // category (e.g. "Sales & Marketing"), so category overlap counts
      // for less rather than letting a broad category alone claim a
      // strong role match.
      const overlap = Math.max(jaccard(words, jobTitleWords), jaccard(words, jobCategoryWords) * 0.5);
      if (overlap > bestRoleOverlap) {
        bestRoleOverlap = overlap;
        bestRoleLabel = role;
      }
    }
    points += Math.round(bestRoleOverlap * 20);
    if (bestRoleOverlap >= 0.5) {
      reasons.push({ positive: true, text: `Your experience as "${bestRoleLabel}" closely matches this role` });
    } else if (bestRoleOverlap >= 0.2) {
      reasons.push({ positive: true, text: `Your background in "${bestRoleLabel}" is related to this role` });
    }

    // Location — 20 points
    maxPoints += 20;
    if (seeker.location && job.location && seeker.location.toLowerCase().includes(job.location.toLowerCase().split(',')[0])) {
      points += 20;
      reasons.push({ positive: true, text: `Based in ${job.location}, no relocation needed` });
    } else {
      points += 6;
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
