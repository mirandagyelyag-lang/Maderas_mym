# Maderas M&M

> Business management platform built for the day-to-day operation of a real timber business.

Maderas M&M is a full-stack, mobile-first management system designed to centralize commercial and operational workflows in one application. It combines sales, inventory, purchasing, customers, suppliers, quotations, expenses, cash management and reporting with a specialized AI-assisted timber measurement workflow.

## Highlights

- Sales and multi-product transaction management
- Inventory and stock movement tracking
- Purchasing and supplier management
- Customer records and commercial history
- Quotations with detailed documents and PDF generation
- Expense and cash-flow management
- Business dashboards and reports
- User authentication, roles and permissions
- Offline-aware sales synchronization
- Installable Progressive Web App for desktop and mobile
- AI-assisted timber measurement (Cubicador)
- JAS timber volume calculations
- Supabase-backed persistence and Edge Functions
- Responsive interface designed for daily operational use

## Cubicador

The Cubicador is a domain-specific workflow for timber measurement. It combines image validation, AI-assisted reading, confidence checks and JAS volume calculations. The AI processing is isolated in a Supabase Edge Function so model credentials are never exposed to the browser.

## Tech stack

**Frontend:** React 18, Vite 6, React Router, Tailwind CSS  
**Backend & data:** Supabase, PostgreSQL, Supabase Edge Functions  
**PWA:** vite-plugin-pwa, Workbox  
**Data visualization:** Recharts  
**Documents:** jsPDF  
**UI:** Radix UI, Lucide React  
**Quality:** ESLint, TypeScript type checking and project-specific verification scripts

## Architecture

The application separates business logic into repository modules for sales, inventory, purchasing, customers, quotations, expenses, cash and timber measurements. Supabase provides authentication and persistent data, while the frontend includes offline-aware behavior for operational resilience.

```
src/
├── components/        # Shared application and UI components
├── lib/               # Business repositories, auth and domain logic
├── pages/             # Operational modules and screens
└── styles/            # Application and Cubicador styles

supabase/
├── functions/         # Server-side Edge Functions
└── *.sql              # Database setup and supporting SQL
```

## Local development

### Requirements

- Node.js 20+
- npm
- A Supabase project

### Setup

```bash
git clone https://github.com/mirandagyelyag-lang/maderas-mm.git
cd maderas-mm
npm ci
cp .env.example .env
npm run dev
```

Configure the following values in `.env`:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

AI provider credentials used by the Cubicador belong in Supabase Edge Function secrets and must not be exposed through Vite environment variables.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run verify
npm run build
```

The verification suite includes project checks and dedicated Cubicador/JAS regression tests.

## Production

The frontend is configured as an installable PWA and can be deployed to a static frontend platform such as Vercel. The Cubicador server-side logic is deployed separately as a Supabase Edge Function.

## Project status

Active project used as a real-world business management system.

## Author

**Antonia Miranda**  
Software development portfolio project
