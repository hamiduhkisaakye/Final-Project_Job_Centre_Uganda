import { BadRequestException, Injectable, Logger } from '@nestjs/common';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You help a job seeker in Uganda prepare for an upcoming interview at Job Centre Uganda, a Ugandan jobs marketplace. You'll be given a job title and description. Respond with ONLY a JSON object: {"questions": ["...", "..."]} — exactly 5 realistic interview questions an interviewer would plausibly ask for this specific role, ordered from general to role-specific. Plain text only, no markdown, no numbering (the caller numbers them).`;

// Same optional-key posture and error handling as blog-ai.service.ts /
// cv-ai.service.ts — a direct user action awaiting a response, so it
// throws a clear message rather than silently no-opping when disabled.
@Injectable()
export class InterviewAiService {
  private readonly logger = new Logger(InterviewAiService.name);

  get enabled(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async likelyQuestions(input: { title: string; description: string }): Promise<{ questions: string[] }> {
    if (!this.enabled) {
      throw new BadRequestException('AI-suggested questions require an OpenAI API key — set OPENAI_API_KEY in apps/api/.env.');
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
            { role: 'user', content: JSON.stringify({ title: input.title, description: input.description.slice(0, 2000) }) },
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

    let parsed: { questions?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('The AI response could not be understood — please try again.');
    }

    const questions = Array.isArray(parsed.questions) ? parsed.questions.map((q) => String(q)).filter(Boolean).slice(0, 5) : [];
    if (questions.length === 0) throw new BadRequestException('The AI response was incomplete — please try again.');

    return { questions };
  }
}
