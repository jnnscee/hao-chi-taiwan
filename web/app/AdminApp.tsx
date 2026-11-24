"use client";

// The /admin place manager — Jenny's own tool, English only.
//
// Sign-in is the Phase 0 decision: passwordless email code
// (Supabase Auth `signInWithOtp` + `verifyOtp`), no password, and
// the app never creates accounts (shouldCreateUser: false) — the
// one admin user was created directly in Supabase. The emailed
// message also carries a sign-in link; if Jenny taps that instead
// of typing the code, it lands back here and the session arrives
// through the same auth listener, so both paths end at the
// manager. Only ADMIN_EMAIL gets the manager; any other signed-in
// account sees a plain "not authorized" note and no data, and Row
// Level Security (migration `admin_jenny_write_policies`) enforces
// the same rule in the database whatever this UI does.
//
// Visitors never see any of this: the only public trace is a
// discreet "Admin" link in the footer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  emptyPlaceForm,
  formToInternalRow,
  formToPlaceRow,
  internalFormHasContent,
  internalToForm,
  isAdminEmail,
  managerMatchesQuery,
  nextLegacyId,
  placeToForm,
  validateInternalForm,
  validatePlaceForm,
  type AdminPlaceRow,
  type InternalFormState,
  type InternalRow,
  type PlaceFormState,
} from "@/lib/admin";
import { legacyNumber } from "@/lib/places";

const ADMIN_PLACE_COLUMNS =
  "id, legacy_id, list_type, name_zh, name_en, name_rom, gloss, gloss_zh, cuisine, " +
  "rating_value, rating_count, city, district, address_en, address_zh, " +
  "lat, lng, maps_url, maps_short_url, phone, website, instagram, " +
  "instagram_handle, facebook, hours, hours_note, hours_checked_on, " +
  "visitor_notes, cash_only, temporarily_closed";

type View = { kind: "list" } | { kind: "edit"; row: AdminPlaceRow | null };

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loginStep, setLoginStep] = useState<"email" | "code">("email");
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [rows, setRows] = useState<AdminPlaceRow[]>([]);
  const [internalByPlace, setInternalByPlace] = useState<
    Map<string, InternalRow>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>({ kind: "list" });
  const [form, setForm] = useState<PlaceFormState>(() =>
    emptyPlaceForm("want_to_try", "")
  );
  const [internalForm, setInternalForm] = useState<InternalFormState>({
    confidence: "",
    check_status: "",
    notes: "",
  });
  const [editingLegacyId, setEditingLegacyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const suggestedIdRef = useRef<string>("");

  const userEmail = session?.user?.email ?? null;
  const isAdmin = isAdminEmail(userEmail);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [placesRes, internalRes] = await Promise.all([
      supabase.from("places").select(ADMIN_PLACE_COLUMNS).range(0, 999),
      supabase
        .from("place_internal")
        .select("place_id, confidence, check_status, notes")
        .range(0, 999),
    ]);
    if (placesRes.error) {
      setLoadError(`Could not load places: ${placesRes.error.message}`);
      setLoading(false);
      return;
    }
    setRows((placesRes.data ?? []) as unknown as AdminPlaceRow[]);
    const map = new Map<string, InternalRow>();
    for (const r of (internalRes.data ?? []) as unknown as InternalRow[]) {
      map.set(r.place_id, r);
    }
    setInternalByPlace(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void loadData();
  }, [isAdmin, loadData]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      if (a.list_type !== b.list_type) {
        return a.list_type === "recommended" ? -1 : 1;
      }
      return legacyNumber(a.legacy_id) - legacyNumber(b.legacy_id);
    });
    // Same fields as the public search, plus the legacy ID
    // (managerMatchesQuery in lib/admin.ts wraps lib/places.ts).
    return sorted.filter((r) => managerMatchesQuery(r, query));
  }, [rows, query]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailInput.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });
    setLoginBusy(false);
    if (error) {
      setLoginError(error.message);
      return;
    }
    setLoginStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    const { data, error } = await supabase.auth.verifyOtp({
      email: emailInput.trim(),
      token: codeInput.trim(),
      type: "email",
    });
    setLoginBusy(false);
    if (error) {
      setLoginError(error.message);
      return;
    }
    if (data.session) setSession(data.session);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setLoginStep("email");
    setCodeInput("");
    setView({ kind: "list" });
    setBanner(null);
  }

  function openAdd() {
    const listType = "want_to_try" as const;
    const suggestion = nextLegacyId(
      rows.map((r) => r.legacy_id),
      listType
    );
    suggestedIdRef.current = suggestion;
    setForm(emptyPlaceForm(listType, suggestion));
    setInternalForm({ confidence: "", check_status: "", notes: "" });
    setEditingLegacyId(null);
    setFormError(null);
    setDeleteText("");
    setBanner(null);
    setView({ kind: "edit", row: null });
  }

  function openEdit(row: AdminPlaceRow) {
    setForm(placeToForm(row));
    setInternalForm(internalToForm(internalByPlace.get(row.id) ?? null));
    setEditingLegacyId(row.legacy_id);
    setFormError(null);
    setDeleteText("");
    setBanner(null);
    setView({ kind: "edit", row: row });
  }

  function setField<K extends keyof PlaceFormState>(
    key: K,
    value: PlaceFormState[K]
  ) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // While adding, keep the suggested ID in step with the list
      // type until Jenny types an ID of her own.
      if (
        key === "list_type" &&
        view.kind === "edit" &&
        view.row === null &&
        f.legacy_id === suggestedIdRef.current
      ) {
        const suggestion = nextLegacyId(
          rows.map((r) => r.legacy_id),
          value as PlaceFormState["list_type"]
        );
        suggestedIdRef.current = suggestion;
        next.legacy_id = suggestion;
      }
      return next;
    });
  }

  function setInternalField<K extends keyof InternalFormState>(
    key: K,
    value: InternalFormState[K]
  ) {
    setInternalForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (view.kind !== "edit") return;
    const error =
      validatePlaceForm(
        form,
        rows.map((r) => r.legacy_id),
        editingLegacyId
      ) ?? validateInternalForm(internalForm);
    if (error) {
      setFormError(error);
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = formToPlaceRow(form);
    let placeId: string;
    if (view.row) {
      const { error: updateError } = await supabase
        .from("places")
        .update(payload)
        .eq("id", view.row.id);
      if (updateError) {
        setFormError(`Could not save: ${updateError.message}`);
        setSaving(false);
        return;
      }
      placeId = view.row.id;
    } else {
      const { data, error: insertError } = await supabase
        .from("places")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !data) {
        setFormError(
          `Could not save: ${insertError?.message ?? "no row came back"}`
        );
        setSaving(false);
        return;
      }
      placeId = (data as { id: string }).id;
    }
    if (internalByPlace.has(placeId) || internalFormHasContent(internalForm)) {
      const { error: internalError } = await supabase
        .from("place_internal")
        .upsert(formToInternalRow(internalForm, placeId), {
          onConflict: "place_id",
        });
      if (internalError) {
        setFormError(
          `The place itself saved, but its working notes did not: ${internalError.message}`
        );
        setSaving(false);
        await loadData();
        return;
      }
    }
    await loadData();
    setSaving(false);
    setView({ kind: "list" });
    setBanner(
      `Saved ${payload.name_zh} (${payload.legacy_id}). The public pages pick the change up within about a minute — no redeploy needed.`
    );
  }

  async function deletePlace() {
    if (view.kind !== "edit" || !view.row) return;
    setSaving(true);
    setFormError(null);
    const { error } = await supabase
      .from("places")
      .delete()
      .eq("id", view.row.id);
    if (error) {
      setFormError(`Could not delete: ${error.message}`);
      setSaving(false);
      return;
    }
    const name = view.row.name_zh;
    const id = view.row.legacy_id;
    await loadData();
    setSaving(false);
    setView({ kind: "list" });
    setBanner(`Deleted ${name} (${id}), including its working notes.`);
  }

  // --- Signed in, but not as Jenny: no data, no controls. ---
  if (session && !isAdmin) {
    return (
      <div className="admin-wrap">
        <h1 className="admin-title">Admin</h1>
        <div className="admin-card">
          <p>
            You are signed in as <strong>{userEmail}</strong>, which is not
            the admin account for this guide, so nothing here can be viewed
            or changed.
          </p>
          <button type="button" className="admin-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // --- Signed in as Jenny: the place manager. ---
  if (session && isAdmin) {
    return (
      <div className="admin-wrap">
        <div className="admin-head">
          <h1 className="admin-title">Place manager</h1>
          <div className="admin-head-right">
            <span className="admin-who">{userEmail}</span>
            <button type="button" className="admin-btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>

        {banner && <p className="admin-banner">{banner}</p>}

        {view.kind === "list" && (
          <>
            <div className="admin-listbar">
              <input
                type="search"
                className="admin-search"
                placeholder="Search by name, ID, cuisine, city, district…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search places"
              />
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={openAdd}
              >
                Add a place
              </button>
            </div>
            {loadError && <p className="admin-error">{loadError}</p>}
            {loading ? (
              <p>Loading places…</p>
            ) : (
              <>
                <p className="admin-count">
                  {sortedRows.length} of {rows.length} places
                </p>
                <ul className="admin-list">
                  {sortedRows.map((row) => (
                    <li key={row.id} className="admin-row">
                      <span className="admin-row-id">{row.legacy_id}</span>
                      <span className="admin-row-names">
                        <strong>{row.name_zh}</strong>{" "}
                        <span className="admin-row-en">{row.name_en}</span>
                      </span>
                      <span className="admin-row-meta">
                        {row.list_type === "recommended"
                          ? "Recommended"
                          : "Want to Try"}
                        {row.city ? ` · ${row.city}` : ""}
                        {internalByPlace.has(row.id) ? " · has notes" : ""}
                      </span>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {view.kind === "edit" && (
          <form className="admin-form" onSubmit={save}>
            <h2 className="admin-form-title">
              {view.row
                ? `Edit ${view.row.name_zh} (${view.row.legacy_id})`
                : "Add a place"}
            </h2>

            <fieldset className="admin-section">
              <legend>The basics</legend>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>List</span>
                  <select
                    value={form.list_type}
                    onChange={(e) =>
                      setField(
                        "list_type",
                        e.target.value as PlaceFormState["list_type"]
                      )
                    }
                  >
                    <option value="recommended">Recommended</option>
                    <option value="want_to_try">Want to Try</option>
                  </select>
                </label>
                <TextField
                  label="ID (legacy_id)"
                  value={form.legacy_id}
                  onChange={(v) => setField("legacy_id", v)}
                />
                <TextField
                  label="Chinese name *"
                  value={form.name_zh}
                  onChange={(v) => setField("name_zh", v)}
                />
                <TextField
                  label="English name *"
                  value={form.name_en}
                  onChange={(v) => setField("name_en", v)}
                />
                <TextField
                  label="Romanized name"
                  value={form.name_rom}
                  onChange={(v) => setField("name_rom", v)}
                />
                <TextField
                  label="Short gloss (English)"
                  value={form.gloss}
                  onChange={(v) => setField("gloss", v)}
                />
                <TextField
                  label="Description (Chinese)"
                  value={form.gloss_zh}
                  onChange={(v) => setField("gloss_zh", v)}
                />
                <TextField
                  label="Cuisine *"
                  value={form.cuisine}
                  onChange={(v) => setField("cuisine", v)}
                />
              </div>
            </fieldset>

            <fieldset className="admin-section">
              <legend>Google rating</legend>
              <div className="admin-grid">
                <TextField
                  label="Rating (e.g. 4.5)"
                  value={form.rating_value}
                  onChange={(v) => setField("rating_value", v)}
                  inputMode="decimal"
                />
                <TextField
                  label="Number of ratings"
                  value={form.rating_count}
                  onChange={(v) => setField("rating_count", v)}
                  inputMode="numeric"
                />
              </div>
            </fieldset>

            <fieldset className="admin-section">
              <legend>Location</legend>
              <div className="admin-grid">
                <TextField
                  label="City"
                  value={form.city}
                  onChange={(v) => setField("city", v)}
                />
                <TextField
                  label="District"
                  value={form.district}
                  onChange={(v) => setField("district", v)}
                />
                <TextField
                  label="Address (English)"
                  value={form.address_en}
                  onChange={(v) => setField("address_en", v)}
                />
                <TextField
                  label="Address (Chinese)"
                  value={form.address_zh}
                  onChange={(v) => setField("address_zh", v)}
                />
                <TextField
                  label="Latitude"
                  value={form.lat}
                  onChange={(v) => setField("lat", v)}
                  inputMode="decimal"
                />
                <TextField
                  label="Longitude"
                  value={form.lng}
                  onChange={(v) => setField("lng", v)}
                  inputMode="decimal"
                />
              </div>
            </fieldset>

            <fieldset className="admin-section">
              <legend>Links &amp; contact</legend>
              <div className="admin-grid">
                <TextField
                  label="Google Maps link (CID URL)"
                  value={form.maps_url}
                  onChange={(v) => setField("maps_url", v)}
                />
                <TextField
                  label="Google Maps short link"
                  value={form.maps_short_url}
                  onChange={(v) => setField("maps_short_url", v)}
                />
                <TextField
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setField("phone", v)}
                />
                <TextField
                  label="Website"
                  value={form.website}
                  onChange={(v) => setField("website", v)}
                />
                <TextField
                  label="Instagram URL"
                  value={form.instagram}
                  onChange={(v) => setField("instagram", v)}
                />
                <TextField
                  label="Instagram handle"
                  value={form.instagram_handle}
                  onChange={(v) => setField("instagram_handle", v)}
                />
                <TextField
                  label="Facebook URL"
                  value={form.facebook}
                  onChange={(v) => setField("facebook", v)}
                />
              </div>
            </fieldset>

            <fieldset className="admin-section">
              <legend>Visiting</legend>
              <div className="admin-grid">
                <TextField
                  label="Opening hours"
                  value={form.hours}
                  onChange={(v) => setField("hours", v)}
                  textarea
                />
                <TextField
                  label="Hours note"
                  value={form.hours_note}
                  onChange={(v) => setField("hours_note", v)}
                />
                <label className="admin-field">
                  <span>Hours last checked</span>
                  <input
                    type="date"
                    value={form.hours_checked_on}
                    onChange={(e) =>
                      setField("hours_checked_on", e.target.value)
                    }
                  />
                </label>
                <TextField
                  label="Good to know (visitor notes)"
                  value={form.visitor_notes}
                  onChange={(v) => setField("visitor_notes", v)}
                  textarea
                />
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={form.cash_only}
                    onChange={(e) => setField("cash_only", e.target.checked)}
                  />{" "}
                  Cash only
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={form.temporarily_closed}
                    onChange={(e) =>
                      setField("temporarily_closed", e.target.checked)
                    }
                  />{" "}
                  Temporarily closed
                </label>
              </div>
            </fieldset>

            <fieldset className="admin-section admin-internal">
              <legend>Your working notes — never shown to visitors</legend>
              <div className="admin-grid">
                <TextField
                  label="Confidence"
                  value={internalForm.confidence}
                  onChange={(v) => setInternalField("confidence", v)}
                />
                <TextField
                  label="Check status (number)"
                  value={internalForm.check_status}
                  onChange={(v) => setInternalField("check_status", v)}
                  inputMode="numeric"
                />
                <TextField
                  label="Notes"
                  value={internalForm.notes}
                  onChange={(v) => setInternalField("notes", v)}
                  textarea
                />
              </div>
            </fieldset>

            {formError && <p className="admin-error">{formError}</p>}
            <div className="admin-actions">
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save place"}
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={saving}
                onClick={() => setView({ kind: "list" })}
              >
                Back to the list
              </button>
            </div>

            {view.row && (
              <div className="admin-danger">
                <h3>Delete this place</h3>
                <p>
                  This removes {view.row.name_zh} ({view.row.legacy_id}) and
                  its working notes for good. To confirm, type the place's
                  Chinese name exactly:
                </p>
                <div className="admin-danger-row">
                  <input
                    type="text"
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
                    placeholder={view.row.name_zh || view.row.name_en}
                    aria-label="Type the place's Chinese name to confirm deletion"
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    disabled={
                      saving ||
                      deleteText.trim() !==
                        (view.row.name_zh || view.row.name_en)
                    }
                    onClick={deletePlace}
                  >
                    Delete place
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    );
  }

  // --- Signed out: the email-code login. This is also what the
  // static prerender shows. ---
  return (
    <div className="admin-wrap">
      <h1 className="admin-title">Admin</h1>
      <div className="admin-card">
        {loginStep === "email" ? (
          <form onSubmit={sendCode}>
            <p>
              Only Jenny manages this guide, and there is no password: enter
              your email and we will send you a sign-in code.
            </p>
            <label className="admin-field">
              <span>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {loginError && <p className="admin-error">{loginError}</p>}
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={loginBusy}
            >
              {loginBusy ? "Sending…" : "Email me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <p>
              We emailed a 6-digit code to{" "}
              <strong>{emailInput.trim()}</strong>. Type it here to sign in.
              (The email also contains a sign-in link — tapping that works
              too, and brings you back here.)
            </p>
            <label className="admin-field">
              <span>6-digit code</span>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="123456"
              />
            </label>
            {loginError && <p className="admin-error">{loginError}</p>}
            <div className="admin-actions">
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={loginBusy}
              >
                {loginBusy ? "Checking…" : "Sign in"}
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={loginBusy}
                onClick={() => {
                  setLoginStep("email");
                  setLoginError(null);
                }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "numeric" | "text";
  textarea?: boolean;
}) {
  return (
    <label className="admin-field">
      <span>{props.label}</span>
      {props.textarea ? (
        <textarea
          rows={4}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          inputMode={props.inputMode}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </label>
  );
}
