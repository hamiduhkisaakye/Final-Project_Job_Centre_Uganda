'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

function portalHome(role: string) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'COMPANY') return '/company';
  return '/dashboard';
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password);
      router.push(searchParams.get('next') || portalHome(user.role));
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
          src="/handshake-hiring-uganda.jpg"
          alt="A recruiter and job seeker shaking hands after a successful hire in Uganda"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/45 to-primary-pressed/80" />

        <Link href="/" className="relative z-10 bg-white rounded-lg px-3.5 py-2.5 w-fit shadow-2">
          <Image src="/logo.png" alt="Job Centre Uganda" width={140} height={34} className="h-7 w-auto object-contain" />
        </Link>
        <div className="relative z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
          <h1 className="text-3xl font-bold leading-tight mb-5">Your next role is already looking for you.</h1>
          <div className="text-white/95 leading-loose">
            <div>✓ AI matches from your CV, daily</div>
            <div>✓ Verified salaries before you apply</div>
            <div>✓ Track every application in one board</div>
          </div>
        </div>
        <div className="relative z-10" />
      </div>

      <div className="flex-1 flex flex-col p-6 sm:p-8">
        <Link href="/" className="md:hidden mb-6 w-fit">
          <Image src="/logo.png" alt="Job Centre Uganda" width={140} height={34} className="h-7 w-auto object-contain" />
        </Link>
        <div className="flex-1 flex items-center justify-center">
        <form onSubmit={onSubmit} className="w-full max-w-[380px] flex flex-col gap-3.5">
          <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
          {error && <div className="border border-danger bg-red-50 rounded p-3 text-sm text-danger">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          <p className="text-sm text-muted text-center">
            New here?{' '}
            <Link href="/register" className="text-primary font-semibold border-b-2 border-accent">Create an account</Link>
          </p>
          <p className="text-xs text-muted text-center mt-2">
            Demo: sarah.nakato@example.com / owner@stanbicholdings.ug / admin@jobcentre.ug — password Password123!
          </p>
        </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
