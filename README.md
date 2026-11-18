# Hao Chi Taiwan — test app

Test version of Jenny's bilingual Taiwan restaurant guide, starting in Kaohsiung.

- All 40 places from "Taiwan - Tried & Tested" (35 Kaohsiung, 5 elsewhere)
- EN / 中文 toggle, romanized names + English glosses
- Map pins, search and filters, detail views
- "Show driver / 給司機看" card with the Chinese address in large type
- "Near me" search using the visitor's location (1 / 3 / 5 / 10 / 25 km)

## Branches

- `main` → production on Vercel
- `staging` → preview / pre-production on Vercel

## Status — test data only

This is a test app, not the final build. Hours, phone numbers, websites and
Instagram for the first 10 Zuoying places are provisional and flagged in the
app as still to check. Chinese addresses are a draft for Jenny to check.
Nothing here has been loaded into the seed files yet.

The final app will be rebuilt as Next.js + Supabase (see the architecture
document), with the same data, an admin area, and Jenny's own photos.
