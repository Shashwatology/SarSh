"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Smartphone, ArrowRight, Github, Lock, Users, Zap } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    // Show loader for 2.5 seconds on initial visit
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleCTA = () => {
    if (user) {
      router.push('/chats');
    } else {
      router.push('/login');
    }
  };

  if (showLoader) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[100] transition-opacity duration-1000 ease-in-out">
        <div className="relative animate-pulse flex flex-col items-center">
          <div className="w-32 h-32 relative mb-6">
            <Image src="/sarsh-logo.png" alt="Sarsh Logo" fill className="object-cover" priority />
          </div>
          <div className="h-1 w-48 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '50%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden animate-[fadeIn_1s_ease-out]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <div className="w-10 h-10 relative bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center">
              <Image src="/sarsh-logo.png" alt="Sarsh" fill className="object-cover scale-[0.8]" />
            </div>
            <span className="font-bold text-2xl tracking-tighter text-white">Sarsh</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden md:block">Features</a>
            <a href="#security" className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden md:block">Security</a>
            <a href="https://github.com/shashwat" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors hidden sm:block">
              <Github size={22} />
            </a>
            {!loading && (
              <button
                onClick={handleCTA}
                className="text-sm font-semibold bg-white text-black px-6 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md"
              >
                {user ? 'Open Web App' : 'Sign In'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-[200px] pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Background Glows */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/40 blur-[150px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-[40%] left-[30%] -translate-x-1/2 w-[400px] h-[400px] bg-orange-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 mb-10 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[var(--color-brand-accent)] animate-pulse" />
          Welcome to the new era of messaging
        </div>

        <h1 className="text-6xl md:text-[5.5rem] font-bold tracking-tighter mb-8 leading-[1.1] text-white max-w-5xl">
          Private Conversations.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-orange-500">
            Real Connections.
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mb-12 leading-relaxed tracking-tight font-light">
          Sarsh is an Indian messaging platform built for privacy and speed. Connect instantly using just a username—no phone numbers required.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-5">
          <button
            onClick={handleCTA}
            className="flex items-center justify-center gap-2 bg-white text-black px-10 py-4 rounded-full font-semibold text-lg hover:scale-105 transition-all shadow-xl shadow-white/10 w-full sm:w-auto"
          >
            Download for Web
            <ArrowRight size={20} />
          </button>
          {!user && (
            <button
              onClick={() => router.push('/register')}
              className="flex items-center justify-center gap-2 bg-white/5 text-white px-10 py-4 rounded-full font-semibold text-lg border border-white/10 hover:bg-white/10 transition-all w-full sm:w-auto backdrop-blur-md"
            >
              Create Free Account
            </button>
          )}
        </div>
      </section>

      {/* UI Mockup Showcase */}
      <section className="relative px-6 max-w-6xl mx-auto pb-32">
        <div className="relative w-full rounded-[2rem] md:rounded-[3rem] bg-[#0A0A0A]/80 border border-white/10 shadow-[0_0_100px_rgba(15,23,42,0.8)] overflow-hidden backdrop-blur-2xl p-4 md:p-10 aspect-video flex ring-1 ring-white/5">
          {/* Mockup Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-10 bg-[#141414] border-b border-white/5 flex items-center px-6 gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
          </div>

          <div className="mt-8 flex w-full">
            {/* Fake Sidebar */}
            <div className="w-1/3 border-r border-white/10 hidden md:flex flex-col pr-8">
              <div className="w-full h-12 bg-white/5 rounded-2xl mb-8 flex items-center px-4 border border-white/5">
                <div className="w-4 h-4 rounded-full bg-white/20 mr-3" />
                <div className="h-2 w-24 bg-white/10 rounded-full" />
              </div>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 items-center p-2 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-white/10 border border-white/5" />
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="h-3 bg-white/40 rounded-full w-20" />
                        <div className="h-2 bg-white/10 rounded-full w-8" />
                      </div>
                      <div className="h-2 bg-white/20 rounded-full w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Fake Chat Area */}
            <div className="flex-1 md:pl-10 flex flex-col">
              <div className="h-16 border-b border-white/10 flex items-center mb-8 pb-4">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/5" />
                <div className="ml-4 space-y-2">
                  <div className="h-3.5 bg-white/60 rounded-full w-32" />
                  <div className="h-2 bg-orange-500/80 rounded-full w-16" />
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end space-y-6 mb-8">
                <div className="max-w-[70%] h-16 bg-[#1e293b] rounded-3xl rounded-bl-sm self-start border border-white/5 shadow-md flex items-center px-5">
                  <div className="w-3/4 h-2 bg-white/40 rounded-full" />
                </div>
                <div className="max-w-[60%] h-24 bg-blue-800 rounded-3xl rounded-br-sm self-end shadow-md flex flex-col justify-center px-5 space-y-3 border border-white/10">
                  <div className="w-full h-2 bg-white/60 rounded-full" />
                  <div className="w-4/5 h-2 bg-white/40 rounded-full" />
                </div>
                <div className="max-w-[50%] h-12 bg-[#1e293b] rounded-3xl rounded-bl-sm self-start border border-white/5 shadow-md flex items-center px-5">
                  <div className="w-1/2 h-2 bg-white/40 rounded-full" />
                </div>
              </div>
              <div className="h-14 bg-white/5 border border-white/10 rounded-full w-full flex items-center px-6 relative">
                <div className="w-4/5 h-2.5 bg-white/20 rounded-full" />
                <div className="absolute right-2 w-10 h-10 bg-[var(--color-brand-accent)] rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 bg-black relative border-t border-[var(--color-brand-border)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-white">The Future is Minimal.</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Sarsh removes the noise so you can focus on the message. Built for speed, security, and simplicity.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-3xl hover:bg-[#111] transition-colors">
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="text-[var(--color-brand-accent)]" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3">True Privacy</h3>
              <p className="text-gray-400 leading-relaxed">No phone numbers needed. Sign up with email, share your username, and maintain complete control over your identity.</p>
            </div>
            <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-3xl hover:bg-[#111] transition-colors">
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="text-[var(--color-brand-accent)]" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3">Lightning Fast</h3>
              <p className="text-gray-400 leading-relaxed">Built on Next.js and Socket.IO. Messages, online presence, and typing indicators are delivered in real-time instantly.</p>
            </div>
            <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-3xl hover:bg-[#111] transition-colors">
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Smartphone className="text-[var(--color-brand-accent)]" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3">Cross-Platform Web</h3>
              <p className="text-gray-400 leading-relaxed">A beautifully responsive Progressive Web App that feels like a native iOS and Desktop application combined.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-32 bg-black relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-sm text-green-400">
              <Lock size={16} /> Data Security
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Your conversations, secured end-to-end.
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Privacy isn't just a feature on Sarsh, it's the foundation. Our architecture ensures that your personal information, voice notes, and images are protected from edge to cloud. Feel safe communicating with colleagues, friends, and family.
            </p>
            <ul className="space-y-4">
              {['JWT Authentication', 'Media Encryption', 'No tracking pixels', 'Independently Auditable'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-white font-medium">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-blue-600 opacity-20 blur-[100px] rounded-full" />
            <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden flex items-center justify-center aspect-square shadow-2xl">
              <Lock size={120} className="text-white opacity-20" />
              <div className="absolute inset-0 border-[1px] border-white/5 rounded-[2.5rem] bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative text-center px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-5xl font-bold tracking-tight text-white">Ready to join Sarsh?</h2>
          <p className="text-xl text-gray-400">Claim your username today before someone else does.</p>
          <button
            onClick={handleCTA}
            className="bg-white text-black px-12 py-5 rounded-full font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/10"
          >
            {user ? 'Go to Dashboard' : 'Get Started for Free'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 relative bg-white rounded-lg flex items-center justify-center cursor-pointer">
              <Image src="/sarsh-logo.png" alt="Sarsh" fill className="object-cover scale-[0.7]" />
            </div>
            <span className="font-bold text-xl text-white">Sarsh</span>
            <a href="https://github.com/shashwatology" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors hidden sm:block">
              <Github size={22} />
            </a>
            <span className="text-gray-500 text-sm ml-2">© 2026. All rights reserved.</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500 font-medium">
            <button className="hover:text-white transition-colors">Privacy Policy</button>
            <button className="hover:text-white transition-colors">Terms of Service</button>
            <a href="https://github.com/shashwatology" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
