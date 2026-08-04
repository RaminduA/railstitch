"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type DayOff } from "@/lib/api";

export default function DaysOffPage() {
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDay, setNewDay] = useState("");
  const [newReason, setNewReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.getDaysOff();
      setDaysOff(data);
    } catch {
      setError("Failed to load days off.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function handleAdd() {
    if (!newDay) return;
    setSubmitting(true);
    setError(null);
    try {
      const added = await api.addDayOff(newDay, newReason);
      setDaysOff((prev) => {
        const filtered = prev.filter((d) => d.day !== added.day);
        return [...filtered, added].sort((a, b) => a.day.localeCompare(b.day));
      });
      setNewDay("");
      setNewReason("");
    } catch {
      setError("Failed to add day off.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(day: string) {
    try {
      await api.removeDayOff(day);
      setDaysOff((prev) => prev.filter((d) => d.day !== day));
    } catch {
      setError("Failed to remove day off.");
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-ink/50 hover:text-brass transition-colors mb-6"
        >
          ← Admin
        </Link>
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-2">
          Department view
        </p>
        <h1 className="font-display text-4xl text-rail-green mb-8">Days off</h1>

        <div className="rounded-xl border border-rail-green/15 bg-white/40 px-5 py-5 mb-6">
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-3">Block a date</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="date" value={newDay} min={today}
              onChange={(e) => setNewDay(e.target.value)}
              className="rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass font-mono text-sm" />
            <input type="text" placeholder="Reason (e.g. Public holiday)" value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="flex-1 rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass text-sm" />
            <button onClick={handleAdd} disabled={!newDay || submitting}
              className="rounded-md bg-rail-green text-paper px-5 py-2 font-medium disabled:opacity-40 hover:bg-rail-green-dim transition-colors">
              {submitting ? "Adding…" : "Block date"}
            </button>
          </div>
        </div>

        {error && <p className="text-signal-rust text-sm mb-4">{error}</p>}

        {loading ? (
          <div className="animate-pulse flex flex-col gap-2">
            {[0,1,2].map((i) => <div key={i} className="h-14 rounded-lg bg-white/40 border border-rail-green/10" />)}
          </div>
        ) : daysOff.length === 0 ? (
          <div className="rounded-lg border border-rail-green/15 bg-white/40 px-5 py-8 text-center">
            <p className="text-ink/60 font-mono text-sm">No days off configured.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {daysOff.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-rail-green/15 bg-white/40 px-5 py-3">
                <div>
                  <p className="font-mono text-sm text-rail-green">
                    {new Date(d.day + "T12:00:00").toLocaleDateString(undefined, {
                      weekday: "long", month: "long", day: "numeric", year: "numeric",
                    })}
                  </p>
                  {d.reason && <p className="font-mono text-xs text-ink/50 mt-0.5">{d.reason}</p>}
                </div>
                <button onClick={() => handleRemove(d.day)}
                  className="rounded-md border border-signal-rust/40 text-signal-rust px-3 py-1 text-sm hover:bg-signal-rust hover:text-paper transition-colors">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
