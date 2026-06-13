export const WEEKDAYS = [
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];

// "mon,tue,sat" → "Seg · Ter · Sáb"; empty/undefined means every day
export function formatDays(days?: string): string {
  if (!days) return "Todos os dias";
  const labels = days
    .split(",")
    .filter(Boolean)
    .map((k) => WEEKDAYS.find((w) => w.key === k)?.label ?? k);
  return labels.length ? labels.join(" · ") : "Todos os dias";
}
