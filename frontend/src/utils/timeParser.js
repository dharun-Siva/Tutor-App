// Robust start time parser used across components
export function parseStartTime(classItem) {
  const raw = classItem.startTime;

  if (raw && typeof raw === 'string') {
    const timeOnlyMatch = raw.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
    if (timeOnlyMatch) {
      const hours = parseInt(timeOnlyMatch[1], 10);
      const minutes = parseInt(timeOnlyMatch[2], 10);
      const baseDate = classItem.classDate ? new Date(classItem.classDate) : new Date();
      const dt = new Date(baseDate);
      dt.setHours(hours, minutes, 0, 0);
      return dt;
    }

    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  if (classItem.classDate) {
    const parsedClassDate = new Date(classItem.classDate);
    if (!isNaN(parsedClassDate.getTime())) return parsedClassDate;
  }

  return new Date(NaN);
}
