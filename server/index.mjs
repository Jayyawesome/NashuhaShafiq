import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const app = express();
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const workbookPath = path.join(dataDir, "shua-rsvp.xlsx");
const publicWorkbookPath = "data/shua-rsvp.xlsx";
const sheetName = "RSVP Responses";
const headers = ["Timestamp", "Name", "Attendance", "Pax", "Phone", "Wish", "Source"];
const attendanceOptions = new Set(["Hadir", "Tidak Hadir", "Mungkin"]);

let writeQueue = Promise.resolve();

app.use(express.json({ limit: "16kb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

function cleanString(value, maxLength, label, required = false) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (required && normalized.length === 0) {
    throw new Error(`${label} diperlukan.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} mesti ${maxLength} aksara atau kurang.`);
  }
  return normalized;
}

function normalizeSubmissionInput(body) {
  const name = cleanString(body.name, 80, "Nama", true);
  const phone = cleanString(body.phone, 30, "No telefon");
  const wish = cleanString(body.wish, 240, "Ucapan");
  const attendance = cleanString(body.attendance, 20, "Kehadiran", true);
  if (!attendanceOptions.has(attendance)) {
    throw new Error("Pilihan kehadiran tidak sah.");
  }

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

function toWorkbookCell(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function fromWorkbookCell(value) {
  const text = String(value ?? "");
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readSubmissionsFromWorkbook() {
  if (!fs.existsSync(workbookPath)) return [];
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
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

function writeSubmissionsToWorkbook(submissions) {
  ensureDataDir();
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

function recentFirst(submissions) {
  return [...submissions].reverse().slice(0, 20);
}

function enqueueWrite(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

app.get("/api/rsvp", (_req, res) => {
  const submissions = readSubmissionsFromWorkbook();
  res.json({ submissions: recentFirst(submissions), workbook: publicWorkbookPath });
});

app.post("/api/rsvp", async (req, res) => {
  try {
    const submission = normalizeSubmissionInput(req.body ?? {});
    const result = await enqueueWrite(() => {
      const submissions = readSubmissionsFromWorkbook();
      submissions.push(submission);
      writeSubmissionsToWorkbook(submissions);
      return { submission, submissions: recentFirst(submissions), workbook: publicWorkbookPath };
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "RSVP tidak dapat dihantar.",
    });
  }
});

const distDir = path.join(projectRoot, "dist");
app.use(express.static(distDir));

app.get(/^(?!\/api).*/, (_req, res) => {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    res.status(404).send("Build output not found. Run npm run build first.");
    return;
  }
  res.sendFile(indexPath);
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Shua RSVP server running at http://127.0.0.1:${port}`);
});
