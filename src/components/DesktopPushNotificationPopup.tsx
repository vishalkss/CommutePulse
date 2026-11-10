import React from 'react';
import {
  BellRing,
  CornerUpRight,
  Clock,
  X,
  ShieldAlert,
  Monitor,
} from 'lucide-react';
import {
  formatDurationMinutes,
  type DepartureThresholdPushPayload,
} from '../utils/trafficLogic';

interface DesktopPushNotificationPopupProps {
  payload: DepartureThresholdPushPayload;
  isOpen: boolean;
  triggeredAtLabel: string;
  browserPermission: NotificationPermission | 'unsupported';
  onDismiss: () => void;
  onSnooze: () => void;
  onSwitchToBypass: () => void;
}

export const DesktopPushNotificationPopup: React.FC<
  DesktopPushNotificationPopupProps
> = ({
  payload,
  isOpen,
  triggeredAtLabel,
  browserPermission,
  onDismiss,
  onSnooze,
  onSwitchToBypass,
}) => {
  if (!isOpen) return null;

  const thresholdRatioPercent = Math.min(
    100,
    Math.round(
      (payload.typicalThresholdMinutes /
        Math.max(1, payload.estimatedTravelMinutes)) *
        100
    )
  );

  return (
    <aside
      id="desktop-push-notification"
      role="alertdialog"
      aria-labelledby="desktop-push-title"
      aria-describedby="desktop-push-body"
      className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[410px] bg-slate-900 text-white border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* OS / Browser Push Chrome Header */}
      <div className="px-3.5 py-2 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0">
          <Monitor className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-200 truncate">
            CorridorPulse · Web Push Notification
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums shrink-0">
            {triggeredAtLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close desktop push notification"
          className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Notification Content Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              payload.shouldTriggerPush
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {payload.shouldTriggerPush ? (
              <BellRing className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-amber-300 flex items-center gap-1.5">
              <Clock className="w-3 h-3 shrink-0" />
              <span>Saved Departure: {payload.savedDepartureTime}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Threshold {formatDurationMinutes(payload.typicalThresholdMinutes)}
              </span>
            </div>

            <h3
              id="desktop-push-title"
              className="text-sm font-bold text-white mt-0.5 leading-snug"
            >
              {payload.title}
            </h3>

            <p
              id="desktop-push-body"
              className="text-xs text-slate-300 mt-1 leading-relaxed"
            >
              {payload.body}
            </p>
          </div>
        </div>

        {/* Visual Threshold vs. Estimated Travel Time Comparison Bar */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
            <span className="text-slate-300">
              Typical {payload.savedDepartureTime} Threshold:{' '}
              <strong className="text-white">
                {formatDurationMinutes(payload.typicalThresholdMinutes)}
              </strong>
            </span>
            <span
              className={
                payload.shouldTriggerPush
                  ? 'text-red-400 font-semibold'
                  : 'text-emerald-400 font-semibold'
              }
            >
              Live ETA: {formatDurationMinutes(payload.estimatedTravelMinutes)}{' '}
              {payload.excessMinutes > 0 ? `(+${payload.excessMinutes}m)` : ''}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-950 rounded-sm overflow-hidden flex">
            <div
              style={{ width: `${thresholdRatioPercent}%` }}
              className="bg-blue-500 h-full"
              title="Typical Travel Time Threshold"
            />
            {payload.shouldTriggerPush && (
              <div
                style={{ width: `${100 - thresholdRatioPercent}%` }}
                className="bg-red-500 h-full"
                title="Excess Delay Over Threshold"
              />
            )}
          </div>

          <p className="text-[11px] text-slate-300">
            {payload.actionSuggestion}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {payload.canSwitchBypass && (
              <button
                type="button"
                onClick={() => {
                  onSwitchToBypass();
                  onDismiss();
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CornerUpRight className="w-3.5 h-3.5" />
                <span>
                  Switch to Bypass (Save {payload.bypassSavingsMinutes}m)
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onSnooze}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Snooze 15m
            </button>
          </div>

          <span className="text-[10px] text-slate-400 font-mono">
            {browserPermission === 'granted'
              ? 'OS Push + In-App'
              : 'Desktop Push Mock'}
          </span>
        </div>
      </div>
    </aside>
  );
};
