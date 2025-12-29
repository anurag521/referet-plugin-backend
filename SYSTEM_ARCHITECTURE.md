The system has three main components:

Shopify App (Embedded)

Handles app install, OAuth, theme extension, and product-page widget.

Backend API (NestJS + Supabase + PostgreSQL)

Handles auth, campaigns, referral links, tracking, rewards, fraud logic, and webhooks.

Merchant Portal (Refertle Web App)

Separate front‑end that talks to the NestJS API; used only by merchants to manage campaigns and rewards.

Shopify side:

Use App Bridge, OAuth, and Theme App Extensions according to Shopify 2025 best practices.
​

2. NestJS Backend Structure
2.1 Tech Stack
NestJS (REST API, modules, guards, interceptors).

Supabase:

Supabase Auth for merchant accounts.

Supabase/PostgreSQL for relational data (campaigns, referrals, rewards).

Shopify Admin API & Webhooks for orders, discounts, and shop data.
​

2.2 High-Level Modules
AuthModule – Merchant auth using Supabase.

ShopifyModule – OAuth, Shopify API client, webhook verification.

CampaignsModule – CRUD for campaigns.

ReferralsModule – Referral code generation, click tracking, referral transactions.

RewardsModule – Reward calculation, wallet/points/cashback handling, discount code generation.

FraudModule – Fraud rules and review queue.

AnalyticsModule – Dashboards, funnel, revenue metrics.

WebhookModule – NestJS controllers for Shopify webhooks (orders, app uninstall).

Each module exposes controllers (@Controller), services (@Injectable), DTOs (class-validator), and Prisma/TypeORM repositories or Supabase client services.

3. Phase 1 – Merchant Onboarding & Authentication
3.1 App Install & OAuth
Shopify merchant installs the app from the Shopify App Store.

Shopify redirects through OAuth to a NestJS route:

GET /shopify/oauth/callback handled in ShopifyController.

ShopifyService:

Exchanges code for access_token.

Stores shop_id, shop_domain, access_token, and plan in merchants table.

Registers webhooks:

app/uninstalled

orders/create

orders/updated

orders/cancelled

shop/update

Use HMAC verification for security as recommended in Shopify docs.
​

3.2 Merchant Signup (from Shopify App)
Route in AuthController:

POST /api/auth/merchant/signup

Body: { name, email, phone, password }

Context: shop_id, access_token, and plan come from the OAuth session (server-side).

Flow:

Verify shop_id matches Shopify session.

Create Supabase Auth user (email/password).

Insert merchants row:
{ id, shop_id, shop_domain, email, phone, access_token_encrypted, plan, status }.

Create webhook signing secret.

Return { merchant_id, status: "active" }.

Edge cases:

Duplicate email → 409 conflict with message.

Invalid shop data → verify via Shopify API and abort.

3.3 Auto Login to Refertle Portal
After signup, NestJS generates a JWT (signed with app secret) containing { merchant_id, shop_id, email }.

Redirect merchant to the Refertle portal URL with token in query/hash (or via httpOnly cookie).

Portal uses this token to call NestJS APIs; NestJS guards (AuthGuard) validate JWT and attach merchant context.

4. Phase 2 – Campaign Management (NestJS APIs)
4.1 Campaign Entity
Core fields:

name

status: draft | scheduled | active | paused | completed

start_date, end_date

reward_type: cashback | wallet | reward_points

who_gets_reward: both | referrer_only | referee_only

```typescript
referrer_reward: { type: "fixed" | "percentage", value: number }
```

referee_reward: same shape

conditions:

min_order_value

eligible_products (IDs or "all")

eligible_collections

usage_limit: "one_time" | "unlimited"

reward_issuance:

"instant" | "after_days" + reward_issuance_days

reward_expiry_days

return_cancellation_rule: "revoke" | "keep_pending" | "manual_review"

4.2 Campaign Routes (CampaignsController)
POST /api/campaigns – Create campaign

DTO with validation using class-validator.

Uses CampaignsService.create(merchantId, dto).

Validations:

start_date < end_date.

start_date >= now for scheduled.

Reward values positive and within reasonable range.

For status = active: mark active immediately.

For status = scheduled: push a job into a scheduler (e.g., BullMQ) to activate at start_date.

PUT /api/campaigns/:id – Edit campaign

Draft/scheduled: full edit allowed.

Active: restrict critical changes (reward type, who_gets_reward).

Log all edits into campaign_audit_log.

DELETE /api/campaigns/:id – Delete campaign

If draft and no referrals → hard delete.

Else → soft delete (status = deleted) and cancel pending rewards.

PATCH /api/campaigns/:id/status – Activate/pause/complete

Guard ensures merchant owns the campaign.

GET /api/campaigns – List with filters (status, date range, paging).

GET /api/campaigns/:id – Detail view.

5. Phase 3 – Referral Link Generation & Tracking
5.1 Product Page Widget (Shopify Theme Extension)
The extension calls NestJS APIs using the merchant’s public API key / JWT.
​

UI: “Share & Earn ₹X” button on Product Detail Page.

Flow:

If visitor has existing identifier (cookie/localStorage with email/phone) use it.

If not, show an email/phone capture modal (front‑end only).

5.2 Generate Referral Link (ReferralsController)
POST /api/referrals/generate

Body:

json
{
  "product_id": "string",
  "variant_id": "string | null",
  "user_identifier": "email or phone",
  "campaign_id": "string (optional)"
}
Logic in ReferralsService:

Get merchant from auth context.

Pick campaign:

If campaign_id provided, validate it is active.

Else choose default active campaign for that product (latest or by priority).

Create / find referrer record for this merchant + identifier.

Reuse existing code if same referrer + campaign + product already has one.

Otherwise generate unique referral_code.

Build URL: https://{shop_domain}/products/{handle}?ref={code}.

Return: { referral_url, reward_info }.

Edge cases:

No active campaign → respond with “no_campaign” status so widget can hide reward text.

Invalid product → validation error.

5.3 Track Clicks
POST /api/referrals/track-click

Body:

json
{
  "code": "referral_code",
  "source": "whatsapp | email | social | direct",
  "user_agent": "...",
  "ip": "..."
}
Logic:

Find referral_codes entry; if not found, ignore or mark as invalid.

Insert into referral_clicks with timestamp, IP, UA, source.

Mark cookie/localStorage in client (7‑day attribution window).

Front‑end snippet (placed by the app script):

On page load, read ?ref= param.

If present → call this API, then store ref in cookie.

6. Phase 4 – Order Webhooks & Referral Attribution
6.1 Webhook Controller (WebhookController)
Routes for Shopify:

POST /webhooks/orders/create

POST /webhooks/orders/updated

POST /webhooks/orders/cancelled

POST /webhooks/app/uninstalled

Each handler:

Verifies HMAC header using shared secret.
​

Parses payload and forwards to respective service (OrdersService / RewardsService).

6.2 Order Create Logic
In OrdersService.handleOrderCreate(payload):

Extract order_id, email, total_price, line_items, customer_id, discount codes, notes, source.

Find referral:

Check order attributes/metafields for referral_code.

If missing, look up last click with same email within N days.

Validate campaign:

Order total ≥ min order value.

At least one line item in eligible products/collections.

If valid:

Create referral_transactions row with status pending_validation.

Calculate rewards for referrer and referee and create rewards entries with pending or approved based on issuance rules.

Edge cases:

Self‑referral: referrer identifier same as referee email/phone → mark as fraud_suspected.

Multiple codes for same order → last click wins (configurable).

Below min order value → mark transaction as invalid.

6.3 Order Update / Cancel
In OrdersService.handleOrderUpdate & handleOrderCancelled:

Find any related referral_transactions.

Apply return_cancellation_rule:

revoke → set rewards to revoked, adjust wallet/points.

keep_pending → keep unapproved until manual review.

manual_review → move to fraud/review queue.

Handle partial refunds:

Recompute eligible order value and adjust reward proportionally.

7. Phase 5 – Reward System
Two actors: Referrer and Referee.

Reward types:

reward_points

wallet

cashback

Merchant sets point value (e.g., 1 point = ₹1 or custom) per shop.

7.1 Reward Creation
In RewardsService:

For each validated referral transaction:

Calculate reward amounts based on:

Fixed / percentage configuration.

Campaign who‑gets‑reward.

Order value capped at total.

Create rewards row:

ts
{
  user_email,
  user_type: 'referrer' | 'referee',
  reward_type,
  amount,
  status: 'pending' | 'approved',
  approval_date: (now or future date),
  expiry_date: approval_date + reward_expiry_days,
  campaign_id,
  transaction_id
}
If reward_issuance = instant, mark as approved immediately, else schedule via delayed job.

7.2 Reward Points
user_points table keeps aggregate balance per user_email + merchant_id.

On approval:

Increment points_balance.

Redemption:

API POST /api/rewards/redeem with points_to_redeem.

Validate balance ≥ requested.

Convert to money using merchant’s point value.

Create Shopify price rule + discount code via ShopifyService.
​

Store discount code in rewards and decrement points balance once order paid.

7.3 Wallet
user_wallets table holds balance and totals.

Flow similar to points, but stored in currency units directly.

Redemption triggers discount code creation with exact wallet amount (or partial).

On order paid (via webhook), confirm discount usage and deduct wallet balance.

7.4 Cashback
Represented as cashback_payouts linked to rewards.

Status: pending → processing → completed.

Merchant exports CSV for bank/UPI payouts.

API POST /api/cashback/mark-paid to mark as completed.

Edge cases:

Discount amount > order total → cap at order total.

Tiny rewards (e.g., < ₹1) → ignore or round up/down per configuration.

8. Phase 6 – Handling Shopify Data Limits (No Direct Customer Details)
For lower‑tier plans where direct customer queries are limited, use order info and metafields.
​

8.1 Customer Proxy Table
customers_proxy:

email (PK), optional phone, names, shopify_customer_id, aggregates.

Updated on each order webhook:

If email exists → update totals.

Else → insert new row.

8.2 Metafields Strategy
If customer_id exists, store minimal referral data in metafields:

namespace: refertle

keys: referral_code, reward_balance

This allows Shopify themes to show “Your referral rewards” via metafield reads if needed.

8.3 Email-Based Rewards
For guests without customer_id:

Discount codes not bound to a Shopify customer ID; instead, they are single‑use codes emailed to the user.

Redemption tracked via order.discount_codes in webhooks.

9. Phase 7 – Fraud Detection & Prevention
Implemented in FraudModule and used by RewardsService and OrdersService.

Rules:

Self-Referral

Compare referrer identifier with referee email/phone.

Same → mark transaction as fraud_suspected, auto‑reject or send to review.

Duplicate Referral

If campaign usage_limit is one_time and referee email already used → block new rewards.

Velocity Checks

Thresholds:

20 referrals/day from same referrer.

5 referrals/hour from same IP.

Insert into fraud_flags with severity.

Manual Review Queue

GET /api/fraud/review – list suspicious transactions.

Merchant can: approve, reject, or block user.

On reject, update rewards to rejected and adjust balances.

10. Phase 8 – Rewards Usage (Customer Perspective)
After approval:

Reward is visible to customer (via portal or widget) as:

Coupon (discount code)

Wallet credit

Cashback status

Available data per reward:

Amount

Reward type

Expiry date

Usage conditions (min cart value, eligible products)

Customers redeem via Shopify discount system using codes generated by NestJS backend.

11. Phase 9 – Analytics & Reporting
AnalyticsModule exposes:

GET /api/analytics/dashboard – totals:

Referral links generated, clicks, purchases, conversion rate, revenue from referrals, total rewards cost.

GET /api/analytics/funnel – links → clicks → purchases → rewards issued.

GET /api/analytics/top-referrers – leaderboard.

GET /api/analytics/revenue – by campaign, date, product.

Exports:

CSV endpoints for:

Referral performance.

Revenue from referrals.

Reward payout summaries.

12. Phase 10 – Database Schema (Supabase/PostgreSQL)
Core tables (same structure, now managed from NestJS via Supabase client or ORM):

merchants

campaigns

campaign_audit_log

referrers

referral_codes

referral_clicks

referral_transactions

rewards

user_wallets

user_points

customers_proxy

cashback_payouts

fraud_flags

All NestJS services use repositories or Supabase client wrappers with proper indexes for performance.
​

13. Phase 11 – Operational Concerns & Edge Cases
Rate limiting: Use a queue (e.g., BullMQ) for Shopify API calls and backoff handling.
​

Webhook idempotency: Use order_id + event type as unique key to avoid duplicate processing.

App uninstall: app/uninstalled webhook marks merchant as inactive but keeps data for possible reinstall.

Timezones: Store dates in UTC, expose in merchant’s timezone (from shop settings).

Multi‑currency: Rewards stored in shop’s default currency.

Expired rewards: Daily cron job updates expired rewards and prevents redemption.

Discount conflicts: Only one manual code per order; communicate this in UI and docs.