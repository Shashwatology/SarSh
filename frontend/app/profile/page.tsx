"use client";

import { useAuth, api } from '@/context/AuthContext';
import { LogOut, ArrowLeft, Camera, Edit2, Loader2, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

export default function ProfilePage() {
    const { user, logout, checkAuth } = useAuth();
    const router = useRouter();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingAbout, setIsEditingAbout] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAbout, setEditAbout] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setEditName(user.username || '');
            setEditAbout(user.status || 'Hey there! I am using Sarsh.');
        }
    }, [user]);

    const handleProfileUpdate = async () => {
        if (!editName.trim()) return alert('Name cannot be empty.');

        setIsSaving(true);
        try {
            const res = await api.put('/auth/profile', { username: editName, status: editAbout });
            if (res.data) {
                const updatedUser = { ...user, ...res.data };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                await checkAuth();
                setIsEditingName(false);
                setIsEditingAbout(false);
            }
        } catch (err: any) {
            console.error('Failed to update profile', err);
            alert('Failed to update profile.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return null;

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image too large. Please choose an image under 5MB.');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await api.post('/upload/profile-picture', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.profile_picture) {
                // Update user in localStorage and state immediately
                const updatedUser = { ...user, profile_picture: res.data.profile_picture };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                await checkAuth();
            }
        } catch (err: any) {
            console.error('Failed to upload profile picture', err);
            const msg = err?.response?.data?.details || err?.response?.data?.error || err?.response?.data?.msg || 'Failed to upload image. Check your internet connection and try again.';
            alert(msg);
        } finally {
            setIsUploading(false);
            // Reset file input so same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex h-[100dvh] bg-black items-center justify-center">
            <div className="w-full h-full md:max-w-[440px] md:h-[85vh] md:rounded-2xl md:shadow-2xl md:border md:border-[#38383A] bg-black md:bg-[var(--color-brand-surface)] flex flex-col overflow-hidden relative">
                {/* Header (iOS Style) */}
                <div className="backdrop-blur-xl bg-black/80 md:bg-[var(--color-brand-surface)]/80 h-[80px] flex items-end px-4 pb-3 text-white shrink-0 sticky top-0 z-20 border-b border-[#38383A]">
                    <div className="flex items-center gap-2 w-full">
                        <button onClick={() => router.back()} className="text-[var(--color-brand-primary)] hover:opacity-80 p-1 rounded-full transition-opacity flex items-center pr-2">
                            <ArrowLeft size={28} className="-ml-1" />
                        </button>
                        <h1 className="text-[20px] font-semibold tracking-tight mx-auto pr-8">Settings</h1>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto w-full">
                    {/* Centered Avatar Section */}
                    <div className="pb-8 pt-8 flex flex-col items-center">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                        <div
                            className="relative group cursor-pointer transition-transform hover:scale-105"
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                        >
                            <div className={`w-36 h-36 bg-[#1C1C1E] rounded-full overflow-hidden shadow-xl flex items-center justify-center bg-cover bg-center border border-[#38383A] ${isUploading ? 'opacity-50' : ''}`} style={{ backgroundImage: user.profile_picture ? `url(${user.profile_picture})` : 'none' }}>
                                {!user.profile_picture && !isUploading && <Camera size={40} className="text-[#8E8E93]" />}
                                {isUploading && <Loader2 size={40} className="text-white animate-spin" />}
                            </div>
                            {!isUploading && (
                                <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                    <Camera size={24} className="text-white mb-1" />
                                    <span className="text-white text-[10px] text-center px-4 uppercase tracking-widest font-semibold mt-1">Edit</span>
                                </div>
                            )}
                        </div>
                        <h2 className="text-white text-[22px] font-semibold mt-4 tracking-tight">{user.username}</h2>
                        <p className="text-[var(--color-text-secondary)] text-[15px] mt-1">{user.phone}</p>
                    </div>

                    {/* iOS Settings Cards */}
                    <div className="px-4 md:px-6 mb-6">
                        <div className="bg-[#1C1C1E] md:bg-black/20 rounded-2xl overflow-hidden border border-[#38383A] shadow-sm">

                            {/* Name Edit */}
                            <div className="px-4 py-3.5 flex justify-between items-center border-b border-[#38383A] group min-h-[72px]">
                                <div className="flex-1 mr-4">
                                    <p className="text-[12px] text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold mb-1">Display Name</p>
                                    {isEditingName ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full bg-transparent text-white text-[16px] font-medium outline-none border-b border-[var(--color-brand-primary)] pb-1"
                                            placeholder="Your display name"
                                            maxLength={25}
                                        />
                                    ) : (
                                        <div className="text-white text-[16px] font-medium">{user.username}</div>
                                    )}
                                </div>
                                {isEditingName ? (
                                    <div className="flex gap-2 shrink-0">
                                        <div onClick={() => { setIsEditingName(false); setEditName(user.username); }} className="w-8 h-8 rounded-full flex items-center justify-center bg-[#2C2C2E] cursor-pointer text-[#8E8E93] hover:text-white transition-colors">
                                            <X size={16} />
                                        </div>
                                        <div onClick={handleProfileUpdate} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-brand-primary)] cursor-pointer text-white hover:opacity-80 transition-opacity">
                                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        </div>
                                    </div>
                                ) : (
                                    <div onClick={() => setIsEditingName(true)} className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-[#2C2C2E] transition-colors cursor-pointer shrink-0">
                                        <Edit2 size={18} className="text-[var(--color-text-secondary)] group-hover:text-white transition-colors" />
                                    </div>
                                )}
                            </div>

                            {/* About/Status Edit */}
                            <div className="px-4 py-3.5 flex justify-between items-center group min-h-[72px]">
                                <div className="flex-1 mr-4">
                                    <p className="text-[12px] text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold mb-1">About</p>
                                    {isEditingAbout ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editAbout}
                                            onChange={(e) => setEditAbout(e.target.value)}
                                            className="w-full bg-transparent text-white text-[16px] leading-snug outline-none border-b border-[var(--color-brand-primary)] pb-1"
                                            placeholder="Hey there! I am using Sarsh."
                                            maxLength={100}
                                        />
                                    ) : (
                                        <div className="text-white text-[16px] leading-snug">{user.status || 'Hey there! I am using Sarsh.'}</div>
                                    )}
                                </div>
                                {isEditingAbout ? (
                                    <div className="flex gap-2 shrink-0">
                                        <div onClick={() => { setIsEditingAbout(false); setEditAbout(user.status || 'Hey there! I am using Sarsh.'); }} className="w-8 h-8 rounded-full flex items-center justify-center bg-[#2C2C2E] cursor-pointer text-[#8E8E93] hover:text-white transition-colors">
                                            <X size={16} />
                                        </div>
                                        <div onClick={handleProfileUpdate} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-brand-primary)] cursor-pointer text-white hover:opacity-80 transition-opacity">
                                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        </div>
                                    </div>
                                ) : (
                                    <div onClick={() => setIsEditingAbout(true)} className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-[#2C2C2E] transition-colors cursor-pointer shrink-0">
                                        <Edit2 size={18} className="text-[var(--color-text-secondary)] group-hover:text-white transition-colors" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="px-4 py-3 text-[#8E8E93] text-[13px] leading-relaxed">
                            This is not your username or pin. This name will be visible to your contacts instantly.
                        </p>
                    </div>

                    {/* Logout Button */}
                    <div className="px-4 md:px-6 mb-10">
                        <button onClick={logout} className="w-full bg-[#1C1C1E] md:bg-black/20 rounded-xl px-4 py-3.5 flex items-center justify-center gap-2 border border-[#38383A] hover:border-red-500/50 hover:bg-red-500/10 transition-all cursor-pointer group shadow-sm">
                            <LogOut size={20} className="text-red-500 group-hover:text-red-400 transition-colors" />
                            <span className="text-red-500 font-semibold text-[16px] group-hover:text-red-400 transition-colors">Log Out</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
