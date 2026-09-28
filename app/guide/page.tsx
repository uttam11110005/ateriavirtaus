"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers";
import { PageHeader } from "@/components/ui";
import type { Role } from "@/lib/types";

const STEPS: { role: Role; href: string; title: string; body: string }[] = [
  {
    role: "location",
    href: "/location",
    title: "Confirm a count as the school",
    body: "Harjurinteen koulu normally expects 300 diners. Set “On leave / absent” to 25 — the count becomes 275 — and confirm before the countdown runs out. You can also plan the next 7 service days ahead.",
  },
  {
    role: "kitchen",
    href: "/kitchen",
    title: "See it arrive in the kitchen",
    body: "The overview now shows 275 for the school. Move the demo clock to 22:30: locations that haven't confirmed by the 22:00 deadline, such as Päiväkoti Tuulenpesä, turn Missing and planning falls back to an estimate.",
  },
  {
    role: "kitchen",
    href: "/kitchen/production",
    title: "Read the recommendation, then approve or adjust",
    body: "Every input is visible: expected diners, absences (confirmed vs estimated), historical adjustment and buffer. Approve it, or adjust with a reason. Nothing is changed automatically.",
  },
  {
    role: "kitchen",
    href: "/kitchen/actuals",
    title: "Record the results after service",
    body: "Pick the service day, enter 280 produced and 272 served for the school. Surplus is calculated (8 meals); add waste in kg. Large gaps ask for a variance reason.",
  },
  {
    role: "manager",
    href: "/manager",
    title: "Find the pattern as the manager",
    body: "In the synthetic data, late or missing confirmations produce roughly three times more surplus per location-day than on-time ones. The attention table names where to start.",
  },
];

const QUESTIONS = [
  ["How does the kitchen currently know tomorrow's diner count?", "Information source"],
  ["Who enters or confirms the number?", "Ownership"],
  ["What is the deadline?", "Timing"],
  ["What happens if the count changes after the deadline?", "Exception workflow"],
  ["Which system is used today?", "Existing technology"],
  ["Where do people use paper, Excel, email or phone calls?", "Manual work"],
  ["How are special diets included?", "Meal-mix complexity"],
  ["How do you compare planned vs actual meals?", "Feedback loop"],
  ["What is the most common reason for surplus?", "Root cause"],
  ["If you could remove one manual step, which would it be?", "Product opportunity"],
];

export default function Guide() {
  const { setRole } = useSession();
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-8">
      <PageHeader eyebrow="Demo guide · about five minutes" title="Walk the loop: predict, communicate, produce, measure, learn">
        Start from a fresh state (Settings → Reset demo data). The app runs on real time: every location must confirm by 22:00 the evening before service, and the countdown shows how long is left. Use the clock in the top bar to jump to another time of day.
      </PageHeader>

      <ol className="flex flex-col">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rise grid grid-cols-[36px_1fr] gap-4" style={{ "--i": i + 1 } as React.CSSProperties}>
            <div className="flex flex-col items-center">
              <span className="num grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{i + 1}</span>
              {i < STEPS.length - 1 && <span className="w-px flex-1 bg-line-strong" aria-hidden />}
            </div>
            <div className="pb-8">
              <h2 className="pt-1.5 text-[17px] font-semibold tracking-tight text-ink">{s.title}</h2>
              <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-ink-2">{s.body}</p>
              <button
                onClick={() => {
                  setRole(s.role);
                  router.push(s.href);
                }}
                className="press mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                Open as {s.role === "location" ? "school" : s.role} <ArrowRight size={14} />
              </button>
            </div>
          </li>
        ))}
      </ol>

      <section className="card rise overflow-hidden" style={{ "--i": 6 } as React.CSSProperties}>
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-semibold text-ink">Questions to validate with food-service staff</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            The prototype is a proposed workflow, not a finished solution. If an existing system already covers a step,
            investigate the remaining gap instead.
          </p>
        </div>
        <ul className="divide-y divide-line">
          {QUESTIONS.map(([q, what]) => (
            <li key={q} className="flex flex-col gap-0.5 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <span className="text-[15px] text-ink">{q}</span>
              <span className="shrink-0 text-[13px] text-ink-3">{what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rise grid grid-cols-1 gap-6 text-sm leading-relaxed text-ink-2 md:grid-cols-2" style={{ "--i": 7 } as React.CSSProperties}>
        <div>
          <h3 className="mb-1.5 font-semibold text-ink">What the prototype deliberately does not do</h3>
          <p>
            It does not replace meal-planning, attendance or ERP systems, never lowers production without a person approving it,
            makes no nutrition or allergy decisions, stores no personal data (aggregate counts only), and claims no waste-reduction
            percentage before a measured pilot.
          </p>
        </div>
        <div>
          <h3 className="mb-1.5 font-semibold text-ink">How it is built</h3>
          <p>
            Next.js with API routes that mirror the PRD endpoints (<code className="text-[13px]">/api/demand</code>,{" "}
            <code className="text-[13px]">/api/production/*</code>, <code className="text-[13px]">/api/actuals</code>,{" "}
            <code className="text-[13px]">/api/analytics</code>), server-side validation on every write, an audit log for each
            confirmation and change, and a relational data model that can move to Postgres unchanged.
          </p>
        </div>
      </section>
    </div>
  );
}
