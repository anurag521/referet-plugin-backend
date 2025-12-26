
# Implementation Plan: Referral Rewards Pro

This plan follows the "Referral Rewards Pro – Complete Implementation Guide" step-by-step.

We will proceed module by module. After completing each module, I will update this document to mark it as **[COMPLETED]** and explain exactly what was done.

---

## 🏗️ Phase 1: Database Schema Design (The Foundation)
**Goal:** Define the data structure to store shops, campaigns, referrals, and rewards as per the PDF.

- [x] **1. Shops Table**
    - Stores shop URL, access token (encrypted), plan type, and active status.
    - *Why:* Supports multi-tenant architecture (multiple stores using the app).
    
- [x] **2. Campaigns Table**
    - Stores logic: `referrer_reward_value`, `referee_discount`, `min_order_value`.
    - *Why:* Allows merchants to customize rules instead of hardcoded 10%.

- [x] **3. Referrals Table**
    - Stores `referrer_email`, `code` (Unique), `status` (pending/approved), `order_id`.
    - *Why:* Tracks who referred whom and the lifecycle of the referral.

- [x] **4. Rewards Table**
    - Stores `amount`, `type` (coupon/cash), `status`.
    - *Why:* Manages the payouts to referrers.

- [x] **5. Fraud Records Table**
    - Stores IPs and emails of suspicious actors.
    - *Why:* Prevents self-referrals and abuse.

**Database Provider:** NeonDB (PostgreSQL)

---

## 🔌 Phase 2: Backend API Implementation (NestJS)
**Goal:** Create the endpoints that the frontend and Shopify Webhooks will talk to.

### Module A: Referrals Module
- [x] **Generate Link (`POST /api/referrals/generate`)**
    - Accept email & shop.
    - Check for existing code.
    - Generate new code if needed.
    - Return `referral_link`.
    
- [x] **Track Click (`GET /api/referrals/click`)**
    - Validate code.
    - **Implementation Note:** PDF asks for Cookies. We will implement a redirect response that sets a server-side cookie OR ensure the frontend script handles this robustly via localStorage (depending on constraints).

### Module B: Webhooks Module (The Brain)
- [x] **Order Created (`POST /webhooks/orders/create`)**
    - **Step 1: Validation**
        - Check if order has `referral_code` (from Cart Attributes).
        - Check `FraudScore` (IP/Email match).
    - **Step 2: Campaign Check**
        - Fetch active campaign for the shop.
        - Verify `Order Total >= Min Order Value`.
    - **Step 3: Action**
        - Create a `Reward` record (Status: Pending) [TODO: Link to Rewards Module].
        - Update `Referral` status to `Qualified`.

### Module C: Rewards Module
- [x] **Approve Reward (`POST /api/rewards/approve`)**
    - Admin clicks "Approve" in Dashboard.
    - System generates Shopify Discount Code via Admin API.
    - Marks reward as `Issued`.

---

## 🎨 Phase 3: Frontend Implementation (Referet Plugin)
**Goal:** Build the UI for the merchant to manage campaigns and view stats.

- [x] **Dashboard - Campaigns Tab (`app/routes/app.campaigns.tsx`)**
    - Form to set Reward % and Min Order Value.
    - Saves to `Campaigns` table.
    
- [x] **Dashboard - Referrals Tab (`app/routes/app.referrals.tsx`)**
    - Table showing all referrals, status, and earnings.
    
- [x] **Dashboard - Rewards Tab (`app/routes/app.rewards.tsx`)**
    - List of pending rewards.
    - "Approve" button wired to the Backend API.

---

## ✅ Progress Log

### Current Status: Phase 3 Completed (Frontend)
- **Phase 1 (Schema):** Completed. NeonDB connected.
- **Phase 2 (Backend):** 
    - Referral generation & tracking API implemented.
    - Webhook handler for `order/create` implemented (validates referral, fraud checks, creates reward).
    - Rewards service implemented (approval flow).
- **Phase 3 (Frontend):** 
    - Dashboard built with Stats, Campaigns, Referrals, and Rewards management pages using Polaris components.
    - Connected to local Backend API for reward approval.
