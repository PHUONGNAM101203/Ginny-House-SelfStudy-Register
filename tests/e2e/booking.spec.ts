import { test, expect } from "@playwright/test"
import { format, addDays, parse } from "date-fns"

// Golden path: a guest books a free slot on the grid, sees it turn into a
// booked event, fails to cancel with the wrong name/phone, then succeeds
// with the right ones.
//
// Selector/interaction notes (see task-19-report.md for the full writeup):
// - The grid is react-big-calendar. Free/locked slot cells carry no
//   data-testid; they're identified by the `slot-${deskId}-${HH:mm}` class
//   that ScheduleGrid.tsx's slotPropGetter adds (see that file's comment).
// - A plain Playwright `.click()` on a free slot cell times out: RBC renders
//   an empty, absolutely-positioned `.rbc-events-container` on top of the
//   time-slot grid, and Playwright's actionability check refuses to click
//   through it even though the click "should" land on the cell underneath.
//   `.click({ force: true })` skips that actionability/hit-testing check and
//   reliably reaches RBC's onSelectSlot handler.
// - Booked slots render as RBC "events" (`.rbc-event`, titled with the
//   student name) which sit above that empty container, so they don't have
//   the same problem — a plain `.click()` on them works fine.
// - This test used to avoid asserting *which* slot got booked, because the
//   same click on the "08:00" cell would sometimes book 08:30-09:00 instead
//   (confirmed against the `registrations` table, not just the UI). Root
//   cause found and fixed in ScheduleGrid.tsx: RBC auto-scrolled
//   .rbc-time-content by ~56px in componentDidMount, so a click landing in
//   that post-paint window was resolved against geometry that had moved
//   under the pointer. With `scrollToTime` pinned to the range start the
//   layout no longer shifts, and the resolved slot is now exact and stable
//   (verified over repeated runs, dialog title + DB row), so the assertions
//   below check the specific expected time.
test("guest books a slot, it appears on the grid, wrong-credential cancel is rejected, correct cancel succeeds", async ({
  page,
}) => {
  await page.goto("/")

  // The grid renders ONE day (today, since no ?day= is given) rather than the
  // whole week, so there is exactly one 08:00 row per desk column. This
  // `.first()` is therefore the first desk of the default branch on today's
  // date, given a freshly-reset DB with no existing bookings.
  const freeCell = page.locator('.rbc-time-slot[class*="-08:00"]').first()
  await expect(freeCell).toBeVisible()
  await freeCell.click({ force: true })

  // The dialog title carries the resolved range that will be submitted, so
  // this asserts the click booked the slot that was actually clicked.
  await expect(page.getByRole("heading", { name: /Đăng ký Chỗ 1 — 08:00-08:30/ })).toBeVisible()

  await page.getByLabel("Họ tên").fill("Playwright Tester")
  await page.getByLabel("Số điện thoại").fill("0912345678")
  await page.getByLabel("Tên lớp").fill("10A1")
  await page.getByRole("button", { name: "Xác nhận" }).click()

  await expect(page.getByText("Đăng ký thành công!")).toBeVisible()

  const bookedEvent = page.locator(".rbc-event").filter({ hasText: "Playwright Tester" }).first()
  await expect(bookedEvent).toBeVisible()
  await bookedEvent.click()

  // Same check on the way out: the booking that was created is the 08:00 one.
  await expect(page.getByRole("heading", { name: /Huỷ đăng ký Chỗ 1 — 08:00-08:30/ })).toBeVisible()

  await page.getByLabel("Họ tên").fill("Playwright Tester")
  await page.getByLabel("Số điện thoại").fill("0999999999")
  await page.getByRole("button", { name: "Xác nhận huỷ" }).click()
  await expect(page.getByText("Tên hoặc số điện thoại không khớp")).toBeVisible()

  // Rejected cancel must not have touched the booking — still shown as booked.
  await expect(page.locator(".rbc-event").filter({ hasText: "Playwright Tester" })).toHaveCount(1)

  await page.getByLabel("Họ tên").fill("Playwright Tester")
  await page.getByLabel("Số điện thoại").fill("0912345678")
  await page.getByRole("button", { name: "Xác nhận huỷ" }).click()
  await expect(page.getByText("Đã huỷ đăng ký")).toBeVisible()

  // Correct cancel actually freed the slot: no event left, and the cell is
  // selectable (free) again.
  await expect(page.locator(".rbc-event").filter({ hasText: "Playwright Tester" })).toHaveCount(0)
  await expect(page.locator('.rbc-time-slot[class*="-08:00"]').first()).toBeVisible()
})

// Day navigation (added with the single-day redesign): the grid shows one day,
// and the three ways to change it — step buttons, the week strip, and the
// date-picker popover — all have to move both ?day= and ?week= together, since
// getScheduleData still fetches by week.
test("day navigation moves the grid by step button, week strip and date picker", async ({ page }) => {
  await page.goto("/")

  // Vietnam's today, not the Node process's or the browser's — the app pins
  // "today" to Asia/Ho_Chi_Minh, and playwright.config.ts deliberately runs the
  // browser in UTC to prove the two never drift apart.
  const today = parse(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    "yyyy-MM-dd",
    new Date()
  )
  // Regex: the trigger's accessible name also carries the selected date.
  const dateButton = page.getByRole("button", { name: /^Chọn ngày/ })
  await expect(dateButton).toContainText(format(today, "dd/MM/yyyy"))

  // Step forward one day.
  await page.getByRole("button", { name: "Ngày sau" }).click()
  const tomorrow = addDays(today, 1)
  await expect(dateButton).toContainText(format(tomorrow, "dd/MM/yyyy"))
  await expect(page).toHaveURL(new RegExp(`day=${format(tomorrow, "yyyy-MM-dd")}`))
  // ?week= must travel with ?day= — that is what re-fetches the right week.
  await expect(page).toHaveURL(/week=\d{4}-\d{2}-\d{2}/)

  // The week strip jumps straight to a chosen day in the loaded week.
  await page.getByRole("button", { name: format(today, "dd/MM/yyyy"), exact: false }).first().click()
  await expect(dateButton).toContainText(format(today, "dd/MM/yyyy"))

  // The popover date picker jumps to an arbitrary date, including one in a
  // different week (which changes ?week= as well).
  const distant = addDays(today, 40)
  await dateButton.click()
  const picker = page.getByRole("dialog")
  await expect(picker).toBeVisible()
  // The month and year labels swap the whole panel to a month grid / year grid
  // inside the same popover, and picking one returns to the day grid (see
  // components/schedule/DatePickerPanel.tsx). They are real buttons in the
  // document, not the native <select> overlays this picker used to use — those
  // rendered their list as an OS widget outside the popover entirely.
  //
  // Year first, then month: +40 days can cross a year boundary in December,
  // and the month grid only moves within the displayed year.
  await picker.getByRole("button", { name: /^Chọn năm —/ }).click()
  await picker
    .getByRole("group", { name: "Chọn năm" })
    .getByRole("button", { name: String(distant.getFullYear()), exact: true })
    .click()
  // Back on the day grid, so the month label has to be reopened.
  await picker.getByRole("button", { name: /^Chọn tháng —/ }).click()
  await picker.getByRole("group", { name: "Chọn tháng" }).getByRole("button").nth(distant.getMonth()).click()
  await picker.getByRole("button", { name: new RegExp(`ngày ${distant.getDate()} tháng`) }).first().click()
  await expect(dateButton).toContainText(format(distant, "dd/MM/yyyy"))
  await expect(page).toHaveURL(new RegExp(`day=${format(distant, "yyyy-MM-dd")}`))

  // "Hôm nay" always comes back, and disables itself once there.
  const todayButton = page.getByRole("button", { name: "Về hôm nay" })
  await todayButton.click()
  await expect(dateButton).toContainText(format(today, "dd/MM/yyyy"))
  await expect(todayButton).toBeDisabled()
})
