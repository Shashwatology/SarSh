self.addEventListener('push', function (event) {
    const data = JSON.parse(event.data.text());
    event.waitUntil(
        registration.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: { url: data.url }
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            const url = event.notification.data.url || '/chats';
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus().then(() => {
                    // if already open to the exact URL, do nothing, otherwise navigate
                    if (client.url !== url && 'navigate' in client) {
                        client.navigate(url);
                    }
                });
            }
            return clients.openWindow(url);
        })
    );
});
