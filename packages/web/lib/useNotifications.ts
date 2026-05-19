'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from './api';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export type NotificationItem = {
    id: string;
    title: string;
    message: string;
    ts: string;
    read: boolean;
    tone?: NotificationTone;
};

type UseNotificationsOptions = {
    onSyncDelta?: () => void;
    onExpiryWarning?: (item: NotificationItem) => void;
};

type UseNotificationsReturn = {
    items: NotificationItem[];
    toast: NotificationItem | null;
    status: 'connecting' | 'connected' | 'disconnected';
    unreadCount: number;
    clearToast: () => void;
    markAllRead: () => void;
};

const TOKEN_KEY = 'pharmabook_token';

function buildSocketUrl(token: string) {
    const baseUrl = API_URL.replace(/^http/, 'ws');
    return `${baseUrl}/ws?token=${encodeURIComponent(token)}`;
}

function createNotification(
    title: string,
    message: string,
    tone: NotificationTone = 'info'
): NotificationItem {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        message,
        ts: new Date().toISOString(),
        read: false,
        tone,
    };
}

export function useNotifications(
    options: UseNotificationsOptions = {}
): UseNotificationsReturn {
    const { onSyncDelta, onExpiryWarning } = options;

    const [items, setItems] = useState<NotificationItem[]>([]);
    const [toast, setToast] = useState<NotificationItem | null>(null);
    const [status, setStatus] =
        useState<UseNotificationsReturn['status']>('disconnected');

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<number | null>(null);
    const onSyncDeltaRef = useRef<UseNotificationsOptions['onSyncDelta']>();
    const onExpiryWarningRef = useRef<UseNotificationsOptions['onExpiryWarning']>();

    useEffect(() => {
        onSyncDeltaRef.current = onSyncDelta;
    }, [onSyncDelta]);

    useEffect(() => {
        onExpiryWarningRef.current = onExpiryWarning;
    }, [onExpiryWarning]);

    const pushNotification = useCallback((item: NotificationItem) => {
        setItems((prev) => [item, ...prev].slice(0, 20));
        setToast(item);
    }, []);

    const clearToast = useCallback(() => {
        setToast(null);
    }, []);

    const markAllRead = useCallback(() => {
        setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    }, []);

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);

        if (!token) {
            setStatus('disconnected');
            return;
        }

        let shouldReconnect = true;

        const connect = () => {
            if (!shouldReconnect) return;

            setStatus('connecting');

            const socket = new WebSocket(buildSocketUrl(token));
            socketRef.current = socket;

            socket.onopen = () => {
                setStatus('connected');

                // Do NOT push notification here.
                // Otherwise every reconnect creates repeated "WebSocket connected" notifications.
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'sync_delta') {
                        const item = createNotification(
                            'Dashboard updated',
                            'Latest sales or inventory changes received.',
                            'success'
                        );

                        pushNotification(item);
                        onSyncDeltaRef.current?.();
                        return;
                    }

                    if (data.type === 'expiry_warning') {
                        const item = createNotification(
                            'Expiry warning',
                            data.message || 'Some batches are close to expiry.',
                            'warning'
                        );

                        pushNotification(item);
                        onExpiryWarningRef.current?.(item);
                        return;
                    }

                    if (data.type === 'low_stock') {
                        const item = createNotification(
                            'Low stock alert',
                            data.message || 'Some medicines are below threshold.',
                            'warning'
                        );

                        pushNotification(item);
                        onSyncDeltaRef.current?.();
                        return;
                    }
                } catch {
                    const item = createNotification(
                        'Notification received',
                        String(event.data),
                        'info'
                    );

                    pushNotification(item);
                }
            };

            socket.onerror = () => {
                setStatus('disconnected');
            };

            socket.onclose = () => {
                setStatus('disconnected');

                if (shouldReconnect) {
                    reconnectTimerRef.current = window.setTimeout(() => {
                        connect();
                    }, 5000);
                }
            };
        };

        connect();

        return () => {
            shouldReconnect = false;

            if (reconnectTimerRef.current) {
                window.clearTimeout(reconnectTimerRef.current);
            }

            socketRef.current?.close();
        };
    }, [pushNotification]);

    const unreadCount = items.filter((item) => !item.read).length;

    return {
        items,
        toast,
        status,
        unreadCount,
        clearToast,
        markAllRead,
    };
}