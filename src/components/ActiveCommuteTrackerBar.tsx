import React, { useState } from 'react';
import {
  Navigation,
  Play,
  Pause,
  Square,
  FastForward,
  Clock,
  Gauge,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  MapPin,
  Share2,
  Check,
  X,
} from 'lucide-react';
import {
  formatDurationMinutes,
  buildCommuteShareSummary,
  type CommuteTelemetrySnapshot,
  type EvaluatedRoute,
  type CorridorIncident,
  type CommuteShareSummary,
} from '../utils/trafficLogic';

interface ActiveCommuteTrackerBarProps {
  isActive: boolean;
  isPaused: boolean;
  simSpeedMultiplier: number;
  selectedRoute: EvaluatedRoute;
  originQuery: string;
  destinationQuery: string;
  telemetry: CommuteTelemetrySnapshot;
  incidents: CorridorIncident[];
  onStartCommute: () => void;
  onTogglePause: () => void;
  onStopCommute: () => void;
  onStepProgress: (deltaRatio: number) => void;
  onScrubProgress: (nextRatio: number) => void;
  onChangeSimSpeed: (multiplier: number) => void;
}

export const ActiveCommuteTrackerBar: React.FC<
  ActiveCommuteTrackerBarProps
> = ({
  isActive,
  isPaused,
  simSpeedMultiplier,
  selectedRoute,
  originQuery,
  destinationQuery,
  telemetry,
  incidents,
  onStartCommute,
  onTogglePause,
  onStopCommute,
  onStepProgress,
  onScrubProgress,
  onChangeSimSpeed,
}) => {
  const [copiedSummary, setCopiedSummary] =
    useState<CommuteShareSummary | null>(null);
  const [justCopied, setJustCopied] = useState<boolean>(false);

  const shortOrigin = originQuery.split(',')[0].trim() || 'Origin';
  const shortDest = destinationQuery.split(',')[0].trim() || 'Destination';

  const handleShareCommute = async () => {
    const baseUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://corridorpulse.app';

    const summary = buildCommuteShareSummary({
      originQuery,
      destinationQuery,
      selectedRoute,
      incidents,
      isActiveCommute: isActive,
      telemetry,
      baseUrl,
    });

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary.clipboardText);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = summary.clipboardText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch {
      // Fallback preview banner still shows the full shareable summary
    }

    setCopiedSummary(summary);
    setJustCopied(true);
    window.setTimeout(() => {
      setJustCopied(false);
    }, 3500);
  };

  if (!isActive) {
    return (
      <section
        id="commute-launcher-bar"
        aria-label="Start Live Commute Tracker"
        className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs"
      >
        <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">
                  Live Turn-by-Turn Commute Tracker
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {shortOrigin} → {shortDest} ({selectedRoute.label})
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Lock in current Estimated Travel Time (
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatDurationMinutes(selectedRoute.effectiveDurationMinutes)}
                </strong>{' '}
                across{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {selectedRoute.distanceKm.toFixed(1)} km
                </strong>
                ) and track real-time travel time deviation along your route.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="share-commute-btn"
              data-testid="share-commute-btn"
              type="button"
              onClick={handleShareCommute}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {justCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied Route &amp; ETA</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Share</span>
                </>
              )}
            </button>

            <button
              id="start-commute-btn"
              type="button"
              onClick={onStartCommute}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Commute</span>
            </button>
          </div>
        </div>

        {/* Clipboard Copy Confirmation & Shareable Summary Preview */}
        {copiedSummary && (
          <div
            data-testid="share-commute-copied-preview"
            className="px-4 py-2.5 bg-blue-50/70 border-t border-blue-200 text-xs text-slate-800 flex items-start justify-between gap-3"
          >
            <div className="space-y-1 min-w-0">
              <div className="font-semibold text-blue-950 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Copied Route Link, Expected Arrival &amp; Active Alerts to
                    Clipboard
                  </span>
                </span>
                <span className="font-mono tabular-nums text-[11px] text-blue-800">
                  · Expected Arrival: {copiedSummary.expectedArrivalTimeLabel}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-mono truncate">
                Link: {copiedSummary.routeLink}
              </div>
              <div className="text-[11px] text-slate-700 whitespace-pre-line">
                {copiedSummary.activeIncidentsSummary}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCopiedSummary(null)}
              aria-label="Dismiss shared commute preview"
              className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mini-Timeline Visualizer: Predicted Remaining Time for Major Route Landmarks */}
        <div
          id="commute-landmark-timeline"
          data-testid="commute-landmark-mini-timeline"
          className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 mb-2">
            <span className="font-semibold text-slate-700">
              Major Corridor Landmarks · Predicted Remaining Time
            </span>
            <span className="font-mono tabular-nums">
              {telemetry.landmarks.length} checkpoints along{' '}
              {selectedRoute.distanceKm.toFixed(1)} km
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {telemetry.landmarks.map((lm, idx) => {
              const isOrigin = idx === 0;
              const isDest = idx === telemetry.landmarks.length - 1;
              return (
                <div
                  key={lm.id}
                  data-testid={`landmark-node-${idx}`}
                  className="p-2 rounded-md bg-white border border-slate-200 flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono tabular-nums text-slate-500">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOrigin
                            ? 'bg-blue-600'
                            : lm.congestionLevel === 'severe'
                            ? 'bg-red-600'
                            : lm.congestionLevel === 'heavy'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span>{lm.progressPercent}%</span>
                    </span>
                    <span>{lm.cumulativeDistanceKm.toFixed(1)} km</span>
                  </div>

                  <div
                    className="text-xs font-semibold text-slate-900 truncate"
                    title={lm.name}
                  >
                    {lm.name}
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px] font-mono tabular-nums">
                    <span
                      className={`font-semibold ${
                        isOrigin
                          ? 'text-slate-500'
                          : isDest
                          ? 'text-blue-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {isOrigin
                        ? 'Start (0m)'
                        : `in ${Math.round(lm.cumulativeEstimatedMinutes)} min`}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {lm.speedKmh} km/h
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="active-commute-tracker"
      aria-label="Active Commute Progress and Real-Time Deviation Telemetry"
      className="bg-slate-900 text-white border border-slate-800 rounded-lg overflow-hidden shadow-md"
    >
      {/* Top Status & Control Strip */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              telemetry.isCompleted
                ? 'bg-emerald-400'
                : isPaused
                ? 'bg-amber-400'
                : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white">
                {telemetry.isCompleted
                  ? `Commute Completed: Arrived at ${shortDest}`
                  : isPaused
                  ? `Commute Paused: ${shortOrigin} → ${shortDest}`
                  : `Active Commute in Progress: ${shortOrigin} → ${shortDest}`}
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                · {selectedRoute.label}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Segment: {telemetry.currentSegmentName}</span>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-mono tabular-nums inline-flex items-center gap-1 text-emerald-300">
                <Gauge className="w-3.5 h-3.5 shrink-0" />
                <span>{telemetry.currentSegmentSpeedKmh} km/h current speed</span>
              </span>
            </p>
          </div>
        </div>

        {/* Playback & Step Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Speed Multiplier Selector */}
          <div
            role="group"
            aria-label="Tracking simulation speed"
            className="inline-flex bg-slate-800 p-0.5 rounded-md border border-slate-700 text-[11px] font-mono tabular-nums"
          >
            {[1, 30, 60].map((mult) => (
              <button
                key={mult}
                type="button"
                onClick={() => onChangeSimSpeed(mult)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  simSpeedMultiplier === mult
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {mult}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onStepProgress(0.15)}
            disabled={telemetry.isCompleted}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5 text-blue-400" />
            <span>+15% Route</span>
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            disabled={telemetry.isCompleted}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white border border-slate-700 rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Pause</span>
              </>
            )}
          </button>

          <button
            id="share-commute-btn"
            data-testid="share-commute-btn"
            type="button"
            onClick={handleShareCommute}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            {justCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied Route &amp; ETA</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Share</span>
              </>
            )}
          </button>

          <button
            id="end-commute-btn"
            type="button"
            onClick={onStopCommute}
            className="px-3 py-1.5 text-xs font-semibold bg-red-600/90 hover:bg-red-600 text-white rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>End Commute</span>
          </button>
        </div>
      </div>

      {/* Clipboard Copy Confirmation & Shareable Summary Preview (Active Commute Mode) */}
      {copiedSummary && (
        <div
          data-testid="share-commute-copied-preview"
          className="px-4 py-2.5 bg-blue-950/60 border-b border-blue-800/80 text-xs text-slate-200 flex items-start justify-between gap-3"
        >
          <div className="space-y-1 min-w-0">
            <div className="font-semibold text-white flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Copied Route Link, Expected Arrival &amp; Active Alerts to
                  Clipboard
                </span>
              </span>
              <span className="font-mono tabular-nums text-[11px] text-blue-300">
                · Expected Arrival: {copiedSummary.expectedArrivalTimeLabel}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              Link: {copiedSummary.routeLink}
            </div>
            <div className="text-[11px] text-slate-300 whitespace-pre-line">
              {copiedSummary.activeIncidentsSummary}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCopiedSummary(null)}
            aria-label="Dismiss shared commute preview"
            className="p-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Interactive Route Progress Bar & Scrubber */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
          <span className="text-slate-300">
            Origin: <strong className="text-white">{shortOrigin}</strong>
          </span>
          <span className="text-blue-400 font-bold">
            {telemetry.progressPercent}% Complete ({telemetry.distanceCoveredKm}{' '}
            km covered · {telemetry.distanceRemainingKm} km left)
          </span>
          <span className="text-slate-300">
            Destination: <strong className="text-white">{shortDest}</strong>
          </span>
        </div>

        <input
          aria-label="Commute route progress scrubber"
          type="range"
          min={0}
          max={100}
          step={1}
          value={telemetry.progressPercent}
          onChange={(e) => onScrubProgress(Number(e.target.value) / 100)}
          className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
        />
      </div>

      {/* Mini-Timeline Visualizer: Predicted Remaining Time for Major Landmarks Along Selected Route */}
      <div
        id="commute-landmark-timeline"
        data-testid="commute-landmark-mini-timeline"
        className="px-4 py-3 bg-slate-950/40 border-b border-slate-800 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              Major Route Landmarks · Predicted Remaining Time (Click any
              landmark to jump)
            </span>
          </span>
          <span className="font-mono tabular-nums text-slate-400">
            {
              telemetry.landmarks.filter((l) => l.status !== 'passed').length
            }{' '}
            upcoming landmarks · {telemetry.remainingMinutes.toFixed(1)} min to
            destination
          </span>
        </div>

        {/* Visual Timeline Connecting Track */}
        <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${telemetry.progressPercent}%` }}
          />
        </div>

        {/* 5-Node Landmark Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {telemetry.landmarks.map((lm, idx) => {
            const isPassed = lm.status === 'passed';
            const isApproaching = lm.status === 'approaching';
            return (
              <button
                key={lm.id}
                type="button"
                data-testid={`landmark-node-${idx}`}
                onClick={() => onScrubProgress(lm.progressRatio)}
                className={`text-left p-2.5 rounded-md border transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                  isApproaching
                    ? 'bg-blue-950/70 border-blue-500/80 text-white'
                    : isPassed
                    ? 'bg-slate-900/90 border-slate-800 text-slate-400'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono tabular-nums">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      isApproaching
                        ? 'text-blue-300'
                        : isPassed
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isPassed
                          ? 'bg-emerald-400'
                          : isApproaching
                          ? 'bg-blue-400 animate-pulse'
                          : lm.congestionLevel === 'severe'
                          ? 'bg-red-500'
                          : lm.congestionLevel === 'heavy'
                          ? 'bg-amber-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span>
                      {isPassed
                        ? 'Passed'
                        : isApproaching
                        ? 'Next Stop'
                        : `${lm.progressPercent}%`}
                    </span>
                  </span>
                  <span className="text-slate-400">
                    {lm.cumulativeDistanceKm.toFixed(1)} km
                  </span>
                </div>

                <div
                  className={`text-xs font-semibold truncate ${
                    isPassed ? 'text-slate-300' : 'text-white'
                  }`}
                  title={lm.name}
                >
                  {lm.name}
                </div>

                <div className="flex items-center justify-between gap-1 text-[11px] font-mono tabular-nums mt-0.5">
                  <span
                    className={`font-bold ${
                      isPassed
                        ? 'text-emerald-400'
                        : isApproaching
                        ? 'text-amber-300'
                        : 'text-blue-300'
                    }`}
                  >
                    {isPassed
                      ? '0.0 min left'
                      : `in ${lm.remainingMinutes.toFixed(1)} min`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isPassed ? 'Done' : `${lm.distanceRemainingKm} km`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4-Column Real-Time Actual vs. Original Estimate Deviation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
        {/* Metric 1: Route Progress & Remaining Distance */}
        <div className="p-3.5">
          <div className="text-[11px] text-slate-400">
            Route Progress · Active Path
          </div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-0.5">
            {telemetry.progressPercent}% · {telemetry.distanceCoveredKm} km
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Remaining: {telemetry.distanceRemainingKm} km (
            {telemetry.remainingMinutes.toFixed(1)} min left)
          </div>
        </div>

        {/* Metric 2: Actual Elapsed Time vs. Expected at Checkpoint */}
        <div className="p-3.5">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>Actual Elapsed Travel Time</span>
          </div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-0.5">
            {telemetry.elapsedActualMinutes.toFixed(1)} min
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Expected at {telemetry.progressPercent}%:{' '}
            {telemetry.expectedElapsedAtProgressMinutes.toFixed(1)} min
          </div>
        </div>

        {/* Metric 3: Projected Actual Total Time vs. Original Estimate */}
        <div className="p-3.5">
          <div className="text-[11px] text-slate-400">
            Actual Total vs. Original Estimate
          </div>
          <div className="text-xl font-bold text-white font-mono tabular-nums mt-0.5">
            {telemetry.projectedTotalActualMinutes.toFixed(1)} min{' '}
            <span className="text-sm font-normal text-slate-400">
              vs. {telemetry.originalEstimatedMinutes}m est
            </span>
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Locked baseline at start: {telemetry.originalEstimatedMinutes} min
          </div>
        </div>

        {/* Metric 4: Real-Time Schedule Deviation */}
        <div
          data-testid="commute-realtime-deviation"
          className="p-3.5 bg-slate-950/40"
        >
          <div className="text-[11px] text-slate-400">
            Real-Time Travel Time Deviation
          </div>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-0.5 flex items-center gap-1.5 ${
              telemetry.deviationStatus === 'behind'
                ? 'text-red-400'
                : telemetry.deviationStatus === 'ahead'
                ? 'text-emerald-400'
                : 'text-blue-400'
            }`}
          >
            {telemetry.deviationStatus === 'behind' ? (
              <TrendingUp className="w-4 h-4 shrink-0" />
            ) : telemetry.deviationStatus === 'ahead' ? (
              <TrendingDown className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>
              {telemetry.deviationMinutes > 0
                ? `+${telemetry.deviationMinutes.toFixed(1)} min`
                : `${telemetry.deviationMinutes.toFixed(1)} min`}
            </span>
          </div>
          <div
            className={`text-xs font-medium mt-0.5 ${
              telemetry.deviationStatus === 'behind'
                ? 'text-red-300'
                : telemetry.deviationStatus === 'ahead'
                ? 'text-emerald-300'
                : 'text-slate-300'
            }`}
          >
            {telemetry.deviationLabel}
          </div>
        </div>
      </div>
    </section>
  );
};

