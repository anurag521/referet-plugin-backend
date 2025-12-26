# Campaign API Documentation

**Base URL:** `http://localhost:4000`

## Endpoints

### 1. Create a Campaign
- **URL:** `POST /campaigns`
- **Query:** `shopDomain=your-shop.myshopify.com`
- **Body:** JSON object containing all campaign fields.

### 2. List All Campaigns
- **URL:** `GET /campaigns`
- **Query:** `shopDomain=your-shop.myshopify.com`

### 3. Get Single Campaign
- **URL:** `GET /campaigns/:id`

### 4. Update Campaign
- **URL:** `PATCH /campaigns/:id`
- **Body:** JSON object with fields to update.

### 5. Delete Campaign
- **URL:** `DELETE /campaigns/:id`

## Data Structure

| Field | Type | Default | Options |
|-------|------|---------|---------|
| `name` | string | - | - |
| `status` | string | `DRAFT` | `DRAFT`, `SCHEDULED`, `ACTIVE` |
| `startDate` | date | - | ISO String |
| `endDate` | date | - | ISO String (Optional) |
| `rewardRecipient` | string | `BOTH` | `BOTH`, `REFERRER`, `REFERRED` |
| `referrerRewardValue` | number | 0 | - |
| `referrerRewardType` | string | `FIXED` | `FIXED`, `PERCENTAGE` |
| `referredRewardValue` | number | 0 | - |
| `referredRewardType` | string | `FIXED` | `FIXED`, `PERCENTAGE` |
| `minOrderValue` | number | 0 | - |
| `usageLimit` | string | `ONCE` | `ONCE`, `MULTIPLE` |
| `eligibleProductIds` | string[] | [] | Array of Shopify GIDs |
| `rewardExpiryDays` | number | - | - |
| `issuanceType` | string | `INSTANT` | `INSTANT`, `COMPLETION_WINDOW`, `AFTER_X_DAYS` |
| `issuanceDays` | number | - | Required for `AFTER_X_DAYS` |
| `cancellationPolicy` | string | `VOID_ON_RETURN` | `VOID_ON_RETURN`, `HOLD_UNTIL_WINDOW_ENDS` |
