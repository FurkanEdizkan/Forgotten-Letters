# Costs

What Forgotten Letters actually costs to run, comparing the original managed stack
(Vercel + Supabase + Sanity) against the chosen open-source / AWS stack. Figures are
indicative monthly USD as of early 2026 — treat them as planning estimates, not quotes.

## TL;DR

- **Compute is cheap on every option.** The real cost driver is **object storage +
  egress bandwidth** — user-uploaded map assets, avatars, AI-generated images, and STL
  files. Get egress wrong and the bill scales with traffic regardless of stack.
- **Cloudflare R2 has zero egress fees.** Putting all assets on R2 is the single decision
  that keeps this project cheap on any host.
- **Managed floor once you monetize: ~$45/mo.** Self-hosted floor: **~$10–20/mo flat.**

## Managed stack (original plan)

| Service | Free tier | Paid tier | Notes |
|---|---|---|---|
| **Vercel** | Hobby: 100 GB bandwidth — **non-commercial only** | **Pro $20/mo** + ~$0.15/GB over 1 TB | Ads/billing require Pro; Hobby ToS forbids commercial use |
| **Supabase** | 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU — **pauses after 7 days idle** | **Pro $25/mo** → 8 GB DB, 100 GB storage, 250 GB egress | Overage: storage $0.021/GB, egress $0.09/GB |
| **Sanity** | 10k docs, 5 GB assets, 100k CDN req | **Growth $15/seat/mo** | Third vendor; mostly static content |

**What you'd actually pay (managed):**

| Stage | Monthly | Why |
|---|---|---|
| Pre-launch / tiny traffic | **$0** | All free tiers — but Supabase auto-pauses and ads aren't allowed on Vercel Hobby |
| Launched + monetizing, ~1–5k users | **~$45** | Vercel Pro $20 + Supabase Pro $25; Sanity still free |
| Growing, ~20–50k users + uploads + AI Forge | **~$80–200+** | Driven by Supabase storage + egress and Vercel bandwidth overage |

## Open-source / AWS stack (chosen)

| Piece | Open-source part | Cost |
|---|---|---|
| Hosting | Next.js Docker image | **Lightsail Containers $10–20/mo flat**, or Fargate ~$15–30/mo |
| Database + Auth | Postgres + Auth.js | $0 extra co-located on the host, or **RDS micro ~$13/mo** |
| Object storage | Cloudflare R2 | $0.015/GB stored, **$0 egress**; 10 GB free |
| CDN / TLS | Cloudflare | **Free** plan is sufficient |
| Official content | MDX-in-repo | **$0** |
| Email | Amazon SES | ~$0.10 per 1,000 emails (effectively free at this scale) |
| Rate limiting | rate-limiter-flexible (Postgres) | **$0** |

**What you'd actually pay (self-hosted):**

| Stage | Monthly | Why |
|---|---|---|
| Pre-launch / low traffic | **~$10–20 flat** | One Lightsail box runs app + Postgres; no auto-pause |
| Growing | **~$30–60** | Bigger box or RDS micro + modest R2 storage; egress stays $0 |

## The egress trap (read this)

On most clouds (and on Supabase/Vercel overage), **download bandwidth is billed per GB**.
A scenario archive with map images and **STL files** (tens of MB each) can move a lot of
bytes. At $0.09/GB, 1 TB of downloads = ~$90/mo — more than the entire compute bill.

**Mitigation, applied in the architecture:** all user assets live on **Cloudflare R2**
(zero egress) behind a Cloudflare custom domain. Pages and API responses are cached at
Cloudflare's edge (free). This decouples cost from traffic and is why the self-hosted floor
stays flat as the project grows.

## Break-even vs. revenue

Revenue is **ads + supporter tiers** (see [`Monetization.md`](Monetization.md)). Rough
break-even on infrastructure:

| Target | Cost floor | Supporters needed @ €3/mo | Or ad RPM needed* |
|---|---|---|---|
| Managed stack | ~$45/mo | **~15–20 supporters** | meaningful traffic + AdSense |
| Self-hosted (chosen) | ~$15/mo | **~5–6 supporters** | a few thousand pageviews/mo |

\* EthicalAds/Carbon RPMs are modest but privacy-friendly; AdSense pays more but needs a
consent flow. The self-hosted path reaches sustainability with a fraction of the support,
which is the whole point of the re-architecture.

## Cost-control checklist

- [ ] All user assets on **R2** (never on a per-GB-egress store)
- [ ] Cloudflare edge caching on public pages + assets
- [ ] Image resizing / format conversion on upload (cap stored bytes)
- [ ] Per-user **storage quotas** enforced before upload (free tier 50 MB)
- [ ] STL files generated on demand / cleaned up if abandoned (24h temp-file sweep)
- [ ] AI Forge gated behind **credits** so provider API spend can't run away
- [ ] Start on Lightsail flat-rate; only move to Fargate/RDS when metrics justify it
