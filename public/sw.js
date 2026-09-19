self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = typeof data.title === "string" && data.title.trim()
    ? `Wah Thali - ${data.title.trim()}`
    : "Wah Thali - New Order Received";
  const orderNumber = typeof data.orderNumber === "string" ? data.orderNumber : "";
  const url = typeof data.url === "string" ? data.url : "/admin/orders";
  const body = typeof data.body === "string" && data.body.trim()
    ? data.body.trim()
    : orderNumber
      ? `Order ${orderNumber} is waiting. Expand this notification for Accept or Decline.`
      : "New order received. Open admin orders to review.";
  const tag = typeof data.tag === "string" ? data.tag : orderNumber ? `wah-thali-order-${orderNumber}` : "wah-thali-admin";
  const notificationData = { url, orderNumber, title, body, tag };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        tag,
        renotify: true,
        requireInteraction: true,
        silent: false,
        timestamp: Date.now(),
        icon: "/wah-thali-icon-192.png",
        badge: "/wah-thali-icon-192.png",
        vibrate: [180, 70, 180, 70, 240],
        data: notificationData,
        actions: orderNumber
          ? [
              { action: "accept", title: "Accept order" },
              { action: "decline", title: "Decline" },
            ]
          : [],
      }),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: "WAH_THALI_ADMIN_PUSH", ...notificationData });
        });
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const orderNumber = typeof data.orderNumber === "string" ? data.orderNumber : "";
  const fallbackUrl = typeof data.url === "string" ? data.url : "/admin/orders";
  const actionQuery = event.action === "accept" || event.action === "decline" ? `&pushAction=${event.action}` : "";
  const targetUrl = orderNumber
    ? `/admin/orders?order=${encodeURIComponent(orderNumber)}${actionQuery}`
    : fallbackUrl;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const absoluteUrl = new URL(targetUrl, self.location.origin).href;
      for (const client of clientList) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          return client.focus().then(() => client.navigate(absoluteUrl));
        }
      }
      return clients.openWindow(absoluteUrl);
    }),
  );
});
