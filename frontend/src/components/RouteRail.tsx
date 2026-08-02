"use client";

import type { Station } from "@/lib/api";

type Props = {
  stations: Station[];
  originId: number | null;
  destId: number | null;
  onSelect: (stationId: number) => void;
};

const PAD_LEFT = 96;
const PAD_RIGHT = 40;
const BASE_TRACK_WIDTH = 760;
const HEIGHT = 150;
const TRACK_Y = 56;
const MIN_STATION_GAP = 70;

export function RouteRail({ stations, originId, destId, onSelect }: Props) {
  if (stations.length === 0) return null;
  const maxDistance = stations[stations.length - 1].distance_km;

  const xs: number[] = [];
  let prevX = -Infinity;
  for (const s of stations) {
    let x = PAD_LEFT + (s.distance_km / maxDistance) * BASE_TRACK_WIDTH;
    if (x < prevX + MIN_STATION_GAP) x = prevX + MIN_STATION_GAP;
    xs.push(x);
    prevX = x;
  }
  const width = xs[xs.length - 1] + PAD_RIGHT;
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
        aria-label="Route from Colombo Fort to Badulla. Tap your boarding station, then your alighting station."
      >
        <line
          x1={PAD_LEFT}
          y1={TRACK_Y}
          x2={width - PAD_RIGHT}
          y2={TRACK_Y}
          className="stroke-rail-green/25"
          strokeWidth={4}
          strokeLinecap="round"
        />

        {segX1 !== null && segX2 !== null && (
          <line
            x1={Math.min(segX1, segX2)}
            y1={TRACK_Y}
            x2={Math.max(segX1, segX2)}
            y2={TRACK_Y}
            className="stroke-brass"
            strokeWidth={5}
            strokeLinecap="round"
          />
        )}

        {stations.map((s, i) => {
          const x = xs[i];
          const isSelected = s.id === originId || s.id === destId;
          return (
            <g
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="cursor-pointer group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(s.id);
              }}
              aria-pressed={isSelected}
            >
              <circle cx={x} cy={TRACK_Y} r={16} fill="transparent" />
              <circle
                cx={x}
                cy={TRACK_Y}
                r={isSelected ? 8 : 5}
                className={
                  isSelected
                    ? "fill-brass stroke-rail-green"
                    : "fill-paper stroke-rail-green/60 group-hover:stroke-brass"
                }
                strokeWidth={2}
              />
              <g transform={`translate(${x} ${TRACK_Y + 20}) rotate(-38)`}>
                <text
                  x={0}
                  y={0}
                  textAnchor="end"
                  className={
                    "font-mono text-[11px] " +
                    (isSelected
                      ? "fill-rail-green font-medium"
                      : "fill-ink/55 group-hover:fill-brass")
                  }
                >
                  {s.name}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
