# Shua Card Implementation Prompt

Implement the approved Shua wedding-card requirements in this repository. Work directly in the existing Vite, React 18, TypeScript, Tailwind CSS, and `motion/react` application. Complete the implementation, verification, and local run; do not stop at a mockup or a written proposal.

## Source Of Truth

Read these files before editing:

- `Requirement edit for shua card.docx`
- `src/app/App.tsx`
- `src/styles/globals.css`
- `src/components/PersistentYouTubePlayer.tsx`
- `src/lib/rsvp.ts`
- `vite.config.ts`

Use the extracted references in `docs/prompts/assets/shua-card/`:

- `opening-emblem.png`: the approved Nashuha and Shafiq wax emblem.
- `current-invitation-reference.png`: the invitation layout being replaced.
- `target-walimatulurus-reference.png`: the required invitation-copy layout.
- `target-closing-reference.png`: the required closing-page composition.

The older implementation at `https://github.com/Jayyawesome/Nashuha-Shafiq` may be consulted for event data, RSVP validation, Excel workbook behavior, and invitation copy. Adapt its behavior to this Vite application; do not paste Next.js-only APIs, `next/image`, CSS modules, or imports from `framer-motion`. This project uses normal web images and `motion/react`.

## Required Changes

### 1. Opening Gate

- Copy `docs/prompts/assets/shua-card/opening-emblem.png` into `public/` with a descriptive production filename.
- Replace the generated N/&/S circular stamp with the supplied emblem image.
- Make the emblem itself a semantic `button`; do not add a separate open button.
- Place the exact visible hint `Click to open the card` below the emblem.
- Keep the existing full-screen opening background and left/right gate panels.
- On the first emblem activation, run the gate-opening transition, call the existing invitation-entry handler, and start the existing music attempt from that user gesture.
- Ignore repeated activation while the transition is running.
- Preserve keyboard activation, a visible focus indicator, and an accurate accessible label.
- Under `prefers-reduced-motion: reduce`, remove looping/pulsing motion and shorten the gate transition without removing the state change.

### 2. Walimatulurus Invitation Page

Replace the current opening invitation-copy composition with the airy centered layout shown in `target-walimatulurus-reference.png`. Use the existing cream paper background, burgundy text, muted gold accents, and enlarged typography. Avoid wrapping this page in a floating glass card.

Render this content in this order:

1. `Jeffri Bin Mat Jaafar`
2. A gold decorative ampersand
3. `Sarina Binti Mat Din @ Samsudin`
4. `Walimatulurus` as the dominant script heading
5. `Setepak sirih, sekacip pinang, semekar senyuman, seikhlas hati`
6. `Dengan penuh kesyukuran ke hadrat Ilahi`
7. `Mengundang Dato' / Datin / Tuan / Puan / Encik / Cik`
8. A restrained gold dotted divider
9. `ke majlis perkahwinan anakanda kami`
10. `Fatin Nashuha Binti Jeffri`
11. A gold decorative ampersand
12. `Mohamad Shafiq Bin Mohd Shakri`

Preserve the existing event details, date, time, location, calendar/map actions, countdown, programme, doa, dock, music control, and sheets after this invitation page. Maintain the recently increased font sizes and ensure long names wrap intentionally rather than shrinking below readable mobile sizes.

### 3. Horizontal Animated Gallery Stack

Rebuild `HorizontalImageStack` as a horizontal layered card deck using the four existing local wedding images:

- `/Opening Gate Background.png`
- `/Main Page.png`
- `/Background Second Page.png`
- `/Background Last page.png`

Use a circular `currentIndex` and normalize each card's relative index around the active card. Apply horizontal transforms rather than the vertical sample from the DOCX:

- Active card: centered, scale `1`, opacity `1`, `rotateY(0deg)`, highest z-index.
- Immediate neighbours: approximately `42%` of a card width left/right, scale `0.82`, opacity near `0.58`, and opposing `rotateY` values near `8deg`.
- Second neighbours: approximately `72%` left/right, scale `0.70`, opacity near `0.24`, and opposing `rotateY` values near `14deg`.
- Other cards: moved outside the visible stage and hidden from interaction.

Use `motion.div` spring transitions. Only the active card is draggable with `drag="x"`, zero-width drag constraints, and modest elasticity. A horizontal drag of at least 50 pixels changes the active image. Preserve circular previous/next navigation.

Also provide:

- Previous and next icon buttons with accessible labels.
- Clickable navigation dots with an active state.
- A polite `current / total` counter.
- Left/right keyboard navigation on a focusable gallery region.
- Useful image alt text and non-draggable images.
- `touch-action: pan-y` so the user can still scroll the invitation vertically.
- No global wheel listener and no interception of ordinary vertical scrolling.
- A reduced-motion mode that keeps navigation functional with simple opacity changes.

Keep the gallery stage within the invitation frame at 320px through 520px widths. Neighbouring cards may peek within the stage, but the page itself must never gain horizontal overflow.

### 4. Closing RSVP And Gift Page

Restyle the final section to match `target-closing-reference.png` over the existing `/Background Last page.png` asset. Use an airy, unframed composition rather than a translucent floating card.

Render:

- Eyebrow: `Kehadiran Anda Amat Bermakna`
- Heading: `RSVP & Gift`
- Copy: `Sahkan kehadiran dan tinggalkan ucapan. Ucapan terbaru akan dipaparkan di kad ini dan disimpan ke Excel.`
- Two equal-width burgundy pill buttons for `RSVP` and `GIFT`, using the existing Lucide mail and gift icons.

The buttons must open the existing RSVP and Gift sheets. Keep the fixed five-item bottom dock and separate circular music control visible and correctly layered.

## RSVP Excel Backend

Replace the browser-only RSVP persistence with a small Node server while preserving the existing `RsvpSubmission` shape:

```ts
type RsvpSubmission = {
  timestamp: string;
  name: string;
  attendance: "Hadir" | "Tidak Hadir" | "Mungkin";
  pax: number;
  phone: string;
  wish: string;
  source: string;
};
```

### Server Architecture

- Add `server/index.mjs` using Express and `xlsx`.
- Keep Vite's existing `/api` proxy pointed at `http://127.0.0.1:3001`.
- Add `express` and `xlsx` as dependencies and `concurrently` as a development dependency.
- Use these scripts:
  - `dev`: start the API and Vite together through `concurrently -k`.
  - `dev:web`: run Vite.
  - `dev:api`: run `node server/index.mjs`.
  - `build`: run `vite build`.
  - `start`: run `node server/index.mjs` after a build.
- In production mode, the Express server must serve `dist/` and return `index.html` for non-API application routes.
- Store the workbook at `data/shua-rsvp.xlsx` in a worksheet named `RSVP Responses` with columns `Timestamp`, `Name`, `Attendance`, `Pax`, `Phone`, `Wish`, and `Source`.
- Keep generated XLSX files ignored by Git.

### API Contract

`GET /api/rsvp`

```json
{
  "submissions": [],
  "workbook": "data/shua-rsvp.xlsx"
}
```

`POST /api/rsvp`

Request:

```json
{
  "name": "Guest name",
  "attendance": "Hadir",
  "pax": 2,
  "phone": "0123456789",
  "wish": "Ucapan ringkas"
}
```

Success response:

```json
{
  "submission": {},
  "submissions": [],
  "workbook": "data/shua-rsvp.xlsx"
}
```

Error response:

```json
{
  "error": "User-facing error message"
}
```

Normalize whitespace and enforce these limits: name 80 characters and required, phone 30 characters, wish 240 characters, pax 1 through 10, and attendance restricted to the three existing values. Prefix spreadsheet cell values that begin with `=`, `+`, `-`, or `@` with an apostrophe before writing them. Serialize workbook writes so concurrent submissions cannot overwrite one another.

On application load, fetch recent submissions and show them in the wishes area. On successful POST, refresh the wishes from the returned response, clear the form, and show the Excel success message. On failure, show the API error, retain all form values, and do not claim that the RSVP was saved. Seed wishes may remain as a GET-failure display fallback, but POST failures must never silently fall back to local storage.

## Quality Constraints

- Keep the application mobile-first and centered at its existing maximum width on larger screens.
- Do not remove working sections, dock actions, bottom sheets, contact links, calendar/map links, countdown logic, or the persistent music player.
- Do not introduce remote gallery images or sneaker placeholders.
- Do not replace Lucide icons with hand-drawn SVGs.
- Avoid horizontal overflow, overlapping text, clipped names, and controls hidden behind the fixed dock.
- Preserve the existing burgundy, cream, blush, and muted-gold identity while matching the supplied references more closely.
- Keep code changes focused. Extract a component or helper only when it reduces real complexity.

## Acceptance And Verification

Complete all of the following before reporting success:

1. Run `npm install` after dependency changes and commit the updated lockfile.
2. Run `npm run build` successfully.
3. Run `npm run dev`; verify the Vite page and `GET /api/rsvp` both return HTTP 200.
4. Submit a valid RSVP and verify it appears in the UI and in `data/shua-rsvp.xlsx`.
5. Submit a name beginning with `=` and verify the workbook stores it as text rather than a formula.
6. Verify a failed API request keeps the form values and displays an error.
7. Test at approximately 390x844 and 1280x900.
8. Verify opening the emblem reveals the invitation once and attempts music from the same user gesture.
9. Verify gallery drag, arrows, dots, and keyboard navigation, including wraparound.
10. Verify ordinary vertical scrolling still works over the gallery and the document has no horizontal overflow.
11. Verify the RSVP/Gift buttons and every dock sheet still work.
12. Verify reduced-motion behavior and visible keyboard focus.
13. Check the browser console for errors and capture final opening, invitation, gallery, and closing screenshots.
14. Run `npm run build`, then `npm start`, and verify the built site and RSVP API work through the production server.

Finish with a concise summary of changed files, verification results, the local URL, and any genuine remaining limitation. Do not commit or push unless separately instructed.
