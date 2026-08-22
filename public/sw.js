// Minimal push-only service worker — no offline caching, no asset
// precaching. Its one job is turning a push message into a system
// notification and routing a click on that notification back into the app.

self.addEventListener("push", (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Ginny House", body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Ginny House", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.link ?? "/noi-bo/lich" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/noi-bo/lich"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus()
      }
      // No matching tab already open — new tabs land here even on a
      // same-origin client match miss (different path), so this only
      // fires when nothing at all was open.
      if (clients.length > 0 && "focus" in clients[0]) {
        clients[0].navigate(url)
        return clients[0].focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
