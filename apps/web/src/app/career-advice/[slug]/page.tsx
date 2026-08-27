import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import BlogPostPreview from '@/components/BlogPostPreview';
import { publicFetch, API_ORIGIN } from '@/lib/api';
import { categoryLabel } from '@/lib/blog-categories';
import type { BlogPost } from '@/lib/types';

interface AdjacentPost {
  slug: string;
  title: string;
  coverImageUrl: string | null;
}

function description(post: BlogPost) {
  if (post.excerpt) return post.excerpt;
  const text = post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await publicFetch<BlogPost>(`/blog/${params.slug}`);
  if (!post) return { title: 'Post not found — Job Centre Uganda' };
  return { title: `${post.title} — Job Centre Uganda`, description: description(post) };
}

export default async function CareerAdvicePostPage({ params }: { params: { slug: string } }) {
  const [post, related, adjacent] = await Promise.all([
    publicFetch<BlogPost>(`/blog/${params.slug}`),
    publicFetch<BlogPost[]>(`/blog/${params.slug}/related`),
    publicFetch<{ previous: AdjacentPost | null; next: AdjacentPost | null }>(`/blog/${params.slug}/adjacent`),
  ]);
  if (!post) notFound();

  return (
    <>
      <PublicNavbar />

      <div className="max-w-[820px] mx-auto px-6 py-10">
        <div className="text-xs text-muted mb-3">
          <Link href="/career-advice">Career Advice</Link> / <span className="text-ink">{post.title}</span>
        </div>

        <BlogPostPreview
          title={post.title}
          coverImageUrl={post.coverImageUrl}
          category={post.category}
          content={post.content}
          publishedAtLabel={post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-GB', { dateStyle: 'long' }) : undefined}
        />

        {(adjacent?.previous || adjacent?.next) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 pt-8 border-t border-border">
            {adjacent?.previous ? (
              <Link
                href={`/career-advice/${adjacent.previous.slug}`}
                className="group card p-4 flex items-center gap-3 hover:shadow-2 hover:border-primary transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-muted flex-none group-hover:text-primary transition-colors" />
                <div className="min-w-0">
                  <div className="text-xs text-muted mb-0.5">Previous</div>
                  <div className="font-semibold text-sm truncate">{adjacent.previous.title}</div>
                </div>
              </Link>
            ) : (
              <div />
            )}
            {adjacent?.next ? (
              <Link
                href={`/career-advice/${adjacent.next.slug}`}
                className="group card p-4 flex items-center justify-end gap-3 text-right hover:shadow-2 hover:border-primary transition-all sm:col-start-2"
              >
                <div className="min-w-0">
                  <div className="text-xs text-muted mb-0.5">Next</div>
                  <div className="font-semibold text-sm truncate">{adjacent.next.title}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted flex-none group-hover:text-primary transition-colors" />
              </Link>
            ) : (
              <div />
            )}
          </div>
        )}
      </div>

      {related && related.length > 0 && (
        <div className="bg-ground border-t border-border py-12">
          <div className="max-w-[1320px] mx-auto px-6">
            <h2 className="text-xl font-bold mb-5">Related articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/career-advice/${r.slug}`}
                  className="card overflow-hidden flex flex-col hover:shadow-2 hover:border-primary transition-all hover:-translate-y-0.5"
                >
                  {r.coverImageUrl ? (
                    <div className="w-full h-[160px] flex-none bg-white overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${API_ORIGIN}${r.coverImageUrl}`} alt={r.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-[160px] flex-none bg-white" />
                  )}
                  <div className="p-4 flex flex-col gap-1.5">
                    <span className="badge badge-blue w-fit text-[10px]">{categoryLabel(r.category)}</span>
                    <div className="font-semibold text-sm leading-snug line-clamp-2">{r.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
