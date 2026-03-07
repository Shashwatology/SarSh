"use client";

import { useEffect, useState } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, User as UserIcon, Sparkles, Users, X, Check, Bell } from 'lucide-react';
import { format } from 'date-fns';

export default function ChatList() {
    const { user, logout } = useAuth();
    const { socket } = useSocket();
    const [chats, setChats] = useState<any[]>([]);
    const router = useRouter();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedParticipants, setSelectedParticipants] = useState<any[]>([]);
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [groupSearchResults, setGroupSearchResults] = useState<any[]>([]);

    const fetchChats = async () => {
        try {
            const res = await api.get('/chats');
            setChats(res.data);
        } catch (err) {
            console.error('Error fetching chats', err);
        }
    };

    useEffect(() => {
        if (!user) return;
        fetchChats();
    }, [user]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleNewMessage = (data: any) => {
            setChats(prev => {
                const existing = prev.find(c => c.chat_id === Number(data.chat_id));
                if (existing) {
                    // Avoid double counting if we already saw this message ID
                    // Note: We'd need to store the last processed message ID per chat to be perfect, 
                    // but for now, checking if the content and time are the same is a decent quick fix 
                    // or better yet, just listen to one event.

                    const updatedChat = {
                        ...existing,
                        last_message: data.content || 'Photo',
                        last_message_time: data.created_at || new Date().toISOString(),
                        unread_count: data.sender_id !== user.id ? Number(existing.unread_count || 0) + 1 : existing.unread_count
                    };
                    return [updatedChat, ...prev.filter(c => c.chat_id !== Number(data.chat_id))];
                } else {
                    fetchChats();
                    return prev;
                }
            });

            if (data.sender_id !== user.id) {
                if (socket) socket.emit('message_delivered', { messageId: data.id, chatId: String(data.chat_id) });
            }
        };

        // ONLY listen to new_message_notification in ChatList to avoid overlap with receive_message
        socket.on('new_message_notification', handleNewMessage);

        socket.on('read_receipt', (data: any) => {
            if (data.readerId === user.id) {
                setChats(prev => prev.map(chat =>
                    chat.chat_id === Number(data.chatId) ? { ...chat, unread_count: 0 } : chat
                ));
            }
        });

        return () => {
            socket.off('receive_message', handleNewMessage);
            socket.off('new_message_notification', handleNewMessage);
            socket.off('read_receipt');
        };
    }, [socket, user]);

    const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (e.target.value.length > 2) {
            try {
                const res = await api.get(`/chats/users/search?q=${e.target.value}`);
                setSearchResults(res.data);
            } catch (err) {
                console.error(err);
            }
        } else {
            setSearchResults([]);
        }
    };

    const startChat = async (recipientId: number) => {
        try {
            const res = await api.post('/chats', { recipientId });
            router.push(`/chats/${res.data.id}`);
        } catch (err) {
            console.error(err);
        }
    };

    const handleGroupSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setGroupSearchQuery(e.target.value);
        if (e.target.value.length > 2) {
            try {
                const res = await api.get(`/chats/users/search?q=${e.target.value}`);
                setGroupSearchResults(res.data);
            } catch (err) {
                console.error(err);
            }
        } else {
            setGroupSearchResults([]);
        }
    };

    const toggleParticipant = (user: any) => {
        if (selectedParticipants.find(p => p.id === user.id)) {
            setSelectedParticipants(prev => prev.filter(p => p.id !== user.id));
        } else {
            setSelectedParticipants(prev => [...prev, user]);
        }
    };

    const createGroupChat = async () => {
        if (!groupName.trim() || selectedParticipants.length === 0) return;
        try {
            const res = await api.post('/chats', {
                isGroup: true,
                groupName,
                participantIds: selectedParticipants.map(p => p.id)
            });
            setIsGroupModalOpen(false);
            router.push(`/chats/${res.data.id}`);
        } catch (err) {
            console.error(err);
        }
    };

    const subscribeToPush = async () => {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                alert('Push notifications are not supported by your browser.');
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            const permission = await Notification.requestPermission();

            if (permission !== 'granted') {
                alert('Notification permission denied.');
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'BF7PfUzvUxWnMiRbUDmAOb8V9mLTAwozZMAbMELP8EQ003p22dPgwOUTgORdQCarwzaSDBgEcelvgb8H3BNAUzs'
            });

            await api.post('/notifications/subscribe', { subscription });
            alert('Successfully subscribed to notifications!');
        } catch (err) {
            console.error('Push subscription failed:', err);
            alert('Failed to subscribe.');
        }
    };

    return (
        <div className="flex h-[100dvh] w-full bg-black text-white overflow-hidden">
            {/* Container - Mobile 100%, Desktop 400px sidebar */}
            <div className="w-full md:w-[400px] bg-black border-r border-[var(--color-brand-border)] flex flex-col h-full bg-cover z-10 transition-all">
                {/* Header */}
                <div className="backdrop-blur-xl bg-[var(--color-brand-surface)]/80 p-3 flex justify-between items-center border-b border-[var(--color-brand-border)] sticky top-0 z-20">
                    <Link href="/profile" className="flex items-center hover:opacity-80 transition-opacity">
                        {user?.profile_picture ? (
                            <img src={user.profile_picture} alt="Profile" className="w-10 h-10 rounded-full object-cover shadow-sm" />
                        ) : (
                            <div className="w-10 h-10 bg-[#38383A] rounded-full flex items-center justify-center shadow-sm">
                                <UserIcon className="text-white" size={20} />
                            </div>
                        )}
                        <span className="ml-3 font-semibold text-white tracking-tight">{user?.username}</span>
                    </Link>
                    <div className="flex gap-4 text-[var(--color-brand-primary)] cursor-pointer items-center">
                        <button aria-label="Enable notifications" onClick={subscribeToPush} className="hover:opacity-80 transition-opacity">
                            <Bell size={22} />
                        </button>
                        <button aria-label="Create group" onClick={() => setIsGroupModalOpen(true)} className="hover:opacity-80 transition-opacity relative group">
                            <Users size={22} />
                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#2C2C2E] text-white text-[11px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">New Group</span>
                        </button>
                        <button aria-label="New chat" onClick={() => setIsSearchOpen(!isSearchOpen)} className="hover:opacity-80 transition-opacity">
                            <Sparkles size={22} className="text-[var(--color-brand-primary)]" />
                        </button>
                        <button aria-label="Log out" onClick={logout} className="hover:opacity-80 transition-opacity">
                            <LogOut size={22} />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-[var(--color-brand-border)] bg-black">
                    <input
                        type="text"
                        placeholder={isSearchOpen ? "Search users to chat..." : "Search or start new chat"}
                        value={searchQuery}
                        onChange={handleSearch}
                        className="w-full bg-[var(--color-brand-surface)] text-white px-4 py-2 rounded-xl outline-none text-[15px] placeholder-[var(--color-text-secondary)] transition-all focus:ring-2 focus:ring-[var(--color-brand-primary)]/50 border border-transparent focus:border-[var(--color-brand-primary)]"
                    />
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                    {searchQuery.length > 2 ? (
                        <div>
                            <p className="px-5 py-3 text-[13px] text-[var(--color-brand-primary)] font-semibold tracking-wide uppercase">Search Results</p>
                            {searchResults.map((u) => (
                                <div
                                    key={u.id}
                                    onClick={() => startChat(u.id)}
                                    className="flex items-center px-4 py-2.5 hover:bg-[var(--color-brand-surface)] cursor-pointer transition-colors"
                                >
                                    <div className="w-12 h-12 bg-[#38383A] rounded-full flex-shrink-0 flex items-center justify-center shadow-sm">
                                        {u.profile_picture ? <img src={u.profile_picture} alt="" className="w-12 h-12 rounded-full object-cover" /> : <UserIcon className="text-white" size={24} />}
                                    </div>
                                    <div className="ml-3 flex-1 border-b border-[var(--color-brand-border)] pb-3 pt-1">
                                        <h3 className="text-[17px] font-medium text-white">{u.username}</h3>
                                        <p className="text-[var(--color-text-secondary)] text-[15px] truncate mt-0.5">{u.status || 'Hey there! I am using Sarsh.'}</p>
                                    </div>
                                </div>
                            ))}
                            {searchResults.length === 0 && <p className="p-4 text-center text-[var(--color-text-secondary)]">No users found</p>}
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <Link href={`/chats/${chat.chat_id}`} key={chat.chat_id} className="flex items-center px-4 py-2.5 hover:bg-[var(--color-brand-surface)] cursor-pointer group transition-colors">
                                <div className="w-14 h-14 bg-[#38383A] rounded-full flex-shrink-0 flex items-center justify-center shadow-sm">
                                    {chat.profile_picture ? <img src={chat.profile_picture} alt="" className="w-14 h-14 rounded-full object-cover" /> : <UserIcon className="text-white" size={28} />}
                                </div>
                                <div className="ml-3.5 flex-1 flex flex-col justify-center border-b border-[var(--color-brand-border)] pb-3.5 pt-1.5 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="text-[17px] font-medium text-white truncate pr-2">{chat.username}</h3>
                                        <span className={`text-[13px] flex-shrink-0 ${Number(chat.unread_count) > 0 ? 'text-[var(--color-brand-primary)] font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
                                            {chat.last_message_time ? format(new Date(chat.last_message_time), 'HH:mm') : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-[var(--color-text-secondary)] text-[15px] truncate flex-1 pr-3">
                                            {chat.last_message || '...'}
                                        </p>
                                        {Number(chat.unread_count) > 0 && (
                                            <span className="bg-[var(--color-brand-primary)] text-white text-[12px] font-bold px-1.5 py-0.5 min-w-[22px] h-[22px] rounded-full flex items-center justify-center shadow-sm">
                                                {chat.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                    {!chats.length && !searchQuery && (
                        <div className="p-8 text-center text-[var(--color-text-secondary)] mt-10">
                            <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-brand-light)] to-[var(--color-brand-primary)] rounded-full flex items-center justify-center mx-auto mb-4 opacity-80">
                                <Sparkles size={28} className="text-white bg-clip-text" />
                            </div>
                            <p className="text-[15px]">Tap the Sparkles icon above to search for users and start chatting.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Group Modal */}
            {isGroupModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#1C1C1E] border border-[#38383A] rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
                        <div className="p-4 border-b border-[#38383A] flex justify-between items-center bg-[#2C2C2E]/50">
                            <h2 className="text-white font-semibold text-lg">New Group</h2>
                            <button onClick={() => { setIsGroupModalOpen(false); setSelectedParticipants([]); setGroupName(''); }} className="text-[#8E8E93] hover:text-white p-1 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            <input
                                type="text"
                                placeholder="Group Subject"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full bg-[#2C2C2E] text-white px-4 py-3 rounded-xl outline-none text-[15px] placeholder-[#8E8E93] mb-4 border border-transparent focus:border-[var(--color-brand-primary)]"
                            />

                            {selectedParticipants.length > 0 && (
                                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                                    {selectedParticipants.map(p => (
                                        <div key={p.id} className="bg-[var(--color-brand-primary)]/20 text-[var(--color-brand-primary)] px-3 py-1.5 rounded-full text-sm flex items-center whitespace-nowrap">
                                            {p.username}
                                            <button onClick={() => toggleParticipant(p)} className="ml-1.5 hover:text-white"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={groupSearchQuery}
                                onChange={handleGroupSearch}
                                className="w-full bg-[#2C2C2E] text-white px-4 py-2.5 rounded-xl outline-none text-[15px] placeholder-[#8E8E93] mb-3"
                            />

                            <div className="space-y-1">
                                {groupSearchResults.map(u => (
                                    <div key={u.id} onClick={() => toggleParticipant(u)} className="flex items-center justify-between p-2 hover:bg-[#2C2C2E] rounded-xl cursor-pointer">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-[#38383A] rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                {u.profile_picture ? <img src={u.profile_picture} alt="" className="w-full h-full object-cover" /> : <UserIcon className="text-white" size={20} />}
                                            </div>
                                            <span className="ml-3 text-white font-medium">{u.username}</span>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedParticipants.find(p => p.id === u.id) ? 'bg-[var(--color-brand-primary)] border-[var(--color-brand-primary)]' : 'border-[#38383A]'}`}>
                                            {selectedParticipants.find(p => p.id === u.id) && <Check size={14} className="text-white" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 border-t border-[#38383A] bg-[#2C2C2E]/30">
                            <button
                                onClick={createGroupChat}
                                disabled={!groupName.trim() || selectedParticipants.length === 0}
                                className="w-full bg-[var(--color-brand-primary)] text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                            >
                                Create Group ({selectedParticipants.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop empty state - hidden on mobile unless navigating to /chats/[id] */}
            <div className="hidden md:flex flex-1 items-center justify-center bg-[var(--color-brand-bg)] border-l border-[var(--color-brand-border)] relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[var(--color-brand-primary)]/10 blur-[100px] rounded-full pointer-events-none" />
                <div className="text-center z-10 p-10 max-w-md backdrop-blur-sm bg-[var(--color-brand-surface)]/30 border border-white/5 rounded-3xl shadow-2xl">
                    <div className="w-24 h-24 relative bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-[var(--color-brand-primary)]/30 border border-white/20 overflow-hidden">
                        <Image src="/sarsh-logo.png" alt="Sarsh" fill className="object-cover scale-[0.8]" />
                    </div>
                    <h1 className="text-[28px] font-semibold text-white tracking-tight mb-3">Sarsh for Web</h1>
                    <p className="text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
                        Send and receive messages at the speed of thought.<br />Select a chat from the sidebar or start a new conversation.
                    </p>
                    <div className="mt-8 pt-8 border-t border-[var(--color-brand-border)]">
                        <p className="text-[13px] text-[#8E8E93] flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)] animate-pulse"></span>
                            End-to-End Encrypted Concept
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
