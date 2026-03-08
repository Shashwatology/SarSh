"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

export interface User {
    id: number;
    username: string;
    phone: string;
    email: string;
    profile_picture: string;
    status: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Global axios defaults
export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const savedToken = Cookies.get('token');
        const savedUser = localStorage.getItem('user');

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
            subscribeToPushNotifications();
        }
        setLoading(false);
    }, []);

    const subscribeToPushNotifications = async () => {
        try {
            if ('serviceWorker' in navigator && 'PushManager' in window && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
                const registration = await navigator.serviceWorker.ready;

                // Ask for permission explicitly
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.log('Push notification permission denied.');
                    return;
                }

                // Check for existing subscription
                let subscription = await registration.pushManager.getSubscription();

                if (!subscription) {
                    // Subscribe if there isn't one
                    const convertedVapidKey = urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: convertedVapidKey
                    });
                }

                // Send to backend
                await api.post('/notifications/subscribe', { subscription });
                console.log('Successfully subscribed to push notifications');
            }
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
        }
    };

    // Helper to convert VAPID key
    function urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    const login = (newToken: string, userData: User) => {
        setToken(newToken);
        setUser(userData);
        Cookies.set('token', newToken, { expires: 7 });
        localStorage.setItem('user', JSON.stringify(userData));
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        subscribeToPushNotifications();
        router.push('/chats');
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        Cookies.remove('token');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];
        router.push('/login');
    };

    const checkAuth = async () => {
        try {
            const res = await api.get('/auth/me');
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
        } catch (err) {
            console.error('Failed to fetch updated user details', err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, checkAuth, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
