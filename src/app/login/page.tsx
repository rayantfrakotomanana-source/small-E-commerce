'use client';

import { useState, type FormEvent } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      setBusy(false); return;
    }
    const supabase = createBrowserClient(url, key);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (loginError) setError(loginError.message);
    else if (data.user) window.location.assign('/dashboard');
    setBusy(false);
  }

  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span>JR</span><div><strong>JR Concept</strong><small>Business Management</small></div></div>
    <h1>Sign in</h1><p>Access the JR Concept business workspace.</p>
    <form onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </section></main>;
}
