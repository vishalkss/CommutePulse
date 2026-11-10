/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  Bell,
  AlertTriangle,
  CornerUpRight,
  ShieldAlert,
  CheckCircle2,
  Gauge,
  Fuel,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import {
  evaluateBestRouteAndSavings,
  computeCorridorSegmentTelemetry,
  computeCommuteHistoryAnalytics,
  evaluateDepartureThresholdPush,
  evaluateWeatherTrafficImpact,
  computeActiveCommuteTelemetry,
  calculateRouteFuelAndCost,
  filterAndSortIncidents,
  formatDurationMinutes,
  type CorridorIncident,
  type RouteCandidate,
  type AlertRuleConfig,
  type CorridorWeatherRawData,
} from './utils/trafficLogic';
import {
  CorridorMap,
  type LiveComputedRouteData,
} from './components/CorridorMap';
import { RouteEndpointsPicker } from './components/RouteEndpointsPicker';
import { ActiveCommuteTrackerBar } from './components/ActiveCommuteTrackerBar';
import {
  WeatherConditionsWidget,
  type WeatherSimulationMode,
} from './components/WeatherConditionsWidget';
import { IncidentFeedPanel } from './components/IncidentFeedPanel';
import { RouteComparisonTable } from './components/RouteComparisonTable';
import { LiveTrafficSegmentsPanel } from './components/LiveTrafficSegmentsPanel';
import { CommuteHistoryPanel } from './components/CommuteHistoryPanel';
import { DesktopPushNotificationPopup } from './components/DesktopPushNotificationPopup';
import { ReportIncidentModal } from './components/ReportIncidentModal';
import { AlertRulesSection } from './components/AlertRulesSection';

const INITIAL_ROUTES: RouteCandidate[] = [
  {
    id: 'primary',
    label: 'Primary Sarjapur Main Rd Corridor',
    summaryTag: 'Direct arterial via Carmelaram & Iblur approach',
    baseDurationMinutes: 36,
    distanceKm: 14.2,
    isPrimaryDefault: true,
  },
  {
    id: 'alt_1',
    label: 'Kodathi – Hadosiddapura Bypass',
    summaryTag: 'Bypasses central rail crossing bottleneck',
    baseDurationMinutes: 41,
    distanceKm: 15.8,
  },
  {
    id: 'alt_2',
    label: 'Varthur – Outer Ring Road Link',
    summaryTag: 'Wide multi-lane eastern connector',
    baseDurationMinutes: 45,
    distanceKm: 17.6,
  },
];

const INITIAL_INCIDENTS: CorridorIncident[] = [
  {
    id: 'inc-101',
    title: 'Two-car collision & breakdown near level crossing approach',
    category: 'accident',
    severity: 'severe',
    delayMinutes: 14,
    routeId: 'primary',
    routeProgressRatio: 0.36,
    corridorZoneLabel: 'Mid-Corridor Rail Crossing Approach',
    description:
      'Right lane blocked; traffic marshals directing single-file merge. Heavy queue building for 1.1 km.',
    reportedMinutesAgo: 5,
    lanesBlocked: 'Right & Center Lanes',
    acknowledged: false,
    dismissed: false,
    verifiedCount: 24,
  },
  {
    id: 'inc-102',
    title: 'Metro viaduct pier concreting & barricade narrowing',
    category: 'construction',
    severity: 'heavy',
    delayMinutes: 9,
    routeId: 'primary',
    routeProgressRatio: 0.68,
    corridorZoneLabel: 'Service Road Flyover Merge',
    description:
      'Barricades shifted outward for crane placement; bottleneck at flyover service road entry.',
    reportedMinutesAgo: 22,
    lanesBlocked: 'Left Service Merge Lane',
    acknowledged: false,
    dismissed: false,
    verifiedCount: 41,
  },
  {
    id: 'inc-103',
    title: 'Culvert slab work & utility trenching',
    category: 'construction',
    severity: 'moderate',
    delayMinutes: 4,
    routeId: 'alt_1',
    routeProgressRatio: 0.56,
    corridorZoneLabel: 'Internal Bypass Connector',
    description:
      'Reflective cones placed along left shoulder; steady single-lane movement.',
    reportedMinutesAgo: 38,
    lanesBlocked: 'Left Shoulder',
    acknowledged: false,
    dismissed: false,
    verifiedCount: 11,
  },
  {
    id: 'inc-104',
    title: 'Stalled commercial truck on flyover up-ramp',
    category: 'accident',
    severity: 'moderate',
    delayMinutes: 6,
    routeId: 'alt_2',
    routeProgressRatio: 0.68,
    corridorZoneLabel: 'Ring Road Connector Ramp',
    description:
      'Hazard lights active on left lane of up-ramp; recovery vehicle arriving.',
    reportedMinutesAgo: 14,
    lanesBlocked: 'Left Ramp Lane',
    acknowledged: true,
    dismissed: false,
    verifiedCount: 15,
  },
];

function playNotificationChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore audio context restrictions in headless/uninteracted browsers
  }
}

export default function App() {
  const apiKey =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
    (process.env.GOOGLE_MAPS_API_KEY as string) ||
    '';

  // Quota banner state (Google Maps Platform Section 8 Case A)
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  // User-Selectable Origin & Destination State (defaults to Sompura Gate -> Zetwerk Bellandur Office)
  const [originQuery, setOriginQuery] = useState<string>(
    'Sompura Gate, Sarjapur Road, Bengaluru'
  );
  const [destinationQuery, setDestinationQuery] = useState<string>(
    'Zetwerk Bellandur Office, Bengaluru'
  );

  // Departure Time Offset (0 = Live Now, 15 = +15m, 30 = +30m, 60 = Peak 9 AM)
  const [departureOffsetMinutes, setDepartureOffsetMinutes] =
    useState<number>(0);

  // Live Traffic Auto-Sync & Manual Poll Trigger
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [manualPollCounter, setManualPollCounter] = useState<number>(0);
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // Route & Incidents State
  const [routes, setRoutes] = useState<RouteCandidate[]>(INITIAL_ROUTES);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('primary');
  const [incidents, setIncidents] =
    useState<CorridorIncident[]>(INITIAL_INCIDENTS);

  // Filter & Search State
  const [incidentFilter, setIncidentFilter] = useState<
    'all' | 'accident' | 'construction' | 'severe'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    null
  );

  // Modal & Notification Banner State
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [liveNotificationBanner, setLiveNotificationBanner] = useState<{
    title: string;
    detail: string;
    type: 'accident' | 'construction' | 'bypass';
  } | null>(null);

  // Alert Rules Config (including Saved Departure Time & Typical Travel Threshold)
  const [alertRules, setAlertRules] = useState<AlertRuleConfig>({
    minDelayThresholdMinutes: 8,
    notifyOnAccidents: true,
    notifyOnConstruction: true,
    autoSuggestBypass: true,
    soundAlertsEnabled: true,
    savedDepartureTime: '08:30 AM',
    typicalTravelThresholdMinutes: 46,
    desktopPushEnabled: true,
  });

  // Web Push / Desktop Notification Mock State
  const [browserPushPermission, setBrowserPushPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission;
    }
    return 'unsupported';
  });
  const [isDesktopPushOpen, setIsDesktopPushOpen] = useState<boolean>(true);
  const [lastDismissedPushKey, setLastDismissedPushKey] = useState<
    string | null
  >(null);
  const [pushTriggeredAtLabel, setPushTriggeredAtLabel] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // Live Google Maps Computed Route Metadata
  const [liveRouteData, setLiveRouteData] =
    useState<LiveComputedRouteData | null>(null);

  // Live Local Weather API State (Open-Meteo Meteorological API)
  const [liveWeatherData, setLiveWeatherData] =
    useState<CorridorWeatherRawData>({
      temperatureC: 26.8,
      apparentTemperatureC: 28.1,
      humidityPercent: 64,
      precipitationMm: 0.0,
      rainMm: 0.0,
      precipProbabilityPercent: 20,
      windSpeedKmh: 13.4,
      visibilityKm: 9.5,
      weatherCode: 2,
      fetchedAtLabel: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      sourceLabel: 'Open-Meteo Weather API',
    });
  const [weatherSimulationMode, setWeatherSimulationMode] =
    useState<WeatherSimulationMode>('live');
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
  const [weatherFetchCount, setWeatherFetchCount] = useState<number>(0);

  // Active Commute Session State ('Start Commute' Real-Time Route & Deviation Tracker)
  const [isCommuteActive, setIsCommuteActive] = useState<boolean>(false);
  const [isCommutePaused, setIsCommutePaused] = useState<boolean>(false);
  const [commuteProgressRatio, setCommuteProgressRatio] = useState<number>(0);
  const [commuteOriginalEstimatedMinutes, setCommuteOriginalEstimatedMinutes] =
    useState<number>(59);
  const [commuteElapsedActualMinutes, setCommuteElapsedActualMinutes] =
    useState<number>(0);
  const [commuteSimSpeed, setCommuteSimSpeed] = useState<number>(30);

  // Average Vehicle Fuel Efficiency (km/L) for the Fuel & Trip Cost KPI Card
  const [vehicleEfficiencyKmPerLiter, setVehicleEfficiencyKmPerLiter] =
    useState<number>(14.5);

  // Global Dark Mode Theme State (updates html.dark and root container)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('corridorpulse-theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const rootEl = document.documentElement;
    if (isDarkMode) {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(
        'corridorpulse-theme',
        isDarkMode ? 'dark' : 'light'
      );
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, [isDarkMode]);

  // Listen for Google Maps Platform Demo Key Quota Event
  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  // Fetch real-time local weather from Open-Meteo Weather API for the selected corridor coordinates
  useEffect(() => {
    let cancelled = false;
    const lat = liveRouteData?.originPlace?.location?.lat ?? 12.895;
    const lng = liveRouteData?.originPlace?.location?.lng ?? 77.705;

    async function fetchCorridorWeather() {
      setIsWeatherLoading(true);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
          4
        )}&longitude=${lng.toFixed(
          4
        )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,visibility&hourly=precipitation_probability&timezone=auto&forecast_days=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled || !json?.current) return;

        const currentHour = new Date().getHours();
        const hourlyProb =
          json.hourly?.precipitation_probability?.[currentHour] ?? 20;
        const visMeters = json.current.visibility ?? 9500;

        setLiveWeatherData({
          temperatureC: Number(json.current.temperature_2m ?? 26.8),
          apparentTemperatureC: Number(
            json.current.apparent_temperature ?? 28.1
          ),
          humidityPercent: Number(json.current.relative_humidity_2m ?? 64),
          precipitationMm: Number(json.current.precipitation ?? 0),
          rainMm: Number(json.current.rain ?? 0),
          precipProbabilityPercent: Number(hourlyProb),
          windSpeedKmh: Number(json.current.wind_speed_10m ?? 12.5),
          visibilityKm: Number((visMeters / 1000).toFixed(1)),
          weatherCode: Number(json.current.weather_code ?? 2),
          fetchedAtLabel: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          sourceLabel: 'Open-Meteo Live API',
        });
      } catch {
        // Keep last resolved or baseline weather telemetry on network error
      } finally {
        if (!cancelled) setIsWeatherLoading(false);
      }
    }

    void fetchCorridorWeather();
    return () => {
      cancelled = true;
    };
  }, [
    liveRouteData?.originPlace?.location?.lat,
    liveRouteData?.originPlace?.location?.lng,
    weatherFetchCount,
  ]);

  // Periodic 30-second live traffic refresh when enabled
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = window.setInterval(() => {
      setManualPollCounter((c) => c + 1);
      setLastSyncedLabel(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    }, 30000);
    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled]);

  // Apply user-selected Origin & Destination
  const handleApplyEndpoints = (nextOrigin: string, nextDestination: string) => {
    setOriginQuery(nextOrigin);
    setDestinationQuery(nextDestination);
    setSelectedRouteId('primary');
    setSelectedIncidentId(null);

    const shortOrig = nextOrigin.split(',')[0].trim();
    const shortDest = nextDestination.split(',')[0].trim();
    const isDefaultSompura =
      /sompura|sumpura/i.test(nextOrigin + nextDestination) &&
      /bellandur|zetwerk/i.test(nextOrigin + nextDestination);

    if (isDefaultSompura) {
      setRoutes(INITIAL_ROUTES);
    } else {
      setRoutes([
        {
          id: 'primary',
          label: `Primary Direct Corridor (${shortOrig} → ${shortDest})`,
          summaryTag: 'Main arterial route computed via Google Maps',
          baseDurationMinutes: 35,
          distanceKm: 14.0,
          isPrimaryDefault: true,
        },
        {
          id: 'alt_1',
          label: `Secondary Bypass via ${shortOrig} Connector`,
          summaryTag: 'Avoids central junction bottleneck',
          baseDurationMinutes: 40,
          distanceKm: 15.6,
        },
        {
          id: 'alt_2',
          label: `Outer Ring / Express Link toward ${shortDest}`,
          summaryTag: 'Alternate multi-lane corridor',
          baseDurationMinutes: 44,
          distanceKm: 17.2,
        },
      ]);
    }

    setLiveNotificationBanner({
      title: `Active Route Updated: ${shortOrig} → ${shortDest}`,
      detail: `Fetching live Google Maps route geometry, real-time traffic speeds, and active accident/construction delays for ${shortOrig} to ${shortDest}.`,
      type: 'bypass',
    });
  };

  // Sync route alternatives, distances, and base durations when Google Maps Routes API responds
  const handleLiveRouteComputed = (data: LiveComputedRouteData) => {
    setLiveRouteData(data);
    setLastSyncedLabel(data.lastUpdatedIso);

    const shortOrig = originQuery.split(',')[0].trim();
    const shortDest = destinationQuery.split(',')[0].trim();
    const isDefaultSompura =
      /sompura|sumpura/i.test(originQuery + destinationQuery) &&
      /bellandur|zetwerk/i.test(originQuery + destinationQuery);

    if (data.distanceMeters > 0 && data.durationMillis > 0) {
      const liveDistKm = Number((data.distanceMeters / 1000).toFixed(1));
      const liveBaseMins = Math.max(
        10,
        Math.round(data.durationMillis / 60000)
      );

      setRoutes((prev) =>
        prev.map((r, idx) => {
          const altSummary = data.alternativeRoutes?.[idx];
          if (r.id === selectedRouteId) {
            return {
              ...r,
              distanceKm: liveDistKm,
              baseDurationMinutes: liveBaseMins,
              label: isDefaultSompura
                ? r.label
                : idx === 0
                ? `Primary Corridor (${shortOrig} → ${shortDest})`
                : r.label,
            };
          }
          if (altSummary && altSummary.distanceMeters > 0) {
            return {
              ...r,
              distanceKm: Number(
                (altSummary.distanceMeters / 1000).toFixed(1)
              ),
              baseDurationMinutes: Math.max(
                10,
                Math.round(altSummary.durationMillis / 60000)
              ),
            };
          }
          return r;
        })
      );

      // Update incident checkpoint labels dynamically when routing a custom corridor
      const primaryAlt = data.alternativeRoutes?.[0];
      if (!isDefaultSompura && primaryAlt) {
        setIncidents((prev) =>
          prev.map((inc, idx) => {
            if (idx === 0 && primaryAlt.midStepCheckpoint) {
              return {
                ...inc,
                corridorZoneLabel: primaryAlt.midStepCheckpoint,
              };
            }
            if (idx === 1 && primaryAlt.lateStepCheckpoint) {
              return {
                ...inc,
                corridorZoneLabel: primaryAlt.lateStepCheckpoint,
              };
            }
            return inc;
          })
        );
      }
    }
  };

  // Effective Weather Data (Live API or Rain Slowdown Overlay Simulation)
  const effectiveWeatherData: CorridorWeatherRawData = useMemo(() => {
    if (weatherSimulationMode === 'light_rain') {
      return {
        ...liveWeatherData,
        temperatureC: 23.4,
        apparentTemperatureC: 25.0,
        humidityPercent: 86,
        precipitationMm: 2.2,
        rainMm: 2.2,
        precipProbabilityPercent: 84,
        windSpeedKmh: 19.5,
        visibilityKm: 5.2,
        weatherCode: 61,
        sourceLabel: 'Rain Slowdown Overlay (Light Rain)',
      };
    }
    if (weatherSimulationMode === 'heavy_rain') {
      return {
        ...liveWeatherData,
        temperatureC: 21.6,
        apparentTemperatureC: 23.2,
        humidityPercent: 94,
        precipitationMm: 6.8,
        rainMm: 6.8,
        precipProbabilityPercent: 96,
        windSpeedKmh: 28.4,
        visibilityKm: 2.8,
        weatherCode: 65,
        sourceLabel: 'Rain Slowdown Overlay (Heavy Downpour)',
      };
    }
    return liveWeatherData;
  }, [liveWeatherData, weatherSimulationMode]);

  // Evaluate Weather-Related Traffic Slowdown Impact
  const weatherAdvisory = useMemo(
    () =>
      evaluateWeatherTrafficImpact(
        effectiveWeatherData,
        originQuery,
        destinationQuery,
        routes[0]?.baseDurationMinutes || 36
      ),
    [effectiveWeatherData, originQuery, destinationQuery, routes]
  );

  // Overlay active weather slowdown alert into the corridor incidents list
  const effectiveIncidents: CorridorIncident[] = useMemo(() => {
    if (!weatherAdvisory.isRainSlowdownActive) {
      return incidents;
    }
    const weatherIncident: CorridorIncident = {
      id: 'inc-weather-rain',
      title: weatherAdvisory.alertTitle,
      category: 'accident',
      severity:
        weatherAdvisory.severity === 'severe'
          ? 'severe'
          : weatherAdvisory.severity === 'heavy'
          ? 'heavy'
          : 'moderate',
      delayMinutes: weatherAdvisory.extraDelayMinutes,
      routeId: 'primary',
      routeProgressRatio: weatherAdvisory.routeProgressRatio,
      corridorZoneLabel: weatherAdvisory.affectedCheckpointLabel,
      description: weatherAdvisory.alertDescription,
      reportedMinutesAgo: 1,
      lanesBlocked: `Wet Carriageway (-${weatherAdvisory.speedReductionPercent}% speed)`,
      acknowledged: false,
      dismissed: false,
      verifiedCount: 18,
    };
    return [weatherIncident, ...incidents];
  }, [incidents, weatherAdvisory]);

  // Evaluate routes and time savings (including weather-related traffic slowdowns)
  const comparison = useMemo(
    () =>
      evaluateBestRouteAndSavings(
        routes,
        effectiveIncidents,
        selectedRouteId,
        departureOffsetMinutes,
        alertRules.minDelayThresholdMinutes
      ),
    [
      routes,
      effectiveIncidents,
      selectedRouteId,
      departureOffsetMinutes,
      alertRules.minDelayThresholdMinutes,
    ]
  );

  // Compute segment-by-segment real-time speed, congestion, and travel time telemetry
  const corridorSegments = useMemo(
    () =>
      computeCorridorSegmentTelemetry(
        comparison.selectedRoute,
        effectiveIncidents,
        false,
        originQuery,
        destinationQuery,
        liveRouteData?.steps || []
      ),
    [
      comparison.selectedRoute,
      effectiveIncidents,
      originQuery,
      destinationQuery,
      liveRouteData?.steps,
    ]
  );

  // Compute weekly traffic trends & common delay times for the selected corridor
  const commuteHistoryAnalytics = useMemo(
    () =>
      computeCommuteHistoryAnalytics(
        comparison.selectedRoute,
        incidents,
        originQuery,
        destinationQuery
      ),
    [comparison.selectedRoute, incidents, originQuery, destinationQuery]
  );

  // Compute live Active Commute Telemetry (progress along route + actual vs original estimate deviation)
  const activeCommuteTelemetry = useMemo(
    () =>
      computeActiveCommuteTelemetry({
        progressRatio: commuteProgressRatio,
        originalEstimatedMinutes: isCommuteActive
          ? commuteOriginalEstimatedMinutes
          : comparison.selectedRoute.effectiveDurationMinutes,
        elapsedActualMinutes: commuteElapsedActualMinutes,
        selectedRoute: comparison.selectedRoute,
        segments: corridorSegments,
      }),
    [
      commuteProgressRatio,
      isCommuteActive,
      commuteOriginalEstimatedMinutes,
      comparison.selectedRoute,
      commuteElapsedActualMinutes,
      corridorSegments,
    ]
  );

  // Estimate fuel consumption and trip cost for the selected route based on distance and average vehicle efficiency
  const fuelCostEstimate = useMemo(
    () =>
      calculateRouteFuelAndCost(
        comparison.selectedRoute,
        vehicleEfficiencyKmPerLiter,
        102.86
      ),
    [comparison.selectedRoute, vehicleEfficiencyKmPerLiter]
  );

  const handleCycleVehicleEfficiency = () => {
    const presets = [14.5, 18.5, 11.5, 38.0];
    const currentIndex = presets.indexOf(vehicleEfficiencyKmPerLiter);
    const nextIndex = (currentIndex + 1) % presets.length;
    setVehicleEfficiencyKmPerLiter(presets[nextIndex]);
  };

  // Helper to compute realistic elapsed actual minutes at a given route progress ratio
  const computeElapsedMinutesForRatio = (
    targetRatio: number,
    routeDurationMins: number,
    hasSevereBottleneck: boolean
  ) => {
    const clamped = Math.min(1, Math.max(0, targetRatio));
    // Non-linear bottleneck drag through mid-corridor (30% to 75% progress) when on congested primary route
    const midCorridorOverlap = Math.max(
      0,
      Math.min(clamped, 0.78) - 0.28
    );
    const extraBottleneckDrag = hasSevereBottleneck
      ? midCorridorOverlap * 9.5
      : midCorridorOverlap * 1.5;
    return Number((routeDurationMins * clamped + extraBottleneckDrag).toFixed(1));
  };

  // Real-time commute progress ticker when Start Commute is active
  useEffect(() => {
    if (!isCommuteActive || isCommutePaused) return;
    const interval = window.setInterval(() => {
      setCommuteProgressRatio((prev) => {
        if (prev >= 1) return 1;
        // Advance progress smoothly according to simulation speed multiplier
        const step = Math.max(0.008, (commuteSimSpeed / 60) * 0.025);
        const next = Math.min(1, Number((prev + step).toFixed(3)));
        const hasBottleneck =
          comparison.selectedRoute.accidentCount > 0 ||
          comparison.selectedRoute.incidentDelayMinutes >= 12;
        setCommuteElapsedActualMinutes(
          computeElapsedMinutesForRatio(
            next,
            comparison.selectedRoute.effectiveDurationMinutes,
            hasBottleneck
          )
        );
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [
    isCommuteActive,
    isCommutePaused,
    commuteSimSpeed,
    comparison.selectedRoute.effectiveDurationMinutes,
    comparison.selectedRoute.accidentCount,
    comparison.selectedRoute.incidentDelayMinutes,
  ]);

  const handleStartCommute = () => {
    const lockedEstimate = comparison.selectedRoute.effectiveDurationMinutes;
    const initialRatio = 0.12; // Start 12% into the departure stretch so telemetry is immediately active
    const hasBottleneck =
      comparison.selectedRoute.accidentCount > 0 ||
      comparison.selectedRoute.incidentDelayMinutes >= 12;
    setCommuteOriginalEstimatedMinutes(lockedEstimate);
    setCommuteProgressRatio(initialRatio);
    setCommuteElapsedActualMinutes(
      computeElapsedMinutesForRatio(initialRatio, lockedEstimate, hasBottleneck)
    );
    setIsCommutePaused(false);
    setIsCommuteActive(true);
  };

  const handleStepCommuteProgress = (deltaRatio: number) => {
    const next = Math.min(1, Math.max(0, Number((commuteProgressRatio + deltaRatio).toFixed(2))));
    const hasBottleneck =
      comparison.selectedRoute.accidentCount > 0 ||
      comparison.selectedRoute.incidentDelayMinutes >= 12;
    setCommuteProgressRatio(next);
    setCommuteElapsedActualMinutes(
      computeElapsedMinutesForRatio(
        next,
        comparison.selectedRoute.effectiveDurationMinutes,
        hasBottleneck
      )
    );
  };

  const handleScrubCommuteProgress = (nextRatio: number) => {
    const clamped = Math.min(1, Math.max(0, Number(nextRatio.toFixed(2))));
    const hasBottleneck =
      comparison.selectedRoute.accidentCount > 0 ||
      comparison.selectedRoute.incidentDelayMinutes >= 12;
    setCommuteProgressRatio(clamped);
    setCommuteElapsedActualMinutes(
      computeElapsedMinutesForRatio(
        clamped,
        comparison.selectedRoute.effectiveDurationMinutes,
        hasBottleneck
      )
    );
  };

  const handleStopCommute = () => {
    setIsCommuteActive(false);
    setIsCommutePaused(false);
    setCommuteProgressRatio(0);
    setCommuteElapsedActualMinutes(0);
  };

  // Evaluate whether Estimated Travel Time exceeds the typical threshold for the user's saved departure time
  const departurePushPayload = useMemo(
    () =>
      evaluateDepartureThresholdPush(
        comparison.selectedRoute,
        comparison.recommendedRoute,
        alertRules.savedDepartureTime || '08:30 AM',
        alertRules.typicalTravelThresholdMinutes,
        originQuery,
        destinationQuery
      ),
    [
      comparison.selectedRoute,
      comparison.recommendedRoute,
      alertRules.savedDepartureTime,
      alertRules.typicalTravelThresholdMinutes,
      originQuery,
      destinationQuery,
    ]
  );

  const currentPushSignature = `${selectedRouteId}__${departurePushPayload.estimatedTravelMinutes}__${departurePushPayload.typicalThresholdMinutes}__${departurePushPayload.savedDepartureTime}`;

  // Automatically trigger Web Push / Desktop Notification when Estimated Travel Time exceeds typical threshold
  useEffect(() => {
    if (
      alertRules.desktopPushEnabled !== false &&
      departurePushPayload.shouldTriggerPush &&
      lastDismissedPushKey !== currentPushSignature
    ) {
      setIsDesktopPushOpen(true);
      setPushTriggeredAtLabel(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      );

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        try {
          new window.Notification(departurePushPayload.title, {
            body: `${departurePushPayload.body} ${departurePushPayload.actionSuggestion}`,
            tag: 'corridor-pulse-threshold-alert',
          });
        } catch {
          // Fallback to in-app desktop notification popup
        }
      }
    } else if (!departurePushPayload.shouldTriggerPush) {
      setIsDesktopPushOpen(false);
    }
  }, [
    alertRules.desktopPushEnabled,
    departurePushPayload.shouldTriggerPush,
    departurePushPayload.title,
    departurePushPayload.body,
    departurePushPayload.actionSuggestion,
    currentPushSignature,
    lastDismissedPushKey,
  ]);

  const handleRequestBrowserPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPushPermission('unsupported');
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setBrowserPushPermission(result);
    } catch {
      setBrowserPushPermission(window.Notification.permission);
    }
  };

  const handleManualTriggerDesktopPush = () => {
    setLastDismissedPushKey(null);
    setIsDesktopPushOpen(true);
    setPushTriggeredAtLabel(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
    if (alertRules.soundAlertsEnabled) {
      playNotificationChime();
    }
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification.permission === 'granted'
    ) {
      try {
        new window.Notification(departurePushPayload.title, {
          body: `${departurePushPayload.body} ${departurePushPayload.actionSuggestion}`,
          tag: 'corridor-pulse-threshold-alert',
        });
      } catch {
        // Fallback to in-app desktop notification popup
      }
    }
  };

  // Filter incidents for display (including active weather-related slowdown alerts)
  const filteredIncidents = useMemo(
    () =>
      filterAndSortIncidents(
        effectiveIncidents,
        incidentFilter,
        searchQuery,
        false
      ),
    [effectiveIncidents, incidentFilter, searchQuery]
  );

  const activeIncidents = useMemo(
    () => effectiveIncidents.filter((i) => !i.dismissed),
    [effectiveIncidents]
  );
  const totalActiveAccidents = activeIncidents.filter(
    (i) => i.category === 'accident'
  ).length;
  const totalActiveConstruction = activeIncidents.filter(
    (i) => i.category === 'construction'
  ).length;

  const shortOrigin = originQuery.split(',')[0].trim();
  const shortDest = destinationQuery.split(',')[0].trim();

  // Handlers
  const handleManualTrafficRefresh = () => {
    setManualPollCounter((c) => c + 1);
    const nowStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setLastSyncedLabel(nowStr);
    setLiveNotificationBanner({
      title: `Live Traffic Telemetry Updated (${nowStr})`,
      detail: `Current speed on ${comparison.selectedRoute.label}: ${comparison.selectedRoute.averageSpeedKmh} km/h · Congestion: ${comparison.selectedRoute.congestionIndexPercent}% · Est. Travel Time: ${formatDurationMinutes(comparison.selectedRoute.effectiveDurationMinutes)}.`,
      type: 'bypass',
    });
  };

  const handleSwitchToBypass = () => {
    setSelectedRouteId(comparison.recommendedRoute.id);
    setLiveNotificationBanner({
      title: `Switched to ${comparison.recommendedRoute.label}`,
      detail: `Saving ${comparison.timeSavedVsPrimaryMinutes} minutes by bypassing active ${shortOrigin} → ${shortDest} delays.`,
      type: 'bypass',
    });
  };

  const handleAcknowledgeIncident = (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, acknowledged: true } : inc))
    );
  };

  const handleDismissIncident = (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, dismissed: true } : inc))
    );
  };

  const handleVerifyIncident = (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id ? { ...inc, verifiedCount: inc.verifiedCount + 1 } : inc
      )
    );
  };

  const handleAddIncident = (newIncident: CorridorIncident) => {
    setIncidents((prev) => [newIncident, ...prev]);
    if (alertRules.soundAlertsEnabled) {
      playNotificationChime();
    }
    setLiveNotificationBanner({
      title: `${
        newIncident.category === 'accident'
          ? 'New Accident Alert'
          : 'New Construction Alert'
      }: ${newIncident.title}`,
      detail: `${newIncident.corridorZoneLabel} · +${newIncident.delayMinutes} min delay added to corridor calculation.`,
      type: newIncident.category,
    });
  };

  const handleTriggerTestNotification = () => {
    if (alertRules.soundAlertsEnabled) {
      playNotificationChime();
    }
    setLiveNotificationBanner({
      title:
        'Commute Alert Test: Accident + Construction Delay Threshold Reached',
      detail: `Primary ${shortOrigin} → ${shortDest} route has +${comparison.primaryRoute.incidentDelayMinutes}m delay. Recommended: ${comparison.recommendedRoute.label} (saves ${comparison.timeSavedVsPrimaryMinutes} min).`,
      type: 'accident',
    });
  };

  const appShell = (
    <div
      className={`${
        isDarkMode ? 'dark ' : ''
      }min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors`}
    >
      {/* Mandatory Demo Key Quota Banner (Section 8 Case A) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Navigation Bar following strict 3-zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Brand Title (Single text element wordmark) */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            CorridorPulse
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav
            aria-label="Primary Corridor Sections"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#live-corridor"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Live Corridor
            </a>
            <a
              href="#live-traffic-conditions"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Traffic Speeds
            </a>
            <a
              href="#incident-feed"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Incident Alerts
            </a>
            <a
              href="#commute-history"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Commute History
            </a>
          </nav>

          {/* Zone 3: Global Dark Mode Theme Toggle + Primary Action Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              id="dark-mode-toggle-btn"
              data-testid="theme-toggle-btn"
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-pressed={isDarkMode}
              aria-label={
                isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'
              }
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Report Incident
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main
        id="top"
        className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5"
      >
        {/* Live In-App Alert Notification Toast/Banner when triggered */}
        {liveNotificationBanner && (
          <div
            role="status"
            aria-live="polite"
            className={`px-4 py-3 rounded-lg border flex items-start justify-between gap-3 ${
              liveNotificationBanner.type === 'accident'
                ? 'bg-red-50 border-red-200 text-red-950'
                : liveNotificationBanner.type === 'construction'
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-blue-50 border-blue-200 text-blue-950'
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs">
              <Bell className="w-4 h-4 shrink-0 mt-0.5 text-current" />
              <div>
                <p className="font-semibold">{liveNotificationBanner.title}</p>
                <p className="mt-0.5 opacity-90">
                  {liveNotificationBanner.detail}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLiveNotificationBanner(null)}
              aria-label="Dismiss notification banner"
              className="p-1 text-current opacity-70 hover:opacity-100 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Proactive Bypass Advisory Banner when active route is slower than recommended bypass */}
        {comparison.shouldAlertForBypass && (
          <div
            role="region"
            aria-label="Time-Saving Bypass Recommendation"
            className="bg-slate-900 text-white px-4 py-3.5 rounded-lg flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-start sm:items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <div className="text-xs text-slate-300">
                  <span>
                    Active Delay Alert on {comparison.selectedRoute.label}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono tabular-nums text-amber-300 font-semibold">
                    +{comparison.selectedRoute.incidentDelayMinutes} min from{' '}
                    {comparison.selectedRoute.accidentCount} accident &amp;{' '}
                    {comparison.selectedRoute.constructionCount} construction
                    zone
                  </span>
                </div>
                <p className="text-sm font-semibold mt-0.5">
                  Save {comparison.timeSavedVsSelectedMinutes} minutes now by
                  taking {comparison.recommendedRoute.label} (ETA{' '}
                  {formatDurationMinutes(
                    comparison.recommendedRoute.effectiveDurationMinutes
                  )}
                  )
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSwitchToBypass}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <CornerUpRight className="w-3.5 h-3.5" />
              <span>
                Switch to Bypass (Save {comparison.timeSavedVsSelectedMinutes}{' '}
                min)
              </span>
            </button>
          </div>
        )}

        {/* Interactive Origin & Destination Selector with Google Places Autocomplete */}
        <RouteEndpointsPicker
          originQuery={originQuery}
          destinationQuery={destinationQuery}
          onApplyEndpoints={handleApplyEndpoints}
          departureOffsetMinutes={departureOffsetMinutes}
          onSelectDepartureOffset={setDepartureOffsetMinutes}
        />

        {/* Start Commute Launcher & Real-Time Route Progress / Deviation Tracker */}
        <ActiveCommuteTrackerBar
          isActive={isCommuteActive}
          isPaused={isCommutePaused}
          simSpeedMultiplier={commuteSimSpeed}
          selectedRoute={comparison.selectedRoute}
          originQuery={originQuery}
          destinationQuery={destinationQuery}
          telemetry={activeCommuteTelemetry}
          incidents={effectiveIncidents}
          onStartCommute={handleStartCommute}
          onTogglePause={() => setIsCommutePaused((p) => !p)}
          onStopCommute={handleStopCommute}
          onStepProgress={handleStepCommuteProgress}
          onScrubProgress={handleScrubCommuteProgress}
          onChangeSimSpeed={setCommuteSimSpeed}
        />

        {/* Live Local Weather Conditions & Rain-Related Traffic Slowdown Overlay Widget */}
        <WeatherConditionsWidget
          originQuery={originQuery}
          destinationQuery={destinationQuery}
          weatherData={effectiveWeatherData}
          advisory={weatherAdvisory}
          simulationMode={weatherSimulationMode}
          onChangeSimulationMode={setWeatherSimulationMode}
          isLoading={isWeatherLoading}
          onRefreshWeather={() => setWeatherFetchCount((c) => c + 1)}
        />

        {/* 5-Column KPI Summary Strip: Estimated Travel Time, Live Speed, Congestion Level, Bypass Time Saved, Fuel & Trip Cost */}
        <section
          aria-label="Corridor Live Telemetry Summary"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5"
        >
          {/* KPI 1: Estimated Travel Time (Live ETA vs. Saved Departure Threshold) */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
              <div>
                <span>Estimated Travel Time</span>
                <span aria-hidden="true"> · </span>
                <span>{comparison.selectedRoute.distanceKm.toFixed(1)} km</span>
              </div>
              <button
                type="button"
                onClick={handleManualTriggerDesktopPush}
                className={`text-[11px] font-mono tabular-nums font-semibold underline underline-offset-2 cursor-pointer ${
                  departurePushPayload.shouldTriggerPush
                    ? 'text-red-600 hover:text-red-800'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                {departurePushPayload.shouldTriggerPush
                  ? `+${departurePushPayload.excessMinutes}m over ${departurePushPayload.savedDepartureTime}`
                  : `Within ${departurePushPayload.savedDepartureTime}`}
              </button>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatDurationMinutes(
                comparison.selectedRoute.effectiveDurationMinutes
              )}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-between gap-2">
              <span>
                Free-flow:{' '}
                {formatDurationMinutes(
                  comparison.selectedRoute.baseDurationMinutes
                )}
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                Threshold:{' '}
                {formatDurationMinutes(
                  departurePushPayload.typicalThresholdMinutes
                )}
              </span>
            </div>
          </div>

          {/* KPI 2: Live Average Traffic Speed */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="text-xs text-slate-500">
              <span>Current Traffic Speed</span>
              <span aria-hidden="true"> · </span>
              <span>Active Route</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {comparison.selectedRoute.averageSpeedKmh} km/h
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                Free-flow speed: {comparison.selectedRoute.freeFlowSpeedKmh}{' '}
                km/h
              </span>
            </div>
          </div>

          {/* KPI 3: Live Congestion Level & Delay Impact */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="text-xs text-slate-500">
              <span>Congestion Level</span>
              <span aria-hidden="true"> · </span>
              <span>
                {totalActiveAccidents} acc / {totalActiveConstruction} roadwork
              </span>
            </div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                comparison.selectedRoute.congestionStatus === 'severe'
                  ? 'text-red-600'
                  : comparison.selectedRoute.congestionStatus === 'heavy'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {comparison.selectedRoute.congestionIndexPercent}% ·{' '}
              {comparison.selectedRoute.congestionStatus
                .charAt(0)
                .toUpperCase() +
                comparison.selectedRoute.congestionStatus.slice(1)}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>
                +{comparison.primaryRoute.incidentDelayMinutes} min delay on
                Primary Rd
              </span>
            </div>
          </div>

          {/* KPI 4: Smart Bypass Time Saved */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="text-xs text-slate-500">
              <span>Bypass Time Savings</span>
              <span aria-hidden="true"> · </span>
              <span>vs. Direct Main Rd</span>
            </div>
            <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {comparison.timeSavedVsPrimaryMinutes > 0
                ? `${comparison.timeSavedVsPrimaryMinutes} min saved`
                : 'On fastest path'}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">
                Best: {comparison.recommendedRoute.label}
              </span>
            </div>
          </div>

          {/* KPI 5: Estimated Fuel Consumption & Trip Cost */}
          <div
            id="kpi-fuel-trip-cost"
            data-testid="kpi-fuel-cost-card"
            className="bg-white border border-slate-200 rounded-lg p-3.5"
          >
            <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
              <span>Est. Fuel &amp; Trip Cost</span>
              <button
                type="button"
                id="cycle-vehicle-efficiency-btn"
                onClick={handleCycleVehicleEfficiency}
                title="Switch average vehicle fuel efficiency preset (14.5 / 18.5 / 11.5 / 38.0 km/L)"
                className="text-[11px] font-mono tabular-nums font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
              >
                {fuelCostEstimate.baseEfficiencyKmPerLiter} km/L avg
              </button>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {fuelCostEstimate.formattedFuelLiters} ·{' '}
              {fuelCostEstimate.formattedTripCost}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  {fuelCostEstimate.distanceKm.toFixed(1)} km (
                  {fuelCostEstimate.effectiveEfficiencyKmPerLiter} km/L live)
                </span>
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                {fuelCostEstimate.extraCongestionCostInr > 0
                  ? `+₹${fuelCostEstimate.extraCongestionCostInr} jam`
                  : 'Free-flow'}
              </span>
            </div>
          </div>
        </section>

        {/* Main 12-Column Workspace: Map + Live Traffic Speeds + Route Compare (Left 7 cols) & Live Alerts Feed (Right 5 cols) */}
        <div
          id="live-corridor"
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
        >
          {/* Left Column (7 cols): Interactive Google Map + Real-Time Segment Traffic Telemetry + Route Comparison Matrix + Alert Rules */}
          <div className="lg:col-span-7 space-y-5">
            <CorridorMap
              apiKey={apiKey}
              originQuery={originQuery}
              destinationQuery={destinationQuery}
              incidents={effectiveIncidents}
              evaluatedRoutes={comparison.evaluatedRoutes}
              selectedRouteId={selectedRouteId}
              recommendedRouteId={comparison.recommendedRoute.id}
              onSelectRoute={(routeId) => setSelectedRouteId(routeId)}
              onSelectIncident={(incId) =>
                setSelectedIncidentId(incId ? incId : null)
              }
              selectedIncidentId={selectedIncidentId}
              onLiveRouteComputed={handleLiveRouteComputed}
              refreshTrigger={departureOffsetMinutes + manualPollCounter}
              weatherAdvisory={weatherAdvisory}
              activeCommuteProgressRatio={
                isCommuteActive ? commuteProgressRatio : null
              }
              activeCommuteDeviationLabel={
                isCommuteActive
                  ? activeCommuteTelemetry.deviationMinutes > 0
                    ? `+${activeCommuteTelemetry.deviationMinutes.toFixed(1)}m`
                    : `${activeCommuteTelemetry.deviationMinutes.toFixed(1)}m`
                  : undefined
              }
              isDarkMode={isDarkMode}
            />

            <LiveTrafficSegmentsPanel
              originQuery={originQuery}
              destinationQuery={destinationQuery}
              segments={corridorSegments}
              selectedRoute={comparison.selectedRoute}
              lastSyncedLabel={lastSyncedLabel}
              autoRefreshEnabled={autoRefreshEnabled}
              onToggleAutoRefresh={() =>
                setAutoRefreshEnabled((prev) => !prev)
              }
              onManualRefresh={handleManualTrafficRefresh}
            />

            <RouteComparisonTable
              evaluatedRoutes={comparison.evaluatedRoutes}
              selectedRouteId={selectedRouteId}
              recommendedRouteId={comparison.recommendedRoute.id}
              onSelectRoute={(routeId) => setSelectedRouteId(routeId)}
              liveSteps={liveRouteData?.steps || []}
              lastUpdatedIso={lastSyncedLabel}
            />

            <AlertRulesSection
              rules={alertRules}
              onUpdateRules={setAlertRules}
              onTriggerTestNotification={handleTriggerTestNotification}
              pushPayload={departurePushPayload}
              baseDurationMinutes={comparison.selectedRoute.baseDurationMinutes}
              browserPermission={browserPushPermission}
              onRequestBrowserPermission={handleRequestBrowserPushPermission}
              onTriggerDesktopPushMock={handleManualTriggerDesktopPush}
            />
          </div>

          {/* Right Column (5 cols): Live Accident & Construction Alerts Feed */}
          <div className="lg:col-span-5">
            <IncidentFeedPanel
              incidents={filteredIncidents}
              activeFilter={incidentFilter}
              onFilterChange={setIncidentFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedRouteId={selectedRouteId}
              recommendedRouteId={comparison.recommendedRoute.id}
              recommendedRouteLabel={comparison.recommendedRoute.label}
              timeSavedVsSelectedMinutes={comparison.timeSavedVsSelectedMinutes}
              onSwitchToBypass={handleSwitchToBypass}
              onAcknowledgeIncident={handleAcknowledgeIncident}
              onDismissIncident={handleDismissIncident}
              onVerifyIncident={handleVerifyIncident}
              onFocusIncidentOnMap={(id) => setSelectedIncidentId(id)}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              totalActiveAccidents={totalActiveAccidents}
              totalActiveConstruction={totalActiveConstruction}
            />
          </div>
        </div>

        {/* Full-Width Commute History Analytics (Recharts Weekly Trends & Common Delay Windows) */}
        <CommuteHistoryPanel
          analytics={commuteHistoryAnalytics}
          selectedRoute={comparison.selectedRoute}
          onSelectDepartureWindow={setDepartureOffsetMinutes}
        />
      </main>

      {/* Clean Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 mt-8 py-4 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>
            CorridorPulse · Live Commute Traffic Alerter ({shortOrigin} ↔{' '}
            {shortDest})
          </span>
          <span>
            Powered by{' '}
            <a
              href="https://developers.google.com/maps/documentation/javascript?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-800"
            >
              Google Maps Platform
            </a>{' '}
            (Routes API, Places API New, TrafficLayer)
          </span>
        </div>
      </footer>

      {/* Report Incident Modal */}
      <ReportIncidentModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        routes={routes}
        onSubmitIncident={handleAddIncident}
      />

      {/* Web Push / Desktop Notification Mock Popup when Estimated Travel Time exceeds Saved Departure Threshold */}
      <DesktopPushNotificationPopup
        payload={departurePushPayload}
        isOpen={isDesktopPushOpen}
        triggeredAtLabel={pushTriggeredAtLabel}
        browserPermission={browserPushPermission}
        onDismiss={() => {
          setIsDesktopPushOpen(false);
          setLastDismissedPushKey(currentPushSignature);
        }}
        onSnooze={() => {
          setIsDesktopPushOpen(false);
          setLastDismissedPushKey(currentPushSignature);
        }}
        onSwitchToBypass={handleSwitchToBypass}
      />
    </div>
  );

  return apiKey ? (
    <APIProvider apiKey={apiKey}>{appShell}</APIProvider>
  ) : (
    appShell
  );
}
