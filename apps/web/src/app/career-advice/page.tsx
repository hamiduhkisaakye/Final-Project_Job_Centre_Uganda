import Link from 'next/link';
import { Search } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { publicFetch, API_ORIGIN } from '@/lib/api';
import { BLOG_CATEGORIES, categoryLabel } from '@/lib/blog-categories';
import type { BlogPost } from '@/lib/types';

function teaser(post: BlogPost) {
  if (post.excerpt) return post.excerpt;
  const text = post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export default async function CareerAdviceIndexPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  const category = searchParams.category;
  const q = searchParams.q;
  const qs = new URLSearchParams({ take: '60', ...(category ? { category } : {}), ...(q ? { q } : {}) }).toString();
  const posts = (await publicFetch<BlogPost[]>(`/blog?${qs}`)) || [];

  return (
    <>
      <PublicNavbar />

      <div className="bg-ground border-b border-border">
        <div className="max-w-[1320px] mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Career Advice</h1>
          <p className="text-muted">Hiring tips, interview prep, and career guidance from the Job Centre Uganda team.</p>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/career-advice"
              className={`pill border transition-colors ${!category ? 'bg-primary text-white border-primary' : 'bg-white border-border text-ink/80 hover:border-primary'}`}
            >
              All
            </Link>
            {BLOG_CATEGORIES.map((c) => (
              <Link
                key={c.value}
                href={`/career-advice?category=${c.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className={`pill border transition-colors ${category === c.value ? 'bg-primary text-white border-primary' : 'bg-white border-border text-ink/80 hover:border-primary'}`}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <form action="/career-advice" className="flex-none w-full sm:w-[260px]">
            {category && <input type="hidden" name="category" value={category} />}
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search posts…"
                className="input h-10 pl-9"
              />
            </div>
          </form>
        </div>

        {posts.length === 0 ? (
          <p className="text-sm text-muted">No posts match — try a different category or search.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/career-advice/${post.slug}`}
                className="card overflow-hidden flex flex-col hover:shadow-2 hover:border-primary transition-all hover:-translate-y-0.5"
              >
                {post.coverImageUrl ? (
                  <div className="w-full h-[180px] flex-none bg-ground overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${API_ORIGIN}${post.coverImageUrl}`} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-[180px] flex-none bg-ground" />
                )}
                <div className="p-5 flex flex-col gap-2 flex-1">
                  <span className="badge badge-blue w-fit">{categoryLabel(post.category)}</span>
                  <div className="text-xs text-muted">
                    {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </div>
                  <div className="font-semibold text-lg leading-snug line-clamp-2">{post.title}</div>
                  <p className="text-sm text-muted line-clamp-3">{teaser(post)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
