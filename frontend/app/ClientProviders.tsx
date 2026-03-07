"use client";

import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { CallProvider } from '@/context/CallContext';
import CallComponent from '@/components/CallComponent';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SocketProvider>
                <CallProvider>
                    {children}
                    <CallComponent />
                </CallProvider>
            </SocketProvider>
        </AuthProvider>
    );
}


