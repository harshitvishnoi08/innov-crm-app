/**
 * Database schema described for Innov AI.
 *
 * IMPORTANT: This project's Prisma models have no @map on columns, so the real
 * Postgres column names are case-sensitive camelCase and MUST be double-quoted
 * in raw SQL. Table names are snake_case (via @@map). Only the tables/columns
 * listed here are exposed to the AI — auth tables (accounts, sessions,
 * verifications) and secret columns (passwords, tokens) are intentionally omitted.
 */
export const SCHEMA_CONTEXT = `
You are querying a PostgreSQL database for a real-estate CRM called "Innov".

CRITICAL SYNTAX RULES
- Column names are case-sensitive camelCase and MUST be wrapped in double quotes.
  Correct:   SELECT "customerName", "leadCreatedDate" FROM leads
  Wrong:     SELECT customerName, leadCreatedDate FROM leads
- Table names are lowercase snake_case and are written WITHOUT quotes (e.g. leads, lead_activities).
- Use single quotes for string/text values.
- For "this week / last 7 days / today" use now() and interval, comparing against the
  relevant timestamptz column, e.g. WHERE "leadCreatedDate" >= now() - interval '7 days'.

ENUMS (stored as text, compare with exact upper-case values)
- LeadStatus: NEW, FOLLOW_UP, NOT_ANSWERED, MEETING_FIXED, CONTACT_IN_FUTURE, CLOSED_WON, CLOSED_LOST, JUNK
- LeadTemperature: HOT, WARM, COLD
- ActiveStatus: ACTIVE, INACTIVE, HOLD
- UserRole: ADMIN, USER

TABLES AND COLUMNS

leads  — sales leads (the central table)
  id (text), "customerName" (text), "contactNumber" (text), "alternateContact" (text),
  email (text), state (text), city (text), platform (text), "leadSource" (text),
  status (LeadStatus), temperature (LeadTemperature, nullable), "activeStatus" (ActiveStatus),
  "assignedTo" (uuid -> users.id, the salesperson handling the lead),
  "leadCreatedDate" (timestamptz, when the lead actually came in),
  "followUpDate" (timestamptz, nullable),
  "propertyType", "serviceRequired", "briefScope", "budgetRange", "propertySize",
  requirement, "initialNotes", "preferredCallTime" (all text),
  "visitChargeQuoted" (numeric), "visitTokenAmount" (numeric),
  "userId" (uuid -> users.id, who created the record),
  "createdAt" (timestamptz), "updatedAt" (timestamptz)

users  — team members (only safe columns are available)
  id (uuid), name (text), email (text), "rolePermissionId" (uuid -> role_permissions.id),
  "createdAt" (timestamptz)

role_permissions  — roles for users
  id (uuid), role (UserRole)

meetings  — scheduled meetings with leads
  id (uuid), "leadId" (text -> leads.id), "userId" (uuid -> users.id, nullable),
  agenda (text), "meetingDate" (timestamptz), "reminderSent" (boolean),
  "createdAt" (timestamptz), "updatedAt" (timestamptz)

comments  — notes on leads
  id (uuid), "leadId" (text -> leads.id), "userId" (uuid -> users.id, nullable),
  content (text), type (text, default 'note'), "createdAt" (timestamptz)

lead_activities  — activity log for leads
  id (text), "leadId" (text -> leads.id), "activityDate" (timestamptz),
  "activityType" (text), note (text, nullable), "userId" (uuid -> users.id, nullable),
  "createdAt" (timestamptz)

whatsapp_messages  — WhatsApp messages exchanged with leads
  id (text), "leadId" (text -> leads.id), "fromNumber" (text), "toNumber" (text),
  direction (text: 'inbound' | 'outbound'), "messageType" (text), "messageBody" (text, nullable),
  "templateName" (text, nullable), status (text: accepted|sent|delivered|read|failed),
  "sentBy" (uuid -> users.id, nullable), "sentAt" (timestamptz, nullable),
  "createdAt" (timestamptz)

whatsapp_template_rules  — config for automated WhatsApp templates
  id (text), name (text), "formKeyword" (text), "templateName" (text),
  language (text), "isActive" (boolean), "createdAt" (timestamptz)

RELATIONSHIPS
- A lead is created by users via leads."userId" and assigned to a salesperson via leads."assignedTo".
- meetings, comments, lead_activities and whatsapp_messages all link to a lead via "leadId".
- To get a user's role: JOIN role_permissions ON role_permissions.id = users."rolePermissionId".
- To show the salesperson name for a lead:
  JOIN users ON users.id = leads."assignedTo".

GUIDELINES
- Generate exactly ONE read-only SELECT statement (a leading WITH/CTE is fine).
- Never write to the database (no INSERT/UPDATE/DELETE/DDL).
- Prefer human-friendly output: join to users to return names instead of raw uuids,
  and give aggregate columns clear aliases (e.g. AS "lead_count").
- Results are capped at 100 rows automatically; for "how many" questions use COUNT(*).
`.trim();
