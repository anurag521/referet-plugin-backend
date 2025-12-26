# Campaign Creation & Management Flow

This document explains the lifecycle of how campaigns are created and managed in the Referral System, covering both the Shopify App frontend and the NestJS backend.

---

## 1. Prerequisites: Shop Installation
A campaign **cannot** exist without a valid `Shop` record. 
- When a merchant installs the app, the `afterAuth` hook in `shopify.server.ts` (Frontend) triggers.
- It performs an `upsert` in the database to ensure the `Shop` exists and has a valid `accessToken`.

---

## 2. Automatic Campaign Creation (Default)
To ensure the referral system works "out of the box," the system creates a default campaign in two scenarios:

### A. During First Visit
When a merchant first opens the app dashboard, the backend checks for a campaign. If none is found, the system is designed to either prompt for creation or auto-seed a "Default Campaign."

### B. During Referral Link Generation
In `referral.service.ts` (Backend), if a customer tries to generate a referral link but no shop or campaign exists in the database:
1. It creates a **Default Shop** record.
2. It creates an **Active Default Campaign** with these values:
   - **Name:** "Default Campaign"
   - **Status:** `ACTIVE`
   - **Referrer Reward:** 1000 (e.g., $10.00)
   - **Referred Reward:** 10 (%)
   - **Min Order Value:** 500 (e.g., $5.00)

---

## 3. Manual Creation (Shopify Admin UI)
Merchants can customize their rewards through the **Campaign Settings** page in the Shopify App.

### The "Upsert" Logic
The system currently follows a **Single-Active-Campaign** model per shop:
1. **Frontend Action**: When a merchant clicks "Save Campaign" in `app.campaigns.tsx`.
2. **Backend Logic**:
   - The system checks for an existing campaign with `status: 'ACTIVE'`.
   - **If found**: It updates the existing record with the new values (Name, Rewards, Min Order).
   - **If not found**: It creates a new record with `status: 'ACTIVE'`.

---

## 4. Field Definitions
When creating a campaign (via UI or Postman), these are the key fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Internal name (e.g., "New Year Sale") |
| `status` | String | `DRAFT`, `ACTIVE`, or `SCHEDULED` |
| `rewardRecipient` | String | Who gets paid? `BOTH`, `REFERRER`, or `REFERRED` |
| `referrerRewardValue` | Integer | Amount in paisa/cents (e.g., 1000 = $10.00) |
| `referredRewardValue`| Integer | Discount value (e.g., 10 for 10%) |
| `referredRewardType` | String | `FIXED` or `PERCENTAGE` |
| `minOrderValue` | Integer | Minimum purchase amount required to trigger reward |

---

## 5. Technical Implementation Details

### Database (Prisma)
Campaigns are stored in the `campaigns` table and are linked to the `shops` table via `shop_id`.
```prisma
model Campaign {
  id                    String   @id @default(uuid())
  shopId                String   @map("shop_id")
  status                String   @default("DRAFT")
  referrerRewardValue   Int
  referredRewardValue   Int
  // ... other fields
}
```

### API Endpoint (Backend)
- **Endpoint**: `POST /campaigns`
- **Query Param**: `?shopDomain=your-store.myshopify.com`
- **Validation**: The backend will return a `404 Not Found` if the `shopDomain` provided has not installed the app yet.

---

## 6. How to Test Creation
1. **Wipe DB**: Clear the `Campaign` and `Shop` tables.
2. **Install App**: Open the app in Shopify Admin. (Verify `Shop` record appears).
3. **Save UI**: Go to "Campaign Settings" in the App, enter values, and save.
4. **Verify**: Check Prisma Studio to see the created record.
