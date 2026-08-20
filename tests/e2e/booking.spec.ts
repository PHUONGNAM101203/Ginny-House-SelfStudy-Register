import { test, expect } from "@playwright/test"

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

  // First 08:00 free-slot cell in the grid (Monday, first desk of the
  // default branch, given a freshly-reset DB with no existing bookings).
  const freeCell = page.locator('.rbc-time-slot[class*="-08:00"]').first()
  await expect(freeCell).toBeVisible()
  await freeCell.click({ force: true })

  // The dialog title carries the resolved range that will be submitted, so
  // this asserts the click booked the slot that was actually clicked.
  await expect(page.getByRole("heading", { name: /Đăng ký Chỗ 1 — 08:00-08:30/ })).toBeVisible()

  await page.getByLabel("Họ tên").fill("Playwright Tester")
  await page.getByLabel("Số điện thoại").fill("0912345678")
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
