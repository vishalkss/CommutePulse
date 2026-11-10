import React, { useState } from 'react';
import { X, AlertTriangle, Construction } from 'lucide-react';
import {
  validateIncidentReport,
  type CorridorIncident,
  type IncidentCategory,
  type RouteCandidate,
} from '../utils/trafficLogic';

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: RouteCandidate[];
  onSubmitIncident: (newIncident: CorridorIncident) => void;
}

export function ReportIncidentModal({
  isOpen,
  onClose,
  routes,
  onSubmitIncident,
}: ReportIncidentModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('accident');
  const [routeId, setRouteId] = useState<string>(routes[0]?.id || 'primary');
  const [corridorZoneLabel, setCorridorZoneLabel] = useState('');
  const [delayMinutes, setDelayMinutes] = useState('12');
  const [lanesBlocked, setLanesBlocked] = useState('Right Lane');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateIncidentReport({
      title,
      category,
      routeId,
      corridorZoneLabel,
      delayMinutes,
      lanesBlocked,
      description,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const numericDelay = Number(delayMinutes);
    const created: CorridorIncident = {
      id: `inc-${Date.now()}`,
      title: title.trim(),
      category,
      severity:
        numericDelay >= 15
          ? 'severe'
          : numericDelay >= 8
          ? 'heavy'
          : 'moderate',
      delayMinutes: numericDelay,
      routeId,
      routeProgressRatio: 0.5,
      corridorZoneLabel: corridorZoneLabel.trim(),
      description: description.trim(),
      reportedMinutesAgo: 0,
      lanesBlocked: lanesBlocked.trim() || 'Single Lane',
      acknowledged: false,
      dismissed: false,
      verifiedCount: 1,
    };

    onSubmitIncident(created);
    setTitle('');
    setCorridorZoneLabel('');
    setDelayMinutes('12');
    setDescription('');
    setErrors({});
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-incident-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2
              id="report-incident-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Report Corridor Traffic Incident
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Alert commuters along your selected commute corridor
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report incident dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
          {/* Category Selector */}
          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Disruption Type
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCategory('accident')}
                className={`py-2 px-3 text-xs font-medium rounded-md border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  category === 'accident'
                    ? 'bg-red-50 border-red-600 text-red-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Accident / Breakdown</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory('construction')}
                className={`py-2 px-3 text-xs font-medium rounded-md border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  category === 'construction'
                    ? 'bg-amber-50 border-amber-600 text-amber-900'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Construction className="w-3.5 h-3.5" />
                <span>Construction / Roadwork</span>
              </button>
            </div>
          </div>

          {/* Incident Headline */}
          <div>
            <label
              htmlFor="incident-title-input"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Incident Headline
            </label>
            <input
              id="incident-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Rear-end collision blocking right turn lane"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {errors.title && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* Affected Route & Corridor Checkpoint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="incident-route-select"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Affected Route Option
              </label>
              <select
                id="incident-route-select"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="incident-checkpoint-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Corridor Checkpoint / Junction
              </label>
              <input
                id="incident-checkpoint-input"
                type="text"
                value={corridorZoneLabel}
                onChange={(e) => setCorridorZoneLabel(e.target.value)}
                placeholder="e.g., Railway Crossing Approach"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {errors.corridorZoneLabel && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.corridorZoneLabel}
                </p>
              )}
            </div>
          </div>

          {/* Estimated Delay & Lanes Blocked */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="incident-delay-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Estimated Delay (Minutes)
              </label>
              <input
                id="incident-delay-input"
                type="number"
                min={1}
                max={180}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {errors.delayMinutes && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.delayMinutes}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="incident-lanes-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Lanes Blocked
              </label>
              <input
                id="incident-lanes-input"
                type="text"
                value={lanesBlocked}
                onChange={(e) => setLanesBlocked(e.target.value)}
                placeholder="e.g., Right & Center Lanes"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Situational Details */}
          <div>
            <label
              htmlFor="incident-description-input"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Situational Details &amp; Bypass Tip
            </label>
            <textarea
              id="incident-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe queue length, crane/barricade activity, or lane merge advice..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer"
            >
              Publish Live Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
