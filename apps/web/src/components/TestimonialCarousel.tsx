'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

// Auto-rotates every 6s, pausable via manual arrow/dot interaction (the
// timer resets on manual navigation so it never fights the visitor).
export default function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [items.length, index]);

  function go(i: number) {
    setIndex((i + items.length) % items.length);
  }

  const current = items[index];

  return (
    <div className="max-w-[680px] mx-auto text-center">
      <div className="relative min-h-[180px] flex items-center justify-center">
        <button
          onClick={() => go(index - 1)}
          aria-label="Previous testimonial"
          className="hidden md:flex absolute left-[-56px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div key={index} className="animate-fadeIn">
          <p className="text-xl md:text-2xl font-semibold text-white leading-snug mb-5">
            &ldquo;{current.quote}&rdquo;
          </p>
          <div className="text-sm font-semibold text-accent">{current.name}</div>
          <div className="text-xs text-white/70">{current.role}</div>
        </div>

        <button
          onClick={() => go(index + 1)}
          aria-label="Next testimonial"
          className="hidden md:flex absolute right-[-56px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 mt-6">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Go to testimonial ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-accent' : 'w-2 bg-white/30 hover:bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}
