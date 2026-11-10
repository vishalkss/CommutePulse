import React from 'react';
import {
  BellRing,
  Volume2,
  VolumeX,
  Sliders,
  Play,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Monitor,
} from 'lucide-react';
import {
  formatDurationMinutes,
  getTypicalThresholdForSavedDeparture,
  type AlertRuleConfig,
  type DepartureThresholdPushPayload,
} from '../utils/trafficLogic';

interface AlertRulesSectionProps {
  rules: AlertRuleConfig;
  onUpdateRules: (next: AlertRuleConfig) => void;
  onTriggerTestNotification: () => void;
  pushPayload: DepartureThresholdPushPayload;
  baseDurationMinutes: number;
  browserPermission: NotificationPermission | 'unsupported';
  onRequestBrowserPermission: () => void;
  onTriggerDesktopPushMock: () => void;
}

const SAVED_DEPARTURE_SLOTS = [
  '07:30 AM',
  '08:00 AM',
  '08:30 AM',
  '09:00 AM',
  '06:00 PM',
];

export function AlertRulesSection({
  rules,
  onUpdateRules,
  onTriggerTestNotification,
  pushPayload,
  baseDurationMinutes,
  browserPermission,
  onRequestBrowserPermission,
  onTriggerDesktopPushMock,
}: AlertRulesSectionProps) {
  const activeSavedDeparture = rules.savedDepartureTime || '08:30 AM';
  const activeThreshold =
    rules.typicalTravelThresholdMinutes ??
    getTypicalThresholdForSavedDeparture(
      baseDurationMinutes,
      activeSavedDeparture
    );
  const isDesktopPushEnabled = rules.desktopPushEnabled ?? true;

  const handleSelectSavedDeparture = (slot: string) => {
    const newTypical = getTypicalThresholdForSavedDeparture(
      baseDurationMinutes,
      slot
    );
    onUpdateRules({
      ...rules,
      savedDepartureTime: slot,
      typicalTravelThresholdMinutes: newTypical,
    });
  };

  return (
    <section
      id="alert-rules"
      aria-label="Commute Notification and Alert Rules"
      className="bg-white border border-slate-200 rounded-lg p-4 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-600" />
            <span>
              Web Push &amp; Departure Threshold Notification Rules
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically trigger a desktop push notification when Estimated
            Travel Time exceeds your saved departure threshold
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTriggerDesktopPushMock}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-400" />
            <span>Trigger Desktop Push Alert</span>
          </button>

          <button
            type="button"
            onClick={onTriggerTestNotification}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Test In-App Banner</span>
          </button>
        </div>
      </div>

      {/* Saved Departure Time & Typical Travel Time Threshold Push Monitor */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Saved Commute Departure Time &amp; Typical Threshold</span>
          </div>

          {/* Live Threshold Status Indicator */}
          <div
            className={`text-xs font-mono tabular-nums font-semibold flex items-center gap-1.5 ${
              pushPayload.shouldTriggerPush
                ? 'text-red-600'
                : 'text-emerald-700'
            }`}
          >
            {pushPayload.shouldTriggerPush ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  ETA ({formatDurationMinutes(pushPayload.estimatedTravelMinutes)}
                  ) exceeds {activeSavedDeparture} threshold (
                  {formatDurationMinutes(activeThreshold)}) by +
                  {pushPayload.excessMinutes}m · Push Active
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  ETA ({formatDurationMinutes(pushPayload.estimatedTravelMinutes)}
                  ) within {activeSavedDeparture} threshold (
                  {formatDurationMinutes(activeThreshold)})
                </span>
              </>
            )}
          </div>
        </div>

        {/* Saved Departure Time Slot Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-600 mr-1">
              Saved Departure:
            </span>
            {SAVED_DEPARTURE_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => handleSelectSavedDeparture(slot)}
                className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                  activeSavedDeparture === slot
                    ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          {/* Browser Push Permission Status / Request Button */}
          <div className="flex items-center gap-2 text-xs">
            <Monitor className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600">
              Channel:{' '}
              <strong className="text-slate-900">
                {browserPermission === 'granted'
                  ? 'Browser Web Push + Desktop Overlay'
                  : 'Desktop Push Notification Mock'}
              </strong>
            </span>
            {browserPermission === 'default' && (
              <button
                type="button"
                onClick={onRequestBrowserPermission}
                className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
              >
                Grant OS Permission
              </button>
            )}
          </div>
        </div>

        {/* Typical Travel Time Threshold Slider */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label
              htmlFor="typical-travel-threshold-range"
              className="font-medium text-slate-700"
            >
              Typical Travel Time Threshold for {activeSavedDeparture}
            </label>
            <span className="font-mono tabular-nums font-bold text-slate-900">
              Max {formatDurationMinutes(activeThreshold)} (Live ETA:{' '}
              {formatDurationMinutes(pushPayload.estimatedTravelMinutes)})
            </span>
          </div>
          <input
            id="typical-travel-threshold-range"
            type="range"
            min={25}
            max={85}
            step={1}
            value={activeThreshold}
            onChange={(e) =>
              onUpdateRules({
                ...rules,
                typicalTravelThresholdMinutes: Number(e.target.value),
              })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums mt-1">
            <span>25 min (Strict Free-Flow)</span>
            <span>46 min (Typical 8:30 AM)</span>
            <span>85 min (Heavy Peak Buffer)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bypass Time-Saved Slider */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs mb-2">
            <label
              htmlFor="delay-threshold-range"
              className="font-semibold text-slate-800"
            >
              Minimum Time-Saved Bypass Threshold
            </label>
            <span className="font-mono tabular-nums font-semibold text-blue-700">
              Save &ge; {rules.minDelayThresholdMinutes} min
            </span>
          </div>
          <input
            id="delay-threshold-range"
            type="range"
            min={3}
            max={25}
            step={1}
            value={rules.minDelayThresholdMinutes}
            onChange={(e) =>
              onUpdateRules({
                ...rules,
                minDelayThresholdMinutes: Number(e.target.value),
              })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums mt-1">
            <span>3 min (Sensitive)</span>
            <span>10 min (Balanced)</span>
            <span>25 min (Major Only)</span>
          </div>
        </div>

        {/* Toggle Checkboxes */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-semibold text-slate-900">
              Auto-Push When ETA Exceeds Saved Departure Threshold
            </span>
            <input
              type="checkbox"
              checked={isDesktopPushEnabled}
              onChange={(e) =>
                onUpdateRules({
                  ...rules,
                  desktopPushEnabled: e.target.checked,
                })
              }
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-medium text-slate-800">
              Instant Accident &amp; Collision Alerts
            </span>
            <input
              type="checkbox"
              checked={rules.notifyOnAccidents}
              onChange={(e) =>
                onUpdateRules({ ...rules, notifyOnAccidents: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-medium text-slate-800">
              Construction &amp; Lane Closure Advisories
            </span>
            <input
              type="checkbox"
              checked={rules.notifyOnConstruction}
              onChange={(e) =>
                onUpdateRules({
                  ...rules,
                  notifyOnConstruction: e.target.checked,
                })
              }
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-medium text-slate-800 flex items-center gap-1.5">
              {rules.soundAlertsEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Audio Chime on Threshold Breach</span>
            </span>
            <input
              type="checkbox"
              checked={rules.soundAlertsEnabled}
              onChange={(e) =>
                onUpdateRules({
                  ...rules,
                  soundAlertsEnabled: e.target.checked,
                })
              }
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
