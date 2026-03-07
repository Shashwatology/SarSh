"use client";

import { useState } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

export default function Login() {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { loginId, password });
            login(res.data.token, res.data.user);
        } catch (err: any) {
            setError(err.response?.data?.msg || 'Login failed');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
            <div className="max-w-md w-full bg-[#1C1C1E] border border-[#38383A] rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8 text-center pb-6">
                    <div className="w-16 h-16 relative bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[var(--color-brand-primary)]/10 border border-white/5 overflow-hidden">
                        <Image src="/sarsh-logo.png" alt="Sarsh" fill className="object-cover scale-[0.8]" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome Back</h2>
                    <p className="text-[var(--color-text-secondary)]">Sign in to continue to Sarsh</p>
                </div>

                <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <input
                            type="text"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            placeholder="Username, Phone, or Email"
                            className="w-full bg-[#2C2C2E] text-white px-4 py-3.5 rounded-xl outline-none text-[15px] placeholder-[#8E8E93] border border-transparent focus:border-[var(--color-brand-primary)] transition-all"
                            required
                        />
                    </div>

                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-[#2C2C2E] text-white px-4 py-3.5 rounded-xl outline-none text-[15px] placeholder-[#8E8E93] border border-transparent focus:border-[var(--color-brand-primary)] transition-all"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-semibold py-3.5 px-4 rounded-xl transition-opacity flex justify-center items-center cursor-pointer mt-2 disabled:opacity-50"
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <p className="text-center text-[14px] text-[var(--color-text-secondary)] mt-6 pt-4 border-t border-[#38383A]">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-[var(--color-brand-primary)] font-medium hover:underline">
                            Create one
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
