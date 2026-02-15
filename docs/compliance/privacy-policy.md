# Privacy Policy
## Finance Flow

**Version:** 1.0  
**Effective Date:** February 15, 2026  
**Last Reviewed:** February 15, 2026

---

## 1. Introduction

Finance Flow ("we," "our," or "us") is a personal finance tracking application that helps users monitor their spending, manage budgets, and gain insights into their financial habits. This Privacy Policy describes how we collect, use, store, and protect your personal and financial information.

## 2. Information We Collect

### 2.1 Account Information
- Name and email address (collected via Clerk authentication)
- Profile image (if provided)

### 2.2 Financial Data (via Plaid)
- Bank account names, types, and masked account numbers
- Account balances
- Transaction history (date, amount, merchant name, category)
- Institution names

**We do NOT collect or store:**
- Full bank account numbers or routing numbers
- Bank login credentials (handled entirely by Plaid)
- Social Security numbers
- Credit scores

### 2.3 Application Data
- Custom categories and budget settings
- Sharing preferences within your household
- Household membership information

## 3. How We Use Your Information

We use your information solely to:
- Display your financial accounts and balances
- Categorize and display your transactions
- Provide spending insights and budget tracking
- Enable household sharing features you explicitly opt into
- Sync your financial data on your behalf

We do **NOT**:
- Sell your data to third parties
- Use your data for advertising
- Share your data with anyone outside your household
- Use your data for credit decisions or underwriting

## 4. How We Store and Protect Your Information

### 4.1 Encryption
- All data is encrypted in transit using TLS 1.2+
- Database storage uses encryption at rest (AES-256)
- Plaid access tokens are additionally encrypted with AES-256-GCM before storage

### 4.2 Access Controls
- Authentication is required to access any financial data
- Each user can only access their own data and data explicitly shared within their household
- Sharing preferences are controlled per-category by each user

### 4.3 Infrastructure
- Hosted on Vercel (SOC 2 Type II certified)
- Database on Neon PostgreSQL (SOC 2 Type II certified, encrypted at rest)
- Authentication via Clerk (SOC 2 Type II certified)

## 5. Third-Party Services

We integrate with the following third-party services, each with their own privacy policies:

| Service | Purpose | Privacy Policy |
|---------|---------|---------------|
| **Plaid** | Bank account connectivity | [plaid.com/legal](https://plaid.com/legal) |
| **Clerk** | User authentication | [clerk.com/legal/privacy](https://clerk.com/legal/privacy) |
| **Vercel** | Application hosting | [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy) |
| **Neon** | Database hosting | [neon.tech/privacy-policy](https://neon.tech/privacy-policy) |

By connecting your bank accounts through Plaid, you agree to Plaid's End User Privacy Policy. Plaid accesses your bank data on our behalf and transmits it securely to our application.

## 6. Household Data Sharing

- Users may create a household and invite other members
- Each user controls which expense categories are visible to the household via per-category sharing toggles
- Income and net savings visibility are independently controlled
- Private categories are never visible to other household members
- Users can revoke sharing at any time

## 7. Data Retention

- Your financial data is retained as long as your account is active
- You may disconnect bank accounts at any time, which revokes the Plaid access token
- Upon account deletion, all associated personal and financial data is permanently removed from our database

## 8. Your Rights

You have the right to:
- **Access** your data at any time through the application
- **Control** what is shared with household members
- **Disconnect** bank accounts at any time
- **Delete** your account and all associated data
- **Export** your transaction data

## 9. Children's Privacy

Finance Flow is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. Users will be notified of significant changes. The "Last Reviewed" date at the top of this document indicates when this policy was last updated.

## 11. Contact

For questions or concerns about this Privacy Policy, contact:

**Raj Shah**  
Finance Flow  
Email: raj@example.com

---

*This privacy policy is designed to be transparent about how Finance Flow handles user data and to comply with applicable privacy regulations.*
