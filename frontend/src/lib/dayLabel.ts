export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function isYesterday(d: Date): boolean {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return isSameDay(d, y);
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonthDay(d: Date): string {
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function daySeparatorLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return formatMonthDay(d);
}
