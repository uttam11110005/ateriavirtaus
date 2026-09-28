# Ateriavirtaus — meal-demand prototype

Decision-support prototype built from `Ateriavirtaus_BRD_PRD.docx`. It helps food-service teams know
tomorrow's diners **before** production starts, so less avoidable surplus is cooked:

**Predict → Communicate → Produce → Measure → Learn → Predict better**

All data is synthetic (8 fictional locations, 30 service days). No Servica systems are connected.

## Run

```bash
npm install
npm run dev        # http://localhost:3200
```

Data is saved to `data/db.json` (created and seeded on first request, survives refreshes).
Reset it from **Settings → Reset demo data** or by deleting the file.

## Roles (demo role switch, no login)

| Role | Screens |
| --- | --- |
| School / day-care | `/location` — confirm tomorrow's count, absences, special meals, corrections with reason |
| Kitchen | `/kitchen` overview · `/kitchen/production` explainable recommendation + approve/adjust · `/kitchen/actuals` post-service entry · `/kitchen/locations/[id]` detail + change log |
| Manager | `/manager` accuracy, surplus, waste, late-confirmation rate, reasons, attention table, CSV export |
| Demo admin | `/settings` deadlines, buffer, thresholds, locations, reset |

`/guide` has the 5-minute demo script (PRD §14) and the interview validation questions (PRD §13).

## Clock

The app runs on real time by default. Every location must confirm by **22:00 on the evening
before service**; the school screen shows a live countdown to it. The clock in the top bar can
switch to a simulated time (e.g. 21:45 or 22:30) to show Draft → Missing / Late transitions.

## Recommendation logic (PRD §6)

```
forecast    = (expected − absences)            # confirmed count, or estimate = registered − typical absences
            + historical adjustment            # mean(served − confirmed) over ≤20 recent confirmed days, ≥8 needed, capped ±5 %
recommended = forecast + round(forecast × buffer %)
```

Confidence is a data-completeness label (High / Medium / Low), not a probability. Nothing is
changed automatically — the kitchen approves, or adjusts with a mandatory reason.

## Status rules

| Status | Meaning |
| --- | --- |
| Draft | Not confirmed, deadline still open |
| Confirmed | Confirmed before the deadline |
| Changed | Corrected after confirmation (audit-logged; material changes need a reason) |
| Late | First confirmed after the deadline |
| Missing | Deadline passed without confirmation — kitchen plans on an estimate |

## API (PRD §9.3)

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/demand` | GET / POST | Location view · save/confirm/correct a count (`action: "confirm"`) |
| `/api/production/recommendation` | GET | Consolidated demand + explainable recommendation |
| `/api/production/approve` | POST | Approve or adjust (reason required when adjusted) |
| `/api/actuals` | GET / POST | Planned vs. recorded results per location |
| `/api/analytics` | GET | KPIs, daily series, by-location, reasons |
| `/api/export` | GET | CSV |
| `/api/settings`, `/api/admin/*` | GET / POST | Rules, demo clock, locations, reset |

Writes are validated server-side (PRD §8.3) and checked against the `x-demo-role` header.

## Stack

Next.js 16 (App Router, route handlers) · React 19 · Tailwind CSS 4 · Recharts · Phosphor icons · Geist.
The JSON store mirrors the relational model in PRD §8.1 so it can move to Postgres/Supabase unchanged.
