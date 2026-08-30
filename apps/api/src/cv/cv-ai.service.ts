import { BadRequestException, Injectable, Logger } from '@nestjs/common';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are a resume writing coach for Job Centre Uganda, a Ugandan jobs marketplace. You will be given ONE resume field's current draft text and, when relevant, context about the role/section it belongs to. Rewrite it to be punchier and more results-oriented: lead with impact, use active verbs, quantify outcomes where the draft already implies a number, and keep it truthful — never invent facts, employers, dates or metrics that aren't already in the draft.

Rules for the response:
- Respond with ONLY a JSON object: {"suggestions": ["...", "..."]}.
- Provide exactly 2 alternative rewrites, each a plain-text paragraph or bullet-style sentence (no markdown, no HTML), each under 400 characters.
- The two suggestions should differ in emphasis or phrasing, not just wording — e.g. one leading with scope, one leading with outcome.
- If the draft is empty or too short to improve meaningfully, write two short example sentences appropriate to the given context instead.`;

// Chat-completion counterpart to blog-ai.service.ts — same optional-key
// posture and error handling, applied to a single resume field (Summary or
// an Experience entry's description) rather than a whole document.
@Injectable()
export class CvAiService {
  private readonly logger = new Logger(CvAiService.name);

  get enabled(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async improve(input: { text: string; section: string; context?: string }): Promise<{ suggestions: string[] }> {
    if (!this.enabled) {
      throw new BadRequestException('AI suggestions require an OpenAI API key — set OPENAI_API_KEY in apps/api/.env.');
    }

    const userPayload = JSON.stringify({ section: input.section, context: input.context || '', draft: input.text });

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
            { role: 'user', content: userPayload },
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

    let parsed: { suggestions?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('The AI response could not be understood — please try again.');
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map((s) => String(s).slice(0, 500)).filter(Boolean) : [];
    if (suggestions.length === 0) throw new BadRequestException('The AI response was incomplete — please try again.');

    return { suggestions };
  }
}
