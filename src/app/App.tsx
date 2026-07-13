import { Fragment, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  MapPin,
  Phone,
  Calendar,
  Heart,
  Music,
  Mail,
  Gift,
  Clock,
  Navigation,
  MessageSquare,
  Play,
  Pause,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { PersistentAudioPlayer } from "../components/PersistentAudioPlayer";
import type { AudioControllerHandle, AudioPlaybackState, AudioProgress } from "../components/PersistentAudioPlayer";
import { attendanceOptions, seedWishes } from "../lib/rsvp";
import type { AttendanceStatus, RsvpSubmission } from "../lib/rsvp";

// ─── Constants ────────────────────────────────────────────────────────────────
const musicSrc = "/lagu-pernikahan-kita.mp3";
const musicStartAt = 0;
const musicTimelineOffset = 113;
const musicTitle = "Lagu Pernikahan Kita";
const musicArtist = "Tiara Andini & Arsy Widianto";
const eventDateTime = "2026-08-22T12:00:00+08:00";

const eventDetails = {
  title: "Majlis Perkahwinan Nashuha & Shafiq",
  dateISO: "2026-08-22",
  dateLabel: "Sabtu, 22 Ogos 2026",
  startTime: "12:00",
  endTime: "16:00",
  timeLabel: "12 tengah hari - 4 petang",
  venueName: "Kulim Golf Resort & Country",
  venueAddress: "Persiaran Kulim Golf, Kulim Hi-Tech Park, 09000 Kulim, Kedah",
};

const contacts = [
  { name: "Sarina Mat Din", relation: "Ibu", phone: "0194778469" },
  { name: "Jeffri Mat Jaafar", relation: "Bapa", phone: "0135895304" },
  { name: "Fatin Syazwani Jeffri", relation: "Kakak", phone: "0194013804" },
];

const giftDetails = {
  title: "Money Gift",
  recipient: "Fatin Nashuha Binti Jeffri",
  bank: "Maklumat akaun akan dikemaskini",
  note: "Untuk hadiah atau pertanyaan, sila hubungi pihak keluarga melalui WhatsApp.",
};

const fontStyle = `
  .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
  .font-greatvibes { font-family: 'Great Vibes', cursive; }
  .font-montserrat { font-family: 'Montserrat', sans-serif; }
  html, body { margin: 0; padding: 0; overflow-x: hidden; background: #2f0714; }
  ::-webkit-scrollbar { width: 0px; }
`;

type DockPanel = "time" | "location" | "rsvp" | "gift" | "contact" | "music";
type RsvpFormState = { name: string; attendance: AttendanceStatus; pax: number; phone: string; wish: string };
type RsvpApiResponse = { submissions: RsvpSubmission[]; workbook: string };

function AestheticAmpersand() {
  return <span className="aesthetic-ampersand">&amp;</span>;
}

function TextWithAmpersands({ text }: { text: string }) {
  return (
    <>
      {text.split("&").map((part, index) => (
        <Fragment key={`${index}-${part}`}>
          {index > 0 && <AestheticAmpersand />}
          {part}
        </Fragment>
      ))}
    </>
  );
}

function formatMusicTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

const initialForm: RsvpFormState = {
  name: "",
  attendance: "Hadir",
  pax: 1,
  phone: "",
  wish: "",
};

async function parseRsvpResponse(response: Response): Promise<RsvpApiResponse> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : "RSVP tidak dapat dihantar.";
    throw new Error(message);
  }
  if (!Array.isArray(body.submissions)) {
    throw new Error("Senarai RSVP tidak dapat dibaca.");
  }
  return body as RsvpApiResponse;
}

async function fetchRsvpSubmissions() {
  const response = await fetch("/api/rsvp", { headers: { Accept: "application/json" } });
  return parseRsvpResponse(response);
}

async function postRsvpSubmission(form: RsvpFormState) {
  const response = await fetch("/api/rsvp", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: form.name,
      attendance: form.attendance,
      pax: form.pax,
      phone: form.phone,
      wish: form.wish,
    }),
  });
  return parseRsvpResponse(response);
}

function malaysiaPhoneLinks(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `60${digits.slice(1)}` : digits;
  return {
    tel: `tel:+${international}`,
    whatsapp: `https://wa.me/${international}`,
  };
}

function calendarDetails() {
  const date = eventDetails.dateISO.replaceAll("-", "");
  const start = eventDetails.startTime.replace(":", "") + "00";
  const end = eventDetails.endTime.replace(":", "") + "00";
  const location = `${eventDetails.venueName}, ${eventDetails.venueAddress}`;
  const google = new URL("https://calendar.google.com/calendar/render");
  google.searchParams.set("action", "TEMPLATE");
  google.searchParams.set("text", eventDetails.title);
  google.searchParams.set("dates", `${date}T${start}/${date}T${end}`);
  google.searchParams.set("location", location);
  google.searchParams.set("details", "Jemputan perkahwinan Fatin Nashuha Binti Jeffri dan Mohamad Shafiq Bin Mohd Shakri.");
  
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${date}T${start}`,
    `DTEND:${date}T${end}`,
    `SUMMARY:${eventDetails.title}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  
  return { google: google.toString(), ics };
}

function downloadCalendar() {
  const { ics } = calendarDetails();
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nashuha-shafiq.ics";
  anchor.click();
  URL.revokeObjectURL(url);
}

function mapLinks() {
  const query = encodeURIComponent(`${eventDetails.venueName}, ${eventDetails.venueAddress}`);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
  };
}

function formatTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

// ─── Sparkle component ────────────────────────────────────────────────────────
function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
      transition={{ duration: 2.5, delay, repeat: Infinity, repeatDelay: 2 + (delay * 1.7) % 4 }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 0L7 5L12 6L7 7L6 12L5 7L0 6L5 5L6 0Z" fill="#b8894a" opacity="0.6" />
      </svg>
    </motion.div>
  );
}

// ─── Ornament divider ─────────────────────────────────────────────────────────
function OrnamentDivider() {
  return (
    <div className="flex items-center justify-center gap-3 py-2 w-full">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-500/30" />
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2C10 2 7 6 4 10C7 14 10 18 10 18C10 18 13 14 16 10C13 6 10 2 10 2Z" stroke="#b8894a" strokeWidth="0.8" fill="none" />
        <circle cx="10" cy="10" r="1.5" fill="#b8894a" />
      </svg>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500/30" />
    </div>
  );
}

// ─── Animated Section ─────────────────────────────────────────────────────────
function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Entrance Screen ──────────────────────────────────────────────────────────
function EntranceScreen({
  onActivate,
  onEnter,
  onFinish,
}: {
  onActivate: () => void;
  onEnter: () => void;
  onFinish: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleClick = () => {
    if (opening) return;
    onActivate();
    setOpening(true);
    onEnter();
    window.setTimeout(onFinish, reduceMotion ? 950 : 1450);
  };

  // Floating gold particles for entrance
  const particles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      left: `${12 + i * 11}%`,
      size: 3 + (i % 4) * 0.75,
      delay: i * 0.6,
      duration: 3 + (i % 5) * 0.4,
    })), []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      animate={opening ? { opacity: 0 } : { opacity: 1 }}
      transition={{
        duration: reduceMotion ? 0.18 : 0.42,
        delay: opening ? (reduceMotion ? 0.62 : 0.92) : 0,
      }}
    >
      <motion.div
        className="opening-gate-panel opening-gate-panel-left absolute inset-y-0 left-0 w-1/2 origin-left overflow-hidden"
        animate={opening ? { x: "-100%" } : { x: 0 }}
        transition={{ duration: reduceMotion ? 0.72 : 1.05, ease: [0.22, 1, 0.36, 1] }}
        style={{
          borderRight: "1px solid rgba(196, 157, 96, 0.3)",
          willChange: "transform",
        }}
      >
        <div className="absolute inset-y-0 left-0 w-[200%]" style={{
          backgroundImage: "url('/Opening Gate Background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }} />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, rgba(78, 13, 30, 0.9) 0%, rgba(47, 3, 18, 0.95) 100%)"
        }} />
      </motion.div>

      <motion.div
        className="opening-gate-panel opening-gate-panel-right absolute inset-y-0 right-0 w-1/2 origin-right overflow-hidden"
        animate={opening ? { x: "100%" } : { x: 0 }}
        transition={{ duration: reduceMotion ? 0.72 : 1.05, ease: [0.22, 1, 0.36, 1] }}
        style={{
          borderLeft: "1px solid rgba(255, 255, 255, 0.15)",
          willChange: "transform",
        }}
      >
        <div className="absolute inset-y-0 right-0 w-[200%]" style={{
          backgroundImage: "url('/Opening Gate Background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }} />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(225deg, rgba(78, 13, 30, 0.9) 0%, rgba(47, 3, 18, 0.95) 100%)"
        }} />
      </motion.div>

      <motion.div
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
        style={{ background: "rgba(196, 157, 96, 0.25)" }}
        animate={opening ? { opacity: 0 } : { opacity: 1 }}
      />

      {/* Floating gold particles */}
      {!reduceMotion && particles.map((p, i) => (
        <div
          key={i}
          className="gold-particle"
          style={{
            left: p.left,
            bottom: "20%",
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center gap-5 px-8 text-center">
        <motion.button
          type="button"
          onClick={handleClick}
          disabled={opening}
          className="opening-emblem-button relative flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/80 focus-visible:ring-offset-4 focus-visible:ring-offset-[#3a0311] disabled:cursor-default"
          animate={opening ? { scale: 0.82, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={{ duration: opening ? (reduceMotion ? 0.12 : 0.28) : 0 }}
          aria-label="Open Nashuha and Shafiq wedding invitation"
        >
          <motion.span
            className="absolute inset-0 flex items-center justify-center"
            animate={opening || reduceMotion ? { scale: 1 } : { scale: [1, 1.035, 1] }}
            transition={{ duration: 2.4, repeat: opening || reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
          >
            {/* Radial pulse glow */}
            <div className="emblem-radial-pulse" />
            {/* Rotating glow rings */}
            <div className="emblem-glow-ring" />
            <div className="emblem-glow-ring emblem-glow-ring-outer" />
            <img
              src="/shua-opening-emblem.png"
              alt=""
              className="opening-emblem-image h-full w-full select-none object-contain relative z-10"
              draggable={false}
            />
          </motion.span>
        </motion.button>

        <motion.p
          className="font-montserrat text-center text-xs tracking-[0.22em] uppercase"
          style={{ color: "#f3d995" }}
          animate={opening ? { opacity: 0 } : reduceMotion ? { opacity: 1 } : { opacity: [0.62, 1, 0.62] }}
          transition={{ duration: 2.2, repeat: opening || reduceMotion ? 0 : Infinity }}
        >
          Click to open the card
        </motion.p>
      </div>
    </motion.div>
  );
}

// ─── Cover Page ───────────────────────────────────────────────────────────────
function CoverPage() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  const sparkles = Array.from({ length: 8 }, (_, i) => ({
    x: [15, 80, 25, 70, 10, 90, 40, 60][i],
    y: [20, 15, 75, 80, 50, 45, 10, 85][i],
    delay: i * 0.4,
  }));

  // Generate petals data
  const petals = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      left: `${5 + (i * 8) % 90}%`,
      size: 10 + (i % 5) * 1.6,
      duration: 6 + (i % 6),
      delay: i * 0.8,
    })), []);

  return (
    <div ref={ref} className="cover-page-shell relative flex h-full min-h-screen flex-col items-center justify-start overflow-hidden">
      {/* Parallax Background Image */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/Main Page.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          y: reduceMotion ? 0 : bgY,
        }}
      />

      {/* Gold shimmer overlay */}
      <div className="cover-shimmer-overlay" />

      {/* Falling petals */}
      {!reduceMotion && petals.map((p, i) => (
        <div
          key={i}
          className="petal"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Sparkles */}
      {sparkles.map((s, i) => <Sparkle key={i} {...s} />)}
    </div>
  );
}

// ─── Mukadimah Section ────────────────────────────────────────────────────────
export function MukadimahSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatedSection className="invitation-section invitation-section-intro px-6 py-12 text-center">
      <div ref={ref}>
        {/* Bismillah with blur-to-sharp */}
        <motion.p
          className="font-playfair text-2xl mb-5 leading-relaxed"
          style={{ color: "#842944", direction: "rtl" }}
          initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
          animate={visible ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </motion.p>
        <OrnamentDivider />
        <motion.p
          className="section-kicker font-montserrat text-xs tracking-widest uppercase font-semibold mt-6 mb-3"
          style={{ color: "#4a1228" }}
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Assalamualaikum dan Salam Sejahtera
        </motion.p>
        <motion.p
          className="guest-line font-playfair text-xs tracking-wider italic mb-6"
          style={{ color: "#8d5267" }}
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          Dato&apos; / Datin / Tuan / Puan / Encik / Cik
        </motion.p>
        <motion.p
          className="body-copy font-montserrat text-[13px] leading-7 mb-6"
          style={{ color: "#3d0e20" }}
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.45 }}
        >
          Dengan segala hormatnya dan penuh kesyukuran ke hadrat Ilahi, kami mempersilakan kehadiran Tuan/Puan ke majlis perkahwinan anakanda kami:
        </motion.p>

        {/* Staggered couple names with shimmer */}
        <motion.p
          className="names-script font-greatvibes text-4xl mb-1 shimmer-text"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={visible ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          Fatin Nashuha
        </motion.p>
        <motion.p
          className="font-montserrat text-[11px] tracking-widest uppercase mb-3"
          style={{ color: "#8d5267" }}
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.65 }}
        >
          Binti Jeffri
        </motion.p>
        <motion.p
          className="font-montserrat text-lg mb-3"
          style={{ color: "#b8894a" }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={visible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.75, type: "spring", stiffness: 300 }}
        >
          <AestheticAmpersand />
        </motion.p>
        <motion.p
          className="names-script font-greatvibes text-4xl mb-1 shimmer-text"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={visible ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          Mohamad Shafiq
        </motion.p>
        <motion.p
          className="font-montserrat text-[11px] tracking-widest uppercase mb-8"
          style={{ color: "#8d5267" }}
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.95 }}
        >
          Bin Mohd Shakri
        </motion.p>

        <motion.p
          className="font-montserrat text-[10px] tracking-widest uppercase mb-1"
          style={{ color: "#b8894a" }}
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 1.05 }}
        >
          — Daripada —
        </motion.p>
        <motion.p
          className="parent-names font-playfair text-sm leading-7"
          style={{ color: "#3d0e20" }}
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.15 }}
        >
          <strong>Jeffri Bin Mat Jaafar</strong><br />
          <AestheticAmpersand /> <strong>Sarina Binti Mat Din @ Samsudin</strong>
        </motion.p>
        <div className="mt-8">
          <OrnamentDivider />
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─── Details Section ──────────────────────────────────────────────────────────
function WalimatulurusSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatedSection className="invitation-copy-section px-7 py-14 text-center">
      <div ref={ref}>
        <motion.p
          className="parent-names font-playfair font-semibold"
          initial={{ opacity: 0, letterSpacing: "0.3em" }}
          animate={visible ? { opacity: 1, letterSpacing: "0em" } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          Jeffri Bin Mat Jaafar
        </motion.p>
        <motion.p
          className="decorative-ampersand font-greatvibes"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={visible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.25, type: "spring", stiffness: 300 }}
        >
          <AestheticAmpersand />
        </motion.p>
        <motion.p
          className="parent-names font-playfair font-semibold"
          initial={{ opacity: 0, letterSpacing: "0.3em" }}
          animate={visible ? { opacity: 1, letterSpacing: "0em" } : {}}
          transition={{ duration: 0.8, delay: 0.35 }}
        >
          Sarina Binti Mat Din @ Samsudin
        </motion.p>

        {/* Grand title with scale + blur */}
        <motion.h1
          className="walimatulurus-title font-greatvibes golden-underline"
          initial={{ opacity: 0, scale: 0.7, filter: "blur(10px)" }}
          animate={visible ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          Walimatulurus
        </motion.h1>

        <motion.p
          className="invitation-verse font-playfair"
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          Setepak sirih, sekacip pinang, semekar senyuman, seikhlas hati
        </motion.p>
        <motion.p
          className="invitation-copy-line font-playfair"
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          Dengan penuh kesyukuran ke hadrat Ilahi
        </motion.p>
        <motion.p
          className="invitation-copy-line font-playfair"
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          Mengundang Dato&apos; / Datin / Tuan / Puan / Encik / Cik
        </motion.p>

        <div className="dotted-gold-divider" aria-hidden="true" />

        <motion.p
          className="invitation-copy-line font-playfair"
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          ke majlis perkahwinan anakanda kami
        </motion.p>

        <motion.p
          className="couple-formal-name font-playfair font-semibold shimmer-text"
          initial={{ opacity: 0, y: 15 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 1.1 }}
        >
          Fatin Nashuha Binti Jeffri
        </motion.p>
        <motion.p
          className="decorative-ampersand font-greatvibes"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={visible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 1.2, type: "spring", stiffness: 300 }}
        >
          <AestheticAmpersand />
        </motion.p>
        <motion.p
          className="couple-formal-name font-playfair font-semibold shimmer-text"
          initial={{ opacity: 0, y: 15 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 1.3 }}
        >
          Mohamad Shafiq Bin Mohd Shakri
        </motion.p>
      </div>
    </AnimatedSection>
  );
}

function DetailsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const links = mapLinks();
  return (
    <AnimatedSection className="invitation-section px-6 py-9 text-center">
      <div ref={ref}>
        <motion.p
          className="section-kicker font-montserrat text-xs tracking-widest uppercase font-semibold mb-6"
          style={{ color: "#4a1228" }}
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          Butiran Majlis
        </motion.p>

        <div className="detail-stack space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="detail-label font-montserrat text-[10px] tracking-widest uppercase mb-2" style={{ color: "#b8894a" }}>Lokasi</p>
            <p className="detail-value font-playfair text-lg font-bold mb-1" style={{ color: "#4a1228" }}>
              <TextWithAmpersands text={eventDetails.venueName} />
            </p>
            <p className="detail-address font-montserrat text-xs leading-6" style={{ color: "#3d0e20" }}>
              {eventDetails.venueAddress}
            </p>
          </motion.div>

          <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <p className="detail-label font-montserrat text-[10px] tracking-widest uppercase mb-2" style={{ color: "#b8894a" }}>Tarikh</p>
            <p className="detail-value font-playfair text-base font-semibold" style={{ color: "#4a1228" }}>{eventDetails.dateLabel}</p>
          </motion.div>

          <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <p className="detail-label font-montserrat text-[10px] tracking-widest uppercase mb-2" style={{ color: "#b8894a" }}>Masa</p>
            <p className="detail-value font-playfair text-base font-semibold" style={{ color: "#4a1228" }}>{eventDetails.timeLabel}</p>
          </motion.div>
        </div>

        <motion.div
          className="flex justify-center gap-3 mt-8"
          initial={{ opacity: 0, y: 15 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <a
            href={links.google}
            target="_blank"
            rel="noopener noreferrer"
            className="action-link inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs tracking-wide transition hover:bg-amber-50 active:scale-95 shadow-sm font-semibold"
            style={{ borderColor: "rgba(196,157,96,0.3)", color: "#4a1228", background: "rgba(255,255,255,0.7)" }}
          >
            <MapPin className="w-3.5 h-3.5" />
            Google Maps
          </a>
          <a
            href={links.waze}
            target="_blank"
            rel="noopener noreferrer"
            className="action-link inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs tracking-wide transition hover:bg-amber-50 active:scale-95 shadow-sm font-semibold"
            style={{ borderColor: "rgba(196,157,96,0.3)", color: "#4a1228", background: "rgba(255,255,255,0.7)" }}
          >
            <Navigation className="w-3.5 h-3.5" />
            Waze
          </a>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

// ─── Countdown Section ────────────────────────────────────────────────────────
function CountdownSection() {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);

    const update = () => {
      const TARGET = new Date(eventDateTime).getTime();
      const diff = TARGET - Date.now();
      if (diff <= 0) { setTime({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => { clearInterval(id); observer.disconnect(); };
  }, []);

  const units = [
    { label: "Hari", value: time.days, key: "d" },
    { label: "Jam", value: time.hours, key: "h" },
    { label: "Minit", value: time.minutes, key: "m" },
    { label: "Saat", value: time.seconds, key: "s" },
  ];

  return (
    <AnimatedSection className="invitation-section px-6 py-10 text-center">
      <div ref={ref}>
        <motion.p
          className="section-kicker font-montserrat text-xs tracking-widest uppercase font-semibold mb-2"
          style={{ color: "#4a1228" }}
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          Menghitung Hari
        </motion.p>
        <motion.p
          className="font-greatvibes text-3xl mb-6"
          style={{ color: "#8d5267" }}
          initial={{ opacity: 0, y: 10 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Menanti Hari Bahagia
        </motion.p>

        <div className="countdown-grid grid grid-cols-4 gap-2.5">
          {units.map(({ label, value, key }, idx) => (
            <motion.div
              key={label}
              className={`countdown-card rounded-xl py-3 px-1 flex flex-col items-center shadow-sm ${key === "s" ? "seconds-pulse" : ""}`}
              style={{ background: "rgba(255, 255, 255, 0.75)", border: "1px solid rgba(196,157,96,0.15)" }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={visible ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="countdown-number font-playfair text-2xl font-bold leading-none" style={{ color: "#4a1228" }}>
                {formatTwoDigits(value)}
              </span>
              <span className="countdown-label font-montserrat text-[9px] tracking-widest uppercase mt-2 font-semibold" style={{ color: "#8d5267" }}>
                {label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─── Atur Cara Section ────────────────────────────────────────────────────────
function AturCaraSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const events = [
    { time: "12:00", label: "Ketibaan Tetamu" },
    { time: "12:30", label: "Ketibaan Pengantin" },
    { time: "1:00", label: "Makan Beradab" },
    { time: "2:00", label: "Sesi Bergambar" },
    { time: "4:00", label: "Majlis Tamat" },
  ];

  return (
    <AnimatedSection className="invitation-section px-6 py-10">
      <p className="section-kicker font-montserrat text-xs tracking-widest uppercase font-semibold mb-6 text-center" style={{ color: "#4a1228" }}>
        Atur Cara
      </p>
      <div ref={ref} className="timeline-list space-y-5 relative max-w-xs mx-auto">
        {/* Animated timeline line */}
        <div
          className={`timeline-line absolute left-[4.5rem] top-2 bottom-2 w-px ${visible ? "timeline-line-draw" : ""}`}
          style={{
            background: "linear-gradient(to bottom, transparent, rgba(196,157,96,0.3), transparent)",
            transformOrigin: "top",
            transform: visible ? undefined : "scaleY(0)",
          }}
        />
        {events.map(({ time, label }, idx) => (
          <motion.div
            key={time}
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={visible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="timeline-time font-montserrat text-[10px] font-semibold w-16 text-right shrink-0" style={{ color: "#b8894a" }}>{time}</p>
            <div className="w-2 h-2 rounded-full shrink-0 z-10" style={{ background: "#b8894a" }} />
            <p className="timeline-text font-playfair text-xs font-semibold" style={{ color: "#3d0e20" }}>{label}</p>
          </motion.div>
        ))}
      </div>
    </AnimatedSection>
  );
}

// ─── Horizontal Gallery ───────────────────────────────────────────────────────
function HorizontalImageStack() {
  const reduceMotion = useReducedMotion();
  const galleryImages = [
    { src: "/gallery-1.jpg", label: "Tangan pengantin memegang jambangan bunga" },
    { src: "/gallery-2.jpg", label: "Pasangan pengantin duduk bersanding" },
    { src: "/gallery-3.jpg", label: "Cincin perkahwinan dan jambangan bunga" },
    { src: "/gallery-4.jpg", label: "Pengantin bersama ibu di pelamin" },
    { src: "/gallery-5.jpg", label: "Pasangan pengantin di pelamin" },
  ];
  const [active, setActive] = useState(0);

  const goTo = useCallback((index: number) => {
    setActive((index + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const navigate = useCallback((direction: number) => {
    setActive((current) => (current + direction + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const getRelativeIndex = (index: number) => {
    const total = galleryImages.length;
    let diff = index - active;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  return (
    <section
      className="gallery-stack-shell mt-5"
      aria-roledescription="carousel"
      aria-label="Kad gambar perkahwinan"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") navigate(-1);
        if (event.key === "ArrowRight") navigate(1);
      }}
    >
      <div className="gallery-stage">
        {galleryImages.map((image, index) => {
          const diff = getRelativeIndex(index);
          const hidden = Math.abs(diff) > 2;
          const isActive = diff === 0;
          const x = diff === 0 ? "0%" : diff === -1 ? "-42%" : diff === 1 ? "42%" : diff === -2 ? "-72%" : diff === 2 ? "72%" : diff > 0 ? "120%" : "-120%";
          const scale = diff === 0 ? 1 : Math.abs(diff) === 1 ? 0.82 : 0.7;
          const opacity = diff === 0 ? 1 : Math.abs(diff) === 1 ? 0.58 : Math.abs(diff) === 2 ? 0.24 : 0;
          const rotateY = reduceMotion || diff === 0 ? 0 : diff < 0 ? 8 * Math.abs(diff) : -8 * Math.abs(diff);
          const zIndex = 10 - Math.abs(diff);

          return (
            <motion.div
              key={image.src}
              className={`gallery-deck-card ${isActive ? "gallery-active-glow gallery-ken-burns" : ""}`}
              aria-hidden={!isActive}
              animate={{ x, scale, opacity, rotateY, zIndex }}
              transition={reduceMotion ? { duration: 0.05 } : { type: "spring", stiffness: 260, damping: 30, mass: 0.85 }}
              drag={isActive ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.22}
              onDragEnd={(_, info) => {
                if (info.offset.x < -50) navigate(1);
                if (info.offset.x > 50) navigate(-1);
              }}
              style={{
                pointerEvents: isActive ? "auto" : "none",
                visibility: hidden ? "hidden" : "visible",
              }}
            >
              <img
                src={image.src}
                alt={image.label}
                draggable={false}
                className="h-full w-full select-none object-cover"
              />
            </motion.div>
          );
        })}
      </div>

      <div className="gallery-controls">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="gallery-nav-button"
          aria-label="Previous gallery image"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="gallery-dot-row" role="tablist" aria-label="Gallery image navigation">
          {galleryImages.map((image, index) => (
            <button
              type="button"
              key={image.src}
              onClick={() => goTo(index)}
              className={`gallery-dot ${active === index ? "gallery-dot-active" : ""}`}
              aria-label={`Show image ${index + 1}`}
              aria-current={active === index ? "true" : undefined}
            />
          ))}
        </div>

        <p className="gallery-counter font-montserrat" aria-live="polite">
          {active + 1} / {galleryImages.length}
        </p>

        <button
          type="button"
          onClick={() => navigate(1)}
          className="gallery-nav-button"
          aria-label="Next gallery image"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

// ─── Doa Section ─────────────────────────────────────────────────────────────
function DoaSection() {
  return (
    <AnimatedSection className="invitation-section px-6 py-10 text-center">
      <p className="section-kicker font-montserrat text-xs tracking-widest uppercase font-semibold mb-4" style={{ color: "#4a1228" }}>
        Doa <AestheticAmpersand /> Harapan
      </p>
      <OrnamentDivider />
      <p className="doa-copy font-playfair text-xs leading-7 mt-6 italic" style={{ color: "#3d0e20" }}>
        &quot;Ya Allah, berkatilah perkahwinan ini. Jadikanlah ia perkahwinan yang penuh kasih sayang, kebahagiaan dan keberkatan. Semoga pasangan ini dikurniakan keluarga yang sakinah, mawaddah wa rahmah.&quot;
      </p>
      <div className="mt-6">
        <OrnamentDivider />
      </div>
      <p className="guest-line font-montserrat text-[11px] mt-4 font-semibold" style={{ color: "#8d5267" }}>
        Kehadiran Tuan/Puan amat dihargai. Terima Kasih.
      </p>
    </AnimatedSection>
  );
}

// ─── Sheet Content Components ─────────────────────────────────────────────────
function SheetContent({
  active,
  musicState,
  musicProgress,
  onMusicPlay,
  onMusicPause,
  onMusicSeek,
  rsvpForm,
  rsvpStatus,
  rsvpStatusIsError,
  isSubmitting,
  updateRsvpForm,
  submitRsvp,
  wishes,
}: {
  active: DockPanel;
  musicState: AudioPlaybackState;
  musicProgress: AudioProgress;
  onMusicPlay: () => void;
  onMusicPause: () => void;
  onMusicSeek: (seconds: number) => void;
  rsvpForm: RsvpFormState;
  rsvpStatus: string;
  rsvpStatusIsError: boolean;
  isSubmitting: boolean;
  updateRsvpForm: (patch: Partial<RsvpFormState>) => void;
  submitRsvp: (event: React.FormEvent<HTMLFormElement>) => void;
  wishes: RsvpSubmission[];
}) {
  if (active === "time") {
    const calendar = calendarDetails();
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/10 bg-[#842944]/5">
          <Calendar className="w-6 h-6 text-[#842944]" />
          <div>
            <strong className="block text-sm text-[#4a1228] font-bold">{eventDetails.dateLabel}</strong>
            <span className="text-xs text-gray-500">{eventDetails.timeLabel}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={downloadCalendar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold bg-white hover:bg-gray-50 active:scale-95 transition"
            style={{ color: "#4a1228", borderColor: "rgba(196,157,96,0.25)" }}
          >
            <Calendar className="w-3.5 h-3.5" />
            Muat Turun .ics
          </button>
          <a
            href={calendar.google}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold bg-[#842944] text-[#fff4d6] hover:brightness-110 active:scale-95 transition"
          >
            <Calendar className="w-3.5 h-3.5" />
            Google Calendar
          </a>
        </div>
      </div>
    );
  }

  if (active === "location") {
    const links = mapLinks();
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-xl border border-amber-500/10 bg-[#842944]/5">
          <strong className="block text-sm text-[#4a1228] font-bold">
            <TextWithAmpersands text={eventDetails.venueName} />
          </strong>
          <p className="text-xs text-gray-500 mt-1 leading-5">{eventDetails.venueAddress}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={links.google}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold bg-white hover:bg-gray-50 active:scale-95 transition"
            style={{ color: "#4a1228", borderColor: "rgba(196,157,96,0.25)" }}
          >
            <MapPin className="w-3.5 h-3.5" />
            Google Maps
          </a>
          <a
            href={links.waze}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold bg-[#842944] text-[#fff4d6] hover:brightness-110 active:scale-95 transition"
          >
            <Navigation className="w-3.5 h-3.5" />
            Waze
          </a>
        </div>
      </div>
    );
  }

  if (active === "rsvp") {
    return (
      <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
        <form onSubmit={submitRsvp} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-gray-500">Nama</label>
            <input
              required
              name="name"
              value={rsvpForm.name}
              maxLength={80}
              placeholder="Nama anda..."
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
              onChange={(event) => updateRsvpForm({ name: event.target.value })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-gray-500">Kehadiran</label>
            <select
              name="attendance"
              value={rsvpForm.attendance}
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none bg-white"
              onChange={(event) => updateRsvpForm({ attendance: event.target.value as AttendanceStatus })}
            >
              {attendanceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-gray-500">Jumlah pax</label>
            <input
              name="pax"
              type="number"
              min={1}
              max={10}
              value={rsvpForm.pax}
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none bg-white"
              onChange={(event) => updateRsvpForm({ pax: Math.min(10, Math.max(1, Number(event.target.value) || 1)) })}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-gray-500">No telefon</label>
            <input
              name="phone"
              type="tel"
              value={rsvpForm.phone}
              maxLength={30}
              placeholder="Contoh: 0191234567"
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none bg-white"
              onChange={(event) => updateRsvpForm({ phone: event.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-gray-500">Ucapan</label>
            <textarea
              name="wish"
              value={rsvpForm.wish}
              maxLength={240}
              rows={3}
              placeholder="Tulis ucapan ringkas..."
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none bg-white"
              onChange={(event) => updateRsvpForm({ wish: event.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="col-span-2 py-2.5 rounded-xl text-xs font-semibold bg-[#842944] text-[#fff4d6] disabled:opacity-50 transition active:scale-95"
          >
            {isSubmitting ? "Menyimpan..." : "Hantar RSVP"}
          </button>
        </form>
        {rsvpStatus && (
          <p
            className={`p-2 text-xs rounded-xl border text-center ${
              rsvpStatusIsError
                ? "border-red-500/20 bg-red-50 text-red-700"
                : "border-green-500/20 bg-green-50 text-green-700"
            }`}
            role={rsvpStatusIsError ? "alert" : "status"}
          >
            {rsvpStatus}
          </p>
        )}

        {/* Wishes List */}
        <div className="pt-4 border-t border-gray-100">
          <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-400">Ucapan Terbaru</h4>
          <div className="space-y-2.5">
            {wishes.slice(0, 4).map((w, idx) => (
              <div key={idx} className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 text-xs">
                <p className="italic text-gray-700">&quot;{w.wish || "Semoga majlis berjalan lancar."}&quot;</p>
                <strong className="block text-right text-gray-600 mt-1.5">— {w.name}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (active === "gift") {
    const family = malaysiaPhoneLinks(contacts[0].phone);
    return (
      <div className="space-y-4 text-center">
        <div className="flex flex-col items-center p-4 rounded-xl border border-amber-500/10 bg-[#842944]/5">
          <Gift className="w-8 h-8 text-[#842944] mb-2" />
          <strong className="block text-base text-[#4a1228] font-bold">{giftDetails.title}</strong>
          <span className="text-xs text-gray-500 mt-1">{giftDetails.recipient}</span>
        </div>
        <figure className="gift-qr-block">
          <img
            src="/gift-duitnow-qr.jpeg"
            alt="DuitNow QR code for Fatin Nashuha Binti Jeffri"
            className="gift-qr-image"
            loading="lazy"
            decoding="async"
          />
          <figcaption className="font-montserrat">Scan QR DuitNow</figcaption>
        </figure>
        <div className="p-3 rounded-xl border bg-white shadow-sm text-xs">
          <span className="block text-gray-400 font-semibold mb-1">Bank / DuitNow</span>
          <strong className="text-sm text-[#4a1228] font-bold">{giftDetails.bank}</strong>
          <p className="text-gray-500 mt-2 leading-relaxed">{giftDetails.note}</p>
        </div>
        <a
          href={family.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-[#842944] text-[#fff4d6] hover:brightness-110 active:scale-95 transition"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Hubungi Keluarga (WhatsApp)
        </a>
      </div>
    );
  }

  if (active === "contact") {
    return (
      <div className="space-y-2.5">
        {contacts.map((c) => {
          const links = malaysiaPhoneLinks(c.phone);
          return (
            <div key={c.name} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
              <div>
                <strong className="block text-sm text-[#4a1228] font-bold">{c.name}</strong>
                <span className="text-xs text-gray-400 font-semibold">{c.relation} — {c.phone}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={links.tel}
                  className="w-8 h-8 rounded-full border flex items-center justify-center bg-white hover:bg-gray-50 transition active:scale-90"
                  aria-label={`Panggil ${c.name}`}
                >
                  <Phone className="w-3.5 h-3.5 text-[#842944]" />
                </a>
                <a
                  href={links.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border flex items-center justify-center bg-white hover:bg-gray-50 transition active:scale-90"
                  aria-label={`WhatsApp ${c.name}`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#842944]" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const musicLabels: Record<AudioPlaybackState, string> = {
    loading: "Memuatkan muzik...",
    ready: "Pemain sedia.",
    playing: "Lagu sedang dimainkan.",
    paused: "Lagu dijeda.",
    blocked: "Autoplay disekat. Tekan Play untuk memulakan lagu.",
    ended: "Lagu telah tamat.",
    error: "Muzik tidak dapat dimuatkan.",
  };

  const duration = Math.max(0, musicProgress.duration);
  const currentTime = Math.min(Math.max(0, musicProgress.currentTime), duration || musicProgress.currentTime);
  const musicUnavailable = musicState === "loading" || musicState === "error";

  return (
    <div className="music-player-panel text-center">
      <div className={`music-artwork ${musicState === "playing" ? "is-playing" : ""}`} aria-hidden="true">
        {musicState === "playing" ? (
          <span className="music-visualizer">
            {[0, 1, 2, 3].map((bar) => <span key={bar} className="music-bar" />)}
          </span>
        ) : (
          <Music className="h-6 w-6" />
        )}
      </div>

      <div>
        <h3 className="music-track-title font-playfair">{musicTitle}</h3>
        <p className="music-track-artist font-montserrat">
          <TextWithAmpersands text={musicArtist} />
        </p>
      </div>

      <div className="music-progress-group">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={duration ? currentTime : 0}
          disabled={!duration}
          onChange={(event) => onMusicSeek(Number(event.target.value))}
          className="music-progress-slider"
          aria-label="Music progress"
          style={{ "--music-progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
        />
        <div className="music-time-row font-montserrat">
          <span>{formatMusicTime(currentTime + musicTimelineOffset)}</span>
          <span>{formatMusicTime(duration + musicTimelineOffset)}</span>
        </div>
      </div>

      <div className="music-control-row">
        <button
          type="button"
          disabled={musicUnavailable}
          onClick={musicState === "playing" ? onMusicPause : onMusicPlay}
          className="music-play-button"
          aria-label={musicState === "playing" ? "Pause music" : "Play music"}
          title={musicState === "playing" ? "Pause music" : "Play music"}
        >
          {musicState === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <p className="music-status font-montserrat" role="status">{musicLabels[musicState]}</p>
      </div>
    </div>
  );
}

// ─── Main App Component ───────────────────────────────────────────────────────
export default function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [showEntrance, setShowEntrance] = useState(true);
  const [active, setActive] = useState<DockPanel | null>(null);
  const [musicState, setMusicState] = useState<AudioPlaybackState>("loading");
  const [musicProgress, setMusicProgress] = useState<AudioProgress>({ currentTime: 0, duration: 0, buffered: 0 });
  const [wishes, setWishes] = useState<RsvpSubmission[]>(seedWishes);
  const [rsvpForm, setRsvpForm] = useState<RsvpFormState>(initialForm);
  const [rsvpStatus, setRsvpStatus] = useState("");
  const [rsvpStatusIsError, setRsvpStatusIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const playerRef = useRef<AudioControllerHandle>(null);
  const validMusic = true;

  const closeSheet = () => setActive(null);
  
  const openSheet = (panel: DockPanel) => {
    setActive((curr) => (curr === panel ? null : panel));
  };

  const openInvitation = () => {
    setHasEntered(true);
  };

  // Secondary autoplay attempt: retry play after entrance animation if music didn't start
  useEffect(() => {
    if (!hasEntered) return;
    // Give the entrance animation time to complete, then check if music is playing
    const timer = setTimeout(() => {
      if (musicState !== "playing") {
        playerRef.current?.play();
      }
    }, 600);
    return () => clearTimeout(timer);
    // Only run when hasEntered changes, not on musicState changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEntered]);

  const updateRsvpForm = (patch: Partial<RsvpFormState>) => {
    setRsvpForm((curr) => ({ ...curr, ...patch }));
  };

  const submitRsvp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRsvpStatus("");
    setRsvpStatusIsError(false);
    setIsSubmitting(true);
    try {
      const result = await postRsvpSubmission(rsvpForm);
      setWishes(result.submissions.slice(0, 20));
      setRsvpForm(initialForm);
      setRsvpStatus("Terima kasih. RSVP anda telah disimpan ke Excel.");
    } catch (error) {
      setRsvpStatusIsError(true);
      setRsvpStatus(error instanceof Error ? error.message : "RSVP tidak dapat dihantar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchRsvpSubmissions()
      .then((result) => setWishes(result.submissions.slice(0, 20)))
      .catch(() => setWishes(seedWishes));
  }, []);

  return (
    <div className="invitation-root relative min-h-screen font-montserrat">
      <style>{fontStyle}</style>

      {/* Hidden persistent audio player */}
      <PersistentAudioPlayer
        ref={playerRef}
        src={musicSrc}
        startAt={musicStartAt}
        onStateChange={setMusicState}
        onProgressChange={setMusicProgress}
      />

      {/* Entrance screen */}
      <AnimatePresence>
        {showEntrance && (
          <EntranceScreen
            onActivate={() => playerRef.current?.play()}
            onEnter={openInvitation}
            onFinish={() => setShowEntrance(false)}
          />
        )}
      </AnimatePresence>

      {/* Main card wrapper */}
      <AnimatePresence>
        {hasEntered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="relative pb-28 min-h-screen"
          >
            {/* Device-like centered wrapper */}
            <div className="invitation-frame w-full max-w-lg mx-auto sm:my-8 sm:rounded-3xl overflow-hidden shadow-2xl border border-amber-500/15" style={{ minHeight: "100dvh" }}>
              {/* Cover Card */}
              <div className="min-h-screen flex flex-col relative">
                <CoverPage />
              </div>

              {/* Inner details sections */}
              <div className="invitation-paper" style={{
                backgroundImage: "url('/Background Second Page.png')",
                backgroundSize: "cover",
                backgroundRepeat: "repeat-y",
                backgroundPosition: "top center"
              }}>
                <WalimatulurusSection />
                <div className="mx-6 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                
                <DetailsSection />
                <div className="mx-6 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                
                <CountdownSection />
                <div className="mx-6 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                
                <AturCaraSection />
                <div className="mx-6 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                
                {/* Horizontal Gallery */}
                <div className="invitation-section px-6 py-10">
                  <p className="section-kicker font-montserrat text-xs tracking-widest uppercase font-semibold text-center mb-2" style={{ color: "#4a1228" }}>Galeri</p>
                  <HorizontalImageStack />
                </div>
                <div className="mx-6 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

                <DoaSection />
              </div>

              {/* Closing Section */}
              <div
                className="relative py-16 px-6 text-center flex flex-col justify-end overflow-hidden"
                style={{
                  backgroundImage: "url('/Background Last page.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  minHeight: "85vh"
                }}
              >
                <div className="absolute inset-0 bg-white/10 z-0 pointer-events-none" />

                {/* Floating hearts */}
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="floating-heart">
                    <Heart className="w-4 h-4" fill="currentColor" />
                  </div>
                ))}

                <div className="closing-composition relative z-10 mx-auto mb-14 flex w-full max-w-sm flex-col items-center text-center">
                  <motion.p
                    className="closing-eyebrow font-montserrat"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.7 }}
                  >
                    Kehadiran Anda Amat Bermakna
                  </motion.p>
                  <motion.h2
                    className="closing-title font-playfair"
                    initial={{ opacity: 0, scale: 0.85, filter: "blur(8px)" }}
                    whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  >
                    RSVP <AestheticAmpersand /> Gift
                  </motion.h2>
                  <motion.p
                    className="closing-copy font-playfair"
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    Sahkan kehadiran dan tinggalkan ucapan. Ucapan terbaru akan dipaparkan di kad ini dan disimpan ke Excel.
                  </motion.p>
                  <motion.div
                    className="closing-button-row"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, delay: 0.45 }}
                  >
                    <button
                      type="button"
                      onClick={() => openSheet("rsvp")}
                      className="closing-pill-button cta-glow"
                    >
                      <Mail className="h-4 w-4" /> RSVP
                    </button>
                    <button
                      type="button"
                      onClick={() => openSheet("gift")}
                      className="closing-pill-button cta-glow"
                    >
                      <Gift className="h-4 w-4" /> GIFT
                    </button>
                  </motion.div>
                </div>

                <motion.div
                  className="relative z-10 pt-10 pb-6 text-center border-t border-amber-500/10"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  <p className="font-greatvibes text-3xl shimmer-text">Nashuha <AestheticAmpersand /> Shafiq</p>
                  <p className="font-montserrat text-[10px] tracking-[0.2em] uppercase font-semibold text-gray-500 mt-2">22 Ogos 2026</p>
                </motion.div>
              </div>
            </div>

            {/* Bottom sheets / modals */}
            <AnimatePresence>
              {active && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={closeSheet}
                    className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
                  />
                  {/* Modal sheet */}
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 350 }}
                    className="sheet-panel fixed inset-x-0 bottom-16 z-40 mx-auto max-w-lg rounded-t-3xl p-6 shadow-2xl bg-white/95 backdrop-blur-xl border-t border-amber-500/15"
                  >
                    <div className="w-12 h-1 bg-amber-500/20 rounded-full mx-auto mb-4" />
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <h2 className="text-xl font-bold font-playfair text-[#4a1228]">
                          {active === "time" && <>Tarikh <AestheticAmpersand /> Masa</>}
                          {active === "location" && "Lokasi Majlis"}
                          {active === "rsvp" && "Sahkan RSVP"}
                          {active === "gift" && "Hadiah Digital"}
                          {active === "contact" && "Hubungi Kami"}
                          {active === "music" && "Lagu Pilihan"}
                        </h2>
                      </div>
                      <button
                        onClick={closeSheet}
                        className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    <SheetContent
                      active={active}
                      musicState={musicState}
                      musicProgress={musicProgress}
                      onMusicPlay={() => playerRef.current?.play()}
                      onMusicPause={() => playerRef.current?.pause()}
                      onMusicSeek={(seconds) => playerRef.current?.seek(seconds)}
                      rsvpForm={rsvpForm}
                      rsvpStatus={rsvpStatus}
                      rsvpStatusIsError={rsvpStatusIsError}
                      isSubmitting={isSubmitting}
                      updateRsvpForm={updateRsvpForm}
                      submitRsvp={submitRsvp}
                      wishes={wishes}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Separate floating circular Music dock button */}
            {validMusic && (
              <button
                type="button"
                onClick={() => openSheet("music")}
                aria-label={musicState === "playing" ? "Open music player, currently playing" : "Open music player"}
                title="Music player"
                className={`music-dock fixed right-4 bottom-20 z-40 w-12 h-12 rounded-full flex items-center justify-center bg-[#842944] text-[#fff4d6] shadow-lg border border-amber-500/20 transition-all hover:scale-105 active:scale-95 ${
                  active === "music" ? "ring-2 ring-[#fff4d6]" : ""
                }`}
                style={{
                  right: "max(16px, calc((100vw - 512px) / 2 + 16px))"
                }}
              >
                {musicState === "playing" ? (
                  <Music className="w-5 h-5 text-[#fff4d6] animate-pulse" />
                ) : (
                  <Music className="w-5 h-5 text-[#fff4d6] opacity-60" />
                )}
              </button>
            )}

            {/* Fixed bottom navigation dock (Apple-like) */}
            <motion.nav
              className="invitation-dock fixed bottom-3 inset-x-4 z-40 mx-auto max-w-md grid grid-cols-5 gap-1.5 p-2 rounded-full shadow-2xl backdrop-blur-xl border"
              style={{
                background: "rgba(132, 41, 68, 0.95)",
                borderColor: "rgba(255, 244, 217, 0.2)",
                color: "#fff4d6"
              }}
              initial={{ y: 80, opacity: 0, filter: "blur(10px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {[
                { panel: "time", icon: Clock, label: "Masa" },
                { panel: "location", icon: MapPin, label: "Lokasi" },
                { panel: "rsvp", icon: Mail, label: "RSVP" },
                { panel: "gift", icon: Gift, label: "Gift" },
                { panel: "contact", icon: Phone, label: "Hubungi" }
              ].map(({ panel, icon: Icon, label }) => (
                <motion.button
                  key={panel}
                  onClick={() => openSheet(panel as DockPanel)}
                  className={`flex flex-col items-center justify-center py-1.5 rounded-full transition-all active:scale-90 ${
                    active === panel ? "bg-amber-500/25 border border-amber-500/25 text-[#fff4d6] font-semibold" : "text-amber-100/70 hover:text-white"
                  }`}
                  whileTap={{ scale: 0.85 }}
                  animate={active === panel ? { y: [0, -4, 0] } : { y: 0 }}
                  transition={active === panel ? { duration: 0.4, ease: "easeOut" } : { duration: 0.2 }}
                >
                  <Icon className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] tracking-wide uppercase font-semibold">{label}</span>
                </motion.button>
              ))}
            </motion.nav>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
