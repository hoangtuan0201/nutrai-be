/**
 * Date and timezone utilities standardized for Vietnam / Indochina time (Asia/Ho_Chi_Minh - UTC+7)
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Regex validating calendar date format YYYY-MM-DD
 */
export const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Retrieves the current calendar date in Asia/Ho_Chi_Minh timezone (YYYY-MM-DD).
 * Independent of the host server's local system timezone.
 */
export function getVietnamTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Retrieves the calendar date string (YYYY-MM-DD) in Asia/Ho_Chi_Minh timezone
 * for `daysAgo` days before today (0 = today, 1 = yesterday, etc.).
 */
export function getVietnamDateStringDaysAgo(daysAgo = 0): string {
  const todayStr = getVietnamTodayString();
  const [year, month, day] = todayStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day - daysAgo));
  return utcDate.toISOString().split('T')[0];
}

/**
 * Validates a YYYY-MM-DD date string strictly (rejecting invalid leap dates like 2026-02-31).
 */
export function validateDateString(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
}

/**
 * Converts a calendar date YYYY-MM-DD in Asia/Ho_Chi_Minh timezone
 * into an accurate UTC range [startUtc, endUtc] and a normalized UTC loggedDate for @db.Date.
 */
export function getVietnamDayRange(dateStr?: string): {
  dateString: string;
  startUtc: Date;
  endUtc: Date;
  loggedDate: Date;
} {
  const normalizedDateStr = dateStr?.trim() || getVietnamTodayString();

  if (!validateDateString(normalizedDateStr)) {
    throw new Error(`Invalid calendar date format: '${dateStr}'. Expected YYYY-MM-DD.`);
  }

  const [year, month, day] = normalizedDateStr.split('-').map(Number);

  // 00:00:00.000 at Asia/Ho_Chi_Minh (UTC+7) -> -7 hours to get UTC
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0 - 7, 0, 0, 0));

  // 23:59:59.999 at Asia/Ho_Chi_Minh (UTC+7)
  const endUtc = new Date(Date.UTC(year, month - 1, day, 23 - 7, 59, 59, 999));

  // Standard UTC Date for PostgreSQL @db.Date column
  const loggedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  return {
    dateString: normalizedDateStr,
    startUtc,
    endUtc,
    loggedDate,
  };
}
