// All times in the prototype are naive local strings ("YYYY-MM-DD" / "YYYY-MM-DDTHH:mm")
// so the simulated demo clock and the real clock behave identically.

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toStamp(d: Date): string {
  return `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const hm = s.length > 10 ? s.slice(11, 16).split(":").map(Number) : [0, 0];
  return new Date(y, m - 1, d, hm[0], hm[1]);
}

export function isWeekend(d: Date) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function nextWorkingDay(date: string): string {
  let d = addDays(date, 1);
  while (isWeekend(parseDate(d))) d = addDays(d, 1);
  return d;
}

export function previousWorkingDay(date: string): string {
  let d = addDays(date, -1);
  while (isWeekend(parseDate(d))) d = addDays(d, -1);
  return d;
}

export function workingDaysBefore(date: string, count: number): string[] {
  const out: string[] = [];
  let d = date;
  while (out.length < count) {
    d = previousWorkingDay(d);
    out.unshift(d);
  }
  return out;
}

export function minutesBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 60000);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(s: string, long = false): string {
  const d = parseDate(s);
  return long
    ? `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
    : `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtShort(s: string): string {
  const d = parseDate(s);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export function fmtTime(stamp: string | null): string {
  if (!stamp) return "—";
  return stamp.slice(11, 16);
}

export function fmtStamp(stamp: string | null): string {
  if (!stamp) return "—";
  return `${fmtDate(stamp)} ${fmtTime(stamp)}`;
}

export function fmtDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h`;
  if (h === 0) return `${m} min`;
  return `${h} h ${pad(m)} min`;
}
