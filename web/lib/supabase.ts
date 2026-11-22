import { createClient } from "@supabase/supabase-js";

// The publishable key is public by design: Row Level Security on the
// `places` table (anon SELECT-only) is what guards the data, and
// `place_internal` has no public access at all. Never put a secret or
// service-role key in this app.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
