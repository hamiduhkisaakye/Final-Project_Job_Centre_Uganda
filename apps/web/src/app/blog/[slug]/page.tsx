import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { publicFetch, API_ORIGIN } from '@/lib/api';
import type { BlogPost } from '@/lib/types';

function description(post: BlogPost) {
  if (post.excerpt) return post.excerpt;
  const text = post.content.trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await publicFetch<BlogPost>(`/blog/${params.slug}`);
  if (!post) return { title: 'Post not found — Job Centre Uganda' };
  return { title: `${post.title} — Job Centre Uganda`, description: description(post) };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await publicFetch<BlogPost>(`/blog/${params.slug}`);
  if (!post) notFound();

  return (
    <>
      <PublicNavbar />

      <div className="max-w-[820px] mx-auto px-6 py-10">
        <div className="text-xs text-muted mb-3">
          <Link href="/blog">Blog</Link> / <span className="text-ink">{post.title}</span>
        </div>

        {post.coverImageUrl && (
          <div className="w-full h-[320px] rounded-card overflow-hidden mb-6 bg-ground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${API_ORIGIN}${post.coverImageUrl}`} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
        {post.publishedAt && (
          <div className="text-sm text-muted mb-6">
            {new Date(post.publishedAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}
          </div>
        )}

        <div className="flex flex-col gap-4 leading-relaxed">
          {post.content.split(/\n{2,}/).map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">{paragraph}</p>
          ))}
        </div>
      </div>

      <Footer />
    </>
  );
}
