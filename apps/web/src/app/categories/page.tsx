import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { publicFetch } from '@/lib/api';
import { categoryIcon } from '@/lib/category-icons';
import type { Category } from '@/lib/types';

export default async function CategoriesPage() {
  const categories = (await publicFetch<Category[]>('/categories')) || [];

  return (
    <>
      <PublicNavbar />

      <div className="bg-ground border-b border-border">
        <div className="max-w-[1320px] mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Browse all categories</h1>
          <p className="text-muted">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} — find live roles by field.
          </p>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 py-8">
        {categories.length === 0 ? (
          <p className="text-sm text-muted">No categories found.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {categories.map((c) => {
              const Icon = categoryIcon(c.icon);
              return (
                <Link
                  key={c.id}
                  href={`/jobs?category=${encodeURIComponent(c.name)}`}
                  className="group card p-5 flex items-center gap-3.5 hover:shadow-2 hover:border-primary hover:-translate-y-0.5 transition-all"
                >
                  <div className="w-12 h-12 rounded bg-ground group-hover:bg-accent flex items-center justify-center flex-none transition-colors">
                    <Icon className="w-6 h-6 text-primary group-hover:text-ink transition-colors" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted">{c.jobCount.toLocaleString()} jobs</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
