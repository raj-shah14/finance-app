# Access Control Policy
## Finance Flow

**Version:** 1.0  
**Effective Date:** February 15, 2026  
**Last Reviewed:** February 15, 2026  
**Approved By:** Raj Shah, Owner

---

## 1. Purpose

This policy establishes the principles and procedures for managing access to Finance Flow's systems, applications, and data. It ensures that access is granted based on the principle of least privilege and that only authorized individuals can access consumer financial data.

## 2. Scope

This policy applies to:
- All Finance Flow application systems and infrastructure
- All user accounts (application users and administrators)
- All third-party service integrations
- All data stores containing personal or financial information

## 3. Principles

### 3.1 Least Privilege
Users and systems are granted only the minimum level of access necessary to perform their intended functions.

### 3.2 Role-Based Access Control (RBAC)
Access rights are assigned based on defined roles. RBAC ensures individuals only have access to information necessary for their function, streamlining access management and enhancing security.

**Application Roles:**

| Role | Access Level | Permissions |
|------|-------------|-------------|
| **Owner (Admin)** | Full | Manage household, invite/remove members, access all own data, set budgets, connect accounts |
| **Household Member** | Shared | Access own data, view categories shared by other members, manage own sharing preferences |
| **Unauthenticated** | None | No access to any financial data or APIs; redirect to sign-in |

**System Roles:**

| Role | Access Level | Scope |
|------|-------------|-------|
| **Application Service** | Database read/write | Access via encrypted credentials; all queries scoped to authenticated user |
| **Administrator** | Full infrastructure | Vercel dashboard, Neon console, Clerk dashboard, GitHub repo |
| **Cron Service** | Limited API | Authenticated with CRON_SECRET bearer token; sync operations only |

### 3.3 Separation of Duties
- Application-level access is managed by Clerk (authentication)
- Database access is restricted to the application service layer
- Direct database access is limited to the administrator for maintenance purposes only

## 4. Authentication

### 4.1 User Authentication
- All users authenticate via Clerk, which provides:
  - Email-based authentication with secure password requirements
  - Optional multi-factor authentication (MFA)
  - Session management with automatic token expiration and refresh
  - Brute-force protection and rate limiting

### 4.2 Secure Tokens and Certificates
- **JWT Tokens:** Clerk issues signed JWTs for session management, validated on every API request
- **OAuth Tokens:** Plaid Link uses OAuth-based flows for bank authentication; users authenticate directly with their bank — credentials are never exposed to Finance Flow
- **Webhook Signatures:** All incoming webhooks (Clerk, Plaid) are verified using HMAC signatures before processing
- **API Keys:** All service API keys are stored as encrypted environment variables, never in source code

### 4.3 Service-to-Service Authentication
- Plaid API calls are authenticated via client_id + secret in request headers
- Database connections use credential-based authentication over SSL
- Cron job endpoints are protected with bearer token authentication (CRON_SECRET)

## 5. Authorization

### 5.1 API Endpoint Protection
Every API endpoint that accesses financial data:
1. Validates the user's authentication token
2. Retrieves the user's record from the database
3. Filters data to only return records belonging to the user or their household
4. Respects per-category sharing preferences for household views

### 5.2 Data Access Rules
| Data Type | Owner Access | Household Member Access | Public Access |
|-----------|-------------|------------------------|---------------|
| Own transactions | ✅ Full | ❌ None | ❌ None |
| Shared category transactions | ✅ Full | ✅ View only | ❌ None |
| Private category transactions | ✅ Full | ❌ None | ❌ None |
| Own account balances | ✅ Full | ❌ None | ❌ None |
| Household member list | ✅ Full + manage | ✅ View only | ❌ None |
| Sharing preferences | ✅ Own prefs | ✅ Own prefs | ❌ None |

### 5.3 Household Management
- Only the household **Owner** can:
  - Invite new members
  - Remove existing members
- All members can:
  - Control their own sharing preferences
  - View shared data from other members
  - Leave the household

## 6. Access Provisioning and Revocation

### 6.1 Granting Access
- New users are created via Clerk sign-up and automatically synced to the database
- Household access is granted via invite link, which must be explicitly accepted
- No default access to other users' data is granted

### 6.2 Modifying Access
- Sharing preferences can be modified at any time by the data owner
- Changes to sharing preferences take effect immediately

### 6.3 Revoking Access
- Household owners can remove members, immediately revoking shared data access
- Users can disconnect bank accounts, revoking Plaid access tokens
- Account deletion removes all access and associated data
- Clerk handles session invalidation on logout

### 6.4 Automated De-Provisioning
Access revocation is automated to prevent unauthorized access from persisting:

| Trigger | Automated Action | Timeline |
|---------|-----------------|----------|
| **Member removed from household** | Shared data access revoked, household association cleared | Immediate |
| **User deletes account** | All data deleted, Plaid tokens revoked, Clerk account removed | Immediate |
| **Bank account disconnected** | Plaid access token revoked and deleted | Immediate |
| **Session expiry** | Clerk automatically invalidates expired sessions | Automatic (managed by Clerk) |
| **Invite link expiry** | Expired invites cannot be accepted | 30 days after creation |

These automated processes ensure that access permissions are always current and that no stale access persists after a user's status changes.

## 7. Third-Party Access Management

| Third Party | Access Granted | Controls |
|-------------|---------------|----------|
| **Plaid** | Bank data retrieval on behalf of users | Access tokens encrypted at rest; tokens can be revoked per-institution |
| **Clerk** | User identity and authentication | SOC 2 certified; manages session lifecycle |
| **Vercel** | Application runtime | No direct data access; serverless isolation |
| **Neon** | Database storage | Encrypted connections; access restricted to application credentials |

## 8. Monitoring and Review

- Authentication events are logged by Clerk
- API errors and access failures are logged in application logs
- This policy is reviewed at least annually or upon significant changes
- Access rights are reviewed when household membership changes

## 9. Policy Violations

Any suspected unauthorized access or policy violations will be:
1. Investigated promptly
2. Contained by revoking affected credentials
3. Documented with findings and remediation steps
4. Addressed with corrective measures to prevent recurrence

---

*This access control policy ensures that Finance Flow maintains strict control over who can access consumer financial data and under what conditions.*
