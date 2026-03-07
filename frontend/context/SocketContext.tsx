"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { token, user } = useAuth();

    useEffect(() => {
        if (!token || !user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000');

        newSocket.on('connect', () => {
            setIsConnected(true);
            newSocket.emit('setup', user.id);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
        });

        // Focus/Blur tracking
        const handleFocus = () => {
            newSocket.emit('update_presence', { userId: user.id, isOnline: true });
        };
        const handleBlur = () => {
            newSocket.emit('update_presence', { userId: user.id, isOnline: false });
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        setSocket(newSocket);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
            newSocket.disconnect();
        };
    }, [token, user]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
