import React, { useEffect, useState, useRef } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  CloudRain,
  AlertTriangle,
  Construction,
  Navigation,
  Layers,
  RefreshCw,
  MapPin,
  ArrowRight,
  Clock,
} from 'lucide-react';
import type {
  CorridorIncident,
  EvaluatedRoute,
  WeatherTrafficAdvisory,
} from '../utils/trafficLogic';
import {
  formatDurationMinutes,
  cleanStepInstruction,
  buildRouteCongestionHeatmapSegments,
} from '../utils/trafficLogic';

export interface LiveResolvedPlace {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
}

export interface LiveRouteStep {
  instruction: string;
  distanceMeters: number;
  durationMillis: number;
  startLocation?: { lat: number; lng: number };
}

export interface LiveAlternativeRouteSummary {
  index: number;
  distanceMeters: number;
  durationMillis: number;
  summaryLabel: string;
  midStepCheckpoint: string;
  lateStepCheckpoint: string;
}

export interface LiveComputedRouteData {
  distanceMeters: number;
  durationMillis: number;
  steps: LiveRouteStep[];
  alternativeRoutes: LiveAlternativeRouteSummary[];
  originPlace: LiveResolvedPlace | null;
  destinationPlace: LiveResolvedPlace | null;
  lastUpdatedIso: string;
}

interface CorridorMapProps {
  apiKey: string;
  originQuery: string;
  destinationQuery: string;
  incidents: CorridorIncident[];
  evaluatedRoutes: EvaluatedRoute[];
  selectedRouteId: string;
  recommendedRouteId: string;
  onSelectRoute: (routeId: string) => void;
  onSelectIncident: (incidentId: string) => void;
  selectedIncidentId: string | null;
  onLiveRouteComputed: (data: LiveComputedRouteData) => void;
  refreshTrigger: number;
  weatherAdvisory?: WeatherTrafficAdvisory;
  activeCommuteProgressRatio?: number | null;
  activeCommuteDeviationLabel?: string;
  isDarkMode?: boolean;
}

function checkAndDispatchQuotaError(err: unknown) {
  const msg = String((err as Error)?.message || err || '');
  if (
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

interface InnerMapControllerProps extends Omit<CorridorMapProps, 'apiKey'> {
  showTrafficLayer: boolean;
}

function InnerMapController({
  originQuery,
  destinationQuery,
  incidents,
  selectedRouteId,
  recommendedRouteId,
  onSelectRoute,
  onSelectIncident,
  selectedIncidentId,
  onLiveRouteComputed,
  refreshTrigger,
  showTrafficLayer,
  weatherAdvisory,
  activeCommuteProgressRatio,
  activeCommuteDeviationLabel,
}: InnerMapControllerProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const placesLib = useMapsLibrary('places');
  const mapsLib = useMapsLibrary('maps');
  const apiStatus = useApiLoadingStatus();

  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const heatmapPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  const [routePathsByRouteId, setRoutePathsByRouteId] = useState<
    Record<string, Array<{ lat: number; lng: number }>>
  >({});
  const [originPlace, setOriginPlace] = useState<LiveResolvedPlace | null>(
    null
  );
  const [destinationPlace, setDestinationPlace] =
    useState<LiveResolvedPlace | null>(null);
  const [routeLoading, setRouteLoading] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Manage real-time Google Maps TrafficLayer overlay
  useEffect(() => {
    if (!map || !mapsLib) return;

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new mapsLib.TrafficLayer({
        autoRefresh: true,
      });
    }

    if (showTrafficLayer) {
      trafficLayerRef.current.setMap(map);
    } else {
      trafficLayerRef.current.setMap(null);
    }

    return () => {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    };
  }, [map, mapsLib, showTrafficLayer]);

  // Resolve Origin & Destination via Places API (New) and compute route via Routes API
  useEffect(() => {
    if (!map || !routesLib || !originQuery || !destinationQuery) return;

    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);

    // Cleanup old polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    async function resolveAndCompute() {
      let resolvedOrigin: LiveResolvedPlace | null = null;
      let resolvedDest: LiveResolvedPlace | null = null;

      if (placesLib && (placesLib as any).Place?.searchByText) {
        try {
          const [origRes, destRes] = await Promise.all([
            (placesLib as any).Place.searchByText({
              textQuery: originQuery,
              fields: ['id', 'displayName', 'formattedAddress', 'location'],
              maxResultCount: 1,
            }),
            (placesLib as any).Place.searchByText({
              textQuery: destinationQuery,
              fields: ['id', 'displayName', 'formattedAddress', 'location'],
              maxResultCount: 1,
            }),
          ]);

          const origPlaceObj = origRes?.places?.[0];
          if (origPlaceObj && origPlaceObj.location) {
            resolvedOrigin = {
              id: origPlaceObj.id || 'origin',
              displayName: origPlaceObj.displayName || originQuery,
              formattedAddress: origPlaceObj.formattedAddress || originQuery,
              location: {
                lat:
                  typeof origPlaceObj.location.lat === 'function'
                    ? origPlaceObj.location.lat()
                    : origPlaceObj.location.lat,
                lng:
                  typeof origPlaceObj.location.lng === 'function'
                    ? origPlaceObj.location.lng()
                    : origPlaceObj.location.lng,
              },
            };
          }

          const destPlaceObj = destRes?.places?.[0];
          if (destPlaceObj && destPlaceObj.location) {
            resolvedDest = {
              id: destPlaceObj.id || 'destination',
              displayName: destPlaceObj.displayName || destinationQuery,
              formattedAddress:
                destPlaceObj.formattedAddress || destinationQuery,
              location: {
                lat:
                  typeof destPlaceObj.location.lat === 'function'
                    ? destPlaceObj.location.lat()
                    : destPlaceObj.location.lat,
                lng:
                  typeof destPlaceObj.location.lng === 'function'
                    ? destPlaceObj.location.lng()
                    : destPlaceObj.location.lng,
              },
            };
          }
        } catch (placeErr) {
          checkAndDispatchQuotaError(placeErr);
        }
      }

      if (cancelled) return;
      setOriginPlace(resolvedOrigin);
      setDestinationPlace(resolvedDest);

      try {
        const request: Record<string, unknown> = {
          origin: resolvedOrigin ? resolvedOrigin.location : originQuery,
          destination: resolvedDest ? resolvedDest.location : destinationQuery,
          travelMode: 'DRIVING',
          computeAlternativeRoutes: true,
          fields: [
            'path',
            'distanceMeters',
            'durationMillis',
            'viewport',
            'legs',
            'description',
          ],
        };

        const RouteClass = (routesLib as any).Route;
        const response = await RouteClass.computeRoutes(request);
        if (cancelled) return;

        setRouteLoading(false);
        const routes = response?.routes;
        if (!routes || routes.length === 0) {
          setRouteError('No driving route returned for this corridor.');
          return;
        }

        // Choose active route index based on selectedRouteId ('primary' -> 0, 'alt_1' -> 1, 'alt_2' -> 2)
        const desiredIdx =
          selectedRouteId === 'alt_1'
            ? Math.min(1, routes.length - 1)
            : selectedRouteId === 'alt_2'
            ? Math.min(2, routes.length - 1)
            : 0;

        const createdPolylines: google.maps.Polyline[] = [];

        // Render non-selected alternative routes in subtle slate first
        routes.forEach((r: any, idx: number) => {
          if (idx === desiredIdx) return;
          if (typeof r.createPolylines === 'function') {
            const altLines: google.maps.Polyline[] = r.createPolylines();
            altLines.forEach((line) => {
              line.setOptions({
                strokeColor: '#64748b',
                strokeOpacity: 0.45,
                strokeWeight: 5,
                zIndex: 1,
                map,
              });
              createdPolylines.push(line);
            });
          }
        });

        // Render selected route prominently on top
        const activeRoute = routes[desiredIdx] || routes[0];
        if (typeof activeRoute.createPolylines === 'function') {
          const primaryLines: google.maps.Polyline[] =
            activeRoute.createPolylines();
          primaryLines.forEach((line) => {
            line.setOptions({
              strokeColor:
                selectedRouteId === recommendedRouteId ? '#2563eb' : '#d97706',
              strokeOpacity: 0.95,
              strokeWeight: 7,
              zIndex: 5,
              map,
            });
            createdPolylines.push(line);
          });
        }

        polylinesRef.current = createdPolylines;

        // Extract path points per route option so markers sit cleanly on their own corridor geometry
        const extractPoints = (rObj: any): Array<{ lat: number; lng: number }> =>
          (rObj?.path || [])
            .map((pt: any) => ({
              lat: typeof pt.lat === 'function' ? pt.lat() : Number(pt.lat),
              lng: typeof pt.lng === 'function' ? pt.lng() : Number(pt.lng),
            }))
            .filter(
              (pt: { lat: number; lng: number }) =>
                !Number.isNaN(pt.lat) && !Number.isNaN(pt.lng)
            );

        const primaryPts = extractPoints(routes[0]);
        const alt1Pts = extractPoints(routes[1] || routes[0]);
        const alt2Pts = extractPoints(routes[2] || routes[1] || routes[0]);

        setRoutePathsByRouteId({
          primary: primaryPts,
          alt_1: alt1Pts,
          alt_2: alt2Pts,
        });

        if (activeRoute.viewport && map) {
          map.fitBounds(activeRoute.viewport);
        }

        const primaryLeg = activeRoute.legs?.[0];
        const extractedSteps: LiveRouteStep[] = (primaryLeg?.steps || []).map(
          (step: any) => ({
            instruction:
              step.instructions ||
              step.navigationInstruction?.instructions ||
              'Continue along corridor',
            distanceMeters: step.distanceMeters ?? 0,
            durationMillis:
              step.staticDurationMillis ?? step.durationMillis ?? 0,
          })
        );

        const alternativeSummaries: LiveAlternativeRouteSummary[] = routes
          .slice(0, 3)
          .map((r: any, idx: number) => {
            const stepsArr: any[] = r.legs?.[0]?.steps || [];
            const midStep =
              stepsArr[Math.floor(stepsArr.length * 0.4)]?.instructions ||
              stepsArr[Math.floor(stepsArr.length * 0.4)]?.navigationInstruction
                ?.instructions ||
              'Mid-Corridor Junction';
            const lateStep =
              stepsArr[Math.floor(stepsArr.length * 0.75)]?.instructions ||
              stepsArr[Math.floor(stepsArr.length * 0.75)]
                ?.navigationInstruction?.instructions ||
              'Approach Merge';

            return {
              index: idx,
              distanceMeters: r.distanceMeters ?? 0,
              durationMillis: r.durationMillis ?? 0,
              summaryLabel:
                r.description ||
                cleanStepInstruction(midStep).slice(0, 38) ||
                `Route Option ${idx + 1}`,
              midStepCheckpoint: cleanStepInstruction(midStep).slice(0, 42),
              lateStepCheckpoint: cleanStepInstruction(lateStep).slice(0, 42),
            };
          });

        onLiveRouteComputed({
          distanceMeters: activeRoute.distanceMeters ?? 0,
          durationMillis: activeRoute.durationMillis ?? 0,
          steps: extractedSteps,
          alternativeRoutes: alternativeSummaries,
          originPlace: resolvedOrigin,
          destinationPlace: resolvedDest,
          lastUpdatedIso: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      } catch (err: any) {
        if (cancelled) return;
        setRouteLoading(false);
        checkAndDispatchQuotaError(err);
        setRouteError(
          err?.message ||
            'Unable to compute live route via Google Maps Routes API.'
        );
      }
    }

    void resolveAndCompute();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    map,
    routesLib,
    placesLib,
    originQuery,
    destinationQuery,
    selectedRouteId,
    recommendedRouteId,
    refreshTrigger,
  ]);

  const activeRoutePoints =
    routePathsByRouteId[selectedRouteId] || routePathsByRouteId.primary || [];

  // Visually overlay real-time congestion heatmaps onto the existing route path when TrafficLayer is enabled
  useEffect(() => {
    heatmapPolylinesRef.current.forEach((p) => p.setMap(null));
    heatmapPolylinesRef.current = [];

    if (!map || !mapsLib || !showTrafficLayer || activeRoutePoints.length < 2) {
      return;
    }

    const createdHeatmapLines: google.maps.Polyline[] = [];

    // Dark high-contrast route casing underneath the congestion heatmap segments
    const casingLine = new mapsLib.Polyline({
      path: activeRoutePoints,
      strokeColor: '#0f172a',
      strokeOpacity: 0.78,
      strokeWeight: 9,
      zIndex: 6,
      map,
    });
    createdHeatmapLines.push(casingLine);

    const heatmapSegments = buildRouteCongestionHeatmapSegments(
      activeRoutePoints,
      incidents,
      selectedRouteId
    );

    heatmapSegments.forEach((seg) => {
      const segLine = new mapsLib.Polyline({
        path: seg.points,
        strokeColor: seg.strokeColor,
        strokeOpacity: 0.96,
        strokeWeight: 6,
        zIndex: 7,
        map,
      });
      createdHeatmapLines.push(segLine);
    });

    heatmapPolylinesRef.current = createdHeatmapLines;

    return () => {
      createdHeatmapLines.forEach((p) => p.setMap(null));
      heatmapPolylinesRef.current = [];
    };
  }, [map, mapsLib, showTrafficLayer, activeRoutePoints, incidents, selectedRouteId]);

  const visibleMapIncidents = incidents.filter(
    (inc) =>
      !inc.dismissed &&
      (inc.routeId === selectedRouteId || inc.id === selectedIncidentId)
  );
  const selectedIncident =
    incidents.find((i) => !i.dismissed && i.id === selectedIncidentId) || null;

  function getIncidentCoordinates(
    inc: CorridorIncident
  ): { lat: number; lng: number } | null {
    const pathForIncident =
      routePathsByRouteId[inc.routeId] || activeRoutePoints;
    if (pathForIncident.length === 0) return null;
    const clampedRatio = Math.min(0.84, Math.max(0.18, inc.routeProgressRatio));
    const idx = Math.min(
      pathForIncident.length - 1,
      Math.floor(pathForIncident.length * clampedRatio)
    );
    return pathForIncident[idx] || null;
  }

  const shortOrigin = originQuery.split(',')[0].trim();
  const shortDest = destinationQuery.split(',')[0].trim();

  return (
    <>
      {/* Origin Marker from Places API (New) or Route Start */}
      {(originPlace?.location || activeRoutePoints[0]) && (
        <AdvancedMarker
          position={originPlace?.location || activeRoutePoints[0]}
          title={`Origin: ${originPlace?.displayName || originQuery}`}
        >
          <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2.5 py-1.5 rounded-md shadow-md border border-slate-700 text-xs font-medium whitespace-nowrap">
            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{originPlace?.displayName || shortOrigin}</span>
          </div>
        </AdvancedMarker>
      )}

      {/* Destination Marker from Places API (New) or Route End */}
      {(destinationPlace?.location ||
        activeRoutePoints[activeRoutePoints.length - 1]) && (
        <AdvancedMarker
          position={
            destinationPlace?.location ||
            activeRoutePoints[activeRoutePoints.length - 1]
          }
          title={`Destination: ${
            destinationPlace?.displayName || destinationQuery
          }`}
        >
          <div className="flex items-center gap-1.5 bg-blue-700 text-white px-2.5 py-1.5 rounded-md shadow-md border border-blue-500 text-xs font-medium whitespace-nowrap">
            <Navigation className="w-3.5 h-3.5 text-white shrink-0" />
            <span>{destinationPlace?.displayName || shortDest}</span>
          </div>
        </AdvancedMarker>
      )}

      {/* Active Accident & Construction Markers along the selected route geometry */}
      {visibleMapIncidents.map((inc) => {
        const coords = getIncidentCoordinates(inc);
        if (!coords) return null;
        const isAccident = inc.category === 'accident';
        return (
          <AdvancedMarker
            key={inc.id}
            position={coords}
            title={`${inc.title} (+${inc.delayMinutes} min)`}
            onClick={() => onSelectIncident(inc.id)}
          >
            <button
              type="button"
              onClick={() => onSelectIncident(inc.id)}
              aria-label={`Inspect ${inc.category} alert: ${inc.title}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md shadow-md border text-xs font-semibold transition-transform hover:scale-105 cursor-pointer whitespace-nowrap ${
                isAccident
                  ? 'bg-red-600 text-white border-red-800'
                  : 'bg-amber-500 text-slate-950 border-amber-700'
              }`}
            >
              {isAccident ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Construction className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="font-mono tabular-nums">
                +{inc.delayMinutes}m
              </span>
            </button>
          </AdvancedMarker>
        );
      })}

      {/* Weather-Related Traffic Slowdown Marker Overlaid on Route Path */}
      {weatherAdvisory?.isRainSlowdownActive &&
        activeRoutePoints.length > 2 && (
          <AdvancedMarker
            position={
              activeRoutePoints[
                Math.min(
                  activeRoutePoints.length - 1,
                  Math.floor(
                    activeRoutePoints.length *
                      (weatherAdvisory.routeProgressRatio || 0.52)
                  )
                )
              ]
            }
            title={`${weatherAdvisory.alertTitle}: ${weatherAdvisory.alertDescription}`}
          >
            <div
              data-testid="map-weather-slowdown-pin"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md shadow-md border bg-sky-700 text-white border-sky-900 text-xs font-semibold whitespace-nowrap"
            >
              <CloudRain className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono tabular-nums">
                Rain +{weatherAdvisory.extraDelayMinutes}m (-
                {weatherAdvisory.speedReductionPercent}% spd)
              </span>
            </div>
          </AdvancedMarker>
        )}

      {/* Live Active Commuter Position Marker along the selected route path */}
      {typeof activeCommuteProgressRatio === 'number' &&
        activeRoutePoints.length > 1 && (
          <AdvancedMarker
            position={
              activeRoutePoints[
                Math.min(
                  activeRoutePoints.length - 1,
                  Math.max(
                    0,
                    Math.floor(
                      (activeRoutePoints.length - 1) *
                        Math.min(1, Math.max(0, activeCommuteProgressRatio))
                    )
                  )
                )
              ]
            }
            title={`Active Commuter Position: ${Math.round(
              activeCommuteProgressRatio * 100
            )}%`}
          >
            <div
              data-testid="map-active-commuter-pin"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md shadow-lg border-2 border-white bg-emerald-600 text-white text-xs font-bold whitespace-nowrap"
            >
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono tabular-nums">
                You · {Math.round(activeCommuteProgressRatio * 100)}%
                {activeCommuteDeviationLabel
                  ? ` (${activeCommuteDeviationLabel})`
                  : ''}
              </span>
            </div>
          </AdvancedMarker>
        )}

      {/* InfoWindow when an incident pin is clicked */}
      {selectedIncident && getIncidentCoordinates(selectedIncident) && (
        <InfoWindow
          position={getIncidentCoordinates(selectedIncident)!}
          onCloseClick={() => onSelectIncident('')}
        >
          <div className="max-w-xs p-1 text-slate-900">
            <div className="text-xs font-medium text-slate-500 mb-1">
              <span>
                {selectedIncident.category === 'accident'
                  ? 'Accident Alert'
                  : 'Construction Zone'}
              </span>
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums text-red-600 font-semibold">
                +{selectedIncident.delayMinutes} min delay
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              {selectedIncident.title}
            </h4>
            <p className="text-xs text-slate-600 mb-2">
              {selectedIncident.description}
            </p>
            {selectedRouteId !== recommendedRouteId && (
              <button
                type="button"
                onClick={() => {
                  onSelectRoute(recommendedRouteId);
                  onSelectIncident('');
                }}
                className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Switch to Faster Bypass Route
              </button>
            )}
          </div>
        </InfoWindow>
      )}

      {/* Subtle status overlay when computing route */}
      {(routeLoading || apiStatus === APILoadingStatus.LOADING) && (
        <div className="absolute top-3 left-3 z-10 bg-white/95 border border-slate-200 px-3 py-1.5 rounded-md shadow-sm text-xs text-slate-700 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Syncing live corridor route &amp; traffic telemetry...</span>
        </div>
      )}

      {routeError && (
        <div className="absolute bottom-3 left-3 right-3 z-10 bg-amber-50/95 border border-amber-200 px-3 py-2 rounded-md text-xs text-amber-900">
          <span>{routeError}</span>
        </div>
      )}
    </>
  );
}

export function CorridorMap(props: CorridorMapProps) {
  const [showTrafficLayer, setShowTrafficLayer] = useState<boolean>(true);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  const selectedRoute =
    props.evaluatedRoutes.find((r) => r.id === props.selectedRouteId) ||
    props.evaluatedRoutes[0];

  return (
    <section
      aria-label="Live Corridor Interactive Map"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Map Header Controls */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Active Commute Corridor</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {selectedRoute.distanceKm.toFixed(1)} km
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums font-medium text-slate-800">
              ETA {formatDurationMinutes(selectedRoute.effectiveDurationMinutes)}
            </span>
          </div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mt-0.5">
            <span>{props.originQuery}</span>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{props.destinationQuery}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="traffic-layer-toggle-btn"
            type="button"
            onClick={() => setShowTrafficLayer((prev) => !prev)}
            aria-pressed={showTrafficLayer}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              showTrafficLayer
                ? 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {showTrafficLayer
                ? 'TrafficLayer Heatmap: On'
                : 'TrafficLayer Heatmap: Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRefreshCounter((c) => c + 1)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recalculate Route</span>
          </button>
        </div>
      </div>

      {/* Map Viewport Container (CF2: explicit height so map never collapses to 0x0) */}
      <div
        data-testid="corridor-map-viewport"
        className="relative w-full h-[380px] md:h-[430px] bg-slate-100 dark:bg-slate-900"
      >
        {props.apiKey ? (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            colorScheme={props.isDarkMode ? 'DARK' : 'LIGHT'}
            defaultCenter={{ lat: 12.895, lng: 77.705 }}
            defaultZoom={12}
            gestureHandling="cooperative"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full"
          >
            <InnerMapController
              {...props}
              refreshTrigger={props.refreshTrigger + refreshCounter}
              showTrafficLayer={showTrafficLayer}
            />
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
            <Clock className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              Connecting to Google Maps Platform...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
              Live corridor telemetry and incident alerts for {props.originQuery}{' '}
              to {props.destinationQuery} are active below.
            </p>
          </div>
        )}

        {/* On-Map TrafficLayer & Route Congestion Heatmap Legend & Quick Toggle */}
        <div
          data-testid="traffic-layer-heatmap-legend"
          className="absolute bottom-3 left-3 z-10 bg-slate-900/95 text-white border border-slate-700 rounded-lg px-3 py-2 shadow-lg flex flex-wrap items-center gap-3 text-[11px]"
        >
          <button
            type="button"
            onClick={() => setShowTrafficLayer((prev) => !prev)}
            className="font-semibold flex items-center gap-1.5 text-white hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                showTrafficLayer ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span>
              {showTrafficLayer
                ? 'TrafficLayer + Route Heatmap Active'
                : 'TrafficLayer Paused (Click to Enable)'}
            </span>
          </button>

          {showTrafficLayer && (
            <>
              <span aria-hidden="true" className="text-slate-600">
                |
              </span>
              <div className="flex items-center gap-2.5 font-mono tabular-nums text-[10px] text-slate-200">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2 rounded-xs bg-emerald-500 inline-block" />
                  <span>Fast (&gt;24 km/h)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2 rounded-xs bg-amber-500 inline-block" />
                  <span>Moderate</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2 rounded-xs bg-red-500 inline-block" />
                  <span>Slow</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2 rounded-xs bg-red-800 inline-block border border-red-400/40" />
                  <span>Severe Jam</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Corridor Progress & Bottleneck Visualizer Strip */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
          <span className="font-medium text-slate-800">
            Corridor Bottleneck Timeline ({selectedRoute.label})
          </span>
          <span className="font-mono tabular-nums">
            Avg Speed: {selectedRoute.averageSpeedKmh} km/h
          </span>
        </div>

        <div className="relative h-2.5 w-full bg-emerald-500/25 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: '32%' }}
            title="Origin Departure Segment: Nominal Flow"
          />
          <div
            className={`h-full transition-all ${
              selectedRoute.accidentCount > 0 ? 'bg-red-600' : 'bg-amber-500'
            }`}
            style={{ width: '36%' }}
            title="Mid-Corridor Crossing Segment: Delay Zone"
          />
          <div
            className={`h-full transition-all ${
              selectedRoute.constructionCount > 0
                ? 'bg-amber-500'
                : 'bg-emerald-600'
            }`}
            style={{ width: '32%' }}
            title="Destination Approach: Active"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
          <span>0% · {props.originQuery.split(',')[0]}</span>
          <span>50% · Mid-Corridor Checkpoints</span>
          <span>100% · {props.destinationQuery.split(',')[0]}</span>
        </div>
      </div>
    </section>
  );
}
