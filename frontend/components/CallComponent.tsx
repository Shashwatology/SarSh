"use client";

import React, { useEffect, useRef } from 'react';
import { useCall } from '@/context/CallContext';
import { PhoneIncoming, Mic, MicOff, Video, VideoOff, Phone, X, PhoneMissed } from 'lucide-react';

export default function CallComponent() {
    const {
        isReceivingCall, callAccepted, callData, answerCall, rejectCall, endCall,
        localStream, remoteStream, isMuted, isVideoOff, toggleMute, toggleVideo,
        callEnded, isCaller
    } = useCall();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Audio context for ringing sound
    const audioCtxRef = useRef<AudioContext | null>(null);
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const playRingtone = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const playBeep = () => {
            if (!audioCtxRef.current) return;
            const osc = audioCtxRef.current.createOscillator();
            const gainNode = audioCtxRef.current.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, audioCtxRef.current.currentTime); // A4 note
            osc.frequency.setValueAtTime(480, audioCtxRef.current.currentTime + 0.1); // slight warble

            gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioCtxRef.current.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.5, audioCtxRef.current.currentTime + 1.2);
            gainNode.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 1.5);

            osc.connect(gainNode);
            gainNode.connect(audioCtxRef.current.destination);

            osc.start(audioCtxRef.current.currentTime);
            osc.stop(audioCtxRef.current.currentTime + 1.5);

            oscillatorRef.current = osc;
            gainNodeRef.current = gainNode;
        };

        playBeep();
        ringIntervalRef.current = setInterval(playBeep, 2500); // Repeat every 2.5 seconds
    };

    const stopRingtone = () => {
        if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current);
            ringIntervalRef.current = null;
        }
        if (oscillatorRef.current) {
            try { oscillatorRef.current.stop(); } catch (e) { }
            oscillatorRef.current = null;
        }
    };

    // Manage Ringtone lifecycle
    useEffect(() => {
        if (isReceivingCall && !callAccepted) {
            playRingtone();
        } else {
            stopRingtone();
        }

        return () => {
            stopRingtone();
        };
    }, [isReceivingCall, callAccepted]);

    // Auto-play streams when they are set
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // Render incoming call overlay
    if (isReceivingCall && !callAccepted) {
        return (
            <div className="fixed top-10 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-sm">
                <div className="bg-[#2C2C2E] border border-[#38383A] rounded-3xl p-4 shadow-2xl flex items-center justify-between text-white animate-bounce">
                    <div className="flex items-center">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-pulse mr-3 shadow-lg shadow-green-500/30">
                            <PhoneIncoming size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">{callData?.name || 'Someone'}</h3>
                            <p className="text-sm text-gray-400">is calling you {callData?.isVideoCall ? '(Video)' : '(Audio)'}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                        <button onClick={rejectCall} className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                            <PhoneMissed size={20} className="text-white" />
                        </button>
                        <button onClick={answerCall} className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors shadow-md">
                            <Phone size={20} className="text-white" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Render active call interface
    if (callAccepted || (isCaller && !callEnded)) {
        const isVideo = callData?.isVideoCall;

        return (
            <div className={`fixed inset-0 z-[100] bg-black ${isVideo ? '' : 'bg-opacity-90 backdrop-blur-md'} flex flex-col`}>
                {/* Header */}
                <div className="p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="text-white">
                        <h2 className="text-2xl font-bold">{callData?.name || 'User'}</h2>
                        <p className="text-green-400 font-medium tracking-wider text-sm">{callAccepted ? '00:00' : 'Calling...'}</p>
                    </div>
                </div>

                {/* Video Streams */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                    {/* Remote Video (Full Screen if Video Call) */}
                    {remoteStream && isVideo ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover absolute inset-0"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center">
                            <div className="w-32 h-32 bg-[#38383A] rounded-full flex items-center justify-center shadow-2xl mb-6 shadow-[var(--color-brand-primary)]/20">
                                <span className="text-5xl text-white font-light">{callData?.name?.charAt(0).toUpperCase() || '?'}</span>
                            </div>
                            {/* Hidden audio element for remote stream */}
                            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
                        </div>
                    )}

                    {/* Local Video (Floating Thumbnail if Video Call) */}
                    {localStream && isVideo && (
                        <div className="absolute bottom-28 right-6 w-32 h-48 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-20">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="p-8 pb-12 w-full flex justify-center gap-6 z-10 bg-gradient-to-t from-black to-transparent mt-auto">
                    <button
                        onClick={toggleMute}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isMuted ? 'bg-white text-black' : 'bg-[#38383A]/80 backdrop-blur-sm text-white hover:bg-[#48484A]'}`}
                    >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>

                    {isVideo && (
                        <button
                            onClick={toggleVideo}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isVideoOff ? 'bg-white text-black' : 'bg-[#38383A]/80 backdrop-blur-sm text-white hover:bg-[#48484A]'}`}
                        >
                            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                        </button>
                    )}

                    <button
                        onClick={endCall}
                        className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all transform hover:scale-105 shadow-xl shadow-red-500/30"
                    >
                        <Phone size={28} className="text-white transform rotate-[135deg]" />
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
