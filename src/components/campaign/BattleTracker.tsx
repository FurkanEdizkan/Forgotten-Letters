"use client";

/**
 * Battle log for a campaign.
 *
 * Read-only for visitors; the campaign owner also gets a recording form.
 * Participants are free-text names rather than account links, so a
 * campaign can record games against people who do not have an account
 * here — which is most opponents at a table.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Swords, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { deleteBattleAction, recordBattleAction } from "@/lib/actions/battle";
import type { BattleView } from "@/lib/queries/battles";

type Row = { displayName: string; result: "win" | "loss" | "draw"; score: string };

const RESULT_LABELS: Record<Row["result"], string> = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
};

export function BattleTracker({
  campaignId,
  battles,
  scenarios,
  isOwner,
}: {
  campaignId: string;
  battles: BattleView[];
  scenarios: { id: string; title: string }[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scenarioId, setScenarioId] = useState("");
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { displayName: "", result: "win", score: "" },
    { displayName: "", result: "loss", score: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await recordBattleAction({
        campaignId,
        scenarioId: scenarioId || null,
        playedAt,
        notes: notes || undefined,
        participants: rows
          .filter((r) => r.displayName.trim())
          .map((r) => ({
            displayName: r.displayName,
            result: r.result,
            score: r.score ? Number(r.score) : null,
          })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setNotes("");
      setRows([
        { displayName: "", result: "win", score: "" },
        { displayName: "", result: "loss", score: "" },
      ]);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteBattleAction(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
          <Swords className="size-3.5" /> Battle log
        </h2>
        {isOwner && !open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Record a battle
          </Button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}

      {open && (
        <Card className="mt-3 flex flex-col gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="battle-scenario">Scenario</Label>
              <select
                id="battle-scenario"
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 text-sm text-ink focus:border-primary focus:outline-none"
              >
                <option value="">Not recorded</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="battle-date">Played on</Label>
              <Input
                id="battle-date"
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Participants</Label>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.displayName}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) =>
                        j === i ? { ...r, displayName: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="Player or warband"
                  aria-label={`Participant ${i + 1} name`}
                />
                <select
                  value={row.result}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) =>
                        j === i ? { ...r, result: e.target.value as Row["result"] } : r,
                      ),
                    )
                  }
                  aria-label={`Participant ${i + 1} result`}
                  className="h-10 rounded-[var(--radius-md)] border border-border-strong bg-bg px-2 text-sm text-ink focus:border-primary focus:outline-none"
                >
                  {(["win", "loss", "draw"] as const).map((r) => (
                    <option key={r} value={r}>
                      {RESULT_LABELS[r]}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={0}
                  value={row.score}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) =>
                        j === i ? { ...r, score: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="VP"
                  aria-label={`Participant ${i + 1} score`}
                  className="max-w-20"
                />
                {rows.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    className="text-faint hover:text-danger"
                    aria-label={`Remove participant ${i + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() =>
                setRows([...rows, { displayName: "", result: "loss", score: "" }])
              }
            >
              <Plus className="size-4" /> Add participant
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="battle-notes">Notes</Label>
            <Textarea
              id="battle-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="How it played out."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save battle"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {battles.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No battles recorded yet.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {battles.map((battle) => (
            <Card key={battle.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.625rem] uppercase tracking-wider text-faint">
                    {new Date(battle.playedAt).toLocaleDateString()}
                    {battle.scenario ? ` · ${battle.scenario.title}` : ""}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {battle.participants.map((p, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <Badge variant={p.result === "win" ? "success" : "neutral"}>
                          {RESULT_LABELS[p.result]}
                        </Badge>
                        <span className="text-sm text-ink">{p.displayName}</span>
                        {p.score !== null && (
                          <span className="font-mono text-xs text-faint">
                            {p.score}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {battle.notes && (
                    <p className="mt-2 text-sm text-muted">{battle.notes}</p>
                  )}
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => remove(battle.id)}
                    disabled={pending}
                    className="shrink-0 text-faint hover:text-danger disabled:opacity-60"
                    aria-label="Delete battle"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
