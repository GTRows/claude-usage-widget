## What's New in v1.6.0

### 🔔 Usage Alerts
The widget now sends native OS desktop notifications when your usage crosses configurable thresholds.

- Alerts fire at your **warning** and **danger** thresholds (same levels used for bar color changes)
- Covers both **Current Session** and **Weekly Limit**
- Smart startup seeding: thresholds already exceeded when the app launches are treated as acknowledged — no surprise alerts just for opening the widget
- Alerts reset automatically when a usage window resets and climbs back through the threshold
- Enabled by default; toggle off in Settings if not needed

### 📦 Compact Mode
A minimal 290×105px view showing just the two progress bars — useful when screen space is tight.

- Collapse to compact using the **‹** chevron on the left edge of the normal view
- Expand back to normal using the **›** chevron on the right edge of compact view
- Compact mode can also be toggled from the Settings panel (takes effect on Done)
- In compact mode, settings shows a minimal overlay with just the compact toggle
- Mode is persisted across restarts
- Refresh button is hidden in compact mode to prevent accidental resize
- Expanding back to normal always returns to the collapsed (non-expanded) state

---

**Full changelog:** https://github.com/SlavomirDurej/claude-usage-widget/commits/main
