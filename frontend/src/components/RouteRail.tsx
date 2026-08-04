"use client";

import type { Station, TripStop } from "@/lib/api";

type Props = {
  stations: Station[];
  stops: TripStop[];         
  selectedIds: number[];     
  direction: "outbound" | "inbound";
  onSelect: (stationId: number) => void;
};

const PAD_LEFT = 96;
const PAD_RIGHT = 40;
const BASE_TRACK_WIDTH = 900;
const HEIGHT = 160;
const TRACK_Y = 56;
const MIN_STATION_GAP = 20; 

const ZONE_COLORS: Record<number, string> = {
  1: "#6B8E6E",
  2: "#7B9B6B",
  3: "#8FAD6A",
  4: "#A5B86B",
  5: "#C4A84F",
};

export function RouteRail({ stations, stops, selectedIds, direction, onSelect }: Props) {
  if (stations.length === 0) return null;

  const stopIds = new Set(stops.map((s) => s.station_id));
  const boardableIds = new Set(stops.filter((s) => s.can_board).map((s) => s.station_id));

  const maxDistance = stations[stations.length - 1].distance_km;

  // Compute x positions with minimum gap enforcement
  const xs: number[] = [];
  let prevX = -Infinity;
  for (const s of stations) {
    let x = PAD_LEFT + (s.distance_km / maxDistance) * BASE_TRACK_WIDTH;
    if (x < prevX + MIN_STATION_GAP) x = prevX + MIN_STATION_GAP;
    xs.push(x);
    prevX = x;
  }
  const width = xs[xs.length - 1] + PAD_RIGHT;

  // Determine origin/dest from selectedIds based on direction
  let originId: number | null = null;
  let destId: number | null = null;
  if (selectedIds.length === 2) {
    const [a, b] = selectedIds;
    const seqA = stations.find((s) => s.id === a)?.seq ?? 0;
    const seqB = stations.find((s) => s.id === b)?.seq ?? 0;
    if (direction === "outbound") {
      originId = seqA <= seqB ? a : b;
      destId = seqA <= seqB ? b : a;
    } else {
      originId = seqA >= seqB ? a : b;
      destId = seqA >= seqB ? b : a;
    }
  } else if (selectedIds.length === 1) {
    originId = selectedIds[0];
  }

  const xById = new Map(stations.map((s, i) => [s.id, xs[i]]));
  const segX1 = originId !== null ? xById.get(originId) ?? null : null;
  const segX2 = destId !== null ? xById.get(destId) ?? null : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        style={{ width: `${Math.max(width, 640)}px`, height: `${HEIGHT}px` }}
        className="select-none"
        role="group"
        aria-label="Route diagram. Tap your boarding station, then your alighting station."
      >
        {/* Base track */}
        <line
          x1={PAD_LEFT} y1={TRACK_Y}
          x2={width - PAD_RIGHT} y2={TRACK_Y}
          className="stroke-rail-green/20"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Selected segment highlight */}
        {segX1 !== null && segX2 !== null && (
          <line
            x1={Math.min(segX1, segX2)} y1={TRACK_Y}
            x2={Math.max(segX1, segX2)} y2={TRACK_Y}
            className="stroke-brass"
            strokeWidth={5}
            strokeLinecap="round"
          />
        )}

        {stations.map((s, i) => {
          const x = xs[i];
          const isStop = stopIds.has(s.id);
          const canBoard = boardableIds.has(s.id);
          const isSelected = selectedIds.includes(s.id);
          const isOrigin = s.id === originId;
          const isDest = s.id === destId;
          const isDisabled = !isStop;
          const isPassed = isStop && !canBoard;

          return (
            <g
              key={s.id}
              onClick={() => {
                if (!isDisabled && !isPassed) onSelect(s.id);
              }}
              className={isDisabled || isPassed ? "cursor-not-allowed" : "cursor-pointer group"}
              role={isDisabled ? "presentation" : "button"}
              tabIndex={isDisabled || isPassed ? undefined : 0}
              onKeyDown={(e) => {
                if (!isDisabled && !isPassed && (e.key === "Enter" || e.key === " ")) onSelect(s.id);
              }}
              aria-pressed={isSelected}
              aria-disabled={isDisabled || isPassed}
            >
              {/* Tooltip via SVG title element */}
              <title>
                {isDisabled
                  ? "This train doesn't stop at this station"
                  : isPassed
                  ? "Train has already departed from this station"
                  : isSelected
                  ? s.name
                  : `Select ${s.name}`}
              </title>
              {/* Hit area */}
              <circle cx={x} cy={TRACK_Y} r={14} fill="transparent" />

              {/* Station dot */}
              <circle
                cx={x}
                cy={TRACK_Y}
                r={isSelected ? 8 : isStop ? 5 : 3}
                fill={
                  isSelected
                    ? "#C08A2E"
                    : isDisabled
                    ? "#C8BAA0"
                    : isPassed
                    ? "#B0A090"
                    : ZONE_COLORS[s.zone] ?? "#6B8E6E"
                }
                stroke={
                  isSelected
                    ? "#1F3B2C"
                    : isDisabled || isPassed
                    ? "transparent"
                    : "#1F3B2C"
                }
                strokeWidth={isSelected ? 2 : isStop ? 1.5 : 0}
                opacity={isDisabled ? 0.35 : isPassed ? 0.5 : 1}
              />

              {/* Origin/dest indicator ring */}
              {(isOrigin || isDest) && (
                <circle
                  cx={x}
                  cy={TRACK_Y}
                  r={13}
                  fill="transparent"
                  stroke="#C08A2E"
                  strokeWidth={1.5}
                  strokeDasharray={isDest ? "3 2" : "none"}
                />
              )}

              {/* Station label: only show for stops, rotated -40deg */}
              {isStop && (
                <g transform={`translate(${x} ${TRACK_Y + 18}) rotate(-40)`}>
                  <text
                    x={0}
                    y={0}
                    textAnchor="end"
                    fontSize={isPassed ? 9 : 10}
                    fontFamily="var(--font-plex-mono), monospace"
                    fill={
                      isSelected
                        ? "#1F3B2C"
                        : isPassed
                        ? "#A09080"
                        : "#23201B99"
                    }
                    fontWeight={isSelected ? "600" : "400"}
                  >
                    {isPassed ? `${s.name} ✓` : s.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Zone legend */}
      <div className="flex gap-3 mt-1 px-2 flex-wrap">
        {[1, 2, 3, 4, 5].map((z) => (
          <span key={z} className="flex items-center gap-1 font-mono text-[9px] text-ink/50 uppercase tracking-wide">
            <span
              style={{ background: ZONE_COLORS[z] }}
              className="inline-block w-2 h-2 rounded-full"
            />
            Zone {z}
          </span>
        ))}
        <span className="flex items-center gap-1 font-mono text-[9px] text-ink/50 uppercase tracking-wide">
          <span className="inline-block w-2 h-2 rounded-full bg-ink/20" />
          Passed
        </span>
      </div>
    </div>
  );
}
