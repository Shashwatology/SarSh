"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

interface CallContextType {
    callUser: (userId: number, isVideoCall: boolean, name: string) => void;
    answerCall: () => void;
    rejectCall: () => void;
    endCall: () => void;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    callData: any;
    isReceivingCall: boolean;
    isCaller: boolean;
    callAccepted: boolean;
    callEnded: boolean;
    toggleMute: () => void;
    toggleVideo: () => void;
    isMuted: boolean;
    isVideoOff: boolean;
}

const CallContext = createContext<CallContextType>({} as CallContextType);

// Using Google's public STUN servers for NAT traversal
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
    const { socket } = useSocket();
    const { user } = useAuth();

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [callData, setCallData] = useState<any>(null);
    const [isReceivingCall, setIsReceivingCall] = useState(false);
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [isCaller, setIsCaller] = useState(false);

    // Media controls
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const peerConnection = useRef<RTCPeerConnection | null>(null);

    const initPeerConnection = useCallback((toId: number) => {
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        const pc = new RTCPeerConnection(configuration);

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('ice_candidate', {
                    to: toId,
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        peerConnection.current = pc;
        return pc;
    }, [socket]);

    const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);

    useEffect(() => {
        if (!socket || !user) return;

        socket.on('incoming_call', (data: any) => {
            setIsReceivingCall(true);
            setCallData(data);
            setIsCaller(false);
            pendingIceCandidates.current = []; // Reset queue for new call
        });

        socket.on('call_accepted', async (signal) => {
            setCallAccepted(true);
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));

                // Flush buffered candidates
                pendingIceCandidates.current.forEach(async (c) => {
                    try {
                        if (peerConnection.current) {
                            await peerConnection.current.addIceCandidate(new RTCIceCandidate(c));
                        }
                    } catch (e) {
                        console.error('Error adding buffered ice candidate', e);
                    }
                });
                pendingIceCandidates.current = [];
            }
        });

        socket.on('call_rejected', () => {
            cleanupCall();
            alert('Call was rejected or user is busy.');
        });

        socket.on('call_ended', () => {
            cleanupCall();
        });

        socket.on('ice_candidate', async (data) => {
            if (peerConnection.current && peerConnection.current.remoteDescription) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.error('Error adding received ice candidate', e);
                }
            } else {
                // Buffer if connection or remote description isn't ready
                pendingIceCandidates.current.push(data.candidate);
            }
        });

        return () => {
            socket.off('incoming_call');
            socket.off('call_accepted');
            socket.off('call_rejected');
            socket.off('call_ended');
            socket.off('ice_candidate');
        };
    }, [socket, user]);

    const getMedia = async (video: boolean) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
            setLocalStream(stream);
            return stream;
        } catch (err) {
            console.error('Failed to get local stream', err);
            alert('Could not access camera/microphone.');
            return null;
        }
    };

    const callUser = async (userToCall: number, isVideoCall: boolean, name: string) => {
        const stream = await getMedia(isVideoCall);
        if (!stream) return;

        setCallData({ userToCall, isVideoCall, name });
        setIsCaller(true);
        setCallEnded(false);

        const pc = initPeerConnection(userToCall);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket?.emit('call_user', {
            userToCall,
            signalData: offer,
            from: user?.id,
            name: user?.username,
            isVideoCall
        });
    };

    const answerCall = async () => {
        const stream = await getMedia(callData.isVideoCall);
        if (!stream) return;

        setCallAccepted(true);

        const pc = initPeerConnection(callData.from);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(callData.signal));

        // Flush buffered candidates
        pendingIceCandidates.current.forEach(async (c) => {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (e) {
                console.error('Error adding buffered ice candidate during answer', e);
            }
        });
        pendingIceCandidates.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket?.emit('answer_call', {
            to: callData.from,
            signal: answer
        });
    };

    const rejectCall = () => {
        socket?.emit('reject_call', { to: callData.from });
        cleanupCall();
    };

    const endCall = () => {
        const toId = isCaller ? callData.userToCall : callData.from;
        socket?.emit('end_call', { to: toId });
        cleanupCall();
    };

    const cleanupCall = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        setLocalStream(null);
        setRemoteStream(null);
        setCallData(null);
        setIsReceivingCall(false);
        setCallAccepted(false);
        setCallEnded(true);
        setIsCaller(false);
        setIsMuted(false);
        setIsVideoOff(false);

        setTimeout(() => setCallEnded(false), 2000); // Reset after 2s
    };

    const toggleMute = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    return (
        <CallContext.Provider value={{
            callUser, answerCall, rejectCall, endCall,
            localStream, remoteStream, callData, isReceivingCall,
            isCaller, callAccepted, callEnded,
            toggleMute, toggleVideo, isMuted, isVideoOff
        }}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => useContext(CallContext);
