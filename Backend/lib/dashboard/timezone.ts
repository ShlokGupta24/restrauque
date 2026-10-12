import { DashboardDatePreset } from '@/types/dashboard';

/**
 * Validates whether a timezone identifier is a recognized IANA timezone.
 */
export function isValidIanaTimezone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a calendar date string (YYYY-MM-DD) and local time string (HH:mm:ss.SSS)
 * in a specified IANA timezone into the exact UTC Date instant.
 *
 * Uses iterative convergence with native Intl.DateTimeFormat to accurately
 * handle any IANA timezone, non-hourly offsets (e.g. Asia/Kolkata +05:30),
 * and Daylight Saving Time (DST) forward/backward shifts.
 */
export function getZonedInstant(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hPart, mPart, sPartWithMs] = timeStr.split(':');
  const hh = Number(hPart);
  const mm = Number(mPart);
  const [sPart, msPart] = (sPartWithMs || '00.000').split('.');
  const ss = Number(sPart);
  const ms = msPart ? Number(msPart.padEnd(3, '0').slice(0, 3)) : 0;

  // Initial estimate assuming UTC
  let utcMillis = Date.UTC(y, m - 1, d, hh, mm, ss, ms);

  // Converge up to 3 iterations
  for (let iter = 0; iter < 3; iter++) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });

    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcMillis)).map((p) => [p.type, p.value])
    );

    const asLocal = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
      ms
    );

    const targetLocal = Date.UTC(y, m - 1, d, hh, mm, ss, ms);
    const diff = targetLocal - asLocal;

    if (diff === 0) {
      break;
    }
    utcMillis += diff;
  }

  return new Date(utcMillis);
}

/**
 * Extracts the calendar year, month, day, and YYYY-MM-DD representation
 * of a given instant in the specified IANA timezone.
 */
export function getZonedDateParts(
  instant: Date,
  timeZone: string
): { year: number; month: number; day: number; dateStr: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const dateStr = formatter.format(instant); // 'YYYY-MM-DD'
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d, dateStr };
}

/**
 * Formats a Date instant into an ISO 8601 string with the local timezone offset
 * of the target IANA timezone (e.g. '2026-10-12T00:00:00+05:30').
 */
export function formatZonedIso(instant: Date, timeZone: string): string {
  const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    partsFormatter.formatToParts(instant).map((p) => [p.type, p.value])
  );

  const localDateAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  const offsetMinutes = Math.round((localDateAsUtc - instant.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offH = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offM = String(absOffset % 60).padStart(2, '0');
  const offsetStr = `${sign}${offH}:${offM}`;

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offsetStr}`;
}

/**
 * Computes exact start and end Date instants for standard business presets
 * based on the restaurant's reporting timezone.
 */
export function computePresetRange(
  preset: DashboardDatePreset,
  timeZone: string,
  nowInstant: Date = new Date()
): { startDate: Date; endDate: Date; startDateIso: string; endDateIso: string } {
  const todayParts = getZonedDateParts(nowInstant, timeZone);
  const todayStr = todayParts.dateStr;

  let startStr: string;
  let endStr: string;

  switch (preset) {
    case 'today': {
      startStr = todayStr;
      endStr = todayStr;
      break;
    }
    case 'yesterday': {
      const yesterdayInstant = new Date(nowInstant.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayParts = getZonedDateParts(yesterdayInstant, timeZone);
      startStr = yesterdayParts.dateStr;
      endStr = yesterdayParts.dateStr;
      break;
    }
    case 'last_7_days': {
      // 6 days before today through today = 7 days
      const sixDaysAgo = new Date(nowInstant.getTime() - 6 * 24 * 60 * 60 * 1000);
      const sixParts = getZonedDateParts(sixDaysAgo, timeZone);
      startStr = sixParts.dateStr;
      endStr = todayStr;
      break;
    }
    case 'last_30_days': {
      // 29 days before today through today = 30 days
      const twentyNineDaysAgo = new Date(nowInstant.getTime() - 29 * 24 * 60 * 60 * 1000);
      const twentyNineParts = getZonedDateParts(twentyNineDaysAgo, timeZone);
      startStr = twentyNineParts.dateStr;
      endStr = todayStr;
      break;
    }
    case 'this_month': {
      const firstOfMonth = `${todayParts.year}-${String(todayParts.month).padStart(2, '0')}-01`;
      startStr = firstOfMonth;
      endStr = todayStr;
      break;
    }
    default: {
      startStr = todayStr;
      endStr = todayStr;
      break;
    }
  }

  const startDate = getZonedInstant(startStr, '00:00:00.000', timeZone);
  const endDate = getZonedInstant(endStr, '23:59:59.999', timeZone);

  return {
    startDate,
    endDate,
    startDateIso: formatZonedIso(startDate, timeZone),
    endDateIso: formatZonedIso(endDate, timeZone),
  };
}

/**
 * Parses user input date strings (either date-only 'YYYY-MM-DD' or full ISO strings)
 * and resolves the exact reporting window with validation.
 */
export function resolveDateRange(
  params: {
    dateFrom?: string;
    dateTo?: string;
    preset?: DashboardDatePreset;
  },
  timeZone: string,
  nowInstant: Date = new Date()
): {
  startDate: Date;
  endDate: Date;
  startDateIso: string;
  endDateIso: string;
  resolvedPreset: DashboardDatePreset | null;
} {
  const isDateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

  // Precedence rule:
  // If explicit dateFrom or dateTo are supplied, they take precedence over preset.
  if (params.dateFrom || params.dateTo) {
    const todayParts = getZonedDateParts(nowInstant, timeZone);
    const todayStr = todayParts.dateStr;

    let startDate: Date;
    let endDate: Date;

    if (params.dateFrom) {
      if (isDateOnlyRegex.test(params.dateFrom)) {
        startDate = getZonedInstant(params.dateFrom, '00:00:00.000', timeZone);
      } else {
        startDate = new Date(params.dateFrom);
      }
    } else {
      startDate = getZonedInstant(todayStr, '00:00:00.000', timeZone);
    }

    if (params.dateTo) {
      if (isDateOnlyRegex.test(params.dateTo)) {
        endDate = getZonedInstant(params.dateTo, '23:59:59.999', timeZone);
      } else {
        endDate = new Date(params.dateTo);
      }
    } else {
      endDate = getZonedInstant(todayStr, '23:59:59.999', timeZone);
    }

    return {
      startDate,
      endDate,
      startDateIso: formatZonedIso(startDate, timeZone),
      endDateIso: formatZonedIso(endDate, timeZone),
      resolvedPreset: null,
    };
  }

  // If preset is supplied, compute preset range
  if (params.preset) {
    const presetResult = computePresetRange(params.preset, timeZone, nowInstant);
    return {
      startDate: presetResult.startDate,
      endDate: presetResult.endDate,
      startDateIso: presetResult.startDateIso,
      endDateIso: presetResult.endDateIso,
      resolvedPreset: params.preset,
    };
  }

  // Default fallback: 'today'
  const defaultResult = computePresetRange('today', timeZone, nowInstant);
  return {
    startDate: defaultResult.startDate,
    endDate: defaultResult.endDate,
    startDateIso: defaultResult.startDateIso,
    endDateIso: defaultResult.endDateIso,
    resolvedPreset: 'today',
  };
}
