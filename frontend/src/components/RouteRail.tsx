"use client";

import type { Station } from "@/lib/api";

type Props = {
  stations: Station[];
  originId: number | null;
  destId: number | null;
  onSelect: (stationId: number) => void;
};

const PAD = 36;
const WIDTH = 900;
const HEIGHT = 130;
const TRACK_Y = 56;
const TRACK_WIDTH = WIDTH - PAD * 2;

export function RouteRail({ stations, originId, destId, onSelect }: Props) {
  if (stations.length === 0) return null;
  const maxDistance = stations[stations.length - 1].distance_km;

  const xFor = (distanceKm: number) =>
    PAD + (distanceKm / maxDistance) * TRACK_WIDTH;

  const origin = stations.find((s) => s.id === originId) ?? null;
  const dest = stations.find((s) => s.id === destId) ?? null;
  const segX1 = origin ? xFor(origin.distance_km) : null;
  const segX2 = dest ? xFor(dest.distance_km) : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full min-w-160 h-32 select-none"
        role="group"
        aria-label="Route from Colombo Fort to Badulla. Tap your boarding station, then your alighting station."
      >
        <line
          x1={PAD}
          y1={TRACK_Y}
          x2={WIDTH - PAD}
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

        {stations.map((s) => {
          const x = xFor(s.distance_km);
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
              {/* generous invisible hit-area, easier to tap than the dot itself */}
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