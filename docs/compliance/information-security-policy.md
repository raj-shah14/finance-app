# Information Security Policy
## Finance Flow

**Version:** 1.0  
**Effective Date:** February 15, 2026  
**Last Reviewed:** February 15, 2026  
**Approved By:** Raj Shah, Owner

---

## 1. Purpose & Objectives

This Information Security Policy (ISP) establishes Finance Flow's commitment to protecting the confidentiality, integrity, and availability of all information assets, including consumer financial data accessed through third-party integrations such as Plaid.

**Objectives:**
- Protect consumer financial data from unauthorized access, disclosure, alteration, or destruction
- Ensure compliance with applicable laws, regulations, and contractual obligations
- Establish clear accountability for information security responsibilities
- Maintain the trust of users by safeguarding their personal and financial information

## 2. Scope

This policy applies to:
- All information systems, applications, and infrastructure operated by Finance Flow
- All data collected, processed, stored, or transmitted, including consumer financial data obtained via Plaid
- All individuals with access to Finance Flow systems, including the owner/operator and household members
- All third-party services integrated with Finance Flow (Plaid, Clerk, Vercel, Neon)

## 3. Accountability

**Raj Shah (Owner & Administrator)** is responsible for:
- Implementing and maintaining this information security policy
- Ensuring all systems and integrations meet security requirements
- Reviewing and updating this policy at least annually or upon significant changes
- Responding to and managing security incidents
- Ensuring third-party services meet adequate security standards

## 4. Data Classification

| Classification | Description | Examples |
|---------------|-------------|----------|
| **Confidential** | Consumer financial data requiring the highest level of protection | Bank account numbers, transaction history, account balances, Plaid access tokens |
| **Sensitive** | Personal data requiring strong protection | Names, email addresses, authentication credentials |
| **Internal** | Operational data with moderate sensitivity | Application logs, configuration data, system metrics |

## 5. Data Protection Controls

### 5.1 Encryption
- **At Rest:** All sensitive data stored in the database is protected by the database provider's encryption at rest (Neon PostgreSQL with AES-256 encryption). Plaid access tokens are additionally encrypted using AES-256-GCM before database storage.
- **In Transit:** All data transmissions use TLS 1.2 or higher. All API endpoints are served exclusively over HTTPS. Connections to the database use SSL/TLS.

### 5.2 Access Controls
- Authentication is managed through Clerk, providing secure session management with JWT tokens
- API endpoints require valid authentication before accessing any financial data
- Plaid access tokens are encrypted and never exposed to the client-side application
- Database access is restricted to the application service and authorized administrators
- See the Access Control Policy for detailed access management procedures

### 5.3 Secure Token Management
- Plaid access tokens are encrypted using AES-256-GCM before storage
- Clerk manages user session tokens with automatic expiration and refresh
- Webhook signatures are verified using HMAC (svix) to prevent forgery
- All secrets and API keys are stored as environment variables, never in source code

## 6. Infrastructure Security

### 6.1 Cloud Hosting (Primary)
- **Hosting:** Application is hosted on Vercel's serverless platform, which provides DDoS protection, automatic TLS, and isolated execution environments
- **Database:** PostgreSQL hosted on Neon with encryption at rest, automated backups, and SSL-only connections
- **Authentication:** Clerk provides enterprise-grade authentication with brute-force protection, session management, and MFA support
- **Network:** All communications between services occur over encrypted channels (TLS 1.2+)

### 6.2 Self-Hosted Server (Planned/Alternate)
Finance Flow is designed to also run on a self-hosted Raspberry Pi server for maximum data privacy and control:

- **Hardware:** Raspberry Pi 4 (4GB+ RAM) running Raspberry Pi OS (Debian-based)
- **Application:** Next.js application running via Node.js with PM2 process manager for auto-restart and monitoring
- **Database:** PostgreSQL installed locally on the Pi; data never leaves the device
- **Network Exposure:** Exposed to the internet via Cloudflare Tunnel (zero-trust model — no open inbound ports)
- **SSL/TLS:** Managed automatically by Cloudflare; all traffic encrypted end-to-end
- **Physical Security:** Device located in a private residence with restricted physical access

**Self-Hosted Security Controls:**

| Control | Implementation |
|---------|---------------|
| **OS Hardening** | Unattended security updates enabled; unnecessary services disabled; SSH key-only authentication (password auth disabled) |
| **Firewall** | UFW configured to deny all inbound traffic; Cloudflare Tunnel provides the only external access path |
| **Disk Encryption** | Full-disk encryption (LUKS) on the Pi's storage |
| **Database Access** | PostgreSQL bound to localhost only; no external database connections |
| **Backups** | Automated daily database backups to encrypted off-site storage |
| **Monitoring** | PM2 monitors application health with auto-restart on failure; system resource monitoring via standard tools |
| **Updates** | Automatic OS security patches; application dependencies updated per the Vulnerability Management Policy SLA |

## 7. Third-Party Security

All third-party services are evaluated for security compliance:

| Service | Purpose | Security Standards |
|---------|---------|-------------------|
| **Plaid** | Bank connectivity | SOC 2 Type II, ISO 27001, AES-256 encryption |
| **Clerk** | Authentication | SOC 2 Type II, GDPR compliant, encrypted at rest |
| **Vercel** | Application hosting (cloud) | SOC 2 Type II, ISO 27001, automatic TLS |
| **Neon** | Database hosting (cloud) | SOC 2 Type II, encryption at rest, SSL connections |
| **Cloudflare** | Tunnel / reverse proxy (self-hosted) | SOC 2 Type II, ISO 27001, zero-trust network access |

*Note: In the self-hosted configuration, Vercel and Neon are replaced by the Raspberry Pi running Next.js and local PostgreSQL. Cloudflare Tunnel provides secure external access without exposing inbound ports.*

## 8. Incident Response

In the event of a security incident:
1. **Identify** — Detect and confirm the incident
2. **Contain** — Immediately revoke compromised credentials, rotate Plaid access tokens if affected
3. **Investigate** — Determine the scope and impact of the incident
4. **Notify** — Inform affected users and relevant parties as required by law
5. **Remediate** — Implement fixes to prevent recurrence
6. **Document** — Record the incident details, response actions, and lessons learned

## 9. Secure Development Practices

- Source code is stored in a private GitHub repository
- Secrets and API keys are managed through environment variables, never committed to source code
- Dependencies are regularly reviewed and updated to address known vulnerabilities
- The `.env` file containing secrets is included in `.gitignore`

## 10. Data Retention & Disposal

- Transaction data is retained as long as the user's account is active
- Upon account deletion, all associated financial data is removed from the database
- Plaid access tokens are revoked and deleted when an account connection is removed
- Database backups follow the provider's retention policy with encrypted storage

## 11. Policy Review

This policy is reviewed and updated:
- At least annually
- Upon significant changes to the application, infrastructure, or data handling practices
- In response to security incidents or new regulatory requirements

---

*This policy demonstrates Finance Flow's commitment to maintaining a robust information security program that protects consumer financial data in accordance with industry best practices.*
