import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

export interface ParsedCvExperienceEntry {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface ParsedCvEducationEntry {
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  endYear?: string;
}

export interface ParsedCvFields {
  fullName?: string;
  headline?: string;
  about?: string;
  location?: string;
  yearsExperience?: number;
  skills?: string[];
  experience?: ParsedCvExperienceEntry[];
  education?: ParsedCvEducationEntry[];
}

const SYSTEM_PROMPT = `You extract structured profile fields from a job seeker's CV/resume text for Job Centre Uganda, a Ugandan jobs marketplace. Read the text and respond with ONLY a JSON object with these optional keys — omit any key you genuinely cannot determine rather than guessing:
{
  "fullName": string,      // the candidate's full name
  "headline": string,      // a short professional tagline, e.g. "Marketing Officer" — not their name
  "about": string,         // a 2-4 sentence professional summary in their voice
  "location": string,      // city/town, e.g. "Kampala"
  "yearsExperience": number, // total years of professional experience, a whole number
  "skills": string[],      // 5-15 concrete skills, each a short phrase
  "experience": [          // every distinct role found, most recent first
    {
      "title": string,        // job title
      "company": string,      // employer name
      "startDate": string,    // as written, e.g. "Mar 2021" or "2021"
      "endDate": string,      // as written — omit if current is true
      "current": boolean,     // true only if the CV says "present"/"current"
      "description": string   // 1-3 sentences of what they did/achieved in this role
    }
  ],
  "education": [            // every degree/qualification found, most recent first
    { "school": string, "degree": string, "fieldOfStudy": string, "endYear": string }
  ]
}
Never invent information that isn't supported by the text.`;

// Text-extraction + AI structuring for an uploaded CV file. Mirrors
// blog-ai.service.ts's exact posture: raw fetch (no `openai` package),
// `enabled` on OPENAI_API_KEY, throws a clear BadRequestException when
// disabled since this is a direct user action awaiting a response.
@Injectable()
export class CvParserService {
  private readonly logger = new Logger(CvParserService.name);

  get enabled(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    if (file.mimetype === 'application/pdf') {
      const parser = new PDFParse({ data: file.buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  async parse(file: Express.Multer.File): Promise<ParsedCvFields> {
    if (!this.enabled) {
      throw new BadRequestException('CV auto-fill requires an OpenAI API key — set OPENAI_API_KEY in apps/api/.env.');
    }

    const text = (await this.extractText(file)).trim();
    if (text.length < 40) {
      throw new BadRequestException("Couldn't read enough text from that file — it may be a scanned image rather than a text-based document.");
    }

    let res: Response;
    try {
      res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text.slice(0, 6000) },
          ],
        }),
      });
    } catch (err) {
      this.logger.warn(`OpenAI chat request errored: ${(err as Error).message}`);
      throw new BadRequestException('Could not reach the AI service — please try again.');
    }

    if (!res.ok) {
      this.logger.warn(`OpenAI chat request failed: ${res.status} ${await res.text().catch(() => '')}`);
      throw new BadRequestException('The AI service returned an error — please try again.');
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new BadRequestException('The AI service returned an empty response — please try again.');

    let parsed: ParsedCvFields;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('The AI response could not be understood — please try again.');
    }

    return {
      fullName: parsed.fullName || undefined,
      headline: parsed.headline || undefined,
      about: parsed.about || undefined,
      location: parsed.location || undefined,
      yearsExperience: typeof parsed.yearsExperience === 'number' ? parsed.yearsExperience : undefined,
      skills: Array.isArray(parsed.skills) ? parsed.skills.filter((s) => typeof s === 'string') : undefined,
      experience: Array.isArray(parsed.experience) ? parsed.experience.filter((e) => e && typeof e === 'object') : undefined,
      education: Array.isArray(parsed.education) ? parsed.education.filter((e) => e && typeof e === 'object') : undefined,
    };
  }
}
