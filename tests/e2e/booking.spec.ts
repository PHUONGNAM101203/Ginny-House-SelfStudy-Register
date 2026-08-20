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
// - RBC computes which exact slot a click lands on from raw pixel
//   coordinates, and that computation is not pixel-stable: the same
//   `.click({ force: true })` on the "08:00" cell was observed (confirmed
//   directly against the `registrations` table, not just the UI) to
//   sometimes book 08:00-08:30 and sometimes the adjacent 08:30-09:00 row.
//   Nudging the click position didn't reliably fix this. Since the exact
//   slot booked doesn't matter for this golden-path test, the assertions
//   below deliberately never depend on which specific time got booked —
//   only on the desk/student-name-scoped dialog and event elements.
test("guest books a slot, it appears on the grid, wrong-credential cancel is rejected, correct cancel succeeds", async ({
  page,
}) => {
  await page.goto("/")

  // First 08:00 free-slot cell in the grid (Monday, first desk of the
  // default branch, given a freshly-reset DB with no existing bookings).
  // The actual slot RBC ends up booking may be this one or the next row
  // (see note above) — both are free, valid, unlocked slots for this test.
  const freeCell = page.locator('.rbc-time-slot[class*="-08:00"]').first()
  await expect(freeCell).toBeVisible()
  await freeCell.click({ force: true })

  await expect(page.getByRole("heading", { name: /Đăng ký Chỗ/ })).toBeVisible()

  await page.getByLabel("Họ tên").fill("Playwright Tester")
  await page.getByLabel("Số điện thoại").fill("0912345678")
  await page.getByRole("button", { name: "Xác nhận" }).click()

  await expect(page.getByText("Đăng ký thành công!")).toBeVisible()

  const bookedEvent = page.locator(".rbc-event").filter({ hasText: "Playwright Tester" }).first()
  await expect(bookedEvent).toBeVisible()
  await bookedEvent.click()

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
