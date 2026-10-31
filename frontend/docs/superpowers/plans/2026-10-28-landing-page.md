# Public landing page implementation plan

**Goal:** Implement the supplied landing-page reference using existing React, Inter, Tailwind, and Lucide dependencies. Only frontend files may change; no Git mutations or backend changes.

**Design:** White navigation, navy hero, five feature cards, four roles, five-step workflow, department pills, and navy school footer. Retain the reference's copy where supported by the current system. Use the current school logo. On narrow screens, stack the hero and cards and show the workflow vertically.

**Approved preview approach:** Reuse actual student dashboard components in an anonymous empty state. Per follow-up, no visible preview caption; retain the accessible figure description. No private records, fabricated metrics, authenticated layout, or private API requests. A screenshot would become stale; mounting the authenticated dashboard would require a private session. Both are avoided by reusing its presentation components.

**Routing:** Anonymous visitors see the landing page at `/`. Existing session recovery, OTP/profile checks, logout routing, and signed-in redirects remain through ProtectedRoute. `/login` remains available. Google sign-in uses the existing same-origin OAuth URL builder.

**Files:** Add `src/pages/LandingPage.jsx`, its scoped stylesheet, `src/pages/landing/StudentDashboardPreview.jsx`, `src/pages/Home.jsx`, and `tests/landing-page.test.js`. Update App's root route, index metadata, sitemap, Vercel indexing exception, and affected SEO tests.

## Steps

- [x] Add and run failing coverage for anonymous homepage, real-component empty preview, section links, and public indexing.
- [x] Implement landing page, safe preview, and root entry; retain current authentication behavior.
- [x] Update metadata and crawl rules for the public root, preserving Search Console verification and private-page exclusions.
- [x] Run targeted tests, scoped ESLint, production build, full test suite, and desktop/mobile browser checks.

## Review focus

- Public preview must never fetch or reveal account data or expose clickable private controls.
- Saved sessions must still pass through existing authentication checks.
- Google entry must retain the same-origin OAuth cookie behavior.
- Navigation and privacy controls must work with keyboard and mobile input.
- Preview scaling must not create horizontal page overflow.

No dependency installation, commits, or pushes are required.

**Follow-up requirements:** The user requested the system's school logo in the navigation header, which now reuses LV_Logo.png, and SEO promoting the new homepage instead of `/login`. The canonical, social and structured-data URLs now target `/`; only that canonical is submitted in the sitemap. `/login` remains accessible. Descriptions, structured feature information, and the JavaScript-disabled summary describe the real application.

All five feature cards now share the same blue border, radius, and shadow. Header branding was increased to a 46px logo and 20px text (18px on small screens). The visible preview caption was removed at the user's request. Review identified the pending-OTP root case, now preserved and tested for both token and user-ID keys. Desktop/mobile checks covered navigation, privacy dialogs and Escape dismissal, preview scaling, and absence of horizontal overflow. The existing production bundle-size warning remains.
