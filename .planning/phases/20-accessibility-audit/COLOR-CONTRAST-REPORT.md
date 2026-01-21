# Color Contrast Report

**Audit Date:** 2026-01-21
**Standard:** WCAG 2.1 Level AA
**Tool Reference:** WebAIM Contrast Checker formulas

## WCAG AA Requirements

| Text Type | Minimum Ratio | Size Threshold |
|-----------|---------------|----------------|
| Normal text | 4.5:1 | Below 18pt (24px) or 14pt bold (18.5px) |
| Large text | 3:1 | 18pt+ (24px) or 14pt bold+ (18.5px) |
| UI components | 3:1 | Borders, icons, focus indicators |

## Color Palette (from CSS Variables)

| Variable | Hex | RGB | Relative Luminance | Usage |
|----------|-----|-----|-------------------|-------|
| --bg-dark | #1a1a2e | rgb(26, 26, 46) | 0.0141 | Main background |
| --bg-card | #16213e | rgb(22, 33, 62) | 0.0159 | Card backgrounds |
| --bg-section | #0f0f1a | rgb(15, 15, 26) | 0.0076 | Section backgrounds |
| --gold | #d4af37 | rgb(212, 175, 55) | 0.4163 | Headings, accents |
| --gold-light | #f1c40f | rgb(241, 196, 15) | 0.5424 | Hover states |
| --gold-dark | #b8960c | rgb(184, 150, 12) | 0.2977 | Ribbon shadow |
| --cream | #f5f0e1 | rgb(245, 240, 225) | 0.8705 | Body text alternative |
| --text | #e8e8e8 | rgb(232, 232, 232) | 0.7972 | Main body text |
| --text-muted | #a0a0a0 | rgb(160, 160, 160) | 0.3515 | Secondary text |

## Contrast Ratio Calculations

### Contrast Formula
```
L1 = lighter color luminance
L2 = darker color luminance
Contrast Ratio = (L1 + 0.05) / (L2 + 0.05)
```

---

## Main Text Combinations

### Body Text on Dark Background

| Foreground | Background | Usage | Ratio | Required | Status |
|------------|------------|-------|-------|----------|--------|
| #e8e8e8 (--text) | #1a1a2e (--bg-dark) | Body text | **13.22:1** | 4.5:1 | **PASS** |
| #e8e8e8 (--text) | #16213e (--bg-card) | Card body text | **12.87:1** | 4.5:1 | **PASS** |
| #e8e8e8 (--text) | #0f0f1a (--bg-section) | Section body text | **14.74:1** | 4.5:1 | **PASS** |

### Cream Text on Dark Background

| Foreground | Background | Usage | Ratio | Required | Status |
|------------|------------|-------|-------|----------|--------|
| #f5f0e1 (--cream) | #1a1a2e (--bg-dark) | Feature lists, descriptions | **14.34:1** | 4.5:1 | **PASS** |
| #f5f0e1 (--cream) | #16213e (--bg-card) | Card descriptions | **13.95:1** | 4.5:1 | **PASS** |
| #f5f0e1 (--cream) | #0f0f1a (--bg-section) | Section descriptions | **16.00:1** | 4.5:1 | **PASS** |

### Gold Headings on Dark Background

| Foreground | Background | Usage | Ratio | Required | Status |
|------------|------------|-------|-------|----------|--------|
| #d4af37 (--gold) | #1a1a2e (--bg-dark) | H1, H2, H3 headings (large) | **7.27:1** | 3:1 | **PASS** |
| #d4af37 (--gold) | #16213e (--bg-card) | Card headings (large) | **7.08:1** | 3:1 | **PASS** |
| #d4af37 (--gold) | #0f0f1a (--bg-section) | Section headings (large) | **8.10:1** | 3:1 | **PASS** |

**Note:** Gold on dark backgrounds passes for large text (headings) at 3:1 requirement. However, if gold is used for normal-sized text, it would need 4.5:1 to pass (currently at 7.27:1, so it passes both thresholds).

### Muted Text on Dark Background (POTENTIAL FAILURE)

| Foreground | Background | Usage | Ratio | Required | Status |
|------------|------------|-------|-------|----------|--------|
| #a0a0a0 (--text-muted) | #1a1a2e (--bg-dark) | Secondary text, timestamps | **6.26:1** | 4.5:1 | **PASS** |
| #a0a0a0 (--text-muted) | #16213e (--bg-card) | Card secondary text | **6.09:1** | 4.5:1 | **PASS** |
| #a0a0a0 (--text-muted) | #0f0f1a (--bg-section) | Section secondary text | **6.98:1** | 4.5:1 | **PASS** |

**Result:** Muted text passes WCAG AA requirements, contrary to initial concern. The #a0a0a0 gray on dark backgrounds has sufficient contrast.

---

## UI Component Contrast

### Border Colors

| Foreground | Background | Usage | Ratio | Required | Status |
|------------|------------|-------|-------|----------|--------|
| rgba(212,175,55,0.3) | #1a1a2e | --border-subtle on bg-dark | ~2.1:1 | 3:1 | **FAIL** |
| #d4af37 (--gold) | #1a1a2e | Solid gold borders | **7.27:1** | 3:1 | **PASS** |

**CONTRAST-001: Subtle borders insufficient contrast**
- Colors: rgba(212, 175, 55, 0.3) on #1a1a2e
- Effective color: approximately #3d3a35 (30% gold opacity blend)
- Ratio: ~2.1:1 (requires 3:1)
- Usage: Card borders, section dividers
- Impact: Borders may be invisible to users with low vision
- Fix: Increase opacity to `rgba(212, 175, 55, 0.5)` for ~3.5:1 ratio

---

## Status Badge Contrast

### Active Badge (Green)

| Foreground | Background | Effective BG | Usage | Ratio | Required | Status |
|------------|------------|--------------|-------|-------|----------|--------|
| #4ade80 | rgba(74,222,128,0.2) | ~#2d4d3a | Active, Claimed, Yes | **4.85:1** | 4.5:1 | **PASS** |
| #4ade80 | #1a1a2e (page bg) | Direct on dark | **7.91:1** | 4.5:1 | **PASS** |

### Past Due Badge (Yellow/Amber)

| Foreground | Background | Effective BG | Usage | Ratio | Required | Status |
|------------|------------|--------------|-------|-------|----------|--------|
| #fbbf24 | rgba(251,191,36,0.2) | ~#4a432d | Past due, Pending | **5.21:1** | 4.5:1 | **PASS** |
| #fbbf24 | #1a1a2e (page bg) | Direct on dark | **9.37:1** | 4.5:1 | **PASS** |

### Cancelled Badge (Red)

| Foreground | Background | Effective BG | Usage | Ratio | Required | Status |
|------------|------------|--------------|-------|-------|----------|--------|
| #ef4444 | rgba(239,68,68,0.2) | ~#4a2828 | Cancelled, Error | **3.79:1** | 4.5:1 | **FAIL** |
| #ef4444 | #1a1a2e (page bg) | Direct on dark | **5.59:1** | 4.5:1 | **PASS** |

**CONTRAST-002: Red badge text insufficient on semi-transparent background**
- Colors: #ef4444 on rgba(239,68,68,0.2)
- Ratio: 3.79:1 (requires 4.5:1 for small text)
- Usage: Cancelled, Error states
- Fix: Darken badge background to `rgba(239, 68, 68, 0.3)` or lighten text to #ff6b6b

### None/Gray Badge

| Foreground | Background | Effective BG | Usage | Ratio | Required | Status |
|------------|------------|--------------|-------|-------|----------|--------|
| #9ca3af | rgba(156,163,175,0.2) | ~#383b40 | None, No, False | **3.82:1** | 4.5:1 | **FAIL** |
| #9ca3af | #1a1a2e (page bg) | Direct on dark | **5.89:1** | 4.5:1 | **PASS** |

**CONTRAST-003: Gray badge text insufficient on semi-transparent background**
- Colors: #9ca3af on rgba(156,163,175,0.2)
- Ratio: 3.82:1 (requires 4.5:1)
- Usage: None, No, False badges
- Fix: Lighten text to #b4bcc7 or increase background opacity

### Admin/Role Badges

| Badge Class | Foreground | Effective Ratio | Status |
|-------------|------------|-----------------|--------|
| .super_admin | var(--gold) | ~7.27:1 | **PASS** |
| .admin | #60a5fa (blue) | ~5.42:1 | **PASS** |
| .individual | #a78bfa (purple) | ~4.62:1 | **PASS** |
| .owner | var(--gold) | ~7.27:1 | **PASS** |
| .team_member | #60a5fa (blue) | ~5.42:1 | **PASS** |

---

## Button Contrast

### Primary Buttons (CTA)

| Element | Foreground | Background | Ratio | Status |
|---------|------------|------------|-------|--------|
| .cta-button | #1a1a2e (text) | #d4af37 (gold) | **7.27:1** | **PASS** |
| .cta-button:hover | #1a1a2e | #f1c40f (gold-light) | **9.47:1** | **PASS** |
| .form-button | #1a1a2e | #d4af37 | **7.27:1** | **PASS** |
| .btn-primary | #1a1a2e | #d4af37 | **7.27:1** | **PASS** |

### Secondary Buttons

| Element | Foreground | Background | Border | Text Ratio | Border Ratio | Status |
|---------|------------|------------|--------|------------|--------------|--------|
| .btn-secondary | #d4af37 | transparent/#1a1a2e | #d4af37 | 7.27:1 | 7.27:1 | **PASS** |
| .action-button | #d4af37 | #16213e | #d4af37 | 7.08:1 | 7.08:1 | **PASS** |

### Danger Buttons

| Element | Foreground | Background | Ratio | Status |
|---------|------------|------------|-------|--------|
| .btn-danger | #fff | #8b0000 | **8.59:1** | **PASS** |
| .btn-danger:hover | #fff | #a00000 | **7.28:1** | **PASS** |

---

## Link Contrast

| Element | Foreground | Background | Ratio | Status |
|---------|------------|------------|-------|--------|
| Footer links | #a0a0a0 | #0f0f1a | **6.98:1** | **PASS** |
| Footer links:hover | #d4af37 | #0f0f1a | **8.10:1** | **PASS** |
| Form footer links | #d4af37 | #16213e | **7.08:1** | **PASS** |
| Admin nav links | #f5f0e1 | #0f0f1a | **16.00:1** | **PASS** |
| Admin nav active | #d4af37 | rgba bg | ~7.08:1 | **PASS** |

---

## Error/Warning States

| Element | Foreground | Background | Ratio | Status |
|---------|------------|------------|-------|--------|
| .form-error text | #ef4444 | rgba(239,68,68,0.1) | ~4.8:1 | **PASS** |
| .error-state text | #ef4444 | #1a1a2e | **5.59:1** | **PASS** |
| .billing-warning text | #e74c3c | rgba(231,76,60,0.1) | ~5.0:1 | **PASS** |
| Warning icon "!" | #e74c3c | rgba(231,76,60,0.2) | ~4.2:1 | **MARGINAL** |

---

## Focus Indicators (UI Components)

| Element | Focus Color | Background | Ratio | Required | Status |
|---------|-------------|------------|-------|----------|--------|
| .form-input:focus border | #d4af37 | #1a1a2e | **7.27:1** | 3:1 | **PASS** |
| Button focus (if added) | #d4af37 | var | 7.27:1 | 3:1 | **PASS** |

**Note:** While the gold color has sufficient contrast for focus indicators, the current CSS removes outlines (`outline: none`) without providing adequate replacement. The border color change alone may not be visible enough for users with low vision.

---

## Failures Requiring Remediation

### CONTRAST-001: Subtle border insufficient contrast
- **Colors:** rgba(212, 175, 55, 0.3) on #1a1a2e
- **Ratio:** ~2.1:1 (requires 3:1 for UI components)
- **Usage:** Card borders, section dividers, subtle separators
- **Fix:** Change `--border-subtle` to `rgba(212, 175, 55, 0.5)` for ~3.5:1 ratio
- **CSS:**
  ```css
  :root {
    --border-subtle: rgba(212, 175, 55, 0.5); /* Was 0.3 */
  }
  ```
- **Effort:** 5 min

### CONTRAST-002: Red badge text insufficient
- **Colors:** #ef4444 on rgba(239,68,68,0.2)
- **Ratio:** 3.79:1 (requires 4.5:1)
- **Usage:** Cancelled status badges, error badges
- **Fix Option A:** Increase background opacity
  ```css
  .badge.cancelled,
  .badge.canceled {
    background: rgba(239, 68, 68, 0.3); /* Was 0.2 */
  }
  ```
- **Fix Option B:** Lighten text color
  ```css
  .badge.cancelled,
  .badge.canceled {
    color: #ff7575; /* Was #ef4444 */
  }
  ```
- **Effort:** 5 min

### CONTRAST-003: Gray badge text insufficient
- **Colors:** #9ca3af on rgba(156,163,175,0.2)
- **Ratio:** 3.82:1 (requires 4.5:1)
- **Usage:** None, No, False status badges
- **Fix:** Lighten text color
  ```css
  .badge.none,
  .badge.no,
  .badge.false {
    color: #b8c0cc; /* Was #9ca3af - provides ~4.6:1 */
  }
  ```
- **Effort:** 5 min

---

## Summary

### Pass Summary
| Category | Tested | Passed | Failed |
|----------|--------|--------|--------|
| Body text | 6 | 6 | 0 |
| Headings | 3 | 3 | 0 |
| Secondary text | 3 | 3 | 0 |
| Buttons | 8 | 8 | 0 |
| Links | 5 | 5 | 0 |
| Badges | 10 | 7 | 3 |
| UI Components | 3 | 1 | 2 |
| **Total** | **38** | **33** | **5** |

### Failures by Priority
| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| CONTRAST-001 | Subtle borders | Low (decorative) | 5 min |
| CONTRAST-002 | Red badge text | Medium (status info) | 5 min |
| CONTRAST-003 | Gray badge text | Medium (status info) | 5 min |

### Overall Assessment
- **Primary color scheme passes:** Gold, cream, and main text colors all have excellent contrast
- **Badge system needs minor adjustment:** 3 badge variants need slight color tweaks
- **Border opacity too low:** Decorative borders could be slightly more visible
- **Total remediation effort:** ~15-20 minutes of CSS changes
