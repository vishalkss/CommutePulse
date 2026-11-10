import React from 'react';
import {
  Activity,
  Gauge,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type {
  CorridorSegmentTelemetry,
  EvaluatedRoute,
} from '../utils/trafficLogic';
import { formatDurationMinutes } from '../utils/trafficLogic';

interface LiveTrafficSegmentsPanelProps {
  originQuery: string;
  destinationQuery: string;
  segments: CorridorSegmentTelemetry[];
  selectedRoute: EvaluatedRoute;
  lastSyncedLabel: string;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
}

export function LiveTrafficSegmentsPanel({
  originQuery,
  destinationQuery,
  segments,
  selectedRoute,
  lastSyncedLabel,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  onManualRefresh,
}: LiveTrafficSegmentsPanelProps) {
  const shortOrigin = originQuery.split(',')[0].trim() || 'Origin';
  const shortDest = destinationQuery.split(',')[0].trim() || 'Destination';

  return (
    <section
      id="live-traffic-conditions"
      aria-label="Real-Time Corridor Traffic Speed and Congestion Telemetry"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Real-Time Traffic Conditions: {shortOrigin} → {shortDest}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>Corridor Speed:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {selectedRoute.averageSpeedKmh} km/h
            </span>
            <span aria-hidden="true">·</span>
            <span>Free-Flow Baseline:</span>
            <span className="font-mono tabular-nums">
              {selectedRoute.freeFlowSpeedKmh} km/h
            </span>
            <span aria-hidden="true">·</span>
            <span>Congestion Index:</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                selectedRoute.congestionIndexPercent >= 55
                  ? 'text-red-600'
                  : selectedRoute.congestionIndexPercent >= 35
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {selectedRoute.congestionIndexPercent}%
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Updated {lastSyncedLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAutoRefresh}
            aria-pressed={autoRefreshEnabled}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              autoRefreshEnabled
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {autoRefreshEnabled
              ? 'Auto-Sync (30s): On'
              : 'Auto-Sync (30s): Off'}
          </button>

          <button
            type="button"
            onClick={onManualRefresh}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Fetch Live Traffic</span>
          </button>
        </div>
      </div>

      {/* Segment-by-Segment Speed, Congestion Level & Travel Time Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
              <th className="py-2.5 px-4">Corridor Segment</th>
              <th className="py-2.5 px-3 text-right">Distance</th>
              <th className="py-2.5 px-3 text-right">Live Speed</th>
              <th className="py-2.5 px-3">Congestion Level</th>
              <th className="py-2.5 px-4 text-right">Est. Travel Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {segments.map((seg) => {
              const isSevere = seg.congestionLevel === 'severe';
              const isHeavy = seg.congestionLevel === 'heavy';
              const isModerate = seg.congestionLevel === 'moderate';

              return (
                <tr
                  key={seg.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">
                      {seg.segmentName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      <span>{seg.fromCheckpoint}</span>
                      <span aria-hidden="true"> → </span>
                      <span>{seg.toCheckpoint}</span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {seg.distanceKm.toFixed(1)} km
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="font-mono tabular-nums font-semibold text-slate-900 inline-flex items-center justify-end gap-1">
                      <Gauge className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{seg.currentSpeedKmh} km/h</span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500">
                      Normal {seg.freeFlowSpeedKmh} km/h
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          isSevere
                            ? 'text-red-700'
                            : isHeavy
                            ? 'text-amber-800'
                            : isModerate
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {isSevere || isHeavy ? (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                          {isSevere
                            ? 'Severe Jam'
                            : isHeavy
                            ? 'Heavy Congestion'
                            : isModerate
                            ? 'Moderate Slowdown'
                            : 'Nominal Flow'}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-600">
                        {seg.congestionPercent}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isSevere
                            ? 'bg-red-600'
                            : isHeavy
                            ? 'bg-amber-600'
                            : isModerate
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${seg.congestionPercent}%` }}
                      />
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="font-mono tabular-nums font-semibold text-slate-900 inline-flex items-center justify-end gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatDurationMinutes(seg.currentMinutes)}</span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500">
                      {seg.currentMinutes > seg.freeFlowMinutes ? (
                        <span className="text-red-600 font-medium">
                          +{seg.currentMinutes - seg.freeFlowMinutes} min delay
                        </span>
                      ) : (
                        <span className="text-emerald-700">On schedule</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
