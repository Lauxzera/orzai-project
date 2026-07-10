import { z } from "zod";

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário deve estar no formato HH:MM");

const timeRange = z
  .object({ start: timeString, end: timeString })
  .refine((range) => range.start < range.end, { message: "O horário inicial deve ser antes do final." });

export const businessHoursSchema = z.object({
  slotMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(120),
  weekly: z.record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(timeRange).max(6)),
});

export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
