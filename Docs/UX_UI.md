# Voice Agent MVP – UX/UI Design Plan (Single‑Source of Truth)

*Last updated: 2025‑08‑06*

---

## 1. Purpose & Scope

A low‑latency TTS‑LLM‑STT voice agent that answers after‑hours phone calls for SMBs, handling call routing, simple secretarial tasks (scheduling, message taking, basic CRM data capture), and seamless hand‑off back to human staff during business hours.
This document defines the **functional UI/UX requirements**, **information architecture**, and **development sequencing** for the initial pilot release, complementing the existing PRD and Tech‑Stack docs.

---

## 2. Pilot Verticals & Contextual Needs

| Vertical                           | Unique Needs impacting UI                                                    | Priority |
| ---------------------------------- | ---------------------------------------------------------------------------- | -------- |
| **Plumbing / HVAC / Electricians** | "Emergency" toggle for after‑hours escalation routing; variable job duration | **P0**   |
| **Dental / Medical Clinics**       | HIPAA notice banners; appointment type granularities (cleaning, check‑up…)   | **P0**   |
| **Salons** (sandbox)               | High booking volume, shorter slot length, promo code field                   | **P1**   |
| **Law Offices**                    | Conflict‑check disclosure page; custom intake form link                      | **P2**   |

---

## 3. Core User Roles

* **Owner/Admin** – sets up account, billing, integrations.
* **Dispatcher/Staff** – reviews call logs, toggles routing, edits schedule.
* **Read‑only Auditor** (future) – compliance reviews.

---

## 4. Information Architecture

1. **Marketing Site (public)**

   * *Landing* (hero, value prop, pricing tiers).
   * *Features*
   * *Pricing*
   * *FAQ*
   * *TOS* / *Privacy Policy* (static).
2. **Auth Module**

   * Email/Password + Google OAuth (Apple & Microsoft later).
3. **Org Dashboard (post‑login)**

   * **Onboarding Wizard** (multi‑step): business info → phone numbers → script composer → scheduling setup → test‑call.
   * **Agent Overview** (status cards): Current routing state, today’s calls, health metrics.
   * **Script Studio**: editable templates with slot variables and quick‑test dial‑out.
   * **Business Settings**: hours, locations, escalation numbers.
   * **Action Library**: toggle & configure actions (Scheduling, Callback Message, Call Transfer, CRM Push).
   * **Calendar**: two‑pane view (monthly + list) with appointment type & duration editor; external calendar sync status badge.
   * **Call Logs**: searchable table with date, caller‑id, transcript snippet, listen button.
   * **Integrations Hub**: Calendar (Google / Outlook), CRM (HubSpot, Salesforce), Payments (Stripe). Placeholder cards for future.
   * **Billing & Usage**: plan, credit balance, invoices.

---

## 5. Feature Specifications

### 5.1 Authentication & Org Creation (P0)

* Email/password signup with verification.
* Google OAuth (OIDC).
* Org invite flow for additional users.

### 5.2 Onboarding Wizard (P0)

* **Step 1:** Business Basics (name, industry select, hours, timezone).
* **Step 2:** Phone Numbers (buy/verify Twilio # or bring‑your‑own). Webhook auto‑config guide.
* **Step 3:** Script Composer (greeting, fallback, hold‑music pick). Live character‑count & TTS preview.
* **Step 4:** Scheduling Rules (slot types, durations, buffer, double‑booking guard).
* **Step 5:** Test Call – system dials admin, plays greeting, records feedback.

### 5.3 Agent Control Panel (P0)

* **Routing Toggle** (Auto/Manual/Lunch‑break). Quick presets.
* Real‑time status badge (online/offline, latency).

### 5.4 Scheduling Engine UI (P0)

* CRUD appointment types. Drag‑and‑drop calendar; sync status indicators.

### 5.5 Call Logging & QA (P0)

* Table + detail drawer with full transcript & audio player.
* Tagging / sentiment (future P2).

### 5.6 Payments (P0)

* Stripe checkout for subscription tiers + usage overages.

### 5.7 Script Studio Enhancements (P1)

* Industry‑specific snippet library; variable insertion chips; version history.

### 5.8 Integrations Hub (P1)

* OAuth flows; status badges; retry queue view.

### 5.9 Analytics Dashboard (P2)

* Call volume trends, booking conversion, avg call duration.

### 5.10 Accessibility & Compliance

* WCAG 2.1 AA color contrast.
* HIPAA banner toggle for covered entities.

---

## 6. Development Sequencing (Suggested Sprints)

| Sprint                          | Goals                                                                            | Key Pages / Components          |
| ------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| **0 – Foundations**             | Repo scaffolding, design system (Tailwind + shadcn/ui), routing, auth framework. | Layout shell, Auth pages        |
| **1 – Onboarding (Happy Path)** | Wizard MVP + Twilio number connect; minimal Script Composer; test call stub.     | Wizard steps 1‑3, test call API |
| **2 – Scheduling MVP**          | Calendar view, appointment type CRUD, basic org settings.                        | Calendar, settings pages        |
| **3 – Call Handling & Logs**    | Webhooks ingestion, transcript display, audio storage.                           | Call Log table & drawer         |
| **4 – Routing Control**         | Real‑time status, routing toggle widget, lunch‑break presets.                    | Dashboard cards                 |
| **5 – Payments & Billing**      | Stripe integration, plan enforcement.                                            | Billing page                    |
| **6 – Polish & Accessibility**  | Visual audit, WCAG compliance, responsive tweaks.                                | Site‑wide                       |
| **7 – P1 Enhancements**         | Script versioning, Integrations hub scaffolding.                                 | Script Studio upgrades          |

---

## 7. Design System & Components

* **Base stack:** React + Vite, TailwindCSS, shadcn/ui components.
* **Global Elements:** Toasts, modal, drawer, breadcrumb header, status chip, primary/secondary buttons.
* **Voice‑specific:** Waveform loader, Live latency indicator, Dial‑out tester.

---

## 8. Non‑Functional Requirements

1. **Latency budget:** UI actions ≤100 ms to API gateway.
2. **Mobile‑first responsive breakpoints** (xs, md, lg, xl).
3. **Error states**: clear retry guidance (especially for Twilio & Stripe OAuth failures).
4. **Internationalization stub** prepared (en‑US default).

---

## 9. Open Questions / TODOs

* Confirm final pricing tiers for billing page copy.
* Determine HIPAA BAA workflow timing.
* Decide which CRM integrations land in P1 vs P2.
* Need placeholder graphics for landing hero & industry pages.

---

## 10. Revision Log

| Date       | Author       | Notes                  |
| ---------- | ------------ | ---------------------- |
| 2025‑08‑06 | ChatGPT (o3) | Initial draft created. |

---

*End of document*
