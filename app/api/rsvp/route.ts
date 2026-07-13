import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

XLSX.set_fs(fs);

const sheetName = "RSVP Responses";
const publicWorkbookPath = "data/shua-rsvp.xlsx";
const headers = ["Timestamp", "Name", "Attendance", "Pax", "Phone", "Wish", "Source"];
const attendanceOptions = new Set(["Hadir", "Tidak Hadir", "Mungkin"]);
const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "nashuha-shafiq")
  : path.join(process.cwd(), "data");
const workbookPath = path.join(dataDir, "shua-rsvp.xlsx");
const noStoreHeaders = { "Cache-Control": "no-store" };

type Submission = {
  timestamp: string;
  name: string;
  attendance: string;
  pax: number;
  phone: string;
  wish: string;
  source: string;
};

let writeQueue = Promise.resolve();

function cleanString(value: unknown, maxLength: number, label: string, required = false) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (required && normalized.length === 0) throw new Error(`${label} diperlukan.`);
  if (normalized.length > maxLength) throw new Error(`${label} mesti ${maxLength} aksara atau kurang.`);
  return normalized;
}

function normalizeSubmissionInput(body: Record<string, unknown>): Submission {
  const name = cleanString(body.name, 80, "Nama", true);
  const phone = cleanString(body.phone, 30, "No telefon");
  const wish = cleanString(body.wish, 240, "Ucapan");
  const attendance = cleanString(body.attendance, 20, "Kehadiran", true);
  if (!attendanceOptions.has(attendance)) throw new Error("Pilihan kehadiran tidak sah.");

  const pax = Number(body.pax);
  if (!Number.isInteger(pax) || pax < 1 || pax > 10) {
    throw new Error("Jumlah pax mesti antara 1 hingga 10.");
  }

  return {
    timestamp: new Date().toISOString(),
    name,
    attendance,
    pax,
    phone,
    wish,
    source: "Excel API",
  };
}

function toWorkbookCell(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function fromWorkbookCell(value: unknown) {
  const text = String(value ?? "");
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function readSubmissionsFromWorkbook(): Submission[] {
  if (!fs.existsSync(workbookPath)) return [];
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
  return rows.map((row) => ({
    timestamp: fromWorkbookCell(row.Timestamp),
    name: fromWorkbookCell(row.Name),
    attendance: fromWorkbookCell(row.Attendance),
    pax: Number(row.Pax) || 1,
    phone: fromWorkbookCell(row.Phone),
    wish: fromWorkbookCell(row.Wish),
    source: fromWorkbookCell(row.Source),
  }));
}

function writeSubmissionsToWorkbook(submissions: Submission[]) {
  fs.mkdirSync(dataDir, { recursive: true });
  const rows = submissions.map((submission) => [
    toWorkbookCell(submission.timestamp),
    toWorkbookCell(submission.name),
    toWorkbookCell(submission.attendance),
    submission.pax,
    toWorkbookCell(submission.phone),
    toWorkbookCell(submission.wish),
    toWorkbookCell(submission.source),
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, workbookPath);
}

function recentFirst(submissions: Submission[]) {
  return [...submissions].reverse().slice(0, 20);
}

function enqueueWrite<T>(task: () => T | Promise<T>) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

export async function GET() {
  try {
    const submissions = readSubmissionsFromWorkbook();
    return NextResponse.json(
      { submissions: recentFirst(submissions), workbook: publicWorkbookPath },
      { headers: noStoreHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Senarai RSVP tidak dapat dibaca." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const submission = normalizeSubmissionInput(body);
    const result = await enqueueWrite(() => {
      const submissions = readSubmissionsFromWorkbook();
      submissions.push(submission);
      writeSubmissionsToWorkbook(submissions);
      return {
        submission,
        submissions: recentFirst(submissions),
        workbook: publicWorkbookPath,
      };
    });
    return NextResponse.json(result, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RSVP tidak dapat dihantar." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
