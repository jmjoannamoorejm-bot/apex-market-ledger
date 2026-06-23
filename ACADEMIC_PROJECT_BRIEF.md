# Apex Market Ledger: Academic Project Brief

## Project Status

Apex Market Ledger is an educational academic project. It is not a licensed financial institution, broker, investment adviser, bank, exchange, custodian, or payment processor. The project is intended for coursework, interface analysis, user-flow evaluation, and discussion of how financial dashboards can be designed to appear credible and operationally complete.

No part of this project should be used to solicit real investments, process real deposits, provide financial advice, or instruct users to send real funds.

## Project Objective

The goal of the project is to build a realistic web-based investment ledger interface that demonstrates how a modern market-facing platform might organize:

- User registration and account access.
- Email verification and account recovery.
- KYC-style identity review fields.
- Deposit and withdrawal request workflows.
- Admin-controlled user balances.
- Admin-controlled investment positions.
- Tesla-related market watchlists.
- Support message handling.
- Operational backup visibility.
- Public marketing pages and private dashboard pages.

The system is designed to look mature enough for academic review while remaining lightweight enough to deploy on a free hosting tier.

## Design Direction

The visual direction uses a technology-market style inspired by electric vehicles, AI infrastructure, and modern trading dashboards. The design choices include:

- A graphite and black base palette to create a premium institutional feel.
- Red and cyan accents to suggest market activity, energy, and technology.
- Compact cards for balances, market instruments, and operational status.
- Monospace typography for prices, symbols, and financial values.
- A dedicated favicon and social preview image so shared links look complete.
- Mobile-responsive layouts for registration, dashboard, admin, and market pages.

## Core User Features

The user-facing side includes:

- Homepage and public information pages.
- Registration with country selection and phone formatting guidance.
- Login and password reset flow.
- Email verification code flow.
- Dashboard overview with balances.
- Investment and market pages with Tesla-related instruments.
- Watchlist toggling.
- Deposit request workflow.
- Withdrawal request workflow with bank or crypto destination fields.
- KYC-style review form.
- Transaction history.
- Support contact flow.

## Admin Features

The admin dashboard is designed as the operational control center. It includes short explainers so a new administrator can understand what each section controls.

Admin capabilities include:

- Viewing user counts, pending KYC, deposits, withdrawals, and total balances.
- Setting the visible deposit wallet asset, network, label, and address.
- Turning deposits, withdrawals, investments, KYC, and support features on or off.
- Reviewing backup status for the free-hosting persistence workaround.
- Setting a project realism score and review notes.
- Controlling which market cards are visible to users.
- Adjusting user balances.
- Managing active investment positions per user.
- Reviewing deposit requests.
- Reviewing withdrawal requests.
- Updating support message statuses.

## Market Realism Choices

The market section uses Tesla-adjacent and technology-related instruments to create a coherent theme:

- TSLA for electric vehicle exposure.
- NVDA for AI infrastructure exposure.
- QQQ and SPY for broad technology and market benchmarks.
- ARKK for innovation-themed exposure.
- LIT for lithium and battery technology.
- RIVN and LCID for EV peer comparisons.
- BTC for digital asset liquidity context.
- PANW for cybersecurity and enterprise technology exposure.

The market data is presented in a live-style interface, but it is not a live financial data feed. This keeps the project simple, deterministic, and suitable for academic review without relying on paid financial APIs.

## Persistence Approach

The project is designed to run on Render Free, which does not provide a paid persistent disk. To reduce data loss risk within that limitation, the app includes an optional GitHub-backed JSON backup flow.

When configured, the app can:

- Store data locally while running.
- Save a copy of the JSON database to a private GitHub backup repository.
- Restore from that backup on startup.
- Show backup status in the admin dashboard.

This is a practical workaround for academic hosting, not a substitute for a production database.

## Email System

The project supports Resend for:

- Signup email verification.
- Withdrawal authorization codes.
- Password reset codes.

If Resend is not configured, the app still works, but production email delivery will not occur.

## Important Risk Notes

This project intentionally demonstrates realistic financial-platform interface patterns. That realism creates risks if the project is misunderstood or misused.

Key risks include:

- Users may mistake realistic balances or investment cards for real financial records.
- Crypto wallet interfaces can be misunderstood as real payment instructions.
- Admin-controlled balances can create the appearance of account value without external verification.
- Free-tier hosting can restart, sleep, or lose local data without the backup workaround.
- The project does not implement regulatory, legal, broker-dealer, custody, AML, or real KYC compliance systems.
- The project does not perform real investment execution or market settlement.

For academic submission, these risks are part of the learning value: they show why realistic financial UX must be paired with governance, legal compliance, disclosures, data integrity, security, and responsible deployment controls.

## Production Limitations

The current build is not production-ready for real financial use. Missing production-grade components include:

- A real database such as PostgreSQL.
- Full audit logging.
- Stronger admin role management.
- Real document upload and identity verification.
- Real payment processor integration.
- Real market data API integration.
- Legal disclosures and regulatory review.
- Security hardening and penetration testing.
- Formal privacy policy and terms of service.
- Monitoring and incident response.

## Handover Notes

The main administrator should receive:

- Live site URL.
- Admin dashboard URL.
- Admin username and password.
- Render account access.
- GitHub repository access.
- GitHub backup repository access.
- Resend account/API key access.
- Namecheap domain/DNS access.
- A note that Render Free is limited and the GitHub backup is a workaround.

The admin dashboard includes inline explainers to help the administrator understand how to manage wallet settings, user balances, active investments, market visibility, support messages, and backup status.

## Summary

Apex Market Ledger is a realistic educational build that demonstrates how an investment-themed dashboard can be structured end to end: public marketing pages, user onboarding, market views, account activity, admin controls, backup strategy, and email verification. It should be evaluated as an academic prototype and interface study, not as a real financial platform.
