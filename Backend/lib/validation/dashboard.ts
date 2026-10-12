import { z } from 'zod';
import { DashboardDatePreset } from '@/types/dashboard';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dashboardPresetEnum = z.enum(
  ['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month'],
  {
    errorMap: () => ({
      message: 'Preset must be one of: today, yesterday, last_7_days, last_30_days, this_month',
    }),
  }
);

export const dashboardSalesQuerySchema = z
  .object({
    dateFrom: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid dateFrom: must be a valid ISO date or timestamp',
      })
      .optional(),
    dateTo: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid dateTo: must be a valid ISO date or timestamp',
      })
      .optional(),
    preset: dashboardPresetEnum.optional(),
    branchId: z
      .string()
      .regex(uuidRegex, 'Invalid branchId: must be a valid UUID')
      .optional(),
  })
  .strict();

export type DashboardSalesQueryValidated = z.infer<typeof dashboardSalesQuerySchema>;
