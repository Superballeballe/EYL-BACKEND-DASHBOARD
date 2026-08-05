"use client";

import { Box, Stack, TextField, Typography } from "@mui/material";
import { WORK_DAY_END_TIME, WORK_DAY_START_TIME, workingHoursRangeLabel } from "@/lib/format";

function splitDateTime(value: string): { date: string; time: string } {
  const v = value.trim();
  if (!v) return { date: "", time: "" };
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m) return { date: m[1], time: m[2] };
  return { date: "", time: "" };
}

function joinDateTime(date: string, time: string): string {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

export default function ScheduleDateTimeField({
  label,
  value,
  onChange,
  min,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  helperText?: string;
}) {
  const { date, time } = splitDateTime(value);
  const minParts = splitDateTime(min ?? "");
  const timeMin =
    date && minParts.date && date === minParts.date && minParts.time
      ? minParts.time > WORK_DAY_START_TIME
        ? minParts.time
        : WORK_DAY_START_TIME
      : WORK_DAY_START_TIME;

  function update(part: "date" | "time", next: string) {
    const d = part === "date" ? next : date;
    const t = part === "time" ? next : time || "09:00";
    onChange(joinDateTime(d, t));
  }

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mb: 0.75, display: "block" }}>
        {label}
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          size="small"
          type="date"
          label="Date"
          value={date}
          onChange={(e) => update("date", e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: minParts.date ? { min: minParts.date } : undefined,
          }}
          sx={{ flex: 1.2 }}
        />
        <TextField
          size="small"
          type="time"
          label="Time"
          value={time}
          onChange={(e) => update("time", e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { step: 300, min: timeMin, max: WORK_DAY_END_TIME },
          }}
          sx={{ flex: 1 }}
        />
      </Stack>
      {helperText ? (
        <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
          {helperText}
        </Typography>
      ) : (
        <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
          Working hours: {workingHoursRangeLabel()}
        </Typography>
      )}
    </Box>
  );
}

export { joinDateTime, splitDateTime };
