# Plans

This folder is the **execution checklist** for Forgotten Letters V1. Tick
items as you complete them; do not skip ahead. Each file ends with a
`Verify` section — sign that off before moving to the next sprint.

| File                                                             | Sprint | Theme                                   |
| ---------------------------------------------------------------- | ------ | --------------------------------------- |
| [00-master-plan.md](00-master-plan.md)                           | —      | Map of all sprints, decisions, gaps     |
| [01-foundation.md](01-foundation.md)                             | 1      | Bootstrap, auth, theme, CI, branches    |
| [02-data-layer.md](02-data-layer.md)                             | 2      | All migrations, RLS, triggers           |
| [03-cms-and-content.md](03-cms-and-content.md)                   | 3      | Sanity, image pipeline                  |
| [04-crud-and-search.md](04-crud-and-search.md)                   | 4      | Scenarios, campaigns, warbands, search  |
| [05-map-editor-and-campaign.md](05-map-editor-and-campaign.md)   | 5      | Konva editor, campaign tracking, PDF    |
| [06-social-and-notifications.md](06-social-and-notifications.md) | 6      | Votes, comments, email, notifications   |
| [07-account-admin-monitoring.md](07-account-admin-monitoring.md) | 7      | Settings, admin, GDPR, Sentry           |
| [08-hardening-and-launch.md](08-hardening-and-launch.md)         | 8      | Markdown, anti-spam, legal, a11y, tests |
| [09-launch-and-post-launch.md](09-launch-and-post-launch.md)     | 9      | Cutover + v2 backlog                    |

## History

This folder replaces an earlier set of exploratory prompt drafts in
`.github/prompts/`, which have been removed. Architectural rationale that
was useful from those drafts is now folded into the relevant phase files
above. The gap-closing phases (N1, N2, U1, S1, S2) cover what the original
drafts missed: notifications, transactional email, GDPR/data export,
markdown safety, anti-spam, backups, schema reconcile, and onboarding.
