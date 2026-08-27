'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

const ROLE_BACKGROUNDS: Record<'JOB_SEEKER' | 'COMPANY', { src: string; alt: string }> = {
  JOB_SEEKER: { src: '/job-interview-uganda.jpg', alt: 'A job interview in progress at a Uganda office' },
  COMPANY: { src: '/team-collaboration-kampala.jpg', alt: 'A hiring team collaborating around a laptop in Kampala' },
};

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<'JOB_SEEKER' | 'COMPANY'>('JOB_SEEKER');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await register({ email, password, fullName, role, companyName: role === 'COMPANY' ? companyName : undefined });
      router.push(user.role === 'COMPANY' ? '/company' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex flex-col justify-between text-white w-1/2 p-11 relative overflow-hidden">
        <Image
          key={ROLE_BACKGROUNDS[role].src}
          src={ROLE_BACKGROUNDS[role].src}
          alt={ROLE_BACKGROUNDS[role].alt}
          fill
          priority
          className="object-cover transition-opacity duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/45 to-primary-pressed/80" />

        <Link href="/" className="relative z-10 bg-white rounded-lg px-3.5 py-2.5 w-fit shadow-2">
          <Image src="/logo.png" alt="Job Centre Uganda" width={140} height={34} className="h-7 w-auto object-contain" />
        </Link>
        <h1 className="relative z-10 text-3xl font-bold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
          {role === 'COMPANY' ? 'Post jobs Ugandans actually trust.' : 'Free forever for job seekers.'}
        </h1>
        <div className="relative z-10" />
      </div>

      <div className="flex-1 flex flex-col p-6 sm:p-8">
        <Link href="/" className="md:hidden mb-6 w-fit">
          <Image src="/logo.png" alt="Job Centre Uganda" width={140} height={34} className="h-7 w-auto object-contain" />
        </Link>
        <div className="flex-1 flex items-center justify-center">
        <form onSubmit={onSubmit} className="w-full max-w-[400px] flex flex-col gap-3.5">
          <h2 className="text-2xl font-bold mb-1">Create your account</h2>
          {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRole('JOB_SEEKER')}
              className={`flex-1 border rounded p-3.5 text-left ${role === 'JOB_SEEKER' ? 'border-2 border-primary bg-ground' : 'border-border'}`}
            >
              <div className="text-lg mb-1">👤</div>
              <div className="text-sm font-semibold">I&apos;m looking for a job</div>
            </button>
            <button
              type="button"
              onClick={() => setRole('COMPANY')}
              className={`flex-1 border rounded p-3.5 text-left ${role === 'COMPANY' ? 'border-2 border-primary bg-ground' : 'border-border'}`}
            >
              <div className="text-lg mb-1">🏢</div>
              <div className="text-sm font-semibold">I&apos;m hiring</div>
            </button>
          </div>

          <div>
            <label className="label">{role === 'COMPANY' ? 'Your full name' : 'Full name'}</label>
            <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          {role === 'COMPANY' && (
            <div>
              <label className="label">Company name</label>
              <input className="input" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">Email address</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Continue'}</button>
          <p className="text-sm text-muted text-center">
            Already have an account? <Link href="/login" className="text-primary font-semibold border-b-2 border-accent">Log in</Link>
          </p>
        </form>
        </div>
      </div>
    </div>
  );
}
