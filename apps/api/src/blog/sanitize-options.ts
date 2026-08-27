import type { IOptions } from 'sanitize-html';

// Shared allow-list for blog post HTML — applied both when a human saves a
// post (blog.service.ts) and when the AI-enhance endpoint returns a
// suggestion (blog-ai.service.ts), so the stored/returned content can never
// contain more than what the TipTap toolbar (BlogEditor.tsx) can actually
// produce.
export const BLOG_SANITIZE_OPTIONS: IOptions = {
  allowedTags: ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'br'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
  },
  allowedSchemes: ['http', 'https'],
};
