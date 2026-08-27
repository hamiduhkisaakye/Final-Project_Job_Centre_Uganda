import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import BlogPostPreview from '@/components/BlogPostPreview';
import { publicFetch } from '@/lib/api';
import type { BlogPost } from '@/lib/types';

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
  const post = await publicFetch<BlogPost>(`/blog/${params.slug}`);
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
          content={post.content}
          publishedAtLabel={post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-GB', { dateStyle: 'long' }) : undefined}
        />
      </div>

      <Footer />
    </>
  );
}
