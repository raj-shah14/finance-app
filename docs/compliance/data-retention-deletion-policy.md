# Data Retention and Deletion Policy
## Finance Flow

**Version:** 1.0  
**Effective Date:** February 15, 2026  
**Last Reviewed:** February 15, 2026  
**Approved By:** Raj Shah, Owner

---

## 1. Purpose

This policy defines retention periods for all data types collected by Finance Flow and establishes procedures for secure deletion of data that is no longer needed. It ensures compliance with applicable data privacy laws and minimizes risk from unnecessary data retention.

## 2. Scope

This policy applies to all data collected, processed, or stored by Finance Flow, including:
- User account information
- Financial data (transactions, balances, account details)
- Authentication and session data
- Application logs and operational data
- Third-party integration tokens

## 3. Data Retention Schedule

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| **User account info** (name, email) | Duration of active account | Required for application functionality |
| **Transaction data** | Duration of active account | Core application feature; users need historical data |
| **Account balances** | Overwritten on each sync | Only current balance is stored |
| **Plaid access tokens** (encrypted) | Until user disconnects the institution | Required to sync transactions |
| **Household membership data** | Until user leaves household or account is deleted | Required for sharing features |
| **Sharing preferences** | Duration of active account | User-controlled sharing settings |
| **Custom categories & budgets** | Duration of active account | User-created application data |
| **Authentication sessions** | Managed by Clerk (auto-expiry) | Clerk handles session lifecycle with automatic expiration |
| **Webhook event logs** | 90 days | Troubleshooting and audit purposes |
| **Application error logs** | 30 days | Managed by Vercel; auto-rotated |
| **Invite links** | 30 days after creation or upon acceptance | No longer needed after acceptance or expiry |

## 4. Data Deletion Procedures

### 4.1 User-Initiated Account Deletion
When a user requests account deletion:
1. Revoke all Plaid access tokens for the user's connected institutions
2. Delete all transactions associated with the user
3. Delete all account records associated with the user
4. Delete sharing preferences and custom categories
5. Remove user from household membership
6. Delete the user record from the database
7. Trigger account deletion in Clerk (removes authentication data)
8. **Timeline:** Completed within 7 days of request

### 4.2 Bank Account Disconnection
When a user disconnects a bank account:
1. Revoke the Plaid access token for that institution
2. Delete the encrypted access token from the database
3. Optionally retain historical transactions (user's choice) or delete them
4. Delete the account balance record
5. **Timeline:** Immediate

### 4.3 Household Member Removal
When a member is removed from a household:
1. Revoke all sharing visibility of the removed member's data
2. Remove household association from the user record
3. Shared transaction views are immediately inaccessible to remaining members
4. The removed member retains access to their own personal data
5. **Timeline:** Immediate

### 4.4 Expired Data Cleanup
Periodic automated cleanup of:
- Expired/accepted invite links older than 30 days
- Application logs older than their retention period
- Orphaned records from incomplete operations

## 5. Secure Deletion Methods

| Data Location | Deletion Method |
|---------------|----------------|
| **Neon PostgreSQL (cloud)** | SQL DELETE operations; database provider handles secure storage reclamation |
| **Local PostgreSQL (self-hosted)** | SQL DELETE operations; periodic VACUUM to reclaim storage; LUKS-encrypted disk ensures deleted data is unrecoverable |
| **Vercel environment** | Serverless functions are stateless; no persistent local storage |
| **Raspberry Pi (self-hosted)** | Application is stateless between requests; database is the sole data store on encrypted disk |
| **Clerk** | Account deletion via Clerk API; Clerk handles secure data removal per their retention policy |
| **Plaid** | Access token revocation via Plaid API (`/item/remove`); Plaid deletes associated data per their policy |
| **Application logs** | Cloud: auto-rotated by Vercel. Self-hosted: log rotation via `logrotate` with 30-day retention |
| **Database backups (self-hosted)** | Encrypted backups stored off-site; older backups deleted per retention schedule |

## 6. Third-Party Data Retention

Finance Flow relies on third-party services that maintain their own retention policies:

| Service | Their Retention Policy | Our Control |
|---------|----------------------|-------------|
| **Plaid** | Retains data per their privacy policy; deleted upon `/item/remove` | We can revoke access tokens at any time |
| **Clerk** | Retains user data per their policy; deleted upon user deletion | We can delete users via API |
| **Vercel** | Logs retained per plan tier (typically 1-3 days for hobby) | No persistent user data stored |
| **Neon** | Backups per plan tier; data deleted upon SQL DELETE | Full control over data lifecycle |

*Note: In the self-hosted Raspberry Pi configuration, Vercel and Neon are replaced by local infrastructure. All financial data remains on the encrypted Pi. Database backups are encrypted and stored off-site with the same retention periods.*

## 7. Legal Hold

If data is subject to a legal hold or regulatory requirement:
- The affected data is excluded from routine deletion
- The legal hold is documented with scope, reason, and expected duration
- Data is deleted promptly once the legal hold is lifted

## 8. User Rights

Users can exercise the following rights at any time through the application:
- **Right to Access:** View all stored personal and financial data
- **Right to Deletion:** Request complete account and data deletion
- **Right to Portability:** Export transaction data
- **Right to Restrict:** Control data sharing via per-category toggles

## 9. Policy Review

This policy is reviewed:
- At least annually
- When new data types are collected
- When third-party services change their retention policies
- When applicable privacy laws or regulations change

---

*This policy ensures Finance Flow retains data only as long as necessary and securely deletes it when no longer needed, in compliance with applicable data privacy regulations.*
