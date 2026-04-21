export function formatDateGrounding(timezone?: string): string {
  const tz = timezone || "UTC";
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = get("hour");
  const minute = get("minute");

  // Intl may return "24" for midnight in hour12:false — normalize to "00".
  if (hour === "24") hour = "00";

  return `Today is ${weekday}, ${year}-${month}-${day} (timezone: ${tz}) and now time is: ${hour}:${minute}.`;
}
