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
    const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState<any>(null); // holds message to forward
    const [allChats, setAllChats] = useState<any[]>([]);
    const [showAttachments, setShowAttachments] = useState(false);
    const [showScrollFAB, setShowScrollFAB] = useState(false);

    const vibrate = (ms = 10) => {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(ms);
        }
    };

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

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight > 300) {
            setShowScrollFAB(true);
        } else {
            setShowScrollFAB(false);
        }
    };

    const scrollToBottom = () => {
        vibrate(10);
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleReaction = async (messageId: number, reaction: string) => {
        vibrate(10);
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
    const handleTyping = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        vibrate(10);

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

    const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    const handleClearChat = async () => {
        if (!window.confirm('Are you sure you want to clear all messages in this chat? This cannot be undone.')) return;

        try {
            await api.delete(`/messages/clear/${id}`);
            setMessages([]);
            setShowThemePicker(false);
            vibrate(50);
        } catch (err) {
            console.error('Error clearing chat:', err);
            alert('Failed to clear chat');
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
            // Trigger haptic feedback
            vibrate(50);
            setActiveMenuId(msg.id);
            setMenuRect((e.currentTarget as HTMLElement).getBoundingClientRect());
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

        // If finger moves more than 10px vertically, cancel swipe and long press completely
        if (Math.abs(diffY) > 10) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            setSwipingMessageId(null);
            setSwipeDistanceX(0);
            return;
        }

        // Only allow swiping right for swipe-to-reply
        if (diffX > 5) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            if (diffX < MAX_SWIPE) {
                setSwipeDistanceX(diffX);
            } else {
                setSwipeDistanceX(MAX_SWIPE);
            }
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
            vibrate(50);
        }
        setSwipeStartX(null);
        setSwipeStartY(null);
        setSwipingMessageId(null);
        setSwipeDistanceX(0);
    };

    return (
        <div className={`flex ${currentChat?.theme === 'incognito' ? 'flex-row' : 'flex-col'} h-[100dvh] w-full bg-black relative md:rounded-l-sm shadow-inner overflow-hidden theme-${currentChat?.theme || 'default'}`}>
            {currentChat?.theme === 'incognito' && (
                <>
                    {/* Activity Bar */}
                    <div className="w-12 bg-[#333333] border-r border-[#252526] flex flex-col items-center py-3 flex-shrink-0 z-30 justify-between">
                        <div className="flex flex-col items-center w-full">
                            <div className="w-full flex justify-center py-3 text-white cursor-pointer relative border-l-2 border-[#007acc]">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"></path></svg>
                            </div>
                            <div className="w-full flex justify-center py-3 text-[#858585] hover:text-white cursor-pointer">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path></svg>
                            </div>
                            <div className="w-full flex justify-center py-3 text-[#858585] hover:text-white cursor-pointer">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"></path></svg>
                            </div>
                        </div>
                        <div className="w-full flex justify-center py-3 text-[#858585] hover:text-white cursor-pointer mb-2">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.79l.39-1.51M14.11 3.235l.39-1.51M10.125 20.308l-.39-1.51m4.352-16.79l-.39-1.51M13.25 20.81l-1.41-.512M12 3.702l-1.41-.512m-5.836 12.87l.39-1.51m10.124-5.266l.39-1.51m-8.457-3.077l-1.41-.513m14.095 5.13l-1.41-.513"></path></svg>
                        </div>
                    </div>
                    {/* Explorer Sidebar */}
                    <div className="w-64 bg-[#252526] flex flex-col flex-shrink-0 z-30 hidden lg:flex border-r border-[#1e1e1e]">
                        <div className="px-5 py-3 text-[#cccccc] text-[11px] mt-1 font-semibold tracking-wider flex justify-between items-center outline-none select-none">
                            EXPLORER
                            <MoreHorizontal size={14} className="cursor-pointer hover:text-white" />
                        </div>
                        <div className="px-1 flex-1 overflow-y-auto select-none">
                            <div className="flex items-center px-1 py-1 text-[#cccccc] text-sm cursor-pointer border border-transparent">
                                <ChevronDown size={16} className="mr-1" />
                                <span className="font-bold text-[12px] uppercase">CHATBOX_WORKSPACE</span>
                            </div>
                            <div className="pl-4">
                                <div className="flex items-center px-1 py-1 text-[#cccccc] text-[13px] hover:bg-[#2a2d2e] cursor-pointer">
                                    <ChevronRight size={16} className="mr-1 text-[#858585]" />
                                    <span>src</span>
                                </div>
                                <div className="flex items-center px-1 py-1 text-[#cccccc] text-[13px] hover:bg-[#2a2d2e] cursor-pointer">
                                    <ChevronRight size={16} className="mr-1 text-[#858585]" />
                                    <span>components</span>
                                </div>
                                <div className="flex items-center px-1 py-1 text-[#cccccc] text-[13px] hover:bg-[#2a2d2e] cursor-pointer">
                                    <ChevronDown size={16} className="mr-1 text-[#cccccc]" />
                                    <span>chats</span>
                                </div>
                                <div className="pl-3">
                                    <div className="flex items-center px-2 py-1 flex-1 bg-[#37373d] text-white text-[13px] cursor-pointer border-l-4 border-[#007acc] truncate text-[#569cd6]">
                                        <div className="mr-1.5 text-[10px] font-bold text-[#3178c6]">TS</div>
                                        <span className="truncate">Chat_{currentChat?.is_group ? currentChat?.group_name?.replace(/\s+/g, '_') : currentChat?.username?.replace(/\s+/g, '_')}.ts</span>
                                    </div>
                                    <div className="flex items-center px-2 py-1 text-[#cccccc] text-[13px] hover:bg-[#2a2d2e] cursor-pointer">
                                        <div className="mr-1.5 text-[10px] font-bold text-[#cbcb41]">JS</div>
                                        <span>api.js</span>
                                    </div>
                                    <div className="flex items-center px-2 py-1 text-[#cccccc] text-[13px] hover:bg-[#2a2d2e] cursor-pointer">
                                        <div className="mr-1.5 text-[10px] font-bold text-[#519aba]">CSS</div>
                                        <span>globals.css</span>
                                    </div>
                                    <div className="flex items-center px-2 py-1 text-[#cccccc] text-[13px] hover:bg-[#2a2d2e] cursor-pointer">
                                        <div className="mr-1.5 text-[10px] font-bold text-[#f55385]">{ }</div>
                                        <span>package.json</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {/* Main Content Area Wrapper */}
            <div className={`flex flex-col flex-1 h-full w-full relative min-w-0 ${currentChat?.theme === 'incognito' ? 'bg-[#1e1e1e]' : ''}`}>
                {/* Header */}
                {currentChat?.theme === 'incognito' ? (
                    <div>
                        <div className="flex bg-[#252526] h-[35px] w-full items-end overflow-hidden select-none">
                            <div className="flex items-center h-[35px] bg-[#1e1e1e] border-t-2 border-[#007acc] px-3 border-r border-[#2d2d2d] cursor-pointer min-w-fit relative group">
                                <div className="mr-1.5 text-[10px] font-bold text-[#3178c6]">TS</div>
                                <span className="text-[#cccccc] text-[13px] italic mr-2 group-hover:text-white">Chat_{currentChat?.is_group ? currentChat?.group_name?.replace(/\s+/g, '_') : currentChat?.username?.replace(/\s+/g, '_')}.ts</span>
                                <div className="text-[#858585] hover:bg-[#333333] hover:text-white rounded p-0.5 cursor-pointer ml-1">
                                    <X size={14} />
                                </div>
                            </div>
                            {/* Inactive Tab representation */}
                            <div className="flex items-center h-[35px] border-r border-[#2d2d2d] px-3 cursor-pointer min-w-fit hover:bg-[#2d2d2d] group transition-colors">
                                <div className="mr-1.5 text-[10px] font-bold text-[#cbcb41]">JS</div>
                                <span className="text-[#858585] text-[13px] mr-2 group-hover:text-[#cccccc]">api.js</span>
                            </div>
                        </div>
                        {/* Breadcrumbs */}
                        <div className="flex items-center px-4 h-[22px] bg-[#1e1e1e] border-b border-[#2d2d2d] text-[#858585] text-[12px] justify-between relative select-none">
                            <div className="flex items-center overflow-x-auto hide-scrollbar whitespace-nowrap">
                                <span className="hover:text-[#cccccc] cursor-pointer">CHATBOX_WORKSPACE</span>
                                <ChevronRight size={12} className="mx-0.5" />
                                <span className="hover:text-[#cccccc] cursor-pointer">src</span>
                                <ChevronRight size={12} className="mx-0.5" />
                                <span className="hover:text-[#cccccc] cursor-pointer">chats</span>
                                <ChevronRight size={12} className="mx-0.5" />
                                <span className="text-[#cccccc] flex items-center cursor-pointer">
                                    <div className="mr-1 text-[9px] font-bold text-[#3178c6]">TS</div>
                                    Chat_{currentChat?.is_group ? currentChat?.group_name?.replace(/\s+/g, '_') : currentChat?.username?.replace(/\s+/g, '_')}.ts
                                </span>
                            </div>
                            <div className="flex items-center gap-3 bg-[#1e1e1e] pl-2 z-10">
                                <button className="hover:text-[#cccccc] transition-colors" title="Split Editor Right">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18m6-18v18M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" /></svg>
                                </button>
                                <button
                                    onClick={() => setShowThemePicker(!showThemePicker)}
                                    className="hover:text-[#cccccc] transition-colors"
                                    title="Change Theme & Options"
                                >
                                    <Palette size={13} />
                                </button>
                                {showThemePicker && (
                                    <div className="absolute right-0 top-6 mt-1 w-48 bg-[#252526] border border-[#3c3c3c] shadow-2xl p-1 z-50 text-[#cccccc]">
                                        <h3 className="text-[10px] px-2 py-1 uppercase tracking-wider text-[#858585] mb-1">Chat Theme</h3>
                                        <div className="space-y-0.5">
                                            {['default', 'instagram', 'hacker', 'rose', 'ocean', 'incognito'].map(theme => (
                                                <button
                                                    key={theme}
                                                    onClick={() => handleThemeChange(theme)}
                                                    className={`w-full text-left px-2 py-1 text-[12px] flex items-center justify-between hover:bg-[#04395e] hover:text-white transition-colors border border-transparent ${currentChat?.theme === theme ? 'bg-[#37373d] border-[#007acc]' : ''}`}
                                                >
                                                    {theme === 'default' ? 'Classic Blue' : theme === 'incognito' ? 'Incognito Mode' : theme}
                                                </button>
                                            ))}
                                            <div className="h-[1px] bg-[#3c3c3c] my-1 mx-1"></div>
                                            <button
                                                onClick={handleClearChat}
                                                className="w-full text-left px-2 py-1 text-[12px] text-[#f48771] hover:bg-[#04395e] hover:text-white flex items-center gap-2 transition-colors"
                                            >
                                                <Trash2 size={12} /> Clear Chat
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
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
                                        {['default', 'instagram', 'hacker', 'rose', 'ocean', 'incognito'].map(theme => (
                                            <button
                                                key={theme}
                                                onClick={() => handleThemeChange(theme)}
                                                className={`w-full text-left px-3 py-2 rounded-xl text-sm capitalize flex items-center justify-between ${currentChat?.theme === theme ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}
                                            >
                                                {theme === 'default' ? 'Classic Blue' : theme === 'incognito' ? 'Incognito Mode' : theme}
                                                {currentChat?.theme === theme && <Check size={16} className="text-[var(--color-brand-primary)]" />}
                                            </button>
                                        ))}
                                        <div className="h-[1px] bg-white/10 my-1 mx-2"></div>
                                        <button
                                            onClick={handleClearChat}
                                            className="w-full text-left px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                                        >
                                            <Trash2 size={16} /> Clear Chat
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Messages Area - Incognito overriding background pattern and layout */}
                <div
                    className={`flex-1 overflow-y-auto px-4 md:px-8 z-10 flex flex-col gap-3 overflow-x-hidden transition-colors duration-300 relative ${currentChat?.theme === 'incognito' ? 'bg-[#1e1e1e] font-mono py-8' : 'chat-bg-pattern bg-[var(--color-brand-bg)] py-6'}`}
                    onScroll={handleScroll}
                >

                    {/* Blur Overlay when a message menu is open */}
                    {activeMenuId && currentChat?.theme !== 'incognito' && (
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-[40] transition-all duration-200"
                            onClick={() => { setActiveMenuId(null); setMenuRect(null); }}
                        />
                    )}

                    {/* Incognito Top Decoration */}
                    {currentChat?.theme === 'incognito' && messages.length > 0 && (
                        <div className="text-[#6a9955] text-sm mb-4 selection:bg-[#264f78]">
                        /** <br />
                            * @author {currentChat?.is_group ? currentChat?.group_name : currentChat?.username} <br />
                            * @description Secure communication channel established. <br />
                            * @timestamp {new Date().toISOString()} <br />
                            */
                        </div>
                    )}

                    {messages.map((msg, index) => {
                        const isMine = msg.sender_id === user?.id;
                        const isConsecutive = index > 0 && messages[index - 1].sender_id === msg.sender_id;
                        const isNextConsecutive = index < messages.length - 1 && messages[index + 1].sender_id === msg.sender_id;

                        const isFirstConsecutive = !isConsecutive;
                        const isLastConsecutive = !isNextConsecutive;

                        // Date Separator Logic
                        const msgDate = new Date(msg.created_at || new Date());
                        const prevMsgDate = index > 0 ? new Date(messages[index - 1].created_at || new Date()) : null;
                        const showDateSeparator = !prevMsgDate || msgDate.toDateString() !== prevMsgDate.toDateString();

                        // Bubble Border Radius Logic
                        let borderRadiusClass = 'rounded-[20px]';
                        if (isMine) {
                            if (isFirstConsecutive && isNextConsecutive) borderRadiusClass += ' rounded-br-[4px]';
                            else if (!isFirstConsecutive && isNextConsecutive) borderRadiusClass += ' rounded-tr-[4px] rounded-br-[4px]';
                            else if (!isFirstConsecutive && !isNextConsecutive) borderRadiusClass += ' rounded-tr-[4px]';
                            else borderRadiusClass += ' rounded-br-[4px]'; // Single message
                        } else {
                            if (isFirstConsecutive && isNextConsecutive) borderRadiusClass += ' rounded-bl-[4px]';
                            else if (!isFirstConsecutive && isNextConsecutive) borderRadiusClass += ' rounded-tl-[4px] rounded-bl-[4px]';
                            else if (!isFirstConsecutive && !isNextConsecutive) borderRadiusClass += ' rounded-tl-[4px]';
                            else borderRadiusClass += ' rounded-bl-[4px]'; // Single message
                        }

                        const isSwiping = swipingMessageId === msg.id;
                        const isActiveMenu = activeMenuId === msg.id;
                        const isIncognito = currentChat?.theme === 'incognito';

                        return (
                            <div key={msg.id || index} className={`flex w-full ${isIncognito ? 'mb-0 hover:bg-[#2a2d2e] group/line cursor-text' : 'flex-col mb-0.5'}`}>
                                {isIncognito && (
                                    <div className="w-[50px] flex-shrink-0 flex justify-end pr-[18px] text-[#858585] text-[13px] select-none pt-[1px] font-mono border-r border-transparent group-hover/line:text-[#c6c6c6]">
                                        {index + 1}
                                    </div>
                                )}
                                <div className={`flex flex-col flex-1 pl-1 ${isIncognito ? 'overflow-hidden' : ''}`}>
                                    {/* Date Separator Pill */}
                                    {showDateSeparator && !isIncognito && (
                                        <div className="flex justify-center my-4 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
                                            <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-medium text-white/80 border border-white/5 uppercase tracking-wide">
                                                {format(msgDate, 'dd MMM, yyyy')}
                                            </div>
                                        </div>
                                    )}

                                    {showDateSeparator && isIncognito && (
                                        <div className="text-[#6a9955] text-[13px] mt-1 mb-1 pl-2">
                                            {'// Session started: ' + format(msgDate, 'yyyy-MM-dd HH:mm')}
                                        </div>
                                    )}

                                    <div
                                        className={`flex relative message-bubble-container ${isMine ? (isIncognito ? 'justify-start' : 'justify-end') : 'justify-start'} ${isConsecutive && !showDateSeparator && !isIncognito ? '-mt-1' : ''}`}
                                        onTouchStart={isIncognito ? undefined : (e) => handleTouchStart(e, msg)}
                                        onTouchMove={isIncognito ? undefined : handleTouchMove}
                                        onTouchEnd={isIncognito ? undefined : () => handleTouchEnd(msg)}
                                        onContextMenu={isIncognito ? undefined : (e) => e.preventDefault()}
                                        style={isIncognito ? {} : { WebkitTouchCallout: 'none', userSelect: 'none' }}
                                    >
                                        {/* Reply Icon Indicator (revealed on swipe) */}
                                        {!isMine && !isIncognito && (
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
                                            className={`${isIncognito ? 'w-full px-2 py-[1px] text-[13px] tracking-tight whitespace-pre-wrap' : `max-w-[85%] md:max-w-[70%] px-4 py-2.5 text-[15px] leading-relaxed border border-white/5 shadow-md z-[1]`} relative group transition-all duration-200
                                        ${isMine && !isIncognito ? `bg-[var(--color-brand-bubble-me)] text-white ${borderRadiusClass}` : !isIncognito ? `bg-[var(--color-brand-bubble-other)] text-white ${borderRadiusClass}` : 'text-[#d4d4d4]'} 
                                        ${msg.is_deleted ? 'opacity-70 italic' : ''} 
                                        ${isActiveMenu && !isIncognito ? 'scale-[1.02] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[50] ring-1 ring-white/10' : ''}`}
                                            style={{
                                                transform: isSwiping && !isMine && !isIncognito ? `translateX(${swipeDistanceX}px)` : isActiveMenu && !isIncognito ? 'scale(1.02)' : 'translateX(0)',
                                                transition: isSwiping ? 'none' : 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                            }}
                                        >
                                            {!isMine && currentChat?.is_group && !isConsecutive && !isIncognito && (
                                                <div className="text-[12px] font-semibold text-[var(--color-brand-primary)] mb-0.5 opacity-90">
                                                    {msg.sender_name || 'Participant'}
                                                </div>
                                            )}

                                            {msg.is_forwarded && !isIncognito && (
                                                <div className="flex items-center text-[12px] text-white/70 italic mb-1 border-b border-white/10 pb-0.5">
                                                    <Forward size={12} className="mr-1" /> Forwarded
                                                </div>
                                            )}

                                            {msg.reply_to_id && !isIncognito && (
                                                <div className="bg-black/20 border-l-4 border-[var(--color-brand-primary)] rounded-md p-2 mb-2 text-sm mt-1">
                                                    <div className="font-semibold text-[var(--color-brand-primary)] text-xs mb-0.5">{msg.reply_to_username || 'User'}</div>
                                                    <div className="text-white/80 line-clamp-2 text-xs">{msg.reply_to_content || (msg.reply_to_media_url ? 'Media attached' : 'Deleted message')}</div>
                                                </div>
                                            )}

                                            {!msg.is_deleted && !isIncognito && (
                                                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            if (activeMenuId === msg.id) {
                                                                setActiveMenuId(null);
                                                                setMenuRect(null);
                                                            } else {
                                                                setActiveMenuId(msg.id);
                                                                const container = e.currentTarget.closest('.message-bubble-container');
                                                                if (container) setMenuRect(container.getBoundingClientRect());
                                                            }
                                                        }}
                                                        className="text-white/80 hover:text-white bg-black/10 rounded-full p-0.5 backdrop-blur-sm"
                                                    >
                                                        <ChevronDown size={18} />
                                                    </button>
                                                </div>
                                            )}

                                            {(msg.media_type === 'image' || (!msg.media_type && msg.media_url)) && msg.media_url && !isIncognito && (
                                                <img src={msg.media_url} alt="Media" className="rounded-xl mb-1 mt-1 max-w-full h-auto max-h-[300px] object-cover border border-white/10" />
                                            )}
                                            {msg.media_type === 'audio' && msg.media_url && !isIncognito && (
                                                <div className="mt-1 mb-2">
                                                    <audio controls src={msg.media_url} className="h-10 outline-none max-w-[200px] md:max-w-[250px]" />
                                                </div>
                                            )}
                                            {msg.media_type === 'document' && msg.media_url && !isIncognito && (
                                                <div className="mt-1 mb-2 flex items-center bg-black/20 p-3 rounded-xl border border-white/10">
                                                    <FileText size={24} className="mr-3 opacity-80" />
                                                    <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex-1 truncate font-medium max-w-[180px]">
                                                        {msg.content || 'Document'}
                                                    </a>
                                                </div>
                                            )}

                                            {msg.media_url && isIncognito && (
                                                <span className="text-[#d16969] italic">{"import { blob } from '" + msg.media_type + "'; "}</span>
                                            )}

                                            <div className={`flex flex-wrap items-end gap-3 ${isIncognito ? 'inline' : ''}`}>
                                                {msg.content && msg.media_type !== 'document' && (
                                                    <span className={`break-words whitespace-pre-wrap ${isIncognito ? 'inline' : 'flex-1'} ${msg.is_deleted && !isIncognito ? 'text-white/70 text-[15px]' : ''}`}>
                                                        {isIncognito ? (
                                                            isMine ? (
                                                                <><span className="text-[#569cd6]">const</span> <span className="text-[#4fc1ff]">_msg</span> = <span className="text-[#ce9178]">"{msg.content}"</span>;<span className="text-[#608b4e] ml-4 text-[11px]">{"// " + format(new Date(msg.created_at || new Date()), 'HH:mm')}{msg.status === 'read' ? ' [✓✓]' : ' [✓]'}</span></>
                                                            ) : (
                                                                <><span className="text-[#4ec9b0]">console</span>.<span className="text-[#dcdcaa]">log</span>(<span className="text-[#ce9178]">"{msg.content}"</span>);<span className="text-[#608b4e] ml-4 text-[11px]">{"// " + format(new Date(msg.created_at || new Date()), 'HH:mm')}</span></>
                                                            )
                                                        ) : msg.content}
                                                    </span>
                                                )}

                                                {!isIncognito && (
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
                                                )}
                                            </div>

                                            {msg.reactions && msg.reactions.length > 0 && !isIncognito && (
                                                <div className={`absolute -bottom-3 ${isMine ? 'right-4' : 'left-4'} bg-[#2C2C2E] border border-[#38383A] rounded-full px-2 py-0.5 text-[12px] flex items-center gap-1 shadow-md z-10`}>
                                                    {Array.from(new Set(msg.reactions.map((r: any) => r.reaction))).map((reaction: any) => (
                                                        <span key={reaction}>{reaction}</span>
                                                    ))}
                                                    <span className="text-white/60 font-semibold ml-0.5">{msg.reactions.length > 1 ? msg.reactions.length : ''}</span>
                                                </div>
                                            )}

                                            {msg.reactions && msg.reactions.length > 0 && isIncognito && (
                                                <span className="text-[#608b4e] text-[11px] ml-4 italic inline">
                                                    {"/* reacts: " + Array.from(new Set(msg.reactions.map((r: any) => r.reaction))).join('') + " */"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} className="h-4" />

                    {/* Scroll to Bottom FAB */}
                    {showScrollFAB && (
                        <div className="sticky bottom-4 w-full flex justify-end px-2 z-30 animate-[fadeIn_0.2s_ease-out]">
                            <button
                                onClick={scrollToBottom}
                                className="bg-[#2C2C2E]/90 backdrop-blur-md border border-white/10 rounded-full p-2.5 shadow-2xl text-[var(--color-brand-primary)] hover:bg-[#38383A] transition-all"
                            >
                                <ChevronDown size={24} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Dynamic Floating Context Menu */}
                {activeMenuId && menuRect && (
                    <div
                        className="fixed z-[60] flex flex-col gap-2 animate-[popIn_0.2s_ease-out_forwards]"
                        style={{
                            top: menuRect.bottom + 250 > window.innerHeight
                                ? Math.max(10, window.innerHeight - 250) // Nudge up if it clips bottom
                                : menuRect.bottom + 8, // Directly below message
                            ...(messages.find(m => m.id === activeMenuId)?.sender_id === user?.id
                                ? { right: Math.max(10, window.innerWidth - menuRect.right) } // Align to right (My message)
                                : { left: Math.max(10, menuRect.left) } // Align to left (Other's)
                            ),
                            maxWidth: 'calc(100vw - 20px)'
                        }}
                    >
                        {/* Reaction Emojis - Floating Row */}
                        <div className="flex gap-2 p-2 bg-[#2C2C2E]/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 self-end sm:self-auto">
                            {['👍', '❤️', '😂', '😮', '😢'].map((emoji, idx) => (
                                <button
                                    key={emoji}
                                    onClick={() => handleReaction(activeMenuId, emoji)}
                                    className="text-2xl hover:scale-125 transition-transform px-1 focus:outline-none animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]"
                                    style={{ animationDelay: `${idx * 0.04}s`, opacity: 0, animationFillMode: 'forwards' }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>

                        {/* Action Block */}
                        <div className="bg-[#2C2C2E]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-48 overflow-hidden">
                            {(() => {
                                const activeMsg = messages.find(m => m.id === activeMenuId);
                                if (!activeMsg) return null;
                                const isMine = activeMsg.sender_id === user?.id;

                                return (
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => { setReplyingTo(activeMsg); setActiveMenuId(null); setMenuRect(null); }}
                                            className="w-full px-4 py-3 text-left text-[14px] text-white hover:bg-[#38383A] flex items-center transition-colors"
                                        >
                                            <Reply size={18} className="mr-3 opacity-70 text-[var(--color-brand-primary)]" /> Reply
                                        </button>
                                        <div className="h-[1px] bg-white/5 w-full" />
                                        <button
                                            onClick={() => { setShowForwardModal(activeMsg); setActiveMenuId(null); setMenuRect(null); }}
                                            className="w-full px-4 py-3 text-left text-[14px] text-white hover:bg-[#38383A] flex items-center transition-colors"
                                        >
                                            <Forward size={18} className="mr-3 opacity-70 text-green-400" /> Forward
                                        </button>

                                        {isMine && (
                                            <>
                                                <div className="h-[1px] bg-white/5 w-full" />
                                                <button
                                                    onClick={() => { initiateEdit(activeMsg); setActiveMenuId(null); setMenuRect(null); }}
                                                    className="w-full px-4 py-3 text-left text-[14px] text-white hover:bg-[#38383A] flex items-center transition-colors"
                                                >
                                                    <Edit2 size={18} className="mr-3 opacity-70 text-blue-400" /> Edit
                                                </button>
                                                <div className="h-[1px] bg-white/5 w-full" />
                                                <button
                                                    onClick={() => { handleDeleteMessage(activeMenuId); setActiveMenuId(null); setMenuRect(null); }}
                                                    className="w-full px-4 py-3 text-left text-[14px] text-red-500 hover:bg-[#38383A] flex items-center transition-colors"
                                                >
                                                    <Trash2 size={18} className="mr-3 opacity-70 text-red-500" /> Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

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
                {currentChat?.theme === 'incognito' ? (
                    <div className="flex flex-col w-full bg-[#1e1e1e] border-t border-[#2d2d2d] select-none font-mono z-20">
                        {/* Terminal Panel Tabs */}
                        <div className="flex items-center px-4 h-[35px] text-[11px] font-medium tracking-wide space-x-6 text-[#858585] uppercase">
                            <span className="cursor-pointer hover:text-[#cccccc]">Problems</span>
                            <span className="cursor-pointer hover:text-[#cccccc]">Output</span>
                            <span className="cursor-pointer hover:text-[#cccccc]">Debug Console</span>
                            <span className="text-[#e7e7e7] border-b border-[#e7e7e7] h-[35px] flex items-center cursor-pointer">Terminal</span>
                            <span className="cursor-pointer hover:text-[#cccccc]">Ports</span>

                            <div className="ml-auto flex items-center space-x-3 text-[#cccccc]">
                                <span className="flex items-center cursor-pointer hover:text-white lowercase"><svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>bash</span>
                                <span className="cursor-pointer hover:text-white"><Trash2 size={13} /></span>
                                <span className="cursor-pointer hover:text-white"><ChevronDown size={16} /></span>
                                <span className="cursor-pointer hover:text-white"><X size={16} /></span>
                            </div>
                        </div>

                        {/* Terminal Input Row */}
                        <div className="px-4 py-2 pb-4 flex flex-col font-mono text-[13px] overflow-hidden cursor-text" onClick={() => document.getElementById('terminal-input')?.focus()}>
                            <div className="text-[#cccccc] mb-2 opacity-80">
                                Windows PowerShell<br />
                                Copyright (C) Microsoft Corporation. All rights reserved.<br /><br />
                                Install the latest PowerShell for new features and improvements! https://aka.ms/PSWindows
                            </div>
                            <div className="flex items-start w-full group">
                                <span className="text-[#858585] mt-[3px] mr-2 select-none">{"PS C:\\Users\\Dev\\CHATBOX_WORKSPACE>"}</span>
                                <form onSubmit={handleSendMessage} className="flex-1 flex group shadow-none min-h-[24px]">
                                    <textarea
                                        id="terminal-input"
                                        rows={1}
                                        value={newMessage}
                                        onChange={(e) => {
                                            handleTyping(e as any);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                if (newMessage.trim() || editingMessage) {
                                                    handleSendMessage(e as any);
                                                    e.currentTarget.style.height = 'auto';
                                                }
                                            }
                                        }}
                                        onPaste={handlePaste}
                                        placeholder=""
                                        className="flex-1 focus:outline-none resize-none overflow-y-auto leading-relaxed bg-transparent text-[#d4d4d4] py-0.5 min-h-[24px] max-h-[120px] hide-scrollbar caret-white"
                                    />
                                    {editingMessage && (
                                        <button
                                            type="button"
                                            onClick={() => { setEditingMessage(null); setNewMessage(''); }}
                                            className="ml-2 text-[#8E8E93] hover:text-white transition-colors p-1 self-start"
                                            title="Cancel Edit"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    <button type="submit" className="hidden">Submit</button>
                                </form>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="backdrop-blur-2xl px-2 sm:px-4 py-2 sm:py-3 pb-[env(safe-area-inset-bottom)] pb-4 sm:pb-6 flex flex-col z-20 w-full relative shadow-2xl bg-[var(--color-brand-bg)]/80 border-t border-[var(--color-brand-border)]">
                        {replyingTo && (
                            <div className="flex items-center justify-between bg-black/40 rounded-t-2xl px-4 py-2 mb-2 border-l-4 border-[var(--color-brand-primary)] text-sm shadow-md">
                                <div>
                                    <span className="font-semibold text-[var(--color-brand-primary)] text-xs block mb-0.5">Replying to {replyingTo.sender_name || 'User'}</span>
                                    <span className="text-white/80 line-clamp-1">{replyingTo.content || 'Media message'}</span>
                                </div>
                                <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white bg-white/10 rounded-full p-1"><X size={16} /></button>
                            </div>
                        )}

                        {canvasInvite && !isIncognito && (
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
                                                </button>
                                                <button onClick={() => { setShowAttachments(false); fileInputRef.current?.click(); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl transition-colors text-white text-sm font-medium">
                                                    <div className="bg-green-500/20 p-1.5 rounded-lg text-green-400"><ImageIcon size={18} /></div> Image
                                                </button>
                                                <input type="file" ref={documentInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleDocumentUpload} />
                                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            </div>
                                        )}
                                    </div>
                                    <form onSubmit={handleSendMessage} className={`flex-1 flex ml-1`}>
                                        <div className="w-full bg-white/5 backdrop-blur-md rounded-3xl px-4 py-2 sm:px-5 sm:py-2.5 shadow-inner border border-white/10 flex items-center min-h-[40px] sm:min-h-[44px] transition-colors focus-within:bg-white/10 focus-within:border-white/20">
                                            <textarea
                                                rows={1}
                                                value={newMessage}
                                                onChange={(e) => {
                                                    handleTyping(e as any);
                                                    // Auto-resize logic
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        if (newMessage.trim()) {
                                                            handleSendMessage(e as any);
                                                            // Reset height after sending
                                                            e.currentTarget.style.height = 'auto';
                                                        }
                                                    }
                                                }}
                                                onPaste={handlePaste}
                                                placeholder={editingMessage ? "Edit message..." : "Message (paste image here)..."}
                                                className="flex-1 outline-none text-white bg-transparent placeholder-[#8E8E93] text-[14px] sm:text-[15px] resize-none overflow-y-auto min-h-[24px] max-h-[120px] py-1 hide-scrollbar"
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
                )}

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
                </div>
            )}
        </div>
        </div >
    );
}
