# Phase 20: Accessibility Audit - Research

**Researched:** 2026-01-21
**Domain:** WCAG 2.1 AA Compliance for Static HTML/CSS
**Confidence:** HIGH

## Summary

This research covers WCAG 2.1 Level AA compliance requirements for the membership gateway's static HTML frontend. The project uses a medieval theme with dark backgrounds (#1a1a2e), gold accents (#d4af37), and custom fonts (Cinzel, Crimson Text).

Based on analysis of the existing codebase (17 HTML files across public/, public/admin/, and public/app/), the accessibility audit will focus on five key areas: form labels, color contrast, focus indicators, keyboard navigation, and ARIA labels for interactive elements.

**Primary recommendation:** Use automated testing tools (axe DevTools, Lighthouse) for initial detection, then manual verification for the 60-70% of issues automated tools cannot detect. The gold-on-dark color scheme requires careful contrast verification, and focus indicators need explicit CSS styling since browser defaults are being overridden.

## Standard Stack

The established tools for accessibility auditing:

### Core Testing Tools
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| axe DevTools | 4.x | Browser extension for detailed accessibility testing | Zero false-positive commitment, detects ~57% of issues |
| Google Lighthouse | Built-in | Quick accessibility scoring in DevTools | Uses axe-core, good for initial assessment |
| WAVE | Browser extension | Visual overlay showing accessibility issues | Best for quick visual evaluation |
| WebAIM Contrast Checker | Online | Verify color contrast ratios | Industry standard, WCAG-aligned |

### Supporting Tools
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Colour Contrast Analyser (CCA) | Desktop color sampling | When testing rendered colors |
| NVDA/VoiceOver | Screen reader testing | Manual verification of screen reader experience |
| Keyboard-only navigation | Tab order verification | Test all interactive elements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| axe DevTools | Pa11y CI | Pa11y better for automation, axe better for developer workflow |
| Manual testing | Automated only | Automated catches only 30-40% of WCAG issues |

## Architecture Patterns

### Audit Workflow Structure
```
1. Automated Scan
   |-- Run axe DevTools on each page
   |-- Run Lighthouse accessibility audit
   |-- Export issues to tracking document

2. Color Contrast Verification
   |-- Test all text color combinations
   |-- Verify against WCAG AA ratios
   |-- Document any failures

3. Form Accessibility Review
   |-- Verify label-input associations
   |-- Check error message accessibility
   |-- Test screen reader announcement

4. Keyboard Navigation Testing
   |-- Tab through all interactive elements
   |-- Verify logical tab order
   |-- Check for keyboard traps

5. Focus Indicator Verification
   |-- Verify visible focus states
   |-- Check custom focus styles meet 3:1 contrast
   |-- Test focus-visible support
```

### File Organization for Findings
```
.planning/phases/20-accessibility-audit/
|-- 20-RESEARCH.md         # This file
|-- 20-01-PLAN.md          # Audit execution plan
|-- AUDIT-FINDINGS.md      # Detailed findings per page
|-- CONTRAST-REPORT.md     # Color contrast analysis
|-- REMEDIATION-CHECKLIST.md # Required fixes
```

### Pattern 1: Form Label Association
**What:** Every form input must have a programmatically associated label
**When to use:** All `<input>`, `<select>`, `<textarea>` elements
**Example:**
```html
<!-- Correct: Using for/id association -->
<label for="email" class="form-label">Email Address</label>
<input type="email" id="email" name="email" class="form-input">

<!-- Also correct: Wrapping input in label -->
<label class="form-label">
  Email Address
  <input type="email" name="email" class="form-input">
</label>

<!-- Incorrect: Placeholder only (not accessible) -->
<input type="email" placeholder="Enter email">
```
Source: [W3C WAI Form Labeling Tutorial](https://www.w3.org/WAI/tutorials/forms/labels/)

### Pattern 2: Focus Indicator Styling
**What:** Custom focus indicators must meet contrast requirements
**When to use:** When overriding browser default focus styles
**Example:**
```css
/* Good: Visible focus indicator with sufficient contrast */
*:focus {
  outline: 3px solid #d4af37; /* At least 2px thick */
  outline-offset: 2px;        /* Separation for clarity */
}

/* Better: Use focus-visible for keyboard-only focus */
*:focus-visible {
  outline: 3px solid #d4af37;
  outline-offset: 2px;
}

/* Bad: Removing focus indicator */
*:focus {
  outline: none; /* NEVER do this without replacement */
}
```
Source: [W3C Understanding Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)

### Pattern 3: Icon Button Accessibility
**What:** Icon-only buttons need accessible names
**When to use:** Buttons with SVG/icons and no visible text
**Example:**
```html
<!-- Good: aria-label provides accessible name -->
<button class="btn-icon" aria-label="Search">
  <svg>...</svg>
</button>

<!-- Good: sr-only text for screen readers -->
<button class="btn-icon">
  <svg aria-hidden="true">...</svg>
  <span class="sr-only">Search</span>
</button>

<!-- Bad: No accessible name -->
<button class="btn-icon">
  <svg>...</svg>
</button>
```
Source: [MDN ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role)

### Anti-Patterns to Avoid
- **Using placeholders as labels:** Screen readers don't announce placeholders as labels
- **Relying on color alone:** Information must not be conveyed by color only
- **Removing focus outlines without replacement:** Keyboard users lose navigation cues
- **Using tabindex > 0:** Breaks natural tab order
- **Using div/span for interactive elements:** Use semantic HTML (button, a, input)

## Don't Hand-Roll

Problems that have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contrast checking | Manual visual inspection | WebAIM Contrast Checker, axe DevTools | Mathematical precision required |
| Accessibility scanning | Custom scripts | axe-core, Lighthouse, WAVE | Comprehensive rule coverage |
| Screen reader testing | Guessing behavior | NVDA (Windows), VoiceOver (Mac) | Real assistive technology |
| Focus management | Custom tab order logic | Native HTML elements | Semantic HTML handles this |
| Modal accessibility | Custom keyboard trapping | Dialog element or established patterns | Complex edge cases handled |

**Key insight:** Accessibility issues are often subtle and require specialized tools to detect. Visual inspection cannot catch programmatic issues that affect assistive technology users.

## Common Pitfalls

### Pitfall 1: Gold Text Contrast on Dark Background
**What goes wrong:** Gold (#d4af37) may not have sufficient contrast on the dark background (#1a1a2e) for all text sizes
**Why it happens:** Gold/yellow colors are notoriously difficult for contrast compliance
**How to avoid:** Verify all gold text combinations with a contrast checker; may need to lighten gold for small text
**Warning signs:** Text appears legible to you but fails automated checks

### Pitfall 2: Missing Focus Indicators After CSS Override
**What goes wrong:** Custom CSS removes browser default focus indicators without providing alternatives
**Why it happens:** Developers add `outline: none` for visual aesthetics, forget to add replacement
**How to avoid:** Search CSS for `outline: none` or `outline: 0`; ensure `:focus` or `:focus-visible` styles exist
**Warning signs:** Tabbing through page shows no visual indication of focused element

### Pitfall 3: Checkbox/Select Without Visible Labels
**What goes wrong:** Filter dropdowns and checkboxes lack programmatic label association
**Why it happens:** Labels may be visually present but not using `for` attribute
**How to avoid:** Every input needs `id` that matches a label's `for`, or be wrapped in label
**Warning signs:** Screen reader announces "checkbox" or "combobox" without context

### Pitfall 4: Dynamic Content Not Announced
**What goes wrong:** Error messages, loading states, and dynamic updates aren't announced to screen readers
**Why it happens:** Content changes without ARIA live regions
**How to avoid:** Use `role="alert"`, `aria-live="polite"`, or `aria-live="assertive"` for dynamic content
**Warning signs:** Error messages appear visually but screen reader doesn't announce them

### Pitfall 5: SVG Icons Without Accessible Names
**What goes wrong:** Inline SVGs in buttons/links have no text alternative
**Why it happens:** SVG content is decorative from developer's perspective but semantic for users
**How to avoid:** Add `aria-hidden="true"` to decorative SVGs; add `aria-label` to interactive SVG containers
**Warning signs:** Button reads as "button" with no description

### Pitfall 6: Keyboard Traps in Dialogs
**What goes wrong:** Users can't escape modal dialogs with keyboard
**Why it happens:** Focus not managed properly when dialog opens/closes
**How to avoid:** Use native `<dialog>` element; trap focus within dialog; return focus on close
**Warning signs:** Tab key cycles within dialog forever, Escape doesn't close

## Code Examples

Verified patterns from official sources:

### Accessible Error Message Pattern
```html
<!-- Container for error messages with live region -->
<div id="error-message" class="form-error" role="alert" aria-live="assertive">
  <!-- Error text injected here will be announced -->
</div>

<!-- JavaScript to show error -->
<script>
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.classList.add('visible');
  // role="alert" automatically announces to screen readers
}
</script>
```
Source: [W3C WAI Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/)

### Screen Reader Only Text
```css
/* Visually hidden but accessible to screen readers */
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
Source: [WebAIM CSS in Action](https://webaim.org/techniques/css/invisiblecontent/)

### Skip Link Pattern
```html
<!-- First focusable element on page -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Main content target -->
<main id="main-content">
  ...
</main>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #d4af37;
  color: #1a1a2e;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>
```
Source: [WebAIM Skip Navigation](https://webaim.org/techniques/skipnav/)

### Data Table Accessibility
```html
<!-- Accessible table with proper headers -->
<table class="data-table">
  <caption class="sr-only">Member list with subscription status</caption>
  <thead>
    <tr>
      <th scope="col">
        <input type="checkbox" id="select-all" aria-label="Select all members">
      </th>
      <th scope="col">Email</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <input type="checkbox" aria-label="Select member john@example.com">
      </td>
      <td>john@example.com</td>
      <td>Active</td>
    </tr>
  </tbody>
</table>
```
Source: [W3C WAI Table Concepts](https://www.w3.org/WAI/tutorials/tables/)

## Color Contrast Analysis

### Current Color Palette (from styles.css)
| Variable | Hex | Usage |
|----------|-----|-------|
| --bg-dark | #1a1a2e | Main background |
| --bg-card | #16213e | Card backgrounds |
| --bg-section | #0f0f1a | Section backgrounds |
| --gold | #d4af37 | Headings, accents |
| --gold-light | #f1c40f | Hover states |
| --cream | #f5f0e1 | Body text alternative |
| --text | #e8e8e8 | Main body text |
| --text-muted | #a0a0a0 | Secondary text |

### Required Contrast Ratios (WCAG 2.1 AA)
| Text Type | Minimum Ratio | Size Threshold |
|-----------|---------------|----------------|
| Normal text | 4.5:1 | Below 18pt (24px) |
| Large text | 3:1 | 18pt+ (24px) or 14pt bold (18.5px) |
| UI components | 3:1 | Borders, icons |

### Combinations to Verify
| Foreground | Background | Usage | Test Required |
|------------|------------|-------|---------------|
| --gold (#d4af37) | --bg-dark (#1a1a2e) | Headings | Likely passes (high contrast) |
| --text (#e8e8e8) | --bg-dark (#1a1a2e) | Body text | Likely passes |
| --text-muted (#a0a0a0) | --bg-dark (#1a1a2e) | Secondary text | May fail (lower contrast) |
| --cream (#f5f0e1) | --bg-dark (#1a1a2e) | Feature lists | Likely passes |
| --gold (#d4af37) | --bg-card (#16213e) | Card headings | Verify |
| --text-muted (#a0a0a0) | --bg-card (#16213e) | Card secondary | May fail |

### Badge Colors to Verify
| Badge Type | Text Color | Background | Notes |
|------------|------------|------------|-------|
| .badge.active | #4ade80 | rgba(74,222,128,0.2) | Green on transparent |
| .badge.past_due | #fbbf24 | rgba(251,191,36,0.2) | Yellow on transparent |
| .badge.cancelled | #ef4444 | rgba(239,68,68,0.2) | Red on transparent |
| .badge.none | #9ca3af | rgba(156,163,175,0.2) | Gray on transparent |

**Note:** Badge colors must contrast with both their backgrounds AND the underlying page background.

## Current State Analysis

### Pages Identified for Audit (17 total)

**Public Pages (5):**
- `public/index.html` - Landing page with pricing cards
- `public/login.html` - User login form
- `public/signup.html` - User registration form
- `public/dashboard.html` - User dashboard
- `public/claim.html` - Discord linking page

**Admin Pages (8):**
- `public/admin/login.html` - Admin login
- `public/admin/dashboard.html` - Admin dashboard
- `public/admin/members.html` - Member management with filters
- `public/admin/member-detail.html` - Single member view
- `public/admin/config.html` - Configuration
- `public/admin/audit.html` - Audit log
- `public/admin/admins.html` - Admin management
- `public/admin/templates.html` - Email templates

**Other Pages (4):**
- `public/404.html`
- `public/checkout-success.html`
- `public/team-claim.html`
- `public/team-dashboard.html`

### Known Issues Identified in Code Review

1. **Form labels:** Login/signup forms have proper `for` attributes - GOOD
2. **Checkbox labels:** Admin table checkboxes lack labels - ISSUE
3. **Focus styles:** No explicit `:focus` styles found in CSS - ISSUE
4. **SVG icons:** Shield SVG on landing page lacks `role` or `aria-label` - ISSUE
5. **Loading spinners:** Missing `aria-live` on loading states - ISSUE
6. **Error messages:** Have `role="alert"` in some places - PARTIAL
7. **Dialog element:** Uses native `<dialog>` in admin pages - GOOD
8. **Skip links:** Not present - ISSUE

## WCAG Success Criteria Checklist

### Level A (Must Have)
| Criterion | Description | Relevant to Project |
|-----------|-------------|---------------------|
| 1.1.1 | Non-text Content | SVG icons need alt text |
| 1.3.1 | Info and Relationships | Form labels, table headers |
| 1.4.1 | Use of Color | Don't rely on color alone |
| 2.1.1 | Keyboard | All functionality keyboard accessible |
| 2.1.2 | No Keyboard Trap | Can escape all components |
| 2.4.1 | Bypass Blocks | Skip links for navigation |
| 2.4.4 | Link Purpose | Links have descriptive text |
| 3.3.1 | Error Identification | Errors described in text |
| 3.3.2 | Labels or Instructions | Form inputs have labels |
| 4.1.2 | Name, Role, Value | Interactive elements have names |

### Level AA (Required for Compliance)
| Criterion | Description | Relevant to Project |
|-----------|-------------|---------------------|
| 1.4.3 | Contrast (Minimum) | 4.5:1 for text |
| 1.4.4 | Resize Text | Text scales to 200% |
| 1.4.11 | Non-text Contrast | 3:1 for UI components |
| 2.4.6 | Headings and Labels | Descriptive headings |
| 2.4.7 | Focus Visible | Visible focus indicator |
| 3.3.3 | Error Suggestion | Provide correction hints |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual-only testing | Automated + manual | Always | Catch more issues faster |
| :focus only | :focus-visible | CSS4 / 2020+ | Better UX for mouse users |
| title attribute | aria-label | ARIA 1.0+ | More reliable screen reader support |
| tabindex everywhere | Semantic HTML | Always best | Simpler, more maintainable |
| WCAG 2.0 | WCAG 2.2 | Oct 2023 | New focus appearance criteria |

**Deprecated/outdated:**
- `accesskey` attribute: Conflicts with assistive technology shortcuts
- `title` for form labels: Unreliably announced by screen readers

## Open Questions

Things that couldn't be fully resolved:

1. **Exact contrast ratios for color palette**
   - What we know: Colors are documented in CSS variables
   - What's unclear: Exact contrast ratios require tool verification
   - Recommendation: Run WebAIM Contrast Checker on each combination during audit

2. **Badge color accessibility on varying backgrounds**
   - What we know: Badges use semi-transparent backgrounds
   - What's unclear: Final rendered contrast depends on underlying elements
   - Recommendation: Test badges in context on each page

3. **Custom font accessibility**
   - What we know: Cinzel and Crimson Text are used
   - What's unclear: Font legibility at various sizes
   - Recommendation: Test with browser zoom at 200%

## Sources

### Primary (HIGH confidence)
- [W3C WCAG 2.1 Understanding Docs](https://www.w3.org/WAI/WCAG21/Understanding/) - Official success criteria explanations
- [W3C WAI Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/labels/) - Form labeling patterns
- [MDN ARIA Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) - ARIA attribute usage

### Secondary (MEDIUM confidence)
- [WebAIM WCAG Checklist](https://webaim.org/standards/wcag/checklist) - Practical WCAG checklist
- [WebAIM Keyboard Accessibility](https://webaim.org/techniques/keyboard/) - Keyboard navigation guidance
- [A11Y Project Checklist](https://www.a11yproject.com/checklist/) - Community-maintained checklist

### Tertiary (LOW confidence)
- Web search results for tool comparisons - May be outdated
- Blog posts on color contrast - Opinions vary

## Metadata

**Confidence breakdown:**
- WCAG requirements: HIGH - Official W3C documentation
- Testing tools: HIGH - Industry standard tools
- Color contrast concerns: MEDIUM - Requires verification with tools
- Code analysis: HIGH - Direct review of HTML/CSS files

**Research date:** 2026-01-21
**Valid until:** 2026-04-21 (WCAG standards stable, tools update frequently)
