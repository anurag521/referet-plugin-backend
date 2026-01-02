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
**Status: Not Started / Deleted [0%]**
- [ ] **4.1 Campaign Entity**: Codebase was cleaned; module removed.
- [ ] **4.2 Campaign Routes**: None.
- [ ] **Frontend UI**: No pages exist.

## Phase 3: Referral Link Generation & Tracking
**Status: Not Started / Deleted [0%]**
- [ ] **5.1 Product Page Widget**: `extensions/referral-script` exists (frontend only).
- [ ] **5.2 Backend Logic**: `ReferralModule` .
- [ ] **5.3 Track Clicks**: `ReferralModule` .

## Phase 4: Order Webhooks & Referral Attribution
**Status: Partial / Backend Only [30%]**
- [x] **6.1 Webhook Controller**: `WebhooksModule` exists and is imported in `app.module.ts`.
- [ ] **6.2 Attribution Logic**: Likely requires `ReferralModule` components which are now missing.

## Phase 5: Reward System
**Status: Not Started / Deleted [0%]**
- [ ] **Backend**: `RewardsModule` removed.
- [ ] **Frontend**: No UI.

## Phases 6-11 (Later Stages)
**Status: Pending [0%]**

---

## Immediate Next Steps
1. **Debug Login API**: Fix the 500 Error on `POST /api/auth/login`.
2. **Re-implement Core Modules**:
   - Re-introduce `CampaignsModule` (Phase 2).
   - Re-introduce `ReferralModule` (Phase 3).
