import React from 'react';
import {
  AlertTriangle,
  Construction,
  Search,
  Check,
  ThumbsUp,
  CornerUpRight,
  Plus,
  X,
} from 'lucide-react';
import type { CorridorIncident } from '../utils/trafficLogic';

interface IncidentFeedPanelProps {
  incidents: CorridorIncident[];
  activeFilter: 'all' | 'accident' | 'construction' | 'severe';
  onFilterChange: (filter: 'all' | 'accident' | 'construction' | 'severe') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedRouteId: string;
  recommendedRouteId: string;
  recommendedRouteLabel: string;
  timeSavedVsSelectedMinutes: number;
  onSwitchToBypass: () => void;
  onAcknowledgeIncident: (id: string) => void;
  onDismissIncident: (id: string) => void;
  onVerifyIncident: (id: string) => void;
  onFocusIncidentOnMap: (id: string) => void;
  onOpenReportModal: () => void;
  totalActiveAccidents: number;
  totalActiveConstruction: number;
}

export function IncidentFeedPanel({
  incidents,
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  selectedRouteId,
  recommendedRouteId,
  recommendedRouteLabel,
  timeSavedVsSelectedMinutes,
  onSwitchToBypass,
  onAcknowledgeIncident,
  onDismissIncident,
  onVerifyIncident,
  onFocusIncidentOnMap,
  onOpenReportModal,
  totalActiveAccidents,
  totalActiveConstruction,
}: IncidentFeedPanelProps) {
  return (
    <section
      id="incident-feed"
      aria-label="Live Accident and Construction Delay Alerts"
      className="bg-white border border-slate-200 rounded-lg flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Live Accident &amp; Construction Alerts
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="font-mono tabular-nums">
              {totalActiveAccidents} {totalActiveAccidents === 1 ? 'Accident' : 'Accidents'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {totalActiveConstruction} Construction{' '}
              {totalActiveConstruction === 1 ? 'Zone' : 'Zones'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenReportModal}
          className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Alert</span>
        </button>
      </div>

      {/* Filter Bar & Search Input */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 space-y-2.5">
        {/* Interactive Segmented Filter Controls */}
        <div
          role="group"
          aria-label="Filter traffic alerts by category"
          className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto"
        >
          {(
            [
              { id: 'all', label: 'All Alerts' },
              { id: 'accident', label: 'Accidents' },
              { id: 'construction', label: 'Construction' },
              { id: 'severe', label: 'Severe (>10m)' },
            ] as const
          ).map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFilterChange(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 flex-1 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search checkpoints, lane closures, or roadwork..."
            aria-label="Filter incidents by keyword"
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear incident search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Incident List */}
      <div className="divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
        {incidents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-800">
              No matching corridor alerts
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              No active accidents or construction delays match your current filter
              selection.
            </p>
            {(activeFilter !== 'all' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  onFilterChange('all');
                  onSearchChange('');
                }}
                className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                Reset Alert Filters
              </button>
            )}
          </div>
        ) : (
          incidents.map((incident) => {
            const isAccident = incident.category === 'accident';
            const impactsCurrentRoute = incident.routeId === selectedRouteId;

            return (
              <article
                key={incident.id}
                className={`p-4 transition-colors ${
                  incident.acknowledged ? 'bg-slate-50/70 opacity-80' : 'bg-white hover:bg-slate-50/50'
                }`}
              >
                {/* Unboxed inline metadata line (Zero-Pill discipline) */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isAccident ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      {isAccident ? (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Construction className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {isAccident ? 'Accident Delay' : 'Construction Delay'}
                      </span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-700 font-medium">
                      {incident.corridorZoneLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {incident.reportedMinutesAgo === 0
                        ? 'Just now'
                        : `${incident.reportedMinutesAgo}m ago`}
                    </span>
                  </div>

                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      incident.delayMinutes >= 12
                        ? 'text-red-600'
                        : 'text-amber-700'
                    }`}
                  >
                    +{incident.delayMinutes} min delay
                  </span>
                </div>

                {/* Primary Title */}
                <h3 className="text-sm font-semibold text-slate-900">
                  <button
                    type="button"
                    onClick={() => onFocusIncidentOnMap(incident.id)}
                    className="text-left hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    {incident.title}
                  </button>
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {incident.description}
                </p>

                {/* Secondary Metadata Line */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                  <span>Lanes affected: {incident.lanesBlocked}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {incident.verifiedCount} commuter confirmations
                  </span>
                  {incident.acknowledged && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-700 font-medium">
                        Acknowledged
                      </span>
                    </>
                  )}
                </div>

                {/* Action Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onVerifyIncident(incident.id)}
                      aria-label={`Confirm ${incident.title} is still active`}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>Still There ({incident.verifiedCount})</span>
                    </button>

                    {!incident.acknowledged && (
                      <button
                        type="button"
                        onClick={() => onAcknowledgeIncident(incident.id)}
                        aria-label={`Acknowledge alert ${incident.title}`}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3 h-3" />
                        <span>Acknowledge</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDismissIncident(incident.id)}
                      aria-label={`Clear resolved alert ${incident.title}`}
                      className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Clear Resolved
                    </button>
                  </div>

                  {impactsCurrentRoute &&
                    selectedRouteId !== recommendedRouteId &&
                    timeSavedVsSelectedMinutes > 0 && (
                      <button
                        type="button"
                        onClick={onSwitchToBypass}
                        className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <CornerUpRight className="w-3.5 h-3.5" />
                        <span>
                          Take {recommendedRouteLabel.split(' ')[0]} Bypass (Save{' '}
                          {timeSavedVsSelectedMinutes}m)
                        </span>
                      </button>
                    )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
