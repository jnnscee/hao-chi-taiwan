import type { Metadata } from "next";
import AdminApp from "../AdminApp";

// Jenny's place manager. Everything interactive happens in the
// client component (Supabase Auth session in the browser); the
// server render is just the sign-in form. Kept out of search
// indexes — it is a tool, not a page for visitors.

export const metadata: Metadata = {
  title: "Admin — Hao Chi Taiwan",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="page">
      <AdminApp />
    </main>
  );
}
