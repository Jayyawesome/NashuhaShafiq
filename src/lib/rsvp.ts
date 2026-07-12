export const attendanceOptions = ["Hadir", "Tidak Hadir", "Mungkin"] as const;

export type AttendanceStatus = (typeof attendanceOptions)[number];

export type RsvpSubmission = {
  timestamp: string;
  name: string;
  attendance: AttendanceStatus;
  pax: number;
  phone: string;
  wish: string;
  source: string;
};

export const seedWishes: RsvpSubmission[] = [
  {
    timestamp: "2026-07-04T00:00:00.000+08:00",
    name: "Keluarga Pengantin",
    attendance: "Hadir",
    pax: 2,
    phone: "",
    wish: "Semoga majlis diberkati dan dipermudahkan.",
    source: "Preview",
  },
  {
    timestamp: "2026-07-04T00:01:00.000+08:00",
    name: "Sahabat",
    attendance: "Hadir",
    pax: 1,
    phone: "",
    wish: "Tahniah Nashuha dan Shafiq. Selamat pengantin baru.",
    source: "Preview",
  },
];
