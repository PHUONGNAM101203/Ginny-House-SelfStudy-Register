import { startOfWeek, addDays } from "date-fns"

export function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
