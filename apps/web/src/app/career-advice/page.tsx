import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { publicFetch, API_ORIGIN } from '@/lib/api';
import type { BlogPost } from '@/lib/types';

function teaser(post: BlogPost) {
  if (post.excerpt) return post.excerpt;
  const text = post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export default async function CareerAdviceIndexPage() {
  const posts = (await publicFetch<BlogPost[]>('/blog')) || [];

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
        {posts.length === 0 ? (
          <p className="text-sm text-muted">No posts published yet — check back soon.</p>
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
