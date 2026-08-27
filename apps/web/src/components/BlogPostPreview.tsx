import { API_ORIGIN } from '@/lib/api';

// Read-only rendering of a post exactly as it appears on the public detail
// page — shared by the admin editor's "Preview" toggle, the AI-enhancement
// suggestion panel, and the actual public career-advice/[slug] page, so all
// three always look identical.
export default function BlogPostPreview({
  title,
  publishedAtLabel,
  coverImageUrl,
  content,
}: {
  title: string;
  publishedAtLabel?: string;
  coverImageUrl?: string | null;
  content: string;
}) {
  return (
    <div>
      {coverImageUrl && (
        <div className="w-full h-[320px] rounded-card overflow-hidden mb-6 bg-ground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${API_ORIGIN}${coverImageUrl}`} alt={title} className="w-full h-full object-cover" />
        </div>
      )}
      <h1 className="text-3xl font-bold mb-2">{title || 'Untitled post'}</h1>
      {publishedAtLabel && <div className="text-sm text-muted mb-6">{publishedAtLabel}</div>}
      <div className="blog-content" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
