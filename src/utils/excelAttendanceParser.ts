import * as XLSX from 'xlsx';
import { AttendanceRecord, AttendanceStatus, ProjectFile } from '../types';

export interface ParseResult {
  fileName: string;
  monthYear: string; // e.g. "2026-08"
  daysInMonth: number;
  staffCount: number;
  customColumns: string[];
  records: AttendanceRecord[];
  rawEmployees: {
    id: string;
    name: string;
    department: string;
    dayPunches: Record<number, string[]>; // dayNumber -> list of timestamps e.g. ["06:47", "16:09"]
  }[];
}

interface ShiftPolicy {
  resumptionTime: string; // e.g. "08:00"
  closingTime: string; // e.g. "17:00"
  gracePeriodMinutes: number; // e.g. 15
}

const DEFAULT_POLICY: ShiftPolicy = {
  resumptionTime: '08:00',
  closingTime: '17:00',
  gracePeriodMinutes: 15,
};

/**
 * Extracts all valid HH:MM or HH:MM:SS timestamps from a string cell
 * Handles multiline cells like "06:47\n16:09\n16:09", space separated "06:47 16:09", etc.
 */
export function extractTimestampsFromCell(cellValue: any): string[] {
  if (cellValue === null || cellValue === undefined) return [];
  const text = String(cellValue).trim();
  if (!text) return [];

  // Match times like 06:47, 6:47, 18:02:15, 08:00 AM/PM
  const timeRegex = /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/g;
  const matches = text.match(timeRegex);
  if (!matches) return [];

  // Clean and format as HH:MM
  const uniqueTimes = Array.from(
    new Set(
      matches.map((t) => {
        const parts = t.split(':');
        const hh = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        return `${hh}:${mm}`;
      })
    )
  );

  // Sort chronologically
  uniqueTimes.sort((a, b) => a.localeCompare(b));
  return uniqueTimes;
}

/**
 * Converts HH:MM string to total minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hh, mm] = timeStr.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

/**
 * Formats difference in minutes as decimal hours (e.g., 9.3 hours)
 */
export function calculateHoursWorked(clockIn: string, clockOut: string): number {
  if (!clockIn || !clockOut || clockIn === '--:--' || clockOut === '--:--') return 0;
  let inMins = timeToMinutes(clockIn);
  let outMins = timeToMinutes(clockOut);

  // If night shift crosses midnight
  if (outMins < inMins) {
    outMins += 24 * 60;
  }

  const diffMins = outMins - inMins;
  if (diffMins <= 0) return 0;
  return Math.round((diffMins / 60) * 10) / 10;
}

/**
 * Checks if an attendance record has overtime beyond official shift closing time
 */
export function isRecordOvertime(
  clockOut: string,
  closingTime: string = '17:00'
): boolean {
  if (!clockOut || clockOut === '--:--') return false;
  const outMins = timeToMinutes(clockOut);
  const closingMins = timeToMinutes(closingTime);
  return outMins > closingMins;
}

/**
 * Determines attendance status based on shift rules (Primary Punctuality Category)
 */
export function determineAttendanceStatus(
  clockIn: string,
  clockOut: string,
  policy: ShiftPolicy = DEFAULT_POLICY
): AttendanceStatus {
  if (!clockIn || clockIn === '--:--') {
    if (clockOut && clockOut !== '--:--') return 'Early Departure';
    return 'Absent';
  }

  let inMins = timeToMinutes(clockIn);
  const resumMins = timeToMinutes(policy.resumptionTime);
  const lateThreshold = resumMins + policy.gracePeriodMinutes;

  // Handle overnight shifts crossing midnight (e.g. resumption 22:00, arrival 00:15)
  if (resumMins >= 18 * 60 && inMins < 12 * 60) {
    inMins += 24 * 60;
  }

  const workedHours = calculateHoursWorked(clockIn, clockOut);

  if (workedHours > 0 && workedHours < 4) {
    return 'Half Day';
  }

  if (inMins > lateThreshold) {
    return 'Late';
  }

  return 'On Time';
}

/**
 * Main parser function to parse Biometric Attendance Machine Export files (.xlsx, .xls, .csv, .tsv or raw text)
 */
export function parseBiometricAttendanceFile(
  fileData: ArrayBuffer | string,
  fileName: string,
  monthYear: string = '2026-08',
  policy: ShiftPolicy = DEFAULT_POLICY
): ParseResult {
  let worksheetRows: any[][] = [];

  if (typeof fileData === 'string') {
    // Delimited string or CSV text
    const lines = fileData.split(/\r?\n/);
    worksheetRows = lines.map((line) => {
      // Split by tab or comma if tab is present
      if (line.includes('\t')) return line.split('\t');
      // Simple CSV split handling quotes
      return line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((cell) => cell.replace(/^"|"$/g, ''));
    });
  } else {
    // ArrayBuffer from XLSX / CSV file upload
    const workbook = XLSX.read(fileData, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    worksheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  }

  if (!worksheetRows || worksheetRows.length === 0) {
    throw new Error('The uploaded file is empty or could not be parsed.');
  }

  // Find Header Row containing Employee ID or Name or Department
  let headerRowIndex = -1;
  let empIdColIdx = -1;
  let nameColIdx = -1;
  let deptColIdx = -1;
  const dayColMap: Record<number, number> = {}; // dayNumber (1..31) -> column index

  for (let r = 0; r < Math.min(15, worksheetRows.length); r++) {
    const row = worksheetRows[r];
    if (!row || !Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim().toLowerCase();

      if (
        empIdColIdx === -1 &&
        (cell.includes('employee id') || cell.includes('emp id') || cell === 'id' || cell === 'pin' || cell === 'no.')
      ) {
        empIdColIdx = c;
        headerRowIndex = r;
      }

      if (
        nameColIdx === -1 &&
        (cell.includes('name') || cell.includes('staff name') || cell.includes('full name') || cell === 'employee')
      ) {
        nameColIdx = c;
        headerRowIndex = r;
      }

      if (
        deptColIdx === -1 &&
        (cell.includes('department') || cell.includes('dept') || cell.includes('unit') || cell.includes('section'))
      ) {
        deptColIdx = c;
        headerRowIndex = r;
      }

      // Check if column header is a day number 1..31
      const cellNum = parseInt(cell, 10);
      if (!isNaN(cellNum) && cellNum >= 1 && cellNum <= 31) {
        dayColMap[cellNum] = c;
        headerRowIndex = r;
      }
    }

    if (empIdColIdx !== -1 && (nameColIdx !== -1 || Object.keys(dayColMap).length > 0)) {
      break;
    }
  }

  // Fallback default column indexes if header detection was partial
  if (empIdColIdx === -1) empIdColIdx = 0;
  if (nameColIdx === -1) nameColIdx = 1;
  if (deptColIdx === -1) deptColIdx = 2;

  // If no day columns detected, check columns starting after metadata
  if (Object.keys(dayColMap).length === 0 && headerRowIndex !== -1) {
    const headerRow = worksheetRows[headerRowIndex];
    for (let c = Math.max(empIdColIdx, nameColIdx, deptColIdx) + 1; c < headerRow.length; c++) {
      const val = parseInt(String(headerRow[c] || '').trim(), 10);
      if (!isNaN(val) && val >= 1 && val <= 31) {
        dayColMap[val] = c;
      }
    }
  }

  const detectedDays = Object.keys(dayColMap).map(Number).sort((a, b) => a - b);
  const maxDayInFile = detectedDays.length > 0 ? Math.max(...detectedDays) : 31;

  const rawEmployees: {
    id: string;
    name: string;
    department: string;
    dayPunches: Record<number, string[]>;
  }[] = [];

  const records: AttendanceRecord[] = [];
  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 1;

  for (let r = startRow; r < worksheetRows.length; r++) {
    const row = worksheetRows[r];
    if (!row || !Array.isArray(row)) continue;

    const rawEmpId = String(row[empIdColIdx] || '').trim();
    const rawName = String(row[nameColIdx] || '').trim();
    const rawDept = String(row[deptColIdx] || '').trim() || 'General';

    // Ignore empty/footer/summary rows
    if (!rawEmpId && !rawName) continue;
    if (rawEmpId.toLowerCase().includes('total') || rawName.toLowerCase().includes('total')) continue;

    const empId = rawEmpId || `EMP-${r}`;
    const empName = rawName || `Staff ${empId}`;

    const dayPunches: Record<number, string[]> = {};

    for (let d = 1; d <= maxDayInFile; d++) {
      const colIdx = dayColMap[d];
      if (colIdx !== undefined && colIdx < row.length) {
        const cellVal = row[colIdx];
        const timestamps = extractTimestampsFromCell(cellVal);
        dayPunches[d] = timestamps;

        let clockIn = '--:--';
        let clockOut = '--:--';

        if (timestamps.length >= 2) {
          clockIn = timestamps[0];
          clockOut = timestamps[timestamps.length - 1];
        } else if (timestamps.length === 1) {
          const singleTime = timestamps[0];
          const mins = timeToMinutes(singleTime);
          if (mins >= 13 * 60) {
            clockOut = singleTime;
          } else {
            clockIn = singleTime;
          }
        }

        const status = determineAttendanceStatus(clockIn, clockOut, policy);
        const hours = calculateHoursWorked(clockIn, clockOut);

        // Date string formatting YYYY-MM-DD
        const formattedDayStr = String(d).padStart(2, '0');
        const recordDate = `${monthYear}-${formattedDayStr}`;

        records.push({
          id: `rec-${empId}-${d}-${Date.now()}`,
          employeeId: empId,
          employeeName: empName,
          department: rawDept,
          shift: `Standard (${policy.resumptionTime} - ${policy.closingTime})`,
          date: recordDate,
          dayNumber: d,
          scheduledIn: policy.resumptionTime,
          clockIn: clockIn,
          clockOut: clockOut,
          totalHours: hours,
          status: status,
          notes: timestamps.length > 0 ? `Machine punches: ${timestamps.join(', ')}` : 'No punch recorded',
        });
      }
    }

    rawEmployees.push({
      id: empId,
      name: empName,
      department: rawDept,
      dayPunches,
    });
  }

  return {
    fileName: fileName.endsWith('.csv') || fileName.endsWith('.xlsx') ? fileName : `${fileName}.csv`,
    monthYear: monthYear,
    daysInMonth: maxDayInFile,
    staffCount: rawEmployees.length,
    customColumns: ['Employee ID', 'Full Name', 'Department', 'Shift'],
    records,
    rawEmployees,
  };
}
