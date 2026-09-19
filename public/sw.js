self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = typeof data.title === "string" ? data.title : "Wah Thali";
  const orderNumber = typeof data.orderNumber === "string" ? data.orderNumber : "";
  const url = typeof data.url === "string" ? data.url : "/admin/orders";
  const body = typeof data.body === "string" ? data.body : "New order received.";
  const tag = typeof data.tag === "string" ? data.tag : orderNumber ? `wah-thali-order-${orderNumber}` : "wah-thali-admin";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      icon: "/wah-thali-icon-192.png",
      badge: "/wah-thali-icon-192.png",
      vibrate: [180, 70, 180, 70, 240],
      data: { url, orderNumber },
      actions: orderNumber
        ? [
            { action: "accept", title: "Accept" },
            { action: "decline", title: "Decline" },
          ]
        : [],
    }),
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
