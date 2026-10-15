import { describe, it, expect } from 'vitest';
import { dashboardSalesQuerySchema } from '@/lib/validation/dashboard';
import {
  isValidIanaTimezone,
  getZonedInstant,
  getZonedDateParts,
  formatZonedIso,
  computePresetRange,
  resolveDateRange,
} from '@/lib/dashboard/timezone';

describe('STEP 11B: POS Sales Dashboard Validation & Timezone Boundary Tests', () => {
  describe('1. dashboardSalesQuerySchema', () => {
    it('should parse valid presets successfully', () => {
      const presets = ['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month'] as const;
      for (const preset of presets) {
        const parsed = dashboardSalesQuerySchema.parse({ preset });
        expect(parsed.preset).toBe(preset);
      }
    });

    it('should reject invalid preset values', () => {
      expect(() => dashboardSalesQuerySchema.parse({ preset: 'this_year' })).toThrow();
      expect(() => dashboardSalesQuerySchema.parse({ preset: 'all_time' })).toThrow();
      expect(() => dashboardSalesQuerySchema.parse({ preset: 'invalid' })).toThrow();
    });

    it('should parse valid ISO dates and calendar date strings', () => {
      const validDates = ['2026-10-12', '2026-10-12T14:30:00.000Z', '2026-10-12T20:00:00+05:30'];
      for (const d of validDates) {
        const parsed = dashboardSalesQuerySchema.parse({ dateFrom: d, dateTo: d });
        expect(parsed.dateFrom).toBe(d);
        expect(parsed.dateTo).toBe(d);
      }
    });

    it('should reject invalid date strings', () => {
      expect(() => dashboardSalesQuerySchema.parse({ dateFrom: 'not-a-date' })).toThrow();
      expect(() => dashboardSalesQuerySchema.parse({ dateTo: '2026-99-99' })).toThrow();
    });

    it('should parse valid branchId UUID and reject malformed UUIDs', () => {
      const validUuid = '12345678-1234-1234-1234-123456789abc';
      const parsed = dashboardSalesQuerySchema.parse({ branchId: validUuid });
      expect(parsed.branchId).toBe(validUuid);

      expect(() => dashboardSalesQuerySchema.parse({ branchId: 'not-a-uuid' })).toThrow();
      expect(() => dashboardSalesQuerySchema.parse({ branchId: '1234' })).toThrow();
    });

    it('should reject unexpected extra fields (strict schema)', () => {
      expect(() =>
        dashboardSalesQuerySchema.parse({
          preset: 'today',
          unexpectedField: 'hack',
        })
      ).toThrow();
    });
  });

  describe('2. Timezone Validation and IANA Support', () => {
    it('should validate standard and region-specific IANA timezones', () => {
      expect(isValidIanaTimezone('Asia/Kolkata')).toBe(true);
      expect(isValidIanaTimezone('America/New_York')).toBe(true);
      expect(isValidIanaTimezone('Europe/London')).toBe(true);
      expect(isValidIanaTimezone('UTC')).toBe(true);
      expect(isValidIanaTimezone('Invalid/Nonexistent_Timezone')).toBe(false);
    });

    it('should compute exact UTC instant for Asia/Kolkata (+05:30) calendar boundaries', () => {
      // Kolkata is UTC+5:30 (no DST).
      // 2026-10-12 00:00:00.000 IST == 2026-10-11 18:30:00.000 UTC
      const startOfDay = getZonedInstant('2026-10-12', '00:00:00.000', 'Asia/Kolkata');
      expect(startOfDay.toISOString()).toBe('2026-10-11T18:30:00.000Z');

      // 2026-10-12 23:59:59.999 IST == 2026-10-12 18:29:59.999 UTC
      const endOfDay = getZonedInstant('2026-10-12', '23:59:59.999', 'Asia/Kolkata');
      expect(endOfDay.toISOString()).toBe('2026-10-12T18:29:59.999Z');
    });

    it('should compute correct DST boundary instants for America/New_York (EDT vs EST)', () => {
      // In July: EDT is UTC-4.
      // 2026-07-01 00:00:00 EDT == 2026-07-01 04:00:00.000 UTC
      const summerStart = getZonedInstant('2026-07-01', '00:00:00.000', 'America/New_York');
      expect(summerStart.toISOString()).toBe('2026-07-01T04:00:00.000Z');

      // In January: EST is UTC-5.
      // 2026-01-01 00:00:00 EST == 2026-01-01 05:00:00.000 UTC
      const winterStart = getZonedInstant('2026-01-01', '00:00:00.000', 'America/New_York');
      expect(winterStart.toISOString()).toBe('2026-01-01T05:00:00.000Z');
    });

    it('should correctly format zoned ISO strings with local offset', () => {
      const instant = new Date('2026-10-11T18:30:00.000Z');
      const formatted = formatZonedIso(instant, 'Asia/Kolkata');
      expect(formatted).toBe('2026-10-12T00:00:00+05:30');
    });
  });

  describe('3. Preset Range Calculations', () => {
    // Reference instant: 2026-10-12 at 12:00:00 PM IST (06:30:00 UTC)
    const referenceInstant = new Date('2026-10-12T06:30:00.000Z');

    it('should compute preset today correctly', () => {
      const range = computePresetRange('today', 'Asia/Kolkata', referenceInstant);
      expect(range.startDate.toISOString()).toBe('2026-10-11T18:30:00.000Z');
      expect(range.endDate.toISOString()).toBe('2026-10-12T18:29:59.999Z');
      expect(range.startDateIso).toBe('2026-10-12T00:00:00+05:30');
      expect(range.endDateIso).toBe('2026-10-12T23:59:59+05:30');
    });

    it('should compute preset yesterday correctly', () => {
      const range = computePresetRange('yesterday', 'Asia/Kolkata', referenceInstant);
      // Yesterday is 2026-10-11 in Kolkata
      expect(range.startDate.toISOString()).toBe('2026-10-10T18:30:00.000Z');
      expect(range.endDate.toISOString()).toBe('2026-10-11T18:29:59.999Z');
      expect(range.startDateIso).toBe('2026-10-11T00:00:00+05:30');
    });

    it('should compute preset last_7_days correctly (7 calendar days)', () => {
      const range = computePresetRange('last_7_days', 'Asia/Kolkata', referenceInstant);
      // 6 days before Oct 12 is Oct 6
      expect(range.startDate.toISOString()).toBe('2026-10-05T18:30:00.000Z');
      expect(range.endDate.toISOString()).toBe('2026-10-12T18:29:59.999Z');
      expect(range.startDateIso).toBe('2026-10-06T00:00:00+05:30');
      expect(range.endDateIso).toBe('2026-10-12T23:59:59+05:30');
    });

    it('should compute preset this_month correctly (from 1st of month)', () => {
      const range = computePresetRange('this_month', 'Asia/Kolkata', referenceInstant);
      // Oct 1st start
      expect(range.startDate.toISOString()).toBe('2026-09-30T18:30:00.000Z');
      expect(range.endDate.toISOString()).toBe('2026-10-12T18:29:59.999Z');
      expect(range.startDateIso).toBe('2026-10-01T00:00:00+05:30');
      expect(range.endDateIso).toBe('2026-10-12T23:59:59+05:30');
    });
  });

  describe('4. Range Resolution & Precedence Rules', () => {
    const referenceInstant = new Date('2026-10-12T06:30:00.000Z');

    it('should give explicit dateFrom/dateTo precedence over preset', () => {
      const resolved = resolveDateRange(
        {
          dateFrom: '2026-10-01',
          dateTo: '2026-10-05',
          preset: 'today', // Should be ignored because explicit dates were supplied
        },
        'Asia/Kolkata',
        referenceInstant
      );

      expect(resolved.resolvedPreset).toBeNull();
      expect(resolved.startDate.toISOString()).toBe('2026-09-30T18:30:00.000Z'); // 2026-10-01 00:00 IST
      expect(resolved.endDate.toISOString()).toBe('2026-10-05T18:29:59.999Z'); // 2026-10-05 23:59 IST
    });

    it('should default to today preset when no parameters are provided', () => {
      const resolved = resolveDateRange({}, 'Asia/Kolkata', referenceInstant);
      expect(resolved.resolvedPreset).toBe('today');
      expect(resolved.startDate.toISOString()).toBe('2026-10-11T18:30:00.000Z');
      expect(resolved.endDate.toISOString()).toBe('2026-10-12T18:29:59.999Z');
    });

    it('should correctly expand single dateFrom to end of today', () => {
      const resolved = resolveDateRange(
        {
          dateFrom: '2026-10-10',
        },
        'Asia/Kolkata',
        referenceInstant
      );

      expect(resolved.startDate.toISOString()).toBe('2026-10-09T18:30:00.000Z'); // 2026-10-10 00:00 IST
      expect(resolved.endDate.toISOString()).toBe('2026-10-12T18:29:59.999Z'); // Today 2026-10-12 23:59 IST
    });
  });
});
