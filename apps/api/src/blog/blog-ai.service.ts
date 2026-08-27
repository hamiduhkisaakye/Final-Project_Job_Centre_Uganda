import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { BLOG_SANITIZE_OPTIONS } from './sanitize-options';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

export interface EnhanceBlogPostInput {
  title: string;
  excerpt: string;
  content: string;
}

const SYSTEM_PROMPT = `You are an editor for the "Career Advice" section of Job Centre Uganda, a Ugandan jobs marketplace. You will be given a draft blog post (title, optional excerpt, HTML content). Improve clarity, grammar, structure and flow while preserving the author's meaning and any facts — do not invent new claims.

Rules for the response:
- Respond with ONLY a JSON object: {"title": "...", "excerpt": "...", "content": "..."}.
- "content" must use only these HTML tags: h2, h3, p, strong, em, ul, ol, li, a, img, br. No other tags, no markdown, no code fences.
- If the input content contains <img> tags, keep their exact "src" attribute unchanged and do not add any new <img> tags — you have no way to generate real images.
- "excerpt" should be a single engaging sentence (max ~160 characters) summarizing the post, suitable as a card teaser.
- Keep the tone practical and encouraging, written for job seekers and professionals in Uganda.`;

// Chat-completion counterpart to embeddings.service.ts's OpenAI integration —
// same optional-key posture (works if OPENAI_API_KEY is set, throws a clear
// user-facing error otherwise) but this is a direct user action (a button
// click awaiting a response), not a background best-effort call, so it
// throws instead of silently no-opping.
@Injectable()
export class BlogAiService {
  private readonly logger = new Logger(BlogAiService.name);

  get enabled(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async enhance(input: { title: string; excerpt?: string; content: string }): Promise<EnhanceBlogPostInput> {
    if (!this.enabled) {
      throw new BadRequestException('AI enhancement requires an OpenAI API key — set OPENAI_API_KEY in apps/api/.env.');
    }

    const userPayload = JSON.stringify({ title: input.title, excerpt: input.excerpt || '', content: input.content });

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

    let parsed: Partial<EnhanceBlogPostInput>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('The AI response could not be understood — please try again.');
    }

    if (!parsed.title || !parsed.content) {
      throw new BadRequestException('The AI response was incomplete — please try again.');
    }

    return {
      title: String(parsed.title).slice(0, 300),
      excerpt: String(parsed.excerpt || '').slice(0, 300),
      // Defense in depth — sanitize the model's output the same way a real
      // save would, in case it ignores the tag-allowlist instruction.
      content: sanitizeHtml(String(parsed.content), BLOG_SANITIZE_OPTIONS),
    };
  }
}
