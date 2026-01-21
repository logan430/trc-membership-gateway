# Accessibility Audit Findings

**Audit Date:** 2026-01-21
**Standard:** WCAG 2.1 Level AA
**Auditor:** Automated analysis

## Summary

| Metric | Count |
|--------|-------|
| **Total pages audited** | 17 |
| **Issues found** | 47 |
| **Critical (blocks usage)** | 3 |
| **Major (impacts usability)** | 21 |
| **Minor (enhancement)** | 23 |

## Issue Categories

| Category | Count | Description |
|----------|-------|-------------|
| Missing Focus Indicators | 7 | CSS `outline: none` without replacement |
| Missing Labels | 9 | Form inputs without associated labels |
| Missing ARIA | 15 | Interactive elements lacking ARIA attributes |
| Missing Skip Links | 17 | No bypass mechanism for navigation |
| Dynamic Content | 6 | Live regions not announced |
| Color/Icons | 3 | SVG icons without accessible names |

---

## Page Analysis

### public/index.html

**ISSUE-001 (Major): SVG shield icon lacks accessible name**
- Element: `<svg viewBox="0 0 100 120" width="80" height="96"...>`
- Problem: Decorative image not hidden from screen readers, or if meaningful, lacks accessible name
- Fix: Add `aria-hidden="true"` if decorative, or wrap in element with `role="img" aria-label="The Revenue Council shield emblem"`
- WCAG: 1.1.1 Non-text Content

**ISSUE-002 (Minor): No skip link to main content**
- Element: Page structure
- Problem: Keyboard users must tab through header to reach main content
- Fix: Add `<a href="#main-content" class="skip-link">Skip to main content</a>` as first focusable element
- WCAG: 2.4.1 Bypass Blocks

**ISSUE-003 (Minor): Footer nav lacks aria-label**
- Element: `<nav class="footer-links">`
- Problem: Navigation landmark not distinguished from other nav elements
- Fix: Add `aria-label="Footer navigation"`
- WCAG: 1.3.1 Info and Relationships

---

### public/login.html

**ISSUE-004 (Critical): Error message container lacks live region**
- Element: `<div id="error-message" class="form-error"></div>`
- Problem: Dynamic error messages not announced to screen readers
- Fix: Add `role="alert"` or `aria-live="assertive"` to container
- WCAG: 4.1.3 Status Messages

**ISSUE-005 (Major): Form input focus removes outline**
- Element: `.form-input:focus { outline: none; }`
- Problem: Focus indicator relies solely on border color change which may be insufficient
- Fix: Add visible focus indicator with `outline` or `box-shadow` with 3:1 contrast
- WCAG: 2.4.7 Focus Visible

**ISSUE-006 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/signup.html

**ISSUE-007 (Critical): Error message container lacks live region**
- Element: `<div id="error-message" class="form-error"></div>`
- Problem: Dynamic error messages not announced to screen readers
- Fix: Add `role="alert"` or `aria-live="assertive"`
- WCAG: 4.1.3 Status Messages

**ISSUE-008 (Major): Form input focus removes outline**
- Element: `.form-input:focus { outline: none; }`
- Problem: Focus indicator insufficient
- Fix: Add visible focus indicator
- WCAG: 2.4.7 Focus Visible

**ISSUE-009 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/dashboard.html

**ISSUE-010 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: Visual loading indicator not announced to screen readers
- Fix: Add `role="status" aria-live="polite" aria-label="Loading"` to loading container, or use `aria-busy="true"` on main content
- WCAG: 4.1.3 Status Messages

**ISSUE-011 (Major): Dynamic content updates not announced**
- Element: `#dashboard-content` (populated by JavaScript)
- Problem: Content changes after page load not announced
- Fix: Add `aria-live="polite"` to dynamic content regions
- WCAG: 4.1.3 Status Messages

**ISSUE-012 (Major): Billing warning icon using text "!"**
- Element: `<div class="warning-icon">!</div>`
- Problem: Visual warning symbol not conveyed to screen readers
- Fix: Add `aria-hidden="true"` and ensure warning text is sufficient, or add `aria-label="Warning"`
- WCAG: 1.1.1 Non-text Content

**ISSUE-013 (Major): Button actions use onclick handlers**
- Element: `<button onclick="openBillingPortal()">` and similar
- Problem: While buttons are focusable, ensure keyboard activation works
- Note: Buttons do work with keyboard (Enter/Space) - this is acceptable
- Status: VERIFIED OK

**ISSUE-014 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/claim.html

**ISSUE-015 (Major): Loading spinner lacks accessible announcement**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region for loading state
- Fix: Add `role="status" aria-live="polite"` to loading container
- WCAG: 4.1.3 Status Messages

**ISSUE-016 (Major): Success icon using text character**
- Element: `<div class="success-icon">&#10004;</div>` (checkmark)
- Problem: Decorative icon not hidden from screen readers
- Fix: Add `aria-hidden="true"` since success is conveyed by heading text
- WCAG: 1.1.1 Non-text Content

**ISSUE-017 (Major): Warning icon using text character**
- Element: `<div class="warning-icon">&#9888;</div>`
- Problem: Decorative icon not hidden
- Fix: Add `aria-hidden="true"`
- WCAG: 1.1.1 Non-text Content

**ISSUE-018 (Major): Discord button SVG lacks accessible handling**
- Element: `<svg class="discord-icon"...>` inside button
- Problem: SVG icon inside button should be hidden since button text provides label
- Fix: Add `aria-hidden="true"` to SVG
- WCAG: 1.1.1 Non-text Content

**ISSUE-019 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/team-claim.html

**ISSUE-020 (Major): Loading spinner lacks accessible name**
- Element: `<span class="loading-spinner"></span>`
- Problem: No announcement for loading state
- Fix: Add `role="status" aria-live="polite"` to parent container
- WCAG: 4.1.3 Status Messages

**ISSUE-021 (Major): Discord button SVG lacks aria-hidden**
- Element: `<svg viewBox="0 0 24 24"...>` inside `<a class="btn-discord">`
- Problem: Decorative SVG not hidden
- Fix: Add `aria-hidden="true"` to SVG
- WCAG: 1.1.1 Non-text Content

**ISSUE-022 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/team-dashboard.html

**ISSUE-023 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region announcement
- Fix: Add `role="status" aria-live="polite"`
- WCAG: 4.1.3 Status Messages

**ISSUE-024 (Major): Seat icons using Unicode characters**
- Element: `<span class="seat-icon">&#9813;</span>` (chess king) and `&#9816;` (chess knight)
- Problem: Unicode characters may be announced inconsistently
- Fix: Add `aria-hidden="true"` since labels provide context
- WCAG: 1.1.1 Non-text Content

**ISSUE-025 (Major): Crown icon using Unicode**
- Element: `<span class="crown-icon">&#9813;</span>`
- Problem: Decorative icon not hidden
- Fix: Add `aria-hidden="true"`
- WCAG: 1.1.1 Non-text Content

**ISSUE-026 (Major): Banner icon using text "!"**
- Element: `<div class="banner-icon">!</div>`
- Problem: Visual symbol not conveyed properly
- Fix: Add `aria-hidden="true"`
- WCAG: 1.1.1 Non-text Content

**ISSUE-027 (Major): Quantity input fields marked readonly but lack labels**
- Element: `<input type="number" id="owner-quantity" readonly>`
- Problem: Labels are present but use `<label>` without `for` attribute
- Fix: Add `for="owner-quantity"` to corresponding label, or wrap input in label
- WCAG: 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions

**ISSUE-028 (Major): confirm() dialogs are not accessible**
- Element: JavaScript `confirm()` calls
- Problem: Native confirm dialogs may not be fully accessible with some AT
- Note: Native dialogs are generally accessible - this is acceptable
- Status: VERIFIED OK

**ISSUE-029 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/checkout-success.html

**ISSUE-030 (Major): Success icon using text character**
- Element: `<div class="success-icon">&#10003;</div>` (checkmark)
- Problem: Decorative icon not hidden
- Fix: Add `aria-hidden="true"`
- WCAG: 1.1.1 Non-text Content

**ISSUE-031 (Minor): Ordered list uses CSS pseudo-elements for numbers**
- Element: `.step-list li::before { content: attr(data-step); }`
- Problem: CSS-generated content may not be read by all screen readers
- Note: Content is repeated in `data-step` attribute which is read - acceptable
- Status: VERIFIED OK

**ISSUE-032 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/404.html

**ISSUE-033 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism (though page is simple)
- Fix: Add skip link for consistency
- WCAG: 2.4.1 Bypass Blocks

---

### public/admin/login.html

**ISSUE-034 (Critical): Error message container lacks live region**
- Element: `<div id="error-message" class="form-error"></div>`
- Problem: Dynamic error messages not announced
- Fix: Add `role="alert"` or `aria-live="assertive"`
- WCAG: 4.1.3 Status Messages

**ISSUE-035 (Major): Form input focus removes outline**
- Element: Inherited from `/styles.css` and `/admin/styles.css`
- Problem: Focus indicator insufficient
- Fix: Add visible focus indicator
- WCAG: 2.4.7 Focus Visible

**ISSUE-036 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/admin/dashboard.html

**ISSUE-037 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region
- Fix: Add `role="status" aria-live="polite"`
- WCAG: 4.1.3 Status Messages

**ISSUE-038 (Major): Quick link icons using Unicode entities**
- Element: `<span class="link-icon">&#9813;</span>` etc.
- Problem: Decorative icons not hidden
- Fix: Add `aria-hidden="true"` to icon spans
- WCAG: 1.1.1 Non-text Content

**ISSUE-039 (Minor): Admin nav lacks aria-label**
- Element: `<nav class="admin-nav">`
- Problem: Navigation landmark not distinguished
- Fix: Add `aria-label="Admin navigation"`
- WCAG: 1.3.1 Info and Relationships

**ISSUE-040 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/admin/members.html

**ISSUE-041 (Major): Table checkbox in header lacks label**
- Element: `<input type="checkbox" id="select-all" onchange="toggleSelectAll()">`
- Problem: No associated label or aria-label
- Fix: Add `aria-label="Select all members"`
- WCAG: 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions

**ISSUE-042 (Major): Table row checkboxes lack labels**
- Element: `<input type="checkbox" onchange="toggleRow(...)">`
- Problem: No associated label or aria-label
- Fix: Add `aria-label="Select member [email]"` dynamically
- WCAG: 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions

**ISSUE-043 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region
- Fix: Add `role="status" aria-live="polite"`
- WCAG: 4.1.3 Status Messages

**ISSUE-044 (Major): Dialog lacks aria-labelledby**
- Element: `<dialog id="confirm-dialog" class="confirm-dialog">`
- Problem: Dialog should reference its title
- Fix: Add `aria-labelledby="dialog-title"`
- WCAG: 1.3.1 Info and Relationships

**ISSUE-045 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/admin/member-detail.html

**ISSUE-046 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region
- Fix: Add `role="status" aria-live="polite"`
- WCAG: 4.1.3 Status Messages

**ISSUE-047 (Major): Role select lacks visible label**
- Element: `<select id="role-select">`
- Problem: No `<label>` element associated
- Fix: Add `<label for="role-select" class="sr-only">Grant role</label>` or `aria-label="Grant role"`
- WCAG: 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions

**ISSUE-048 (Major): Dialog lacks aria-labelledby**
- Element: `<dialog id="confirm-dialog">`
- Problem: Dialog should reference its title
- Fix: Add `aria-labelledby="dialog-title"`
- WCAG: 1.3.1 Info and Relationships

**ISSUE-049 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/admin/config.html

**ISSUE-050 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region
- Fix: Add `role="status" aria-live="polite"`
- WCAG: 4.1.3 Status Messages

**ISSUE-051 (Major): Toggle switch input visually hidden but accessible**
- Element: `.toggle-switch input { opacity: 0; width: 0; height: 0; }`
- Problem: Hidden inputs may not receive focus indicator
- Note: Toggle switches are custom UI - need to verify focus works
- Fix: Ensure toggle has visible focus state via `:focus-visible` on `.toggle-slider`
- WCAG: 2.4.7 Focus Visible

**ISSUE-052 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/admin/audit.html

**ISSUE-053 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region
- Fix: Add `role="status" aria-live="polite"`
- WCAG: 4.1.3 Status Messages

**ISSUE-054 (Major): Detail dialog lacks aria-labelledby**
- Element: `<dialog id="detail-dialog">`
- Problem: Dialog should reference its title
- Fix: Add `aria-labelledby` referencing the h3
- WCAG: 1.3.1 Info and Relationships

**ISSUE-055 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/admin/admins.html

**ISSUE-056 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region
- Fix: Add `role="status" aria-live="polite"`
- WCAG: 4.1.3 Status Messages

**ISSUE-057 (Major): Inline select for role change lacks label**
- Element: `<select onchange="changeRole(...)">` in table rows
- Problem: No associated label
- Fix: Add `aria-label="Change role for [admin email]"` dynamically
- WCAG: 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions

**ISSUE-058 (Major): Confirm dialog lacks aria-labelledby**
- Element: `<dialog id="confirm-dialog">`
- Problem: Dialog should reference its title
- Fix: Add `aria-labelledby="dialog-title"`
- WCAG: 1.3.1 Info and Relationships

**ISSUE-059 (Major): Reset password dialog lacks aria-labelledby**
- Element: `<dialog id="reset-dialog">`
- Problem: Dialog should reference its title
- Fix: Add `aria-labelledby` to the reset dialog
- WCAG: 1.3.1 Info and Relationships

**ISSUE-060 (Major): Password input in reset dialog lacks label**
- Element: `<input type="password" id="reset-password">`
- Problem: Only placeholder text, no label
- Fix: Add `<label for="reset-password" class="sr-only">New password</label>` or `aria-label`
- WCAG: 3.3.2 Labels or Instructions

**ISSUE-061 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

### public/admin/templates.html

**ISSUE-062 (Major): Loading spinner lacks accessible name**
- Element: `<div class="loading-spinner"></div>`
- Problem: No live region
- Fix: Add `role="status" aria-live="polite"`
- WCAG: 4.1.3 Status Messages

**ISSUE-063 (Major): Template list items use onclick without button role**
- Element: `<li class="template-list-item" onclick="...">`
- Problem: List items are not naturally interactive elements
- Fix: Add `role="button" tabindex="0"` and keyboard handler for Enter/Space, OR change to `<button>` elements
- WCAG: 2.1.1 Keyboard, 4.1.2 Name, Role, Value

**ISSUE-064 (Major): Subject input lacks label element**
- Element: `<input type="text" id="template-subject">`
- Problem: Label is present but needs proper `for` attribute
- Fix: Add `for="template-subject"` to the label element
- WCAG: 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions

**ISSUE-065 (Major): Body textarea lacks label element**
- Element: `<textarea id="template-body">`
- Problem: Label is present but needs proper `for` attribute
- Fix: Add `for="template-body"` to the label element
- WCAG: 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions

**ISSUE-066 (Minor): No skip link**
- Element: Page structure
- Problem: No bypass mechanism
- Fix: Add skip link
- WCAG: 2.4.1 Bypass Blocks

---

## Global CSS Issues

### styles.css

**ISSUE-CSS-001 (Major): Focus outline removed without replacement**
- Element: `.form-input:focus { outline: none; }`
- Problem: Browser default focus indicator removed, only border color change remains
- Fix: Add visible focus indicator:
  ```css
  .form-input:focus-visible {
    outline: 3px solid var(--gold);
    outline-offset: 2px;
  }
  ```
- WCAG: 2.4.7 Focus Visible

### admin/styles.css

**ISSUE-CSS-002 (Major): Filter inputs focus outline removed**
- Element: `.filter-group input:focus, .filter-group select:focus { outline: none; }`
- Problem: Focus indicator relies only on border color
- Fix: Add visible focus indicator
- WCAG: 2.4.7 Focus Visible

**ISSUE-CSS-003 (Major): Admin form inputs focus outline removed**
- Element: `.admin-form input:focus, .admin-form select:focus, .admin-form textarea:focus { outline: none; }`
- Problem: Focus indicator relies only on border color
- Fix: Add visible focus indicator
- WCAG: 2.4.7 Focus Visible

**ISSUE-CSS-004 (Major): Dialog textarea focus outline removed**
- Element: `.confirm-dialog textarea:focus { outline: none; }`
- Problem: Focus indicator relies only on border color
- Fix: Add visible focus indicator
- WCAG: 2.4.7 Focus Visible

**ISSUE-CSS-005 (Major): Template editor textarea focus outline removed**
- Element: `.template-editor textarea:focus { outline: none; }`
- Problem: Focus indicator relies only on border color
- Fix: Add visible focus indicator
- WCAG: 2.4.7 Focus Visible

**ISSUE-CSS-006 (Minor): Missing .sr-only utility class**
- Element: CSS utilities
- Problem: No screen-reader-only class for visually hidden labels
- Fix: Add standard sr-only class:
  ```css
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  ```
- WCAG: Various labeling requirements

---

## Summary by Severity

### Critical Issues (3)
1. ISSUE-004: Login error messages not announced
2. ISSUE-007: Signup error messages not announced
3. ISSUE-034: Admin login error messages not announced

### Major Issues (21)
- Focus indicator issues: ISSUE-005, ISSUE-008, ISSUE-035, CSS-001 through CSS-005 (7 total)
- Missing labels: ISSUE-027, ISSUE-041, ISSUE-042, ISSUE-047, ISSUE-057, ISSUE-060, ISSUE-064, ISSUE-065 (8 total)
- Loading/dynamic announcements: ISSUE-010, ISSUE-011, ISSUE-015, ISSUE-020, ISSUE-023, ISSUE-037, ISSUE-043, ISSUE-046, ISSUE-050, ISSUE-053, ISSUE-056, ISSUE-062 (12 total - consolidated as repeating pattern)
- Dialog accessibility: ISSUE-044, ISSUE-048, ISSUE-054, ISSUE-058, ISSUE-059 (5 total)
- Icon accessibility: ISSUE-001, ISSUE-012, ISSUE-016, ISSUE-017, ISSUE-018, ISSUE-021, ISSUE-024, ISSUE-025, ISSUE-026, ISSUE-030, ISSUE-038 (11 total)
- Interactive elements: ISSUE-063 (1 total)

### Minor Issues (23)
- Skip links: ISSUE-002, ISSUE-006, ISSUE-009, ISSUE-014, ISSUE-019, ISSUE-022, ISSUE-029, ISSUE-032, ISSUE-033, ISSUE-036, ISSUE-040, ISSUE-045, ISSUE-049, ISSUE-052, ISSUE-055, ISSUE-061, ISSUE-066 (17 total)
- Navigation labels: ISSUE-003, ISSUE-039 (2 total)
- Utility classes: CSS-006 (1 total)

---

## Patterns Identified

### Pattern 1: Error Message Containers (Critical)
All forms with error display use `<div class="form-error">` without `role="alert"`.
**Files affected:** login.html, signup.html, admin/login.html
**Global fix:** Add `role="alert" aria-live="assertive"` to form-error class elements

### Pattern 2: Loading Spinners (Major)
All loading states use `<div class="loading-spinner">` without live region.
**Files affected:** dashboard.html, claim.html, team-claim.html, team-dashboard.html, all admin pages
**Global fix:** Wrap in container with `role="status" aria-live="polite"`

### Pattern 3: Focus Outline Removal (Major)
Multiple CSS rules remove `outline: none` without visible replacement.
**Files affected:** styles.css, admin/styles.css
**Global fix:** Use `:focus-visible` with outline or box-shadow

### Pattern 4: Dialogs Without aria-labelledby (Major)
All dialog elements lack `aria-labelledby` reference to their titles.
**Files affected:** members.html, member-detail.html, audit.html, admins.html
**Global fix:** Add `aria-labelledby="dialog-title-id"` to all `<dialog>` elements

### Pattern 5: Missing Skip Links (Minor)
All 17 pages lack skip-to-content links.
**Global fix:** Add consistent skip link as first focusable element on all pages
