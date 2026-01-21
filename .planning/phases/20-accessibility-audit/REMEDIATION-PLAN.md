# Accessibility Remediation Plan

**Created:** 2026-01-21
**Based on:** ACCESSIBILITY-FINDINGS.md, COLOR-CONTRAST-REPORT.md
**Total Estimated Effort:** 4-6 hours

---

## Priority 1: Critical Issues
*Must fix immediately - blocks core functionality for AT users*

### P1-001: Add live regions to error messages
**Affects:** login.html, signup.html, admin/login.html
**WCAG:** 4.1.3 Status Messages
**Impact:** Screen reader users cannot perceive form errors
**Effort:** 15 min

**Current code (all 3 files):**
```html
<div id="error-message" class="form-error"></div>
```

**Fixed code:**
```html
<div id="error-message" class="form-error" role="alert" aria-live="assertive"></div>
```

**Files to modify:**
1. `public/login.html` - line 21
2. `public/signup.html` - line 21
3. `public/admin/login.html` - line 21

---

## Priority 2: Major Issues - Focus Indicators
*High impact - affects all keyboard users*

### P2-001: Add visible focus indicators
**Affects:** styles.css, admin/styles.css
**WCAG:** 2.4.7 Focus Visible
**Impact:** Keyboard users cannot see which element is focused
**Effort:** 30 min

**Add to styles.css (after existing focus rules):**
```css
/* Accessible focus indicators */
.form-input:focus-visible,
button:focus-visible,
a:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}

/* Remove default focus styles only when :focus-visible is supported */
@supports selector(:focus-visible) {
  .form-input:focus:not(:focus-visible),
  button:focus:not(:focus-visible) {
    outline: none;
  }
}
```

**Add to admin/styles.css:**
```css
/* Accessible focus indicators for admin UI */
.filter-group input:focus-visible,
.filter-group select:focus-visible,
.admin-form input:focus-visible,
.admin-form select:focus-visible,
.admin-form textarea:focus-visible,
.confirm-dialog textarea:focus-visible,
.template-editor textarea:focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}

/* Toggle switch focus */
.toggle-switch input:focus-visible + .toggle-slider {
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}
```

---

## Priority 3: Major Issues - Loading States
*Affects all async content*

### P3-001: Add loading state announcements
**Affects:** All pages with loading spinners
**WCAG:** 4.1.3 Status Messages
**Impact:** AT users don't know content is loading
**Effort:** 45 min

**Pattern to apply to all loading containers:**

**Current:**
```html
<div id="loading" class="loading">
  <div class="loading-spinner"></div>
  <p>Loading...</p>
</div>
```

**Fixed:**
```html
<div id="loading" class="loading" role="status" aria-live="polite">
  <div class="loading-spinner" aria-hidden="true"></div>
  <p>Loading...</p>
</div>
```

**Files to modify:**
| File | Line |
|------|------|
| public/dashboard.html | ~42 |
| public/claim.html | ~15 |
| public/team-claim.html | ~20 |
| public/team-dashboard.html | ~25 |
| public/admin/dashboard.html | ~32 |
| public/admin/members.html | ~77 |
| public/admin/member-detail.html | ~34 |
| public/admin/config.html | ~32 |
| public/admin/audit.html | ~66 |
| public/admin/admins.html | ~39 |
| public/admin/templates.html | ~32 |

---

## Priority 4: Major Issues - Missing Labels
*Affects form accessibility*

### P4-001: Add screen-reader-only utility class
**Affects:** styles.css
**WCAG:** Various (enables proper labeling)
**Effort:** 5 min

**Add to styles.css:**
```css
/* Screen reader only - visually hidden but accessible */
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

### P4-002: Add missing form labels
**Effort:** 30 min

**admin/members.html - Select all checkbox (line ~88):**
```html
<!-- Current -->
<input type="checkbox" id="select-all" onchange="toggleSelectAll()">

<!-- Fixed -->
<input type="checkbox" id="select-all" onchange="toggleSelectAll()" aria-label="Select all members">
```

**admin/members.html - Row checkboxes (JavaScript template ~353):**
```javascript
// Current
<input type="checkbox" ... onchange="toggleRow('${member.id}', this.checked)">

// Fixed
<input type="checkbox" ... onchange="toggleRow('${member.id}', this.checked)" aria-label="Select ${escapeHtml(member.email)}">
```

**admin/member-detail.html - Role select (line ~97):**
```html
<!-- Current -->
<select id="role-select" style="...">

<!-- Fixed -->
<label for="role-select" class="sr-only">Grant role</label>
<select id="role-select" style="...">
```

**admin/admins.html - Role change selects (JavaScript template):**
```javascript
// Add aria-label dynamically
<select onchange="changeRole('${admin.id}', this.value)" aria-label="Change role for ${escapeHtml(admin.email)}" ...>
```

**admin/admins.html - Reset password input (line ~106):**
```html
<!-- Current -->
<input type="password" id="reset-password" ...>

<!-- Fixed -->
<label for="reset-password" class="sr-only">New password</label>
<input type="password" id="reset-password" ...>
```

**admin/templates.html - Subject/Body labels (lines ~62-65):**
```html
<!-- Current -->
<label>Subject</label>
<input type="text" id="template-subject" ...>

<!-- Fixed -->
<label for="template-subject">Subject</label>
<input type="text" id="template-subject" ...>
```
(Same for template-body textarea)

**team-dashboard.html - Quantity inputs:**
Add `for` attributes to labels matching input IDs.

---

## Priority 5: Major Issues - Dialog Accessibility
*Affects modal interactions*

### P5-001: Add aria-labelledby to dialogs
**Affects:** All dialog elements
**WCAG:** 1.3.1 Info and Relationships
**Effort:** 20 min

**Pattern to apply:**

**Current:**
```html
<dialog id="confirm-dialog" class="confirm-dialog">
  <h3 id="dialog-title">Confirm Action</h3>
```

**Fixed:**
```html
<dialog id="confirm-dialog" class="confirm-dialog" aria-labelledby="dialog-title">
  <h3 id="dialog-title">Confirm Action</h3>
```

**Files to modify:**
| File | Dialog ID | Title ID |
|------|-----------|----------|
| admin/members.html | confirm-dialog | dialog-title |
| admin/member-detail.html | confirm-dialog | dialog-title |
| admin/audit.html | detail-dialog | (add id to h3) |
| admin/admins.html | confirm-dialog | dialog-title |
| admin/admins.html | reset-dialog | (add id to h3) |

---

## Priority 6: Major Issues - Decorative Icons
*Cleans up screen reader experience*

### P6-001: Hide decorative icons from screen readers
**Affects:** Multiple pages
**WCAG:** 1.1.1 Non-text Content
**Effort:** 30 min

**Pattern to apply:**
Add `aria-hidden="true"` to decorative icons/symbols.

**index.html - SVG shield:**
```html
<svg viewBox="0 0 100 120" aria-hidden="true" ...>
```
Or wrap meaningfully:
```html
<div role="img" aria-label="The Revenue Council shield emblem">
  <svg viewBox="0 0 100 120" aria-hidden="true" ...>
</div>
```

**dashboard.html - Warning icon:**
```html
<div class="warning-icon" aria-hidden="true">!</div>
```

**claim.html - Success/Warning icons:**
```html
<div class="success-icon" aria-hidden="true">&#10004;</div>
<div class="warning-icon" aria-hidden="true">&#9888;</div>
```

**checkout-success.html:**
```html
<div class="success-icon" aria-hidden="true">&#10003;</div>
```

**team-dashboard.html:**
```html
<span class="seat-icon" aria-hidden="true">&#9813;</span>
<span class="crown-icon" aria-hidden="true">&#9813;</span>
<div class="banner-icon" aria-hidden="true">!</div>
```

**admin/dashboard.html - Quick link icons:**
```html
<span class="link-icon" aria-hidden="true">&#9813;</span>
```

**SVGs inside buttons (claim.html, team-claim.html):**
```html
<svg class="discord-icon" aria-hidden="true" ...>
```

---

## Priority 7: Major Issues - Interactive Elements
*Keyboard accessibility*

### P7-001: Make template list items keyboard accessible
**Affects:** admin/templates.html
**WCAG:** 2.1.1 Keyboard, 4.1.2 Name, Role, Value
**Effort:** 20 min

**Option A: Add button semantics to list items**
```javascript
// Current template
<li class="template-list-item ${...}" onclick="selectTemplate('${t.name}')">

// Fixed
<li class="template-list-item ${...}"
    role="button"
    tabindex="0"
    onclick="selectTemplate('${t.name}')"
    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectTemplate('${t.name}'); }">
```

**Option B: Use actual buttons (preferred)**
```javascript
<li>
  <button class="template-list-btn ${...}" onclick="selectTemplate('${t.name}')">
    ${escapeHtml(t.name)}
  </button>
</li>
```
Requires adding CSS for `.template-list-btn` to match current styling.

---

## Priority 8: Color Contrast Fixes
*Visual accessibility*

### P8-001: Fix contrast issues
**Affects:** styles.css, admin/styles.css
**WCAG:** 1.4.3 Contrast (Minimum)
**Effort:** 15 min

**styles.css - Increase border opacity:**
```css
/* Current */
--border-subtle: rgba(212, 175, 55, 0.3);

/* Fixed */
--border-subtle: rgba(212, 175, 55, 0.5);
```

**admin/styles.css - Fix badge contrast:**
```css
/* Red/Cancelled badge - lighten text */
.badge.cancelled,
.badge.canceled {
  background: rgba(239, 68, 68, 0.2);
  color: #ff7575; /* Was #ef4444 */
}

/* Gray/None badge - lighten text */
.badge.none,
.badge.no,
.badge.false {
  background: rgba(156, 163, 175, 0.2);
  color: #b8c0cc; /* Was #9ca3af */
}
```

---

## Priority 9: Minor Issues - Skip Links
*Bypass mechanism for keyboard users*

### P9-001: Add skip links to all pages
**Affects:** All 17 HTML pages
**WCAG:** 2.4.1 Bypass Blocks
**Effort:** 45 min

**Add CSS to styles.css:**
```css
/* Skip link styling */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--gold);
  color: var(--bg-dark);
  padding: 8px 16px;
  z-index: 100;
  font-family: 'Cinzel', serif;
  font-weight: 700;
  text-decoration: none;
  border-radius: 0 0 4px 0;
}

.skip-link:focus {
  top: 0;
}
```

**Add as first element in body (all pages):**
```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <!-- rest of page -->
```

**Add id to main content area:**
```html
<main id="main-content" class="...">
```

**Pages needing this addition:**
- public/index.html
- public/login.html
- public/signup.html
- public/dashboard.html
- public/claim.html
- public/team-claim.html
- public/team-dashboard.html
- public/checkout-success.html
- public/404.html
- public/admin/login.html
- public/admin/dashboard.html
- public/admin/members.html
- public/admin/member-detail.html
- public/admin/config.html
- public/admin/audit.html
- public/admin/admins.html
- public/admin/templates.html

---

## Priority 10: Minor Issues - Navigation Labels
*Improves landmark navigation*

### P10-001: Add aria-labels to navigation elements
**Affects:** Multiple pages
**WCAG:** 1.3.1 Info and Relationships
**Effort:** 15 min

**All public pages - Footer nav:**
```html
<nav class="footer-links" aria-label="Footer navigation">
```

**All admin pages - Admin nav:**
```html
<nav class="admin-nav" aria-label="Admin navigation">
```

---

## Implementation Order

### Wave 1: Critical (15 min)
1. P1-001: Add live regions to error messages

### Wave 2: High Impact (1.5 hours)
2. P4-001: Add sr-only utility class
3. P2-001: Add visible focus indicators
4. P3-001: Add loading state announcements

### Wave 3: Forms & Dialogs (50 min)
5. P4-002: Add missing form labels
6. P5-001: Add aria-labelledby to dialogs

### Wave 4: Content (30 min)
7. P6-001: Hide decorative icons
8. P7-001: Make template list keyboard accessible

### Wave 5: Visual & Navigation (1.25 hours)
9. P8-001: Fix contrast issues
10. P9-001: Add skip links
11. P10-001: Add navigation labels

---

## Verification Checklist

After implementing fixes, verify:

- [ ] Screen reader can announce form errors on login/signup pages
- [ ] Tab key shows visible focus indicator on all interactive elements
- [ ] Loading states announced by screen reader
- [ ] All form inputs have associated labels (check with AT)
- [ ] Dialogs announce their titles when opened
- [ ] Decorative icons not announced by screen reader
- [ ] Template list navigable by keyboard
- [ ] Badge text readable at all zoom levels
- [ ] Skip link visible on Tab and jumps to main content
- [ ] Navigation landmarks properly labeled

---

## Total Effort Summary

| Priority | Description | Effort |
|----------|-------------|--------|
| P1 | Critical - Error messages | 15 min |
| P2 | Focus indicators | 30 min |
| P3 | Loading states | 45 min |
| P4 | Form labels | 35 min |
| P5 | Dialog accessibility | 20 min |
| P6 | Decorative icons | 30 min |
| P7 | Keyboard navigation | 20 min |
| P8 | Color contrast | 15 min |
| P9 | Skip links | 45 min |
| P10 | Navigation labels | 15 min |
| **Total** | | **4.5 hours** |

*Buffer for testing and edge cases: +1 hour*
*Realistic total: 5-6 hours*
