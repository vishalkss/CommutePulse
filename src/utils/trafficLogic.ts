export type IncidentCategory = 'accident' | 'construction';
export type SeverityLevel = 'moderate' | 'heavy' | 'severe';
export type CongestionLevel = 'nominal' | 'moderate' | 'heavy' | 'severe';

export interface CorridorIncident {
  id: string;
  title: string;
  category: IncidentCategory;
  severity: SeverityLevel;
  delayMinutes: number;
  routeId: string; // Which route option this incident primarily impacts ('primary' | 'alt_1' | 'alt_2')
  routeProgressRatio: number; // 0.05 to 0.95 along the route path
  corridorZoneLabel: string;
  description: string;
  reportedMinutesAgo: number;
  lanesBlocked: string;
  acknowledged: boolean;
  dismissed: boolean;
  verifiedCount: number;
}

export interface RouteCandidate {
  id: string;
  label: string;
  summaryTag: string;
  baseDurationMinutes: number;
  distanceKm: number;
  isPrimaryDefault?: boolean;
}

export interface EvaluatedRoute extends RouteCandidate {
  incidentDelayMinutes: number;
  departureMultiplierMinutes: number;
  effectiveDurationMinutes: number;
  averageSpeedKmh: number;
  freeFlowSpeedKmh: number;
  congestionIndexPercent: number;
  activeIncidentCount: number;
  accidentCount: number;
  constructionCount: number;
  congestionStatus: CongestionLevel;
}

export interface CorridorSegmentTelemetry {
  id: string;
  segmentName: string;
  fromCheckpoint: string;
  toCheckpoint: string;
  distanceKm: number;
  freeFlowMinutes: number;
  currentMinutes: number;
  currentSpeedKmh: number;
  freeFlowSpeedKmh: number;
  congestionPercent: number;
  congestionLevel: CongestionLevel;
  speedCategory: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';
}

export interface RouteComparisonSummary {
  evaluatedRoutes: EvaluatedRoute[];
  recommendedRoute: EvaluatedRoute;
  selectedRoute: EvaluatedRoute;
  primaryRoute: EvaluatedRoute;
  timeSavedVsPrimaryMinutes: number;
  timeSavedVsSelectedMinutes: number;
  shouldAlertForBypass: boolean;
}

export interface AlertRuleConfig {
  minDelayThresholdMinutes: number;
  notifyOnAccidents: boolean;
  notifyOnConstruction: boolean;
  autoSuggestBypass: boolean;
  soundAlertsEnabled: boolean;
  savedDepartureTime?: string;
  typicalTravelThresholdMinutes?: number;
  desktopPushEnabled?: boolean;
}

export interface IncidentReportInput {
  title: string;
  category: string;
  routeId: string;
  corridorZoneLabel: string;
  delayMinutes: string | number;
  lanesBlocked: string;
  description: string;
}

export interface RawRouteStepInput {
  instruction: string;
  distanceMeters: number;
  durationMillis: number;
}

/**
 * Validates user-selected origin and destination strings.
 */
export function validateRouteEndpoints(
  origin: string,
  destination: string
): { valid: boolean; error: string | null } {
  const cleanOrigin = origin.trim();
  const cleanDest = destination.trim();

  if (cleanOrigin.length < 2) {
    return {
      valid: false,
      error: 'Please enter or select a valid starting origin location.',
    };
  }
  if (cleanDest.length < 2) {
    return {
      valid: false,
      error: 'Please enter or select a valid destination location.',
    };
  }
  if (cleanOrigin.toLowerCase() === cleanDest.toLowerCase()) {
    return {
      valid: false,
      error: 'Origin and destination must be different locations.',
    };
  }
  return { valid: true, error: null };
}

/**
 * Computes additional congestion minutes caused by departure time offset.
 * Offset 0 = Live Now, 15 = +15m, 30 = +30m, 60 = Peak Hour Simulation
 */
export function getDepartureOffsetAdjustment(
  baseDurationMinutes: number,
  departureOffsetMinutes: number,
  isPrimaryRoute: boolean
): number {
  if (departureOffsetMinutes === 0) return 0;
  if (departureOffsetMinutes === 15) {
    return isPrimaryRoute
      ? Math.round(baseDurationMinutes * 0.08)
      : Math.round(baseDurationMinutes * 0.04);
  }
  if (departureOffsetMinutes === 30) {
    return isPrimaryRoute
      ? Math.round(baseDurationMinutes * 0.15)
      : Math.round(baseDurationMinutes * 0.07);
  }
  if (departureOffsetMinutes >= 60) {
    return isPrimaryRoute
      ? Math.round(baseDurationMinutes * 0.28)
      : Math.round(baseDurationMinutes * 0.12);
  }
  return 0;
}

/**
 * Evaluates a single route candidate against active (non-dismissed) incidents and departure offset.
 */
export function calculateEffectiveRouteMetrics(
  route: RouteCandidate,
  incidents: CorridorIncident[],
  departureOffsetMinutes = 0
): EvaluatedRoute {
  const activeRouteIncidents = incidents.filter(
    (inc) => !inc.dismissed && inc.routeId === route.id
  );

  const incidentDelayMinutes = activeRouteIncidents.reduce(
    (sum, inc) => sum + Math.max(0, inc.delayMinutes),
    0
  );

  const departureMultiplierMinutes = getDepartureOffsetAdjustment(
    route.baseDurationMinutes,
    departureOffsetMinutes,
    Boolean(route.isPrimaryDefault)
  );

  const effectiveDurationMinutes = Math.max(
    1,
    route.baseDurationMinutes + incidentDelayMinutes + departureMultiplierMinutes
  );

  const hours = effectiveDurationMinutes / 60;
  const averageSpeedKmh =
    hours > 0 ? Number((route.distanceKm / hours).toFixed(1)) : 0;

  const baseHours = Math.max(1, route.baseDurationMinutes) / 60;
  const freeFlowSpeedKmh =
    baseHours > 0 ? Number((route.distanceKm / baseHours).toFixed(1)) : 0;

  const delayRatio =
    (effectiveDurationMinutes - route.baseDurationMinutes) /
    Math.max(1, route.baseDurationMinutes);
  const congestionIndexPercent = Math.min(
    98,
    Math.max(5, Math.round(delayRatio * 100 + 18))
  );

  const accidentCount = activeRouteIncidents.filter(
    (i) => i.category === 'accident'
  ).length;
  const constructionCount = activeRouteIncidents.filter(
    (i) => i.category === 'construction'
  ).length;

  const totalExtraDelay = incidentDelayMinutes + departureMultiplierMinutes;
  let congestionStatus: CongestionLevel = 'nominal';
  if (totalExtraDelay >= 18 || accidentCount >= 2) {
    congestionStatus = 'severe';
  } else if (totalExtraDelay >= 10) {
    congestionStatus = 'heavy';
  } else if (totalExtraDelay >= 4) {
    congestionStatus = 'moderate';
  }

  return {
    ...route,
    incidentDelayMinutes,
    departureMultiplierMinutes,
    effectiveDurationMinutes,
    averageSpeedKmh,
    freeFlowSpeedKmh,
    congestionIndexPercent,
    activeIncidentCount: activeRouteIncidents.length,
    accidentCount,
    constructionCount,
    congestionStatus,
  };
}

/**
 * Strips HTML tags and extracts a clean road/maneuver label from a Google Maps step instruction.
 */
export function cleanStepInstruction(rawInstruction: string): string {
  return rawInstruction
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes real-time segment-by-segment traffic conditions (speed, congestion level, travel time)
 * dynamically from either live Google Maps Route steps or the selected origin/destination endpoints.
 */
export function computeCorridorSegmentTelemetry(
  selectedRoute: EvaluatedRoute,
  incidents: CorridorIncident[],
  isReversed = false,
  originName = 'Sompura Gate',
  destinationName = 'Zetwerk Bellandur Office',
  liveSteps: RawRouteStepInput[] = []
): CorridorSegmentTelemetry[] {
  const shortOrigin = originName.split(',')[0].trim() || 'Origin';
  const shortDest = destinationName.split(',')[0].trim() || 'Destination';

  const progressWindows: Array<[number, number]> = [
    [0.0, 0.28],
    [0.28, 0.60],
    [0.60, 0.82],
    [0.82, 1.0],
  ];

  // If live Google Maps Route steps are present (>= 4 steps), bucket them into 4 real route segments!
  let baseSegments: Array<{
    id: string;
    segmentName: string;
    fromCheckpoint: string;
    toCheckpoint: string;
    distanceRatio: number;
    progressRange: [number, number];
    baseMinutesRatio: number;
  }>;

  if (liveSteps.length >= 4) {
    const totalStepMeters = Math.max(
      1,
      liveSteps.reduce((acc, s) => acc + Math.max(50, s.distanceMeters || 0), 0)
    );
    const chunkSize = Math.ceil(liveSteps.length / 4);
    baseSegments = [0, 1, 2, 3].map((bucketIdx) => {
      const slice = liveSteps.slice(
        bucketIdx * chunkSize,
        bucketIdx === 3 ? liveSteps.length : (bucketIdx + 1) * chunkSize
      );
      const bucketMeters = slice.reduce(
        (acc, s) => acc + Math.max(50, s.distanceMeters || 0),
        0
      );
      const ratio = Math.max(0.12, bucketMeters / totalStepMeters);
      const firstInst = slice[0]
        ? cleanStepInstruction(slice[0].instruction)
        : `Section ${bucketIdx + 1}`;
      const lastInst = slice[slice.length - 1]
        ? cleanStepInstruction(slice[slice.length - 1].instruction)
        : `Checkpoint ${bucketIdx + 1}`;

      const segmentTitle =
        bucketIdx === 0
          ? `${shortOrigin} Departure – ${firstInst.slice(0, 42)}`
          : bucketIdx === 3
          ? `${firstInst.slice(0, 38)} – ${shortDest} Arrival`
          : `Corridor Stretch ${bucketIdx + 1}: ${firstInst.slice(0, 46)}`;

      return {
        id: `seg-live-${bucketIdx + 1}`,
        segmentName: segmentTitle,
        fromCheckpoint:
          bucketIdx === 0 ? shortOrigin : firstInst.slice(0, 36),
        toCheckpoint:
          bucketIdx === 3 ? shortDest : lastInst.slice(0, 36),
        distanceRatio: ratio,
        progressRange: progressWindows[bucketIdx],
        baseMinutesRatio: ratio,
      };
    });
  } else {
    const isDefaultSompuraBellandur =
      /sompura|sumpura/i.test(originName + destinationName) &&
      /bellandur|zetwerk/i.test(originName + destinationName);

    if (isDefaultSompuraBellandur) {
      const defaultTemplates = [
        {
          id: 'seg-1',
          segmentName: 'Sompura Gate – Dommasandra Stretch',
          fromCheckpoint: 'Sompura Gate Junction',
          toCheckpoint: 'Dommasandra Circle',
          distanceRatio: 0.24,
          progressRange: [0.0, 0.28] as [number, number],
          baseMinutesRatio: 0.22,
        },
        {
          id: 'seg-2',
          segmentName: 'Dommasandra – Kodathi & Carmelaram Approach',
          fromCheckpoint: 'Dommasandra Circle',
          toCheckpoint: 'Carmelaram Railway Overpass',
          distanceRatio: 0.31,
          progressRange: [0.28, 0.60] as [number, number],
          baseMinutesRatio: 0.32,
        },
        {
          id: 'seg-3',
          segmentName: 'Carmelaram – Kaikondrahalli & Wipro Gate Corridor',
          fromCheckpoint: 'Carmelaram Station Approach',
          toCheckpoint: 'Kaikondrahalli Junction',
          distanceRatio: 0.25,
          progressRange: [0.60, 0.82] as [number, number],
          baseMinutesRatio: 0.26,
        },
        {
          id: 'seg-4',
          segmentName: 'Bellandur Outer Ring Road Merge – Zetwerk Office',
          fromCheckpoint: 'Iblur / Bellandur Service Merge',
          toCheckpoint: 'Zetwerk Bellandur Office',
          distanceRatio: 0.20,
          progressRange: [0.82, 1.0] as [number, number],
          baseMinutesRatio: 0.20,
        },
      ];

      baseSegments = isReversed
        ? [...defaultTemplates].reverse().map((s, idx) => ({
            ...s,
            id: `seg-rev-${idx + 1}`,
            fromCheckpoint: s.toCheckpoint,
            toCheckpoint: s.fromCheckpoint,
          }))
        : defaultTemplates;
    } else {
      baseSegments = [
        {
          id: 'seg-custom-1',
          segmentName: `${shortOrigin} Departure & Initial Arterial`,
          fromCheckpoint: shortOrigin,
          toCheckpoint: '25% Corridor Checkpoint',
          distanceRatio: 0.24,
          progressRange: [0.0, 0.28],
          baseMinutesRatio: 0.22,
        },
        {
          id: 'seg-custom-2',
          segmentName: `Mid-Route Primary Crossing (${shortOrigin} → ${shortDest})`,
          fromCheckpoint: '25% Corridor Checkpoint',
          toCheckpoint: 'Mid-Corridor Interchange',
          distanceRatio: 0.31,
          progressRange: [0.28, 0.60],
          baseMinutesRatio: 0.32,
        },
        {
          id: 'seg-custom-3',
          segmentName: `Main Arterial Connector toward ${shortDest}`,
          fromCheckpoint: 'Mid-Corridor Interchange',
          toCheckpoint: '75% Approach Junction',
          distanceRatio: 0.25,
          progressRange: [0.60, 0.82],
          baseMinutesRatio: 0.26,
        },
        {
          id: 'seg-custom-4',
          segmentName: `${shortDest} Final Approach & Merge`,
          fromCheckpoint: '75% Approach Junction',
          toCheckpoint: shortDest,
          distanceRatio: 0.20,
          progressRange: [0.82, 1.0],
          baseMinutesRatio: 0.20,
        },
      ];
    }
  }

  const activeRouteIncidents = incidents.filter(
    (inc) => !inc.dismissed && inc.routeId === selectedRoute.id
  );

  return baseSegments.map((seg) => {
    const distanceKm = Number(
      Math.max(0.8, selectedRoute.distanceKm * seg.distanceRatio).toFixed(1)
    );
    const freeFlowMinutes = Math.max(
      3,
      Math.round(selectedRoute.baseDurationMinutes * seg.baseMinutesRatio)
    );

    const segIncidentDelay = activeRouteIncidents
      .filter(
        (inc) =>
          inc.routeProgressRatio >= seg.progressRange[0] &&
          inc.routeProgressRatio <= seg.progressRange[1]
      )
      .reduce((sum, inc) => sum + inc.delayMinutes, 0);

    const offsetShare = Math.round(
      selectedRoute.departureMultiplierMinutes * seg.baseMinutesRatio
    );

    const currentMinutes = Math.max(
      freeFlowMinutes,
      freeFlowMinutes + segIncidentDelay + offsetShare
    );

    const currentSpeedKmh = Number(
      ((distanceKm / Math.max(1, currentMinutes)) * 60).toFixed(1)
    );
    const freeFlowSpeedKmh = Number(
      ((distanceKm / Math.max(1, freeFlowMinutes)) * 60).toFixed(1)
    );

    const speedDropRatio =
      freeFlowSpeedKmh > 0
        ? Math.max(0, (freeFlowSpeedKmh - currentSpeedKmh) / freeFlowSpeedKmh)
        : 0;

    const congestionPercent = Math.min(
      96,
      Math.max(
        12,
        Math.round(speedDropRatio * 100 + (segIncidentDelay > 0 ? 22 : 14))
      )
    );

    let congestionLevel: CongestionLevel = 'nominal';
    let speedCategory: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM' = 'NORMAL';

    if (segIncidentDelay >= 10 || currentSpeedKmh < 14) {
      congestionLevel = 'severe';
      speedCategory = 'TRAFFIC_JAM';
    } else if (segIncidentDelay >= 5 || currentSpeedKmh < 20) {
      congestionLevel = 'heavy';
      speedCategory = 'TRAFFIC_JAM';
    } else if (segIncidentDelay >= 2 || currentSpeedKmh < 26) {
      congestionLevel = 'moderate';
      speedCategory = 'SLOW';
    }

    return {
      id: seg.id,
      segmentName: seg.segmentName,
      fromCheckpoint: seg.fromCheckpoint,
      toCheckpoint: seg.toCheckpoint,
      distanceKm,
      freeFlowMinutes,
      currentMinutes,
      currentSpeedKmh,
      freeFlowSpeedKmh,
      congestionPercent,
      congestionLevel,
      speedCategory,
    };
  });
}

/**
 * Compares all route options and computes time savings & bypass alert triggers.
 */
export function evaluateBestRouteAndSavings(
  routes: RouteCandidate[],
  incidents: CorridorIncident[],
  selectedRouteId: string,
  departureOffsetMinutes = 0,
  minDelayThresholdMinutes = 8
): RouteComparisonSummary {
  if (routes.length === 0) {
    throw new Error('At least one route candidate is required');
  }

  const evaluatedRoutes = routes.map((r) =>
    calculateEffectiveRouteMetrics(r, incidents, departureOffsetMinutes)
  );

  const sortedByFastest = [...evaluatedRoutes].sort(
    (a, b) => a.effectiveDurationMinutes - b.effectiveDurationMinutes
  );

  const recommendedRoute = sortedByFastest[0];
  const primaryRoute =
    evaluatedRoutes.find((r) => r.isPrimaryDefault) || evaluatedRoutes[0];
  const selectedRoute =
    evaluatedRoutes.find((r) => r.id === selectedRouteId) || primaryRoute;

  const timeSavedVsPrimaryMinutes = Math.max(
    0,
    primaryRoute.effectiveDurationMinutes -
      recommendedRoute.effectiveDurationMinutes
  );

  const timeSavedVsSelectedMinutes = Math.max(
    0,
    selectedRoute.effectiveDurationMinutes -
      recommendedRoute.effectiveDurationMinutes
  );

  const shouldAlertForBypass =
    recommendedRoute.id !== selectedRoute.id &&
    timeSavedVsSelectedMinutes >= minDelayThresholdMinutes;

  return {
    evaluatedRoutes,
    recommendedRoute,
    selectedRoute,
    primaryRoute,
    timeSavedVsPrimaryMinutes,
    timeSavedVsSelectedMinutes,
    shouldAlertForBypass,
  };
}

/**
 * Filters and sorts corridor incidents by category, severity, and search text.
 */
export function filterAndSortIncidents(
  incidents: CorridorIncident[],
  filter: 'all' | 'accident' | 'construction' | 'severe',
  searchQuery = '',
  includeDismissed = false
): CorridorIncident[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return incidents
    .filter((inc) => {
      if (!includeDismissed && inc.dismissed) return false;
      if (filter === 'accident' && inc.category !== 'accident') return false;
      if (filter === 'construction' && inc.category !== 'construction')
        return false;
      if (
        filter === 'severe' &&
        inc.delayMinutes < 10 &&
        inc.severity !== 'severe'
      ) {
        return false;
      }
      if (normalizedQuery.length > 0) {
        const haystack =
          `${inc.title} ${inc.corridorZoneLabel} ${inc.description} ${inc.lanesBlocked}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.acknowledged !== b.acknowledged) {
        return a.acknowledged ? 1 : -1;
      }
      if (b.delayMinutes !== a.delayMinutes) {
        return b.delayMinutes - a.delayMinutes;
      }
      return a.reportedMinutesAgo - b.reportedMinutesAgo;
    });
}

/**
 * Validates user input for reporting a new traffic jam, accident, or construction delay.
 */
export function validateIncidentReport(input: IncidentReportInput): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errMap: Record<string, string> = {};

  if (!input.title || input.title.trim().length < 4) {
    errMap.title = 'Enter a descriptive incident title (at least 4 characters).';
  }

  if (input.category !== 'accident' && input.category !== 'construction') {
    errMap.category = 'Select either Accident or Construction.';
  }

  if (!input.corridorZoneLabel || input.corridorZoneLabel.trim().length < 3) {
    errMap.corridorZoneLabel =
      'Specify the affected corridor checkpoint or segment.';
  }

  const parsedDelay = Number(input.delayMinutes);
  if (
    input.delayMinutes === '' ||
    Number.isNaN(parsedDelay) ||
    parsedDelay < 1 ||
    parsedDelay > 180
  ) {
    errMap.delayMinutes =
      'Enter an estimated delay between 1 and 180 minutes.';
  }

  if (!input.description || input.description.trim().length < 8) {
    errMap.description =
      'Provide a short situational note (at least 8 characters).';
  }

  return {
    valid: Object.keys(errMap).length === 0,
    errors: errMap,
  };
}

/**
 * Formats minutes into concise human-readable duration (e.g. "42 min" or "1 hr 12 min").
 */
export function formatDurationMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) {
    return `${rounded} min`;
  }
  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

export interface WeeklyCommuteTrendPoint {
  day: string;
  dayFull: string;
  isWeekend: boolean;
  freeFlowMinutes: number;
  avgTravelMinutes: number;
  accidentDelayMinutes: number;
  constructionDelayMinutes: number;
  totalDelayMinutes: number;
  avgSpeedKmh: number;
  congestionPercent: number;
  bypassSavedMinutes: number;
}

export interface HourlyDelayWindowPoint {
  windowLabel: string;
  displayHour: string;
  periodTag: 'Morning Peak' | 'Midday' | 'Evening Peak' | 'Off-Peak';
  expectedTravelMinutes: number;
  freeFlowMinutes: number;
  commonDelayMinutes: number;
  accidentRiskPercent: number;
  constructionImpactMinutes: number;
  avgSpeedKmh: number;
  severityLevel: CongestionLevel;
  recommendation: string;
}

export interface CommuteHistoryAnalytics {
  corridorTitle: string;
  shortOrigin: string;
  shortDestination: string;
  weeklyTrends: WeeklyCommuteTrendPoint[];
  hourlyDelayWindows: HourlyDelayWindowPoint[];
  worstCommuteDay: WeeklyCommuteTrendPoint;
  bestCommuteDay: WeeklyCommuteTrendPoint;
  peakDelayWindow: HourlyDelayWindowPoint;
  optimalDepartureWindow: HourlyDelayWindowPoint;
  weeklyAverageMinutes: number;
  weeklyTotalBypassSavingsMinutes: number;
}

/**
 * Generates deterministic, corridor-specific weekly traffic trends (Mon-Sun)
 * and common hourly delay windows (07:00-21:00) for the selected route and endpoints.
 */
export function computeCommuteHistoryAnalytics(
  selectedRoute: EvaluatedRoute,
  incidents: CorridorIncident[],
  originName = 'Sompura Gate',
  destinationName = 'Zetwerk Bellandur Office'
): CommuteHistoryAnalytics {
  const shortOrigin = originName.split(',')[0].trim() || 'Origin';
  const shortDestination =
    destinationName.split(',')[0].trim() || 'Destination';
  const corridorTitle = `${shortOrigin} → ${shortDestination}`;

  // Compute a deterministic hash from origin + destination so custom corridors have distinct signatures
  const seedStr = `${shortOrigin.toLowerCase()}__${shortDestination.toLowerCase()}__${selectedRoute.id}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) % 997;
  }
  const corridorVariance = (hash % 5) - 2; // -2 to +2 minutes subtle corridor offset

  const baseMins = Math.max(12, selectedRoute.baseDurationMinutes);
  const distKm = Math.max(3, selectedRoute.distanceKm);

  const activeIncidents = incidents.filter((inc) => !inc.dismissed);
  const routeAccidentDelay = activeIncidents
    .filter((inc) => inc.routeId === selectedRoute.id && inc.category === 'accident')
    .reduce((sum, inc) => sum + inc.delayMinutes, 0);
  const routeConstructionDelay = activeIncidents
    .filter(
      (inc) => inc.routeId === selectedRoute.id && inc.category === 'construction'
    )
    .reduce((sum, inc) => sum + inc.delayMinutes, 0);

  // Baseline daily profile multipliers for Bengaluru IT corridors
  const dayProfiles: Array<{
    day: string;
    dayFull: string;
    isWeekend: boolean;
    congestionFactor: number;
    accWeight: number;
    constWeight: number;
  }> = [
    {
      day: 'Mon',
      dayFull: 'Monday',
      isWeekend: false,
      congestionFactor: 0.88,
      accWeight: 0.78,
      constWeight: 0.95,
    },
    {
      day: 'Tue',
      dayFull: 'Tuesday',
      isWeekend: false,
      congestionFactor: 1.04,
      accWeight: 0.92,
      constWeight: 1.0,
    },
    {
      day: 'Wed',
      dayFull: 'Wednesday',
      isWeekend: false,
      congestionFactor: 1.15,
      accWeight: 1.12,
      constWeight: 1.05,
    },
    {
      day: 'Thu',
      dayFull: 'Thursday',
      isWeekend: false,
      congestionFactor: 1.08,
      accWeight: 1.0,
      constWeight: 1.0,
    },
    {
      day: 'Fri',
      dayFull: 'Friday',
      isWeekend: false,
      congestionFactor: 0.96,
      accWeight: 0.94,
      constWeight: 0.9,
    },
    {
      day: 'Sat',
      dayFull: 'Saturday',
      isWeekend: true,
      congestionFactor: 0.48,
      accWeight: 0.42,
      constWeight: 0.75,
    },
    {
      day: 'Sun',
      dayFull: 'Sunday',
      isWeekend: true,
      congestionFactor: 0.28,
      accWeight: 0.25,
      constWeight: 0.55,
    },
  ];

  const baseAccAnchor = Math.max(4, routeAccidentDelay || 8);
  const baseConstAnchor = Math.max(3, routeConstructionDelay || 6);

  const weeklyTrends: WeeklyCommuteTrendPoint[] = dayProfiles.map((prof, idx) => {
    const dayShift = ((hash + idx * 7) % 3) - 1;
    const accidentDelayMinutes = Math.max(
      1,
      Math.round(baseAccAnchor * prof.accWeight + dayShift)
    );
    const constructionDelayMinutes = Math.max(
      1,
      Math.round(baseConstAnchor * prof.constWeight + Math.max(0, corridorVariance))
    );
    const totalDelayMinutes = accidentDelayMinutes + constructionDelayMinutes;
    const avgTravelMinutes = Math.max(
      baseMins + 2,
      baseMins + totalDelayMinutes
    );
    const avgSpeedKmh = Number(
      (distKm / (avgTravelMinutes / 60)).toFixed(1)
    );
    const congestionPercent = Math.min(
      96,
      Math.max(
        12,
        Math.round((totalDelayMinutes / Math.max(10, baseMins)) * 100 + 16)
      )
    );
    const bypassSavedMinutes = Math.max(
      2,
      Math.round(totalDelayMinutes * (prof.isWeekend ? 0.35 : 0.58))
    );

    return {
      day: prof.day,
      dayFull: prof.dayFull,
      isWeekend: prof.isWeekend,
      freeFlowMinutes: baseMins,
      avgTravelMinutes,
      accidentDelayMinutes,
      constructionDelayMinutes,
      totalDelayMinutes,
      avgSpeedKmh,
      congestionPercent,
      bypassSavedMinutes,
    };
  });

  // 10 departure windows throughout the day showing common delay times
  const windowProfiles: Array<{
    windowLabel: string;
    displayHour: string;
    periodTag: 'Morning Peak' | 'Midday' | 'Evening Peak' | 'Off-Peak';
    delayFactor: number;
    accidentRiskBase: number;
  }> = [
    {
      windowLabel: '07:00',
      displayHour: '7:00 AM',
      periodTag: 'Off-Peak',
      delayFactor: 0.22,
      accidentRiskBase: 14,
    },
    {
      windowLabel: '08:00',
      displayHour: '8:00 AM',
      periodTag: 'Morning Peak',
      delayFactor: 0.68,
      accidentRiskBase: 38,
    },
    {
      windowLabel: '09:00',
      displayHour: '9:00 AM',
      periodTag: 'Morning Peak',
      delayFactor: 1.18,
      accidentRiskBase: 64,
    },
    {
      windowLabel: '10:00',
      displayHour: '10:00 AM',
      periodTag: 'Morning Peak',
      delayFactor: 0.94,
      accidentRiskBase: 52,
    },
    {
      windowLabel: '12:00',
      displayHour: '12:00 PM',
      periodTag: 'Midday',
      delayFactor: 0.44,
      accidentRiskBase: 26,
    },
    {
      windowLabel: '15:00',
      displayHour: '3:00 PM',
      periodTag: 'Midday',
      delayFactor: 0.52,
      accidentRiskBase: 31,
    },
    {
      windowLabel: '17:00',
      displayHour: '5:00 PM',
      periodTag: 'Evening Peak',
      delayFactor: 0.86,
      accidentRiskBase: 48,
    },
    {
      windowLabel: '18:00',
      displayHour: '6:00 PM',
      periodTag: 'Evening Peak',
      delayFactor: 1.24,
      accidentRiskBase: 68,
    },
    {
      windowLabel: '19:00',
      displayHour: '7:00 PM',
      periodTag: 'Evening Peak',
      delayFactor: 1.02,
      accidentRiskBase: 55,
    },
    {
      windowLabel: '21:00',
      displayHour: '9:00 PM',
      periodTag: 'Off-Peak',
      delayFactor: 0.3,
      accidentRiskBase: 19,
    },
  ];

  const combinedAnchorDelay = Math.max(10, baseAccAnchor + baseConstAnchor);

  const hourlyDelayWindows: HourlyDelayWindowPoint[] = windowProfiles.map(
    (win, idx) => {
      const slotVariance = ((hash + idx * 5) % 3) - 1;
      const commonDelayMinutes = Math.max(
        2,
        Math.round(combinedAnchorDelay * win.delayFactor + slotVariance)
      );
      const constructionImpactMinutes = Math.max(
        1,
        Math.round(baseConstAnchor * (win.periodTag === 'Off-Peak' ? 0.5 : 0.85))
      );
      const expectedTravelMinutes = baseMins + commonDelayMinutes;
      const avgSpeedKmh = Number(
        (distKm / (expectedTravelMinutes / 60)).toFixed(1)
      );
      const accidentRiskPercent = Math.min(
        92,
        Math.max(
          8,
          Math.round(win.accidentRiskBase + (routeAccidentDelay > 10 ? 8 : 0))
        )
      );

      let severityLevel: CongestionLevel = 'nominal';
      if (commonDelayMinutes >= 18) {
        severityLevel = 'severe';
      } else if (commonDelayMinutes >= 12) {
        severityLevel = 'heavy';
      } else if (commonDelayMinutes >= 6) {
        severityLevel = 'moderate';
      }

      let recommendation = 'Clear corridor window; direct route is optimal.';
      if (severityLevel === 'severe') {
        recommendation = `High bottleneck risk near ${shortDestination} approach; depart 25m earlier or use bypass.`;
      } else if (severityLevel === 'heavy') {
        recommendation = `Active merge queues building; monitor ${shortOrigin} arterial alerts.`;
      } else if (severityLevel === 'moderate') {
        recommendation = 'Steady arterial flow with minor construction slowdowns.';
      }

      return {
        windowLabel: win.windowLabel,
        displayHour: win.displayHour,
        periodTag: win.periodTag,
        expectedTravelMinutes,
        freeFlowMinutes: baseMins,
        commonDelayMinutes,
        accidentRiskPercent,
        constructionImpactMinutes,
        avgSpeedKmh,
        severityLevel,
        recommendation,
      };
    }
  );

  const weekdayTrends = weeklyTrends.filter((d) => !d.isWeekend);
  const worstCommuteDay = [...weekdayTrends].sort(
    (a, b) => b.avgTravelMinutes - a.avgTravelMinutes
  )[0];
  const bestCommuteDay = [...weekdayTrends].sort(
    (a, b) => a.avgTravelMinutes - b.avgTravelMinutes
  )[0];

  const peakDelayWindow = [...hourlyDelayWindows].sort(
    (a, b) => b.commonDelayMinutes - a.commonDelayMinutes
  )[0];
  const optimalDepartureWindow = [...hourlyDelayWindows].sort(
    (a, b) => a.commonDelayMinutes - b.commonDelayMinutes
  )[0];

  const weeklyAverageMinutes = Math.round(
    weekdayTrends.reduce((sum, d) => sum + d.avgTravelMinutes, 0) /
      Math.max(1, weekdayTrends.length)
  );
  const weeklyTotalBypassSavingsMinutes = weekdayTrends.reduce(
    (sum, d) => sum + d.bypassSavedMinutes,
    0
  );

  return {
    corridorTitle,
    shortOrigin,
    shortDestination,
    weeklyTrends,
    hourlyDelayWindows,
    worstCommuteDay,
    bestCommuteDay,
    peakDelayWindow,
    optimalDepartureWindow,
    weeklyAverageMinutes,
    weeklyTotalBypassSavingsMinutes,
  };
}

export interface DepartureThresholdPushPayload {
  shouldTriggerPush: boolean;
  estimatedTravelMinutes: number;
  typicalThresholdMinutes: number;
  excessMinutes: number;
  savedDepartureTime: string;
  corridorLabel: string;
  title: string;
  body: string;
  actionSuggestion: string;
  canSwitchBypass: boolean;
  bypassRouteId: string;
  bypassRouteLabel: string;
  bypassSavingsMinutes: number;
  severity: 'nominal' | 'warning' | 'critical';
}

/**
 * Computes the typical expected travel time threshold (in minutes) for a user's saved departure time
 * based on the route's free-flow baseline duration.
 */
export function getTypicalThresholdForSavedDeparture(
  baseDurationMinutes: number,
  savedDepartureTime: string
): number {
  const cleanBase = Math.max(10, Math.round(baseDurationMinutes));
  const normalized = savedDepartureTime.trim().toUpperCase();

  if (normalized.includes('07:00') || normalized.includes('7:00') || normalized.includes('07:30') || normalized.includes('7:30')) {
    return cleanBase + 5;
  }
  if (normalized.includes('08:00') || normalized.includes('8:00')) {
    return cleanBase + 8;
  }
  if (normalized.includes('08:30') || normalized.includes('8:30')) {
    return cleanBase + 10;
  }
  if (normalized.includes('09:00') || normalized.includes('9:00')) {
    return cleanBase + 12;
  }
  if (normalized.includes('09:30') || normalized.includes('9:30')) {
    return cleanBase + 11;
  }
  if (normalized.includes('18:00') || normalized.includes('6:00 PM')) {
    return cleanBase + 12;
  }
  return cleanBase + 10;
}

/**
 * Evaluates whether the current 'Estimated Travel Time' exceeds the typical threshold
 * for the user's saved departure time and constructs a Web Push / Desktop Notification payload.
 */
export function evaluateDepartureThresholdPush(
  selectedRoute: EvaluatedRoute,
  recommendedRoute: EvaluatedRoute,
  savedDepartureTime = '08:30 AM',
  typicalThresholdMinutes?: number,
  originName = 'Sompura Gate',
  destinationName = 'Zetwerk Bellandur Office'
): DepartureThresholdPushPayload {
  const shortOrigin = originName.split(',')[0].trim() || 'Origin';
  const shortDest = destinationName.split(',')[0].trim() || 'Destination';
  const corridorLabel = `${shortOrigin} → ${shortDest}`;

  const resolvedThreshold =
    typeof typicalThresholdMinutes === 'number' && typicalThresholdMinutes > 0
      ? Math.round(typicalThresholdMinutes)
      : getTypicalThresholdForSavedDeparture(
          selectedRoute.baseDurationMinutes,
          savedDepartureTime
        );

  const estimatedTravelMinutes = Math.round(
    selectedRoute.effectiveDurationMinutes
  );
  const excessMinutes = Math.max(
    0,
    estimatedTravelMinutes - resolvedThreshold
  );
  const shouldTriggerPush = estimatedTravelMinutes > resolvedThreshold;

  const bypassSavingsMinutes = Math.max(
    0,
    selectedRoute.effectiveDurationMinutes -
      recommendedRoute.effectiveDurationMinutes
  );
  const canSwitchBypass =
    recommendedRoute.id !== selectedRoute.id && bypassSavingsMinutes > 0;

  let severity: 'nominal' | 'warning' | 'critical' = 'nominal';
  if (excessMinutes >= 10) {
    severity = 'critical';
  } else if (excessMinutes > 0) {
    severity = 'warning';
  }

  const title = shouldTriggerPush
    ? `Travel Time Exceeds ${savedDepartureTime} Threshold (+${excessMinutes} min)`
    : `Within ${savedDepartureTime} Commute Threshold (${formatDurationMinutes(estimatedTravelMinutes)})`;

  const body = shouldTriggerPush
    ? `Estimated Travel Time for ${corridorLabel} is ${formatDurationMinutes(
        estimatedTravelMinutes
      )}, exceeding your typical ${savedDepartureTime} threshold of ${formatDurationMinutes(
        resolvedThreshold
      )} due to ${selectedRoute.accidentCount} accident and ${
        selectedRoute.constructionCount
      } construction delay(s).`
    : `Estimated Travel Time for ${corridorLabel} is ${formatDurationMinutes(
        estimatedTravelMinutes
      )}, which is within your ${savedDepartureTime} threshold of ${formatDurationMinutes(
        resolvedThreshold
      )}.`;

  const actionSuggestion = canSwitchBypass
    ? `Switch to ${recommendedRoute.label} now to save ${bypassSavingsMinutes} min (ETA ${formatDurationMinutes(
        recommendedRoute.effectiveDurationMinutes
      )}).`
    : `Currently on fastest available route (${selectedRoute.label}).`;

  return {
    shouldTriggerPush,
    estimatedTravelMinutes,
    typicalThresholdMinutes: resolvedThreshold,
    excessMinutes,
    savedDepartureTime,
    corridorLabel,
    title,
    body,
    actionSuggestion,
    canSwitchBypass,
    bypassRouteId: recommendedRoute.id,
    bypassRouteLabel: recommendedRoute.label,
    bypassSavingsMinutes,
    severity,
  };
}

export interface RouteCongestionHeatmapSegment {
  id: string;
  points: Array<{ lat: number; lng: number }>;
  strokeColor: string;
  speedBand: 'FAST' | 'MODERATE' | 'SLOW' | 'SEVERE_JAM';
  label: string;
  startRatio: number;
  endRatio: number;
}

/**
 * Slices a route path into contiguous heatmap segments colored by real-time traffic speed bands
 * and proximity to active accident / construction bottlenecks.
 */
export function buildRouteCongestionHeatmapSegments(
  routePoints: Array<{ lat: number; lng: number }>,
  incidents: CorridorIncident[],
  selectedRouteId: string
): RouteCongestionHeatmapSegment[] {
  if (!routePoints || routePoints.length < 2) {
    return [];
  }

  const activeRouteIncidents = incidents.filter(
    (inc) => !inc.dismissed && inc.routeId === selectedRouteId
  );

  // Partition route into up to 12 smooth contiguous segments (or fewer if path has fewer vertices)
  const bucketCount = Math.min(12, Math.max(1, routePoints.length - 1));
  const rawSegments: RouteCongestionHeatmapSegment[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const startIdx = Math.floor((i * (routePoints.length - 1)) / bucketCount);
    const endIdx = Math.max(
      startIdx + 1,
      Math.floor(((i + 1) * (routePoints.length - 1)) / bucketCount)
    );
    const segmentPoints = routePoints.slice(startIdx, endIdx + 1);
    if (segmentPoints.length < 2) continue;

    const startRatio = Number((i / bucketCount).toFixed(2));
    const endRatio = Number(((i + 1) / bucketCount).toFixed(2));
    const midRatio = (startRatio + endRatio) / 2;

    // Evaluate congestion intensity at midRatio based on active incidents and natural arterial flow
    let intensityScore = 0;
    // Slight natural mid-corridor junction slowdown (ratios 0.30 to 0.75)
    if (midRatio >= 0.3 && midRatio <= 0.75) {
      intensityScore += 18;
    }

    for (const inc of activeRouteIncidents) {
      const distanceToIncident = Math.abs(midRatio - inc.routeProgressRatio);
      if (distanceToIncident <= 0.09) {
        intensityScore +=
          inc.category === 'accident'
            ? inc.delayMinutes * 5.2
            : inc.delayMinutes * 4.2;
      } else if (distanceToIncident <= 0.18) {
        intensityScore += inc.delayMinutes * 2.4;
      }
    }

    let speedBand: 'FAST' | 'MODERATE' | 'SLOW' | 'SEVERE_JAM' = 'FAST';
    let strokeColor = '#10B981'; // Emerald-500 (Fast / Free-flow)
    let label = 'Fast Flow (>24 km/h)';

    if (intensityScore >= 52) {
      speedBand = 'SEVERE_JAM';
      strokeColor = '#991B1B'; // Red-800 (Severe Jam / Standstill)
      label = 'Severe Jam (<10 km/h)';
    } else if (intensityScore >= 30) {
      speedBand = 'SLOW';
      strokeColor = '#EF4444'; // Red-500 (Heavy Congestion)
      label = 'Slow / Heavy (10–15 km/h)';
    } else if (intensityScore >= 15) {
      speedBand = 'MODERATE';
      strokeColor = '#F59E0B'; // Amber-500 (Moderate Slowdown)
      label = 'Moderate Slowdown (15–24 km/h)';
    }

    rawSegments.push({
      id: `heat-seg-${i}`,
      points: segmentPoints,
      strokeColor,
      speedBand,
      label,
      startRatio,
      endRatio,
    });
  }

  return rawSegments;
}

export interface CorridorWeatherRawData {
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPercent: number;
  precipitationMm: number;
  rainMm: number;
  precipProbabilityPercent: number;
  windSpeedKmh: number;
  visibilityKm: number;
  weatherCode: number;
  fetchedAtLabel: string;
  sourceLabel: string;
}

export interface WeatherTrafficAdvisory {
  id: string;
  conditionLabel: string;
  severity: CongestionLevel;
  extraDelayMinutes: number;
  speedReductionPercent: number;
  alertTitle: string;
  alertDescription: string;
  affectedCheckpointLabel: string;
  isRainSlowdownActive: boolean;
  routeProgressRatio: number;
}

/**
 * Evaluates live or simulated local weather data and computes weather-related
 * traffic slowdown advisories (e.g. rain-induced slowdowns, waterlogging, low visibility).
 */
export function evaluateWeatherTrafficImpact(
  weather: CorridorWeatherRawData,
  originName = 'Sompura Gate',
  destinationName = 'Zetwerk Bellandur Office',
  baseDurationMinutes = 36
): WeatherTrafficAdvisory {
  const shortOrigin = originName.split(',')[0].trim() || 'Origin';
  const shortDest = destinationName.split(',')[0].trim() || 'Destination';
  const cleanBase = Math.max(12, Math.round(baseDurationMinutes));

  const code = weather.weatherCode;
  const precip = Math.max(weather.precipitationMm || 0, weather.rainMm || 0);
  const prob = weather.precipProbabilityPercent || 0;
  const visKm = weather.visibilityKm ?? 10;

  // Heavy rain / thunderstorm / downpour
  if (code >= 63 || precip >= 4.0) {
    const extraDelayMinutes = Math.max(8, Math.round(cleanBase * 0.25));
    return {
      id: 'weather-heavy-rain',
      conditionLabel:
        code >= 95 ? 'Thunderstorm & Heavy Downpour' : 'Heavy Rain & Waterlogging Risk',
      severity: 'severe',
      extraDelayMinutes,
      speedReductionPercent: 28,
      alertTitle: `Rain-Related Traffic Slowdown (+${extraDelayMinutes} min)`,
      alertDescription: `Heavy precipitation (${precip.toFixed(
        1
      )} mm/h) causing surface waterlogging and 28% speed reduction between ${shortOrigin} and ${shortDest}.`,
      affectedCheckpointLabel: `${shortOrigin} Underpass & ${shortDest} Service Road Approach`,
      isRainSlowdownActive: true,
      routeProgressRatio: 0.52,
    };
  }

  // Moderate / light rain or high rain probability
  if (
    (code >= 51 && code <= 62) ||
    (code >= 80 && code <= 82) ||
    precip >= 0.4 ||
    prob >= 65
  ) {
    const extraDelayMinutes = Math.max(4, Math.round(cleanBase * 0.14));
    return {
      id: 'weather-light-rain',
      conditionLabel: 'Light Rain · Wet Pavement',
      severity: 'heavy',
      extraDelayMinutes,
      speedReductionPercent: 16,
      alertTitle: `Wet Pavement & Rain Slowdown (+${extraDelayMinutes} min)`,
      alertDescription: `Active rain showers (${precip.toFixed(
        1
      )} mm/h · ${prob}% probability) reducing braking traction and slowing arterial flow by 16% toward ${shortDest}.`,
      affectedCheckpointLabel: `Mid-Corridor Arterial & ${shortDest} Flyover Merge`,
      isRainSlowdownActive: true,
      routeProgressRatio: 0.52,
    };
  }

  // Fog / mist / low visibility
  if ((code >= 45 && code <= 48) || visKm < 3.5) {
    const extraDelayMinutes = Math.max(3, Math.round(cleanBase * 0.09));
    return {
      id: 'weather-low-visibility',
      conditionLabel: 'Mist / Reduced Visibility',
      severity: 'moderate',
      extraDelayMinutes,
      speedReductionPercent: 10,
      alertTitle: `Reduced Visibility Slowdown (+${extraDelayMinutes} min)`,
      alertDescription: `Corridor visibility at ${visKm.toFixed(
        1
      )} km; commuters maintaining wider headway distances along ${shortOrigin} → ${shortDest}.`,
      affectedCheckpointLabel: `${shortOrigin} Arterial Stretch`,
      isRainSlowdownActive: true,
      routeProgressRatio: 0.52,
    };
  }

  // Clear / Partly Cloudy / Dry Roadway
  return {
    id: 'weather-clear',
    conditionLabel:
      code === 0
        ? 'Clear Sky · Dry Roadway'
        : code <= 3
        ? 'Partly Cloudy · Dry Roadway'
        : 'Dry Commute Conditions',
    severity: 'nominal',
    extraDelayMinutes: 0,
    speedReductionPercent: 0,
    alertTitle: 'No Weather-Related Traffic Delays',
    alertDescription: `Dry road surface (${weather.temperatureC.toFixed(
      1
    )}°C, visibility ${visKm.toFixed(
      1
    )} km) with normal braking traction across ${shortOrigin} → ${shortDest}.`,
    affectedCheckpointLabel: `${shortOrigin} → ${shortDest}`,
    isRainSlowdownActive: false,
    routeProgressRatio: 0.52,
  };
}

export interface ActiveCommuteSessionInput {
  progressRatio: number; // 0.0 to 1.0
  originalEstimatedMinutes: number;
  elapsedActualMinutes: number;
  selectedRoute: EvaluatedRoute;
  segments: CorridorSegmentTelemetry[];
}

export interface CommuteLandmarkPrediction {
  id: string;
  name: string;
  segmentLabel: string;
  progressRatio: number;
  progressPercent: number;
  cumulativeDistanceKm: number;
  distanceRemainingKm: number;
  cumulativeEstimatedMinutes: number;
  remainingMinutes: number;
  status: 'passed' | 'approaching' | 'upcoming';
  congestionLevel: CongestionLevel;
  speedKmh: number;
}

export interface CommuteTelemetrySnapshot {
  progressPercent: number;
  distanceCoveredKm: number;
  distanceRemainingKm: number;
  currentSegmentName: string;
  currentCheckpointLabel: string;
  currentSegmentSpeedKmh: number;
  elapsedActualMinutes: number;
  expectedElapsedAtProgressMinutes: number;
  remainingMinutes: number;
  projectedTotalActualMinutes: number;
  originalEstimatedMinutes: number;
  deviationMinutes: number;
  paceDeltaMinutes: number;
  deviationStatus: 'ahead' | 'on_time' | 'behind';
  deviationLabel: string;
  isCompleted: boolean;
  landmarks: CommuteLandmarkPrediction[];
}

/**
 * Tracks a user's progress along the selected route and calculates actual travel time
 * versus the original estimate, returning real-time deviation telemetry and landmark ETA predictions.
 */
export function computeActiveCommuteTelemetry(
  input: ActiveCommuteSessionInput
): CommuteTelemetrySnapshot {
  const clampedRatio = Math.min(1, Math.max(0, input.progressRatio));
  const progressPercent = Math.round(clampedRatio * 100);
  const totalDistanceKm = Math.max(0.5, input.selectedRoute.distanceKm);

  const distanceCoveredKm = Number(
    (totalDistanceKm * clampedRatio).toFixed(1)
  );
  const distanceRemainingKm = Number(
    Math.max(0, totalDistanceKm - distanceCoveredKm).toFixed(1)
  );

  // Determine which corridor segment the commuter is currently traversing
  const segCount = input.segments.length;
  const activeSegIndex =
    segCount > 0
      ? Math.min(segCount - 1, Math.floor(clampedRatio * segCount))
      : 0;
  const activeSeg = input.segments[activeSegIndex];

  const currentSegmentName =
    activeSeg?.segmentName || input.selectedRoute.label;
  const currentCheckpointLabel = activeSeg
    ? `${activeSeg.fromCheckpoint} → ${activeSeg.toCheckpoint}`
    : input.selectedRoute.summaryTag;
  const currentSegmentSpeedKmh =
    activeSeg?.currentSpeedKmh || input.selectedRoute.averageSpeedKmh;

  const originalEstimatedMinutes = Math.max(
    1,
    Math.round(input.originalEstimatedMinutes)
  );
  const elapsedActualMinutes = Number(
    Math.max(0, input.elapsedActualMinutes).toFixed(1)
  );

  const expectedElapsedAtProgressMinutes = Number(
    (originalEstimatedMinutes * clampedRatio).toFixed(1)
  );
  const paceDeltaMinutes = Number(
    (elapsedActualMinutes - expectedElapsedAtProgressMinutes).toFixed(1)
  );

  // Remaining minutes based on the active route's current effective duration for the remaining fraction
  const remainingMinutes = Number(
    Math.max(
      0,
      input.selectedRoute.effectiveDurationMinutes * (1 - clampedRatio)
    ).toFixed(1)
  );

  const projectedTotalActualMinutes = Number(
    (elapsedActualMinutes + remainingMinutes).toFixed(1)
  );

  const deviationMinutes = Number(
    (projectedTotalActualMinutes - originalEstimatedMinutes).toFixed(1)
  );

  let deviationStatus: 'ahead' | 'on_time' | 'behind' = 'on_time';
  let deviationLabel = 'On schedule (0.0 min deviation)';

  if (deviationMinutes >= 0.8) {
    deviationStatus = 'behind';
    deviationLabel = `+${deviationMinutes.toFixed(1)} min slower than estimate`;
  } else if (deviationMinutes <= -0.8) {
    deviationStatus = 'ahead';
    deviationLabel = `${deviationMinutes.toFixed(1)} min faster than estimate`;
  }

  // Build major landmark predictions along the selected route from segment checkpoints
  const rawSegments: CorridorSegmentTelemetry[] =
    input.segments.length > 0
      ? input.segments
      : [
          {
            id: 'fallback-seg-1',
            segmentName: input.selectedRoute.label,
            fromCheckpoint: 'Origin Departure',
            toCheckpoint: 'Mid-Corridor Crossing',
            distanceKm: Number((totalDistanceKm * 0.5).toFixed(1)),
            freeFlowMinutes: Math.round(
              input.selectedRoute.baseDurationMinutes * 0.5
            ),
            currentMinutes: Math.round(
              input.selectedRoute.effectiveDurationMinutes * 0.5
            ),
            currentSpeedKmh: input.selectedRoute.averageSpeedKmh,
            freeFlowSpeedKmh: input.selectedRoute.freeFlowSpeedKmh,
            congestionLevel: input.selectedRoute.congestionStatus,
            congestionPercent: input.selectedRoute.congestionIndexPercent,
            speedCategory: 'NORMAL',
          },
          {
            id: 'fallback-seg-2',
            segmentName: input.selectedRoute.label,
            fromCheckpoint: 'Mid-Corridor Crossing',
            toCheckpoint: 'Destination Arrival',
            distanceKm: Number((totalDistanceKm * 0.5).toFixed(1)),
            freeFlowMinutes: Math.round(
              input.selectedRoute.baseDurationMinutes * 0.5
            ),
            currentMinutes: Math.round(
              input.selectedRoute.effectiveDurationMinutes * 0.5
            ),
            currentSpeedKmh: input.selectedRoute.averageSpeedKmh,
            freeFlowSpeedKmh: input.selectedRoute.freeFlowSpeedKmh,
            congestionLevel: input.selectedRoute.congestionStatus,
            congestionPercent: input.selectedRoute.congestionIndexPercent,
            speedCategory: 'NORMAL',
          },
        ];

  const totalSegDist = Math.max(
    0.5,
    rawSegments.reduce((sum, s) => sum + s.distanceKm, 0)
  );
  const totalSegMins = Math.max(
    1,
    rawSegments.reduce((sum, s) => sum + s.currentMinutes, 0)
  );

  const landmarks: CommuteLandmarkPrediction[] = [];
  let foundApproaching = false;

  // Origin landmark (0%)
  landmarks.push({
    id: 'landmark-origin',
    name: rawSegments[0].fromCheckpoint,
    segmentLabel: 'Origin Departure',
    progressRatio: 0,
    progressPercent: 0,
    cumulativeDistanceKm: 0,
    distanceRemainingKm: 0,
    cumulativeEstimatedMinutes: 0,
    remainingMinutes: 0,
    status: 'passed',
    congestionLevel: rawSegments[0].congestionLevel,
    speedKmh: rawSegments[0].currentSpeedKmh,
  });

  let runningDist = 0;
  let runningMins = 0;

  rawSegments.forEach((seg, idx) => {
    runningDist += seg.distanceKm;
    runningMins += seg.currentMinutes;
    const isLast = idx === rawSegments.length - 1;
    const nodeRatio = isLast
      ? 1
      : Number(Math.min(0.96, runningDist / totalSegDist).toFixed(2));
    const nodePercent = Math.round(nodeRatio * 100);
    const cumDistKm = Number((totalDistanceKm * nodeRatio).toFixed(1));
    const cumEstMins = Number(
      (
        (runningMins / totalSegMins) *
        input.selectedRoute.effectiveDurationMinutes
      ).toFixed(1)
    );

    const isPassed = clampedRatio >= nodeRatio - 0.005;
    let status: 'passed' | 'approaching' | 'upcoming' = 'upcoming';
    if (isPassed) {
      status = 'passed';
    } else if (!foundApproaching) {
      status = 'approaching';
      foundApproaching = true;
    }

    const remDistKm = isPassed
      ? 0
      : Number(Math.max(0.1, totalDistanceKm * (nodeRatio - clampedRatio)).toFixed(1));
    const remMins = isPassed
      ? 0
      : Number(
          Math.max(
            0.2,
            input.selectedRoute.effectiveDurationMinutes *
              (nodeRatio - clampedRatio)
          ).toFixed(1)
        );

    landmarks.push({
      id: `landmark-${idx + 1}`,
      name: seg.toCheckpoint,
      segmentLabel: seg.segmentName,
      progressRatio: nodeRatio,
      progressPercent: nodePercent,
      cumulativeDistanceKm: cumDistKm,
      distanceRemainingKm: remDistKm,
      cumulativeEstimatedMinutes: cumEstMins,
      remainingMinutes: remMins,
      status,
      congestionLevel: seg.congestionLevel,
      speedKmh: seg.currentSpeedKmh,
    });
  });

  return {
    progressPercent,
    distanceCoveredKm,
    distanceRemainingKm,
    currentSegmentName,
    currentCheckpointLabel,
    currentSegmentSpeedKmh,
    elapsedActualMinutes,
    expectedElapsedAtProgressMinutes,
    remainingMinutes,
    projectedTotalActualMinutes,
    originalEstimatedMinutes,
    deviationMinutes,
    paceDeltaMinutes,
    deviationStatus,
    deviationLabel,
    isCompleted: clampedRatio >= 0.999,
    landmarks,
  };
}

export interface RouteFuelAndCostEstimate {
  distanceKm: number;
  baseEfficiencyKmPerLiter: number;
  effectiveEfficiencyKmPerLiter: number;
  freeFlowFuelLiters: number;
  estimatedFuelLiters: number;
  congestionFuelPenaltyLiters: number;
  fuelPricePerLiterInr: number;
  freeFlowTripCostInr: number;
  estimatedTripCostInr: number;
  extraCongestionCostInr: number;
  formattedFuelLiters: string;
  formattedTripCost: string;
}

/**
 * Estimates fuel consumption (in Liters) and trip cost (in INR) for a selected route
 * based on route distance, average vehicle efficiency (km/L), and live traffic congestion idling.
 */
export function calculateRouteFuelAndCost(
  selectedRoute: Pick<
    EvaluatedRoute,
    'distanceKm' | 'incidentDelayMinutes' | 'congestionIndexPercent'
  >,
  averageEfficiencyKmPerLiter = 14.5,
  fuelPricePerLiterInr = 102.86
): RouteFuelAndCostEstimate {
  const distanceKm = Math.max(0.5, Number(selectedRoute.distanceKm.toFixed(1)));
  const baseEfficiencyKmPerLiter = Math.max(
    2,
    Number(averageEfficiencyKmPerLiter.toFixed(1))
  );
  const cleanFuelPrice = Math.max(1, Number(fuelPricePerLiterInr.toFixed(2)));

  // Base free-flow fuel required strictly from distance and average vehicle efficiency
  const freeFlowFuelLiters = Number(
    (distanceKm / baseEfficiencyKmPerLiter).toFixed(2)
  );

  // Stop-and-go congestion reduces real-world efficiency by up to 22% plus idling burn (~0.012 L per delay minute)
  const congestionDragRatio =
    Math.min(95, Math.max(0, selectedRoute.congestionIndexPercent)) * 0.0018;
  const effectiveEfficiencyKmPerLiter = Number(
    Math.max(
      1.5,
      baseEfficiencyKmPerLiter * (1 - congestionDragRatio)
    ).toFixed(1)
  );

  const drivingFuelLiters = distanceKm / effectiveEfficiencyKmPerLiter;
  const idlingPenaltyLiters =
    Math.max(0, selectedRoute.incidentDelayMinutes) *
    (14.5 / baseEfficiencyKmPerLiter) *
    0.008;

  const estimatedFuelLiters = Number(
    Math.max(freeFlowFuelLiters, drivingFuelLiters + idlingPenaltyLiters).toFixed(
      2
    )
  );
  const congestionFuelPenaltyLiters = Number(
    Math.max(0, estimatedFuelLiters - freeFlowFuelLiters).toFixed(2)
  );

  const freeFlowTripCostInr = Math.round(freeFlowFuelLiters * cleanFuelPrice);
  const estimatedTripCostInr = Math.round(estimatedFuelLiters * cleanFuelPrice);
  const extraCongestionCostInr = Math.max(
    0,
    estimatedTripCostInr - freeFlowTripCostInr
  );

  return {
    distanceKm,
    baseEfficiencyKmPerLiter,
    effectiveEfficiencyKmPerLiter,
    freeFlowFuelLiters,
    estimatedFuelLiters,
    congestionFuelPenaltyLiters,
    fuelPricePerLiterInr: cleanFuelPrice,
    freeFlowTripCostInr,
    estimatedTripCostInr,
    extraCongestionCostInr,
    formattedFuelLiters: `${estimatedFuelLiters.toFixed(2)} L`,
    formattedTripCost: `₹${estimatedTripCostInr}`,
  };
}

export interface CommuteShareSummaryInput {
  originQuery: string;
  destinationQuery: string;
  selectedRoute: EvaluatedRoute;
  incidents: CorridorIncident[];
  isActiveCommute: boolean;
  telemetry: CommuteTelemetrySnapshot;
  baseUrl?: string;
  referenceTime?: Date;
}

export interface CommuteShareSummary {
  routeLink: string;
  googleMapsUrl: string;
  expectedArrivalTimeLabel: string;
  activeIncidentCount: number;
  activeIncidentsSummary: string;
  clipboardText: string;
}

/**
 * Builds a shareable commute status summary containing the current route link,
 * expected arrival time (ETA clock time + remaining minutes), and active incident alerts.
 */
export function buildCommuteShareSummary(
  input: CommuteShareSummaryInput
): CommuteShareSummary {
  const shortOrigin = input.originQuery.split(',')[0].trim() || 'Origin';
  const shortDest =
    input.destinationQuery.split(',')[0].trim() || 'Destination';
  const refDate = input.referenceTime ? new Date(input.referenceTime) : new Date();

  const remainingMins = input.isActiveCommute
    ? Math.max(0, Math.round(input.telemetry.remainingMinutes))
    : Math.max(1, Math.round(input.selectedRoute.effectiveDurationMinutes));

  const arrivalDate = new Date(refDate.getTime() + remainingMins * 60000);
  const arrivalClockStr = arrivalDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const expectedArrivalTimeLabel = input.isActiveCommute
    ? `${arrivalClockStr} (in ${input.telemetry.remainingMinutes.toFixed(
        1
      )} min · ${input.telemetry.progressPercent}% complete)`
    : `${arrivalClockStr} (ETA ${formatDurationMinutes(
        input.selectedRoute.effectiveDurationMinutes
      )})`;

  const cleanBaseUrl = (
    input.baseUrl || 'https://corridorpulse.app'
  ).replace(/\/+$/, '');
  const encodedOrigin = encodeURIComponent(input.originQuery.trim());
  const encodedDest = encodeURIComponent(input.destinationQuery.trim());
  const encodedRoute = encodeURIComponent(input.selectedRoute.id);

  const routeLink = `${cleanBaseUrl}/?origin=${encodedOrigin}&destination=${encodedDest}&route=${encodedRoute}`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDest}&travelmode=driving`;

  const routeIncidents = input.incidents.filter(
    (inc) => !inc.dismissed && inc.routeId === input.selectedRoute.id
  );

  const activeIncidentsSummary =
    routeIncidents.length > 0
      ? routeIncidents
          .map(
            (inc) =>
              `• [${inc.category.toUpperCase()} +${inc.delayMinutes}m] ${
                inc.title
              } (${inc.corridorZoneLabel})`
          )
          .join('\n')
      : '• None — clear corridor flow on selected route';

  const clipboardLines = [
    `CorridorPulse Live Commute: ${shortOrigin} → ${shortDest}`,
    `Route: ${input.selectedRoute.label} (${input.selectedRoute.distanceKm.toFixed(
      1
    )} km · Avg ${input.selectedRoute.averageSpeedKmh} km/h)`,
    `Expected Arrival Time: ${expectedArrivalTimeLabel}`,
    `Active Incident Alerts (${routeIncidents.length}):`,
    activeIncidentsSummary,
    `Route Link: ${routeLink}`,
    `Google Maps Navigation: ${googleMapsUrl}`,
  ];

  return {
    routeLink,
    googleMapsUrl,
    expectedArrivalTimeLabel,
    activeIncidentCount: routeIncidents.length,
    activeIncidentsSummary,
    clipboardText: clipboardLines.join('\n'),
  };
}







