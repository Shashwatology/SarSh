"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useCall } from '@/context/CallContext';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck, ChevronDown, Edit2, Trash2, X, Mic, Square, Paperclip, FileText, Palette, Users, User as UserIcon, Reply, Forward, Phone, Video, PenTool, Eraser, Grid, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function ChatScreen() {
    const { id } = useParams();
    const { user } = useAuth();
    const { socket } = useSocket();
    const { callUser } = useCall();
    const router = useRouter();

    const [messages, setMessages] = useState<any[]>([]);
    const [currentChat, setCurrentChat] = useState<any>(null);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState<any>(null); // holds message to forward
    const [allChats, setAllChats] = useState<any[]>([]);
    const [showAttachments, setShowAttachments] = useState(false);

    // Canvas State
    const [showCanvas, setShowCanvas] = useState(false);
    const [canvasInvite, setCanvasInvite] = useState<any>(null);
    const [isPainting, setIsPainting] = useState(false);
    const [brushColor, setBrushColor] = useState('#ffffff');
    const [brushSize, setBrushSize] = useState(3);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Gestures
    const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
    const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
    const [swipingMessageId, setSwipingMessageId] = useState<number | null>(null);
    const [swipeDistanceX, setSwipeDistanceX] = useState<number>(0);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const documentInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!id || !user) return;

        const fetchChatAndMessages = async () => {
            try {
                const chatsRes = await api.get('/chats');
                setAllChats(chatsRes.data);
                const chat = chatsRes.data.find((c: any) => c.chat_id === Number(id));
                if (chat) setCurrentChat(chat);

                const msgRes = await api.get(`/messages/${id}`);
                setMessages(msgRes.data);

                await api.put(`/messages/read/${id}`);
                if (socket) {
                    socket.emit('read_receipt', { chatId: String(id), readerId: user.id });
                }
            } catch (err) {
                console.error(err);
            }
        };

        fetchChatAndMessages();
    }, [id, user, socket]);

    useEffect(() => {
        if (!socket || !id || !user) return;

        socket.emit('join_room', String(id));

        socket.on('receive_message', (message: any) => {
            setMessages((prev) => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
            if (message.sender_id !== user.id) {
                api.put(`/messages/read/${id}`);
                // Emit delivery and read receipts
                socket.emit('message_delivered', { messageId: message.id, chatId: String(id) });
                socket.emit('read_receipt', { chatId: String(id), readerId: user.id });
            }
        });

        socket.on('update_message', (data: any) => {
            setMessages((prev) => prev.map(m => m.id === data.id ? data : m));
        });

        socket.on('typing', (data: any) => {
            if (data.senderId !== user.id) {
                setOtherUserTyping(data.isTyping);
            }
        });

        socket.on('read_receipt', () => {
            setMessages((prev) =>
                prev.map(m => m.sender_id === user.id ? { ...m, status: 'read' } : m)
            );
        });

        socket.on('message_status_update', (data: any) => {
            setMessages((prev) =>
                prev.map(m => m.id === data.messageId ? { ...m, status: data.status } : m)
            );
        });

        socket.on('presence_update', (data: any) => {
            setCurrentChat((prev: any) => {
                if (prev && !prev.is_group && Number(data.userId) === Number(prev.other_user_id)) {
                    return { ...prev, is_online: data.isOnline, last_seen: data.lastSeen || (data.isOnline ? null : new Date().toISOString()) };
                }
                return prev;
            });
        });

        socket.on('update_theme', (data: { theme: string }) => {
            setCurrentChat((prev: any) => ({ ...prev, theme: data.theme }));
        });

        socket.on('message_reaction', (data: any) => {
            setMessages((prev) => prev.map(m => {
                if (m.id === Number(data.messageId)) {
                    let reactions = m.reactions || [];
                    if (data.action === 'added') {
                        reactions = reactions.filter((r: any) => r.user_id !== data.userId);
                        reactions.push({ user_id: data.userId, reaction: data.data?.reaction || data.reaction });
                    } else if (data.action === 'removed') {
                        reactions = reactions.filter((r: any) => r.user_id !== data.userId);
                    }
                    return { ...m, reactions };
                }
                return m;
            }));
        });

        socket.on('start_drawing', (data: any) => {
            if (data.senderId && data.senderId !== user.id) {
                setCanvasInvite({ senderId: data.senderId, senderName: data.senderName || 'Your friend' });
            }
        });

        socket.on('drawing_path', (data: any) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.lineWidth = data.size;
            ctx.lineCap = 'round';
            ctx.strokeStyle = data.color;

            if (data.type === 'start') {
                ctx.beginPath();
                ctx.moveTo(data.x * canvas.width, data.y * canvas.height);
            } else if (data.type === 'draw') {
                ctx.lineTo(data.x * canvas.width, data.y * canvas.height);
                ctx.stroke();
            } else if (data.type === 'end') {
                ctx.beginPath();
            }
        });

        socket.on('clear_canvas', () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
        });

        socket.on('end_drawing', () => {
            setShowCanvas(false);
            setCanvasInvite(null);
        });

        socket.on('draw_grid', () => {
            drawTicTacToeGridLocally();
        });

        return () => {
            socket.off('receive_message');
            socket.off('typing');
            socket.off('read_receipt');
            socket.off('message_status_update');
            socket.off('presence_update');
            socket.off('update_message');
            socket.off('update_theme');
            socket.off('message_reaction');
            socket.off('start_drawing');
            socket.off('drawing_path');
            socket.off('clear_canvas');
            socket.off('end_drawing');
            socket.off('draw_grid');
        };
    }, [socket, id, user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, otherUserTyping]);

    const handleReaction = async (messageId: number, reaction: string) => {
        try {
            const res = await api.post(`/messages/${messageId}/react`, { reaction });
            setActiveMenuId(null);
            if (socket) {
                socket.emit('message_reaction', { ...res.data, chatId: id });
            }
        } catch (err) {
            console.error('Error reacting', err);
        }
    };

    let typingTimeout: NodeJS.Timeout;
    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);

        if (!isTyping) {
            setIsTyping(true);
            socket?.emit('typing', { chatId: String(id), senderId: user?.id, isTyping: true });
        }

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            setIsTyping(false);
            socket?.emit('typing', { chatId: String(id), senderId: user?.id, isTyping: false });
        }, 2000);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        if (editingMessage) {
            try {
                const res = await api.put(`/messages/${editingMessage.id}/edit`, { content: newMessage });
                setMessages(prev => prev.map(m => m.id === editingMessage.id ? res.data : m));
                socket?.emit('edit_message', res.data);
                setEditingMessage(null);
                setNewMessage('');
            } catch (err) {
                console.error(err);
            }
            return;
        }

        const tempMessage = {
            chat_id: id,
            sender_id: user?.id,
            content: newMessage,
            status: 'sent',
            reply_to_id: replyingTo?.id,
            reply_to_content: replyingTo?.content,
            reply_to_username: replyingTo?.sender_name,
            created_at: new Date().toISOString(),
            id: Date.now() // temp id
        };

        setMessages((prev) => [...prev, tempMessage]);
        setNewMessage('');
        setIsTyping(false);
        setReplyingTo(null);
        socket?.emit('typing', { chatId: String(id), senderId: user?.id, isTyping: false });

        try {
            const res = await api.post('/messages', {
                chatId: id,
                content: tempMessage.content,
                replyToId: tempMessage.reply_to_id
            });

            setMessages((prev) => prev.map(m => m.id === tempMessage.id ? res.data : m));
            socket?.emit('send_message', res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteMessage = async (messageId: number) => {
        try {
            const res = await api.delete(`/messages/${messageId}`);
            setMessages(prev => prev.map(m => m.id === messageId ? res.data : m));
            socket?.emit('delete_message', res.data);
            setActiveMenuId(null);
        } catch (err) {
            console.error(err);
        }
    };

    const initiateEdit = (msg: any) => {
        setEditingMessage(msg);
        setNewMessage(msg.content);
        setActiveMenuId(null);
    };

    const handleAudioUpload = async (blob: Blob) => {
        const formData = new FormData();
        formData.append('audio', blob, 'voicenote.webm');
        try {
            const uploadRes = await api.post('/upload/audio', formData);
            const { mediaUrl, mediaType } = uploadRes.data;
            const res = await api.post('/messages', { chatId: id, content: '', mediaUrl, mediaType });
            setMessages(prev => [...prev, res.data]);
            socket?.emit('send_message', res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await handleAudioUpload(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Microphone error:', err);
            alert('Could not access microphone');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        }
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Clear the input value so Android browsers don't cache it
        e.target.value = '';

        const formData = new FormData();
        formData.append('document', file);

        try {
            const uploadRes = await api.post('/upload/document', formData);
            const { mediaUrl, mediaType } = uploadRes.data;
            const res = await api.post('/messages', { chatId: id, content: file.name, mediaUrl, mediaType });
            setMessages(prev => [...prev, res.data]);
            socket?.emit('send_message', res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const uploadFileDirectly = async (file: File) => {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const uploadRes = await api.post('/upload', formData);
            const { mediaUrl, mediaType } = uploadRes.data;
            const res = await api.post('/messages', { chatId: id, content: '', mediaUrl, mediaType });

            setMessages((prev) => [...prev, res.data]);
            socket?.emit('send_message', res.data);
        } catch (err) {
            console.error('Image upload failed:', err);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            e.target.value = '';
            await uploadFileDirectly(file);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image/') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    await uploadFileDirectly(file);
                    break;
                }
            }
        }
    };

    const handleThemeChange = async (themeName: string) => {
        if (!currentChat) return;
        try {
            setCurrentChat((prev: any) => ({ ...prev, theme: themeName }));
            setShowThemePicker(false);
            await api.put(`/chats/${id}/theme`, { theme: themeName });
            socket?.emit('change_theme', { chatId: String(id), theme: themeName });
        } catch (err) {
            console.error(err);
        }
    };

    // --- CANVAS LOGIC ---
    const initCanvas = () => {
        socket?.emit('start_drawing', { chatId: String(id), senderId: user?.id, senderName: user?.username });
        setShowCanvas(true);
        setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }, 100);
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent | any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: (clientX - rect.left) / canvas.width,
            y: (clientY - rect.top) / canvas.height
        };
    };

    const startPosition = (e: React.MouseEvent | React.TouchEvent) => {
        setIsPainting(true);
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
            ctx.beginPath();
            ctx.moveTo(x * canvasRef.current.width, y * canvasRef.current.height);
            socket?.emit('drawing_path', { chatId: String(id), x, y, type: 'start', color: brushColor, size: brushSize });
            draw(e as React.MouseEvent);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isPainting) return;
        const { x, y } = getCoordinates(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.strokeStyle = brushColor;
            ctx.lineTo(x * canvas.width, y * canvas.height);
            ctx.stroke();
            socket?.emit('drawing_path', { chatId: String(id), x, y, type: 'draw', color: brushColor, size: brushSize });
        }
    };

    const endPosition = () => {
        setIsPainting(false);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.beginPath();
        socket?.emit('drawing_path', { chatId: String(id), type: 'end' });
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            socket?.emit('clear_canvas', { chatId: String(id) });
        }
    };

    const closeCanvas = () => {
        setShowCanvas(false);
        socket?.emit('end_drawing', { chatId: String(id) });
    };

    const sendCanvasImage = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d');
        if (tCtx) {
            tCtx.fillStyle = '#000000';
            tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tCtx.drawImage(canvas, 0, 0);
        }

        tempCanvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], 'canvas_drawing.png', { type: 'image/png' });
            const formData = new FormData();
            formData.append('image', file);

            try {
                const uploadRes = await api.post('/upload', formData);
                const { mediaUrl, mediaType } = uploadRes.data;
                const res = await api.post('/messages', { chatId: id, content: '🎨 Sent a doodle', mediaUrl, mediaType });
                setMessages((prev) => [...prev, res.data]);
                socket?.emit('send_message', res.data);
                closeCanvas();
            } catch (err) {
                console.error(err);
            }
        }, 'image/png');
    };

    const drawTicTacToeGridLocally = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const size = Math.min(canvas.width, canvas.height) * 0.7;
        const startX = (canvas.width - size) / 2;
        const startY = (canvas.height - size) / 2;
        const third = size / 3;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();

        // Vertical lines
        ctx.moveTo(startX + third, startY);
        ctx.lineTo(startX + third, startY + size);
        ctx.moveTo(startX + 2 * third, startY);
        ctx.lineTo(startX + 2 * third, startY + size);

        // Horizontal lines
        ctx.moveTo(startX, startY + third);
        ctx.lineTo(startX + size, startY + third);
        ctx.moveTo(startX, startY + 2 * third);
        ctx.lineTo(startX + size, startY + 2 * third);

        ctx.stroke();
    };

    const drawTicTacToeGrid = () => {
        drawTicTacToeGridLocally();
        socket?.emit('draw_grid', { chatId: String(id) });
    };

    // --- GESTURE LOGIC: SWIPE & LONG PRESS ---
    const SWIPE_THRESHOLD = 50; // pixels to trigger reply
    const MAX_SWIPE = 80;
    const LONG_PRESS_DELAY = 500; // ms

    const handleTouchStart = (e: React.TouchEvent, msg: any) => {
        const touch = e.touches[0];
        setSwipeStartX(touch.clientX);
        setSwipeStartY(touch.clientY);
        setSwipingMessageId(msg.id);
        setSwipeDistanceX(0);

        // Start long press timer
        longPressTimerRef.current = setTimeout(() => {
            // Trigger haptic feedback if supported
            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
            setActiveMenuId(msg.id);
            setSwipingMessageId(null);
            setSwipeDistanceX(0);
        }, LONG_PRESS_DELAY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (swipeStartX === null || swipeStartY === null || swipingMessageId === null) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - swipeStartX;
        const diffY = currentY - swipeStartY;

        // If finger moves more than 10px in any direction, cancel long press
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }

        // Only allow swiping right for swipe-to-reply
        if (Math.abs(diffX) > Math.abs(diffY) && diffX > 0) {
            if (diffX < MAX_SWIPE) {
                setSwipeDistanceX(diffX);
            } else {
                setSwipeDistanceX(MAX_SWIPE);
            }
        } else {
            setSwipeDistanceX(0); // Scrolling vertically or swiping left
        }
    };

    const handleTouchEnd = (msg: any) => {
        // Clear long press if touch ends early
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (swipeDistanceX >= SWIPE_THRESHOLD) {
            setReplyingTo(msg);
            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
        }
        setSwipeStartX(null);
        setSwipeStartY(null);
        setSwipingMessageId(null);
        setSwipeDistanceX(0);
    };

    return (
        <div className={`flex flex-col h-[100dvh] w-full bg-black relative md:rounded-l-sm shadow-inner overflow-hidden theme-${currentChat?.theme || 'default'}`}>
            {/* Header */}
            <div className="backdrop-blur-xl bg-[var(--color-brand-surface)]/80 px-4 py-3 flex items-center border-b border-[var(--color-brand-border)] z-20 w-full shadow-sm sticky top-0">
                <button onClick={() => router.push('/chats')} className="mr-3 md:hidden text-[var(--color-brand-primary)] hover:opacity-80 p-1 rounded-full transition-opacity">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex items-center cursor-pointer group">
                    <div className="w-10 h-10 bg-[#38383A] rounded-full flex-shrink-0 shadow-sm overflow-hidden flex items-center justify-center">
                        {currentChat?.is_group ? (
                            currentChat?.group_icon ? <img src={currentChat.group_icon} alt="" className="w-full h-full object-cover" /> : <Users size={20} className="text-white" />
                        ) : (
                            currentChat?.profile_picture ? <img src={currentChat.profile_picture} alt="" className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-white" />
                        )}
                    </div>
                    <div className="ml-3">
                        <h2 className="text-white font-semibold tracking-tight leading-5 group-hover:text-gray-200 transition-colors">
                            {currentChat?.is_group ? (currentChat?.group_name || 'Group Chat') : (currentChat?.username || 'Loading...')}
                        </h2>
                        <p className="text-[13px] text-[var(--color-brand-primary)]">
                            {currentChat?.is_group ? (
                                <span className="text-[var(--color-text-secondary)]">Group</span>
                            ) : (
                                otherUserTyping ? 'typing...' : (
                                    currentChat?.is_online ? 'Online' :
                                        currentChat?.last_seen ? <span className="text-[var(--color-text-secondary)]">{`last seen ${format(new Date(currentChat.last_seen), 'HH:mm')}`}</span> :
                                            <span className="text-[var(--color-text-secondary)]">{currentChat?.status || 'Offline'}</span>
                                )
                            )}
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="ml-auto flex items-center gap-1 relative">
                    {!currentChat?.is_group && (
                        <>
                            <button
                                onClick={() => callUser(currentChat?.other_user_id || Number(id), false, currentChat?.username, id as string)}
                                className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-[var(--color-brand-primary)] transition-colors"
                            >
                                <Phone size={20} className="w-5 h-5 sm:w-5 sm:h-5" />
                            </button>
                            <button
                                onClick={() => callUser(currentChat?.other_user_id || Number(id), true, currentChat?.username, id as string)}
                                className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-[var(--color-brand-primary)] transition-colors mr-0.5"
                            >
                                <Video size={22} className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowThemePicker(!showThemePicker)}
                        className="p-2 rounded-full hover:bg-white/10 text-[var(--color-brand-primary)] transition-colors"
                    >
                        <Palette size={22} />
                    </button>
                    {showThemePicker && (
                        <div className="absolute right-0 top-12 mt-2 w-48 bg-[#2C2C2E] border border-[#38383A] rounded-2xl shadow-2xl p-2 z-50">
                            <h3 className="text-white text-xs font-semibold px-3 pt-2 pb-3 uppercase tracking-wider text-[var(--color-text-secondary)]">Chat Theme</h3>
                            <div className="space-y-1">
                                {['default', 'instagram', 'hacker', 'rose', 'ocean'].map(theme => (
                                    <button
                                        key={theme}
                                        onClick={() => handleThemeChange(theme)}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-sm capitalize flex items-center justify-between ${currentChat?.theme === theme ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}
                                    >
                                        {theme === 'default' ? 'Classic Blue' : theme}
                                        {currentChat?.theme === theme && <Check size={16} className="text-[var(--color-brand-primary)]" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 z-10 flex flex-col gap-3 overflow-x-hidden">
                {messages.map((msg, index) => {
                    const isMine = msg.sender_id === user?.id;
                    const isConsecutive = index > 0 && messages[index - 1].sender_id === msg.sender_id;
                    const isSwiping = swipingMessageId === msg.id;

                    return (
                        <div
                            key={msg.id || index}
                            className={`flex relative ${isMine ? 'justify-end' : 'justify-start'} ${isConsecutive ? '-mt-1' : ''}`}
                            onTouchStart={(e) => handleTouchStart(e, msg)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={() => handleTouchEnd(msg)}
                        >
                            {/* Reply Icon Indicator (revealed on swipe) */}
                            {!isMine && (
                                <div
                                    className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity"
                                    style={{
                                        opacity: isSwiping ? Math.min(swipeDistanceX / SWIPE_THRESHOLD, 1) : 0,
                                        width: '40px',
                                        zIndex: 0
                                    }}
                                >
                                    <div className="bg-white/10 p-2 rounded-full">
                                        <Reply size={16} className="text-white" />
                                    </div>
                                </div>
                            )}

                            <div
                                className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 relative text-[15px] leading-relaxed shadow-md group border border-white/5 transition-all
                                    ${isMine
                                        ? 'bg-[var(--color-brand-bubble-me)] text-white rounded-[20px] rounded-br-[4px]'
                                        : 'bg-[var(--color-brand-bubble-other)] text-white rounded-[20px] rounded-bl-[4px]'
                                    } ${msg.is_deleted ? 'opacity-70 italic' : ''}`}
                                style={{
                                    transform: isSwiping && !isMine ? `translateX(${swipeDistanceX}px)` : 'translateX(0)',
                                    transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
                                    zIndex: 1
                                }}
                            >
                                {!isMine && currentChat?.is_group && !isConsecutive && (
                                    <div className="text-[12px] font-semibold text-[var(--color-brand-primary)] mb-0.5 opacity-90">
                                        {msg.sender_name || 'Participant'}
                                    </div>
                                )}

                                {msg.is_forwarded && (
                                    <div className="flex items-center text-[12px] text-white/70 italic mb-1 border-b border-white/10 pb-0.5">
                                        <Forward size={12} className="mr-1" /> Forwarded
                                    </div>
                                )}

                                {msg.reply_to_id && (
                                    <div className="bg-black/20 border-l-4 border-[var(--color-brand-primary)] rounded-md p-2 mb-2 text-sm mt-1">
                                        <div className="font-semibold text-[var(--color-brand-primary)] text-xs mb-0.5">{msg.reply_to_username || 'User'}</div>
                                        <div className="text-white/80 line-clamp-2 text-xs">{msg.reply_to_content || (msg.reply_to_media_url ? 'Media attached' : 'Deleted message')}</div>
                                    </div>
                                )}

                                {!msg.is_deleted && (
                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                                            className="text-white/80 hover:text-white bg-black/10 rounded-full p-0.5 backdrop-blur-sm"
                                        >
                                            <ChevronDown size={18} />
                                        </button>

                                        {activeMenuId === msg.id && (
                                            <div className="absolute right-0 top-6 z-50">
                                                <div className="absolute right-0 -top-16 flex gap-1 p-2 bg-[#2C2C2E] rounded-full shadow-2xl border border-[#38383A] animate-[fadeIn_0.15s_ease-out] z-50">
                                                    {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                                                        <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="text-xl hover:scale-125 transition-transform px-1.5 focus:outline-none">{emoji}</button>
                                                    ))}
                                                </div>
                                                <div className="bg-[#2C2C2E] border border-[#38383A] rounded-xl shadow-xl w-40 overflow-hidden">
                                                    <button
                                                        onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2.5 text-left text-[14px] text-white hover:bg-[#38383A] flex items-center transition-colors"
                                                    >
                                                        <Reply size={16} className="mr-2 opacity-70" /> Reply
                                                    </button>
                                                    <div className="h-[1px] bg-[#38383A] w-full" />
                                                    <button
                                                        onClick={() => { setShowForwardModal(msg); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2.5 text-left text-[14px] text-white hover:bg-[#38383A] flex items-center transition-colors"
                                                    >
                                                        <Forward size={16} className="mr-2 opacity-70" /> Forward
                                                    </button>
                                                    <div className="h-[1px] bg-[#38383A] w-full" />
                                                    {isMine && (
                                                        <>
                                                            <button
                                                                onClick={() => initiateEdit(msg)}
                                                                className="w-full px-4 py-2.5 text-left text-[14px] text-white hover:bg-[#38383A] flex items-center transition-colors"
                                                            >
                                                                <Edit2 size={16} className="mr-2 opacity-70" /> Edit
                                                            </button>
                                                            <div className="h-[1px] bg-[#38383A] w-full" />
                                                            <button
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                className="w-full px-4 py-2.5 text-left text-[14px] text-red-500 hover:bg-[#38383A] flex items-center transition-colors"
                                                            >
                                                                <Trash2 size={16} className="mr-2 opacity-70" /> Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(msg.media_type === 'image' || (!msg.media_type && msg.media_url)) && msg.media_url && (
                                    <img src={msg.media_url} alt="Media" className="rounded-xl mb-1 mt-1 max-w-full h-auto max-h-[300px] object-cover border border-white/10" />
                                )}
                                {msg.media_type === 'audio' && msg.media_url && (
                                    <div className="mt-1 mb-2">
                                        <audio controls src={msg.media_url} className="h-10 outline-none max-w-[200px] md:max-w-[250px]" />
                                    </div>
                                )}
                                {msg.media_type === 'document' && msg.media_url && (
                                    <div className="mt-1 mb-2 flex items-center bg-black/20 p-3 rounded-xl border border-white/10">
                                        <FileText size={24} className="mr-3 opacity-80" />
                                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex-1 truncate font-medium max-w-[180px]">
                                            {msg.content || 'Document'}
                                        </a>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-end gap-3">
                                    {msg.content && msg.media_type !== 'document' && <span className={`break-words whitespace-pre-wrap flex-1 ${msg.is_deleted ? 'text-white/70 text-[15px]' : ''}`}>{msg.content}</span>}
                                    <div className={`flex items-center text-[11px] whitespace-nowrap pt-1 ml-auto ${isMine ? 'text-blue-100' : 'text-[var(--color-text-secondary)]'}`}>
                                        {msg.is_edited && !msg.is_deleted && <span className="mr-1.5 opacity-70 italic">edited</span>}
                                        <span>{format(new Date(msg.created_at || new Date()), 'HH:mm')}</span>
                                        {isMine && !msg.is_deleted && (
                                            <span className="ml-1 flex items-center">
                                                {msg.status === 'read' ? <CheckCheck size={14} className="text-white" /> :
                                                    msg.status === 'delivered' ? <CheckCheck size={14} className="text-blue-200 opacity-60" /> :
                                                        <Check size={14} className="text-blue-200 opacity-60" />}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {msg.reactions && msg.reactions.length > 0 && (
                                    <div className={`absolute -bottom-3 ${isMine ? 'right-4' : 'left-4'} bg-[#2C2C2E] border border-[#38383A] rounded-full px-2 py-0.5 text-[12px] flex items-center gap-1 shadow-md z-10`}>
                                        {Array.from(new Set(msg.reactions.map((r: any) => r.reaction))).map((reaction: any) => (
                                            <span key={reaction}>{reaction}</span>
                                        ))}
                                        <span className="text-white/60 font-semibold ml-0.5">{msg.reactions.length > 1 ? msg.reactions.length : ''}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Forward Modal */}
            {showForwardModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1C1C1E] border border-[#38383A] w-full max-w-sm rounded-3xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold flex items-center"><Forward size={18} className="mr-2 text-[var(--color-brand-primary)]" /> Forward Message</h3>
                            <button onClick={() => setShowForwardModal(null)} className="text-gray-400 hover:text-white p-1 rounded-full bg-white/5"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {allChats.filter(c => c.chat_id !== Number(id)).map(chat => (
                                <button
                                    key={chat.chat_id}
                                    onClick={async () => {
                                        try {
                                            await api.post('/messages/forward', { messageId: showForwardModal.id, chatIds: [chat.chat_id] });
                                            setShowForwardModal(null);
                                        } catch (e) { console.error(e); }
                                    }}
                                    className="w-full flex items-center p-3 rounded-2xl hover:bg-[#2C2C2E] transition-colors border border-transparent hover:border-[#38383A] text-left"
                                >
                                    <div className="w-10 h-10 bg-[#38383A] rounded-full flex-shrink-0 mr-3 overflow-hidden flex items-center justify-center">
                                        {chat.is_group ? (chat.group_icon ? <img src={chat.group_icon} alt="" className="w-full h-full object-cover" /> : <Users size={20} className="text-white" />) : (chat.profile_picture ? <img src={chat.profile_picture} alt="" className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-white" />)}
                                    </div>
                                    <span className="text-white text-[15px] font-medium">{chat.is_group ? chat.group_name : chat.username}</span>
                                </button>
                            ))}
                            {allChats.filter(c => c.chat_id !== Number(id)).length === 0 && (
                                <p className="text-center text-gray-500 text-sm py-4">No other chats to forward to.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="backdrop-blur-2xl bg-[var(--color-brand-bg)]/80 px-2 sm:px-4 py-2 sm:py-3 pb-4 sm:pb-6 flex flex-col z-20 w-full border-t border-[var(--color-brand-border)] relative shadow-2xl">
                {replyingTo && (
                    <div className="flex items-center justify-between bg-black/40 rounded-t-2xl px-4 py-2 mb-2 border-l-4 border-[var(--color-brand-primary)] text-sm shadow-md">
                        <div>
                            <span className="font-semibold text-[var(--color-brand-primary)] text-xs block mb-0.5">Replying to {replyingTo.sender_name || 'User'}</span>
                            <span className="text-white/80 line-clamp-1">{replyingTo.content || 'Media message'}</span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white bg-white/10 rounded-full p-1"><X size={16} /></button>
                    </div>
                )}

                {canvasInvite && (
                    <div className="bg-[var(--color-brand-primary)]/20 border border-[var(--color-brand-primary)]/50 rounded-2xl mx-2 mb-3 p-3 flex items-center justify-between backdrop-blur-md shadow-lg animate-pulse">
                        <div className="flex items-center text-white">
                            <PenTool size={20} className="mr-3 flex-shrink-0 text-[var(--color-brand-primary)]" />
                            <span className="text-sm"><strong>{canvasInvite.senderName}</strong> wants to doodle with you!</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowCanvas(true);
                                    setCanvasInvite(null);
                                    setTimeout(() => {
                                        if (canvasRef.current) {
                                            canvasRef.current.width = window.innerWidth;
                                            canvasRef.current.height = window.innerHeight;
                                        }
                                    }, 100);
                                }}
                                className="bg-[var(--color-brand-primary)] text-white px-4 py-1.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                            >
                                Join
                            </button>
                            <button
                                onClick={() => setCanvasInvite(null)}
                                className="bg-white/10 text-white p-1.5 rounded-full hover:bg-white/20 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex items-end w-full">
                    {isRecording ? (
                        <div className="flex-1 flex items-center justify-between mx-2 bg-red-500/10 rounded-3xl px-4 py-2.5 border border-red-500/20 min-h-[44px]">
                            <div className="flex items-center text-red-500 animate-pulse">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />
                                <span className="font-medium tracking-wide">{formatRecordingTime(recordingTime)}</span>
                            </div>
                            <span className="text-red-500/70 text-sm italic mr-2 hidden sm:inline-block">Recording Voice Note...</span>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <button
                                    onClick={() => setShowAttachments(!showAttachments)}
                                    className={`p-1.5 sm:p-2 rounded-full transition-colors mb-0.5 ${showAttachments ? 'bg-white/20 text-white' : 'text-[var(--color-brand-primary)] hover:opacity-80'}`}
                                >
                                    <Plus size={24} className={`sm:w-6 sm:h-6 transition-transform ${showAttachments ? 'rotate-45' : ''}`} />
                                </button>

                                {showAttachments && (
                                    <div className="absolute bottom-12 left-0 bg-[#2C2C2E] border border-[#38383A] rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 min-w-[140px] animate-[fadeIn_0.15s_ease-out]">
                                        <button onClick={() => { setShowAttachments(false); initCanvas(); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors text-white text-sm font-medium">
                                            <div className="bg-purple-500/20 p-1.5 rounded-lg text-purple-400"><PenTool size={18} /></div> Canvas
                                        </button>
                                        <button onClick={() => { setShowAttachments(false); documentInputRef.current?.click(); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors text-white text-sm font-medium">
                                            <div className="bg-blue-500/20 p-1.5 rounded-lg text-blue-400"><Paperclip size={18} /></div> Document
                                            <input type="file" ref={documentInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleDocumentUpload} />
                                        </button>
                                        <button onClick={() => { setShowAttachments(false); fileInputRef.current?.click(); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors text-white text-sm font-medium">
                                            <div className="bg-green-500/20 p-1.5 rounded-lg text-green-400"><ImageIcon size={18} /></div> Image
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <form onSubmit={handleSendMessage} className="flex-1 flex ml-1">
                                <div className="w-full bg-white/5 backdrop-blur-md rounded-3xl px-4 py-2 sm:px-5 sm:py-2.5 shadow-inner border border-white/10 flex items-center min-h-[40px] sm:min-h-[44px] transition-colors focus-within:bg-white/10 focus-within:border-white/20">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={handleTyping}
                                        onPaste={handlePaste}
                                        placeholder={editingMessage ? "Edit message..." : "Message (paste image here)..."}
                                        className="flex-1 outline-none text-white bg-transparent placeholder-[#8E8E93] text-[14px] sm:text-[15px]"
                                    />
                                    {editingMessage && (
                                        <button
                                            type="button"
                                            onClick={() => { setEditingMessage(null); setNewMessage(''); }}
                                            className="ml-2 text-[#8E8E93] hover:text-white transition-colors p-1"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            </form>
                        </>
                    )}

                    {newMessage.trim() && !isRecording ? (
                        <button
                            onClick={handleSendMessage}
                            className="p-2.5 rounded-full bg-[var(--color-brand-primary)] text-white hover:opacity-90 flex items-center justify-center transition-all shadow-md mb-0.5 transform scale-100 ml-1"
                        >
                            <Send size={20} className="ml-0.5" />
                        </button>
                    ) : (
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`p-2.5 flex items-center justify-center transition-all shadow-md mb-0.5 transform scale-100 ml-1 rounded-full ${isRecording ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' : 'bg-[#1C1C1E] text-[var(--color-brand-primary)] hover:bg-[#2C2C2E] border border-[#38383A]'}`}
                        >
                            {isRecording ? <Square size={20} fill="currentColor" className="text-white" /> : <Mic size={20} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas Overlay Component */}
            {showCanvas && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center animate-[fadeIn_0.2s_ease-out]">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startPosition}
                        onMouseMove={draw}
                        onMouseUp={endPosition}
                        onMouseOut={endPosition}
                        onTouchStart={startPosition}
                        onTouchMove={draw}
                        onTouchEnd={endPosition}
                        className="absolute inset-0 w-full h-full bg-black cursor-crosshair touch-none"
                    />

                    {/* Top Bar */}
                    <div className="pointer-events-none absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                        <button onClick={closeCanvas} className="pointer-events-auto p-2 bg-white/10 rounded-full text-white backdrop-blur-md hover:bg-white/20 transition-colors">
                            <X size={24} />
                        </button>
                        <div className="text-white/80 font-semibold tracking-wide flex items-center gap-2 bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                            <PenTool size={16} /> Shared Canvas
                        </div>
                        <button onClick={sendCanvasImage} className="pointer-events-auto px-4 py-2 bg-[var(--color-brand-primary)] rounded-full text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-[var(--color-brand-primary)]/30 transition-all">
                            Send <Send size={16} />
                        </button>
                    </div>

                    {/* Bottom Toolbar */}
                    <div className="pointer-events-none absolute bottom-6 sm:bottom-8 w-full flex justify-center z-10 px-2">
                        <div className="pointer-events-auto bg-[#2C2C2E] border border-[#38383A] rounded-full px-3 sm:px-5 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 shadow-2xl backdrop-blur-xl max-w-full overflow-x-auto hide-scrollbar">
                            <div className="flex gap-1.5 sm:gap-2 flex-shrink-0 items-center">
                                {['#ffffff', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#AF52DE'].map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setBrushColor(color)}
                                        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 transition-transform flex-shrink-0 ${brushColor === color ? 'scale-110 border-white shadow-lg' : 'border-transparent scale-90 opacity-80 hover:opacity-100'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <div className="w-[1px] h-6 sm:h-8 bg-white/10 flex-shrink-0"></div>
                            <button onClick={() => setBrushColor('#000000')} className={`p-1.5 sm:p-2 rounded-full transition-colors flex-shrink-0 ${brushColor === '#000000' ? 'bg-white/20' : 'hover:bg-white/10 opacity-70 hover:opacity-100'}`} title="Eraser">
                                <Eraser size={18} className="sm:w-[22px] sm:h-[22px] text-white" />
                            </button>
                            <button onClick={drawTicTacToeGrid} className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-white transition-colors opacity-80 hover:opacity-100 flex-shrink-0" title="Tic-Tac-Toe Grid">
                                <Grid size={18} className="sm:w-[22px] sm:h-[22px]" />
                            </button>
                            <button onClick={clearCanvas} className="p-1.5 sm:p-2 rounded-full hover:bg-red-500/20 text-red-400 transition-colors opacity-80 hover:opacity-100 flex-shrink-0" title="Clear Canvas">
                                <Trash2 size={18} className="sm:w-[22px] sm:h-[22px]" />
                            </button>
                            <div className="w-[1px] h-6 sm:h-8 bg-white/10 hidden sm:block flex-shrink-0"></div>
                            <input
                                type="range"
                                min="1" max="25"
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                className="w-16 sm:w-24 accent-[var(--color-brand-primary)] hidden sm:block flex-shrink-0"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
