import React, { useEffect, useRef, useState } from "react";
import { createTapTempo, wallNow } from "../lib/clock.js";
import { useSh8r } from "../state/Sh8rContext.jsx";

const BPM_MIN = 20;
const BPM_MAX = 300;

function BeatLight() {
  const { clock } = useSh8r();
  const ref = useRef(null);

  useEffect(() => {
    let id;
    const tick = () => {
      const { beat, bar } = clock.read();
      const node = ref.current;
      if (node) {
        node.style.opacity = String(0.15 + 0.85 * (1 - beat) ** 3);
        node.dataset.downbeat = bar < 0.25 ? "true" : "false";
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [clock]);

  return <span className="beat-light" ref={ref} aria-hidden="true" />;
}

export default function BpmControl() {
  const { bpm, control, clock } = useSh8r();
  const [draft, setDraft] = useState(null);
  const [tapper] = useState(() => createTapTempo());

  function commit() {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (Number.isFinite(next) && next >= BPM_MIN && next <= BPM_MAX) {
      control("bpm:set", { bpm: next });
    }
  }

  function handleTap() {
    const result = tapper.tap(wallNow());
    if (!result) return;
    control("bpm:set", {
      bpm: Math.round(result.bpm * 10) / 10,
      beatEpoch: result.firstTap + clock.sync.offset,
    });
  }

  return (
    <span className="row bpm">
      <BeatLight />
      <label className="label" htmlFor="bpm-input">
        BPM
      </label>
      <input
        id="bpm-input"
        type="number"
        min={BPM_MIN}
        max={BPM_MAX}
        step="0.1"
        value={draft ?? bpm}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(null);
        }}
      />
      <button type="button" onPointerDown={handleTap} title="Tap along to set the tempo">
        Tap
      </button>
      <button
        type="button"
        onClick={() => control("beat:sync")}
        title="Mark this moment as the first beat of a bar"
      >
        Sync 1
      </button>
    </span>
  );
}
