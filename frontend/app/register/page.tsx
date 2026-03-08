"use client";

import { useState } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

export default function Register() {
    const [formData, setFormData] = useState({
        username: '',
        phone: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/register', formData);
            login(res.data.token, res.data.user);
        } catch (err: any) {
            setError(err.response?.data?.msg || 'Registration failed');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4 cursor-default">
            <div className="max-w-md w-full bg-[#1C1C1E] border border-[#38383A] rounded-3xl shadow-2xl overflow-hidden mt-8 mb-8">
                <div className="p-8 text-center pb-6">
                    <div className="w-16 h-16 relative bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[var(--color-brand-primary)]/10 border border-white/5 overflow-hidden">
                        <Image src="/sampark-logo.png" alt="Sampark" fill className="object-cover scale-[0.8]" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Join Sampark</h1>
                    <p className="text-[var(--color-text-secondary)] text-sm">Create an account to start chatting instantly.</p>
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
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Username"
                            className="w-full bg-[#2C2C2E] text-white px-4 py-3.5 rounded-xl outline-none text-[15px] placeholder-[#8E8E93] border border-transparent focus:border-[var(--color-brand-primary)] transition-all"
                            required
                        />
                    </div>

                    <div>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="Phone Number"
                            className="w-full bg-[#2C2C2E] text-white px-4 py-3.5 rounded-xl outline-none text-[15px] placeholder-[#8E8E93] border border-transparent focus:border-[var(--color-brand-primary)] transition-all"
                            required
                        />
                    </div>

                    <div>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Email Address"
                            className="w-full bg-[#2C2C2E] text-white px-4 py-3.5 rounded-xl outline-none text-[15px] placeholder-[#8E8E93] border border-transparent focus:border-[var(--color-brand-primary)] transition-all"
                            required
                        />
                    </div>

                    <div>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Password"
                            className="w-full bg-[#2C2C2E] text-white px-4 py-3.5 rounded-xl outline-none text-[15px] placeholder-[#8E8E93] border border-transparent focus:border-[var(--color-brand-primary)] transition-all"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-semibold py-3.5 px-4 rounded-xl transition-opacity mt-2 cursor-pointer disabled:opacity-50"
                    >
                        {isLoading ? 'Creating account...' : 'Sign Up'}
                    </button>

                    <p className="text-center text-[14px] text-[var(--color-text-secondary)] mt-6 pt-4 border-t border-[#38383A]">
                        Already have an account?{' '}
                        <Link href="/login" className="text-[var(--color-brand-primary)] font-medium hover:underline">
                            Log in
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
