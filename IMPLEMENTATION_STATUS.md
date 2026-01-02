# Implementation Status

This document tracks the progress of the Referet Plugin against the `SYSTEM_ARCHITECTURE.md`.

> [!WARNING]
> **Major Regression:** As of Dec 29, the `Campaigns`, `Referral`, `Rewards`, `Customers`, and `Shops` modules have been removed from the backend. The project is currently focused on the Core Auth & Webhooks foundation.

## Phase 1: Merchant Onboarding & Authentication
**Status: Complete [100%]**
- [x] **3.1 App Install & OAuth (Backend)**: `ShopifyModule` handles basic app context.
- [x] **3.2 Merchant Signup (Backend)**: `AuthModule` exposes `POST /api/auth/merchant/signup`.
- [x] **3.2 Merchant Signup (Frontend)**: `app.signup.tsx` functional.
- [x] **3.3 Dashboard Status**: `GET /api/auth/status` endpoint functional.
- [x] **3.4 External Login API**: `POST /api/auth/login` implemented for external portal access (Supabase Auth).

## Phase 2: Campaign Management
**Status: Partial / Backend Only [Logic Ready, UI Missing]**
- [x] **4.1 Campaign Entity/Service**: `CampaignsService` is fully implemented with validation.
- [ ] **4.2 Campaign Routes**: `CampaignsController` exists but no Frontend UI (`app.campaigns.tsx`) to consume it.
- [ ] **Frontend UI**: No pages exist.

## Phase 3: Referral Link Generation & Tracking
**Status: Partial / Backend Only [Mock Logic]**
- [x] **5.1 Backend Logic**: `ReferralsService` generates codes and validates them.
- [ ] **5.2 Discount Integration**: `validateReferralCode` returns MOCK discounts (`REF-XXXX`). Needs `ShopifyService` integration to create real PriceRules.
- [ ] **Frontend UI**: No Referral history view.

## Phase 4: Order Webhooks & Referral Attribution
**Status: Critical Gap [0%]**
- [ ] **6.1 Webhook Controller**: `WebhooksController` is EMPTY. No order tracking.
- [ ] **6.2 Attribution Logic**: The system cannot track purchases or reward referrers yet.

## Phase 5: Reward System
**Status: Not Started [0%]**
- [ ] **Backend**: No logic for Wallet/Payouts.
- [ ] **Frontend**: No UI.

## Phases 6-11 (Later Stages)
**Status: Pending [0%]**

---

## Immediate Next Steps (Recovery Plan)
1.  **Backend - Webhooks**: Implement `POST /webhooks` to listen for `orders/create`.
2.  **Backend - Discounts**: Make `ReferralsService` create *real* Shopify discounts.
3.  **Frontend - Campaigns**: Allow merchants to create campaigns (`app/routes/app.campaigns.tsx`).
