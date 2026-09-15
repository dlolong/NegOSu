# Industry workspace themes

Goal: make Automotive, Salon/Facial Care, and Pet Care workspaces visually distinct with restrained, readable industry-inspired palettes.

Reuse: existing CSS brand/admin tokens, shell theme attribute, authenticated metadata preference action, and settings radio form. Keep status semantics and business logo ownership intact.

Scope: theme catalog/resolution, auth presentation context, settings chooser, shared interactive highlights, documentation, and focused theme tests. No scheduling, billing, public storefront, or business-data changes.

Database/security: no migration or RLS change. User metadata remains a validated presentation preference, never authorization. Retain all existing palette IDs; add industry defaults and an explicit automatic preference.

Rules: unset/invalid preferences follow the active industry; explicit choices follow the account across businesses. Automatic adapts after business switching. Future industries fall back safely. Status colors remain fixed.

UX: Automotive graphite/cobalt, Salon plum/blush, Pet Care teal/mint. Neutral white working surfaces, subtle borders, readable primary actions and focus/selection states. Show recommended industry palettes first and retain classic choices.

Validation: test resolution, compatibility and allowlisting, CSS/catalog consistency, text and focus contrast; authenticated save/cancel and organization switching; mobile/desktop screenshots; lint, typecheck, unit suite and build. No production changes or deployment.
