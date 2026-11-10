import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import type { EvaluatedRoute } from '../utils/trafficLogic';
import { formatDurationMinutes } from '../utils/trafficLogic';
import type { LiveRouteStep } from './CorridorMap';

interface RouteComparisonTableProps {
  evaluatedRoutes: EvaluatedRoute[];
  selectedRouteId: string;
  recommendedRouteId: string;
  onSelectRoute: (routeId: string) => void;
  liveSteps: LiveRouteStep[];
  lastUpdatedIso: string;
}

export function RouteComparisonTable({
  evaluatedRoutes,
  selectedRouteId,
  recommendedRouteId,
  onSelectRoute,
  liveSteps,
  lastUpdatedIso,
}: RouteComparisonTableProps) {
  const [showSteps, setShowSteps] = useState<boolean>(false);

  return (
    <section
      id="route-compare"
      aria-label="Corridor Route Comparison Matrix"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Corridor Route Comparison &amp; Time Savings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time comparison factoring active accidents and roadwork along your
            selected commute corridor
          </p>
        </div>
        {lastUpdatedIso && (
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Synced {lastUpdatedIso}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
              <th className="py-2.5 px-4">Corridor Path</th>
              <th className="py-2.5 px-3 text-right">Distance</th>
              <th className="py-2.5 px-3 text-right">Base Time</th>
              <th className="py-2.5 px-3 text-right">Incident Delay</th>
              <th className="py-2.5 px-3 text-right">Live ETA</th>
              <th className="py-2.5 px-3">Disruptions</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {evaluatedRoutes.map((route) => {
              const isSelected = route.id === selectedRouteId;
              const isRecommended = route.id === recommendedRouteId;

              return (
                <tr
                  key={route.id}
                  className={`transition-colors ${
                    isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span>{route.label}</span>
                      {isRecommended && (
                        <span className="text-[11px] font-medium text-emerald-700">
                          · Fastest Now
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {route.summaryTag} · Avg {route.averageSpeedKmh} km/h
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {route.distanceKm.toFixed(1)} km
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                    {formatDurationMinutes(route.baseDurationMinutes)}
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums font-medium">
                    {route.incidentDelayMinutes + route.departureMultiplierMinutes > 0 ? (
                      <span className="text-red-600">
                        +{route.incidentDelayMinutes + route.departureMultiplierMinutes} min
                      </span>
                    ) : (
                      <span className="text-emerald-700">+0 min</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {formatDurationMinutes(route.effectiveDurationMinutes)}
                  </td>

                  <td className="py-3 px-3">
                    {route.activeIncidentCount === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Clear corridor</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>
                          {route.accidentCount > 0 && `${route.accidentCount} acc`}
                          {route.accidentCount > 0 && route.constructionCount > 0 && ', '}
                          {route.constructionCount > 0 &&
                            `${route.constructionCount} work`}
                        </span>
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectRoute(route.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? 'Active Route' : 'Use Route'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expandable Turn-by-Turn Maneuvers from Google Maps Routes API */}
      {liveSteps.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50/60">
          <button
            type="button"
            onClick={() => setShowSteps((prev) => !prev)}
            aria-expanded={showSteps}
            className="w-full flex items-center justify-between text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>
                View Live Google Maps Turn-by-Turn Corridor Steps ({liveSteps.length} segments)
              </span>
            </span>
            {showSteps ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {showSteps && (
            <ol className="mt-3 space-y-2 border-t border-slate-200 pt-3 max-h-52 overflow-y-auto text-xs">
              {liveSteps.map((step, index) => (
                <li
                  key={index}
                  className="flex items-start justify-between gap-3 text-slate-700"
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono tabular-nums text-slate-400 w-5 shrink-0">
                      {String(index + 1).padStart(2, '0')}.
                    </span>
                    <span>{step.instruction}</span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-500 shrink-0">
                    {step.distanceMeters >= 1000
                      ? `${(step.distanceMeters / 1000).toFixed(1)} km`
                      : `${step.distanceMeters} m`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
