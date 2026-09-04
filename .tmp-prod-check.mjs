// Uses the PUBLIC anon key from the production site itself — exactly the
// access any visitor's browser has. If the hole were still open this would
// insert rows; it must now return 0.
const URL = process.env.SUPA_URL, KEY = process.env.SUPA_ANON
async function rpc(fn, body) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.text() }
}
function monday(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000)
  const iso = ((d.getUTCDay() + 6) % 7)
  d.setUTCDate(d.getUTCDate() - iso)
  return d.toISOString().slice(0, 10)
}
for (const [label, day] of [
  ["1 năm trước", monday(-365)],
  ["3 năm sau", monday(365 * 3)],
  ["tuần này", monday(0)],
]) {
  const r = await rpc("materialize_recurring_registrations", { p_week_start: day })
  console.log(`  ${label.padEnd(14)} ${day}  ->  HTTP ${r.status}  ${r.body.slice(0, 40)}`)
}
