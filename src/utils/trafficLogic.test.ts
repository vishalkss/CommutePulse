import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEffectiveRouteMetrics,
  computeCorridorSegmentTelemetry,
  computeCommuteHistoryAnalytics,
  evaluateBestRouteAndSavings,
  evaluateDepartureThresholdPush,
  getTypicalThresholdForSavedDeparture,
  buildRouteCongestionHeatmapSegments,
  evaluateWeatherTrafficImpact,
  computeActiveCommuteTelemetry,
  calculateRouteFuelAndCost,
  buildCommuteShareSummary,
  filterAndSortIncidents,
  validateIncidentReport,
  validateRouteEndpoints,
  formatDurationMinutes,
  type CorridorIncident,
  type RouteCandidate,
} from './trafficLogic';

const sampleRoutes: RouteCandidate[] = [
  {
    id: 'primary',
    label: 'Primary Corridor (Direct Main Rd)',
    summaryTag: 'Direct arterial path',
    baseDurationMinutes: 34,
    distanceKm: 13.8,
    isPrimaryDefault: true,
  },
  {
    id: 'alt_1',
    label: 'Northern Connector Bypass',
    summaryTag: 'Bypasses central rail crossing',
    baseDurationMinutes: 39,
    distanceKm: 15.4,
  },
  {
    id: 'alt_2',
    label: 'Southern Tech Corridor Link',
    summaryTag: 'Alternate secondary arterial',
    baseDurationMinutes: 43,
    distanceKm: 16.9,
  },
];

const sampleIncidents: CorridorIncident[] = [
  {
    id: 'inc-1',
    title: 'Multi-vehicle collision blocking right lane',
    category: 'accident',
    severity: 'severe',
    delayMinutes: 14,
    routeId: 'primary',
    routeProgressRatio: 0.42,
    corridorZoneLabel: 'Mid-Corridor Railway Overpass Approach',
    description: 'Tow truck en route; single-lane bottleneck causing tailback.',
    reportedMinutesAgo: 6,
    lanesBlocked: 'Right & Center Lanes',
    acknowledged: false,
    dismissed: false,
    verifiedCount: 19,
  },
  {
    id: 'inc-2',
    title: 'Metro viaduct pier trenching & barricade',
    category: 'construction',
    severity: 'heavy',
    delayMinutes: 9,
    routeId: 'primary',
    routeProgressRatio: 0.78,
    corridorZoneLabel: 'Bellandur Ring Road Merge Segment',
    description: 'Heavy machinery narrowing carriageway to 1.5 lanes.',
    reportedMinutesAgo: 28,
    lanesBlocked: 'Left Service Merge',
    acknowledged: false,
    dismissed: false,
    verifiedCount: 34,
  },
  {
    id: 'inc-3',
    title: 'Stormwater drain resurfacing work',
    category: 'construction',
    severity: 'moderate',
    delayMinutes: 4,
    routeId: 'alt_1',
    routeProgressRatio: 0.55,
    corridorZoneLabel: 'Northern Bypass Connector',
    description: 'Cones placed along shoulder; traffic moving steadily.',
    reportedMinutesAgo: 45,
    lanesBlocked: 'Shoulder only',
    acknowledged: true,
    dismissed: false,
    verifiedCount: 8,
  },
];

test('validateRouteEndpoints rejects empty or identical origin/destination', () => {
  assert.equal(validateRouteEndpoints('', 'Zetwerk Bellandur').valid, false);
  assert.equal(validateRouteEndpoints('Sompura Gate', '').valid, false);
  assert.equal(
    validateRouteEndpoints('Sompura Gate', 'sompura gate').valid,
    false
  );
  assert.equal(
    validateRouteEndpoints('HSR Layout', 'Electronic City').valid,
    true
  );
});

test('calculateEffectiveRouteMetrics aggregates incident delays, speed, and congestion index', () => {
  const primaryEval = calculateEffectiveRouteMetrics(
    sampleRoutes[0],
    sampleIncidents,
    0
  );
  assert.equal(primaryEval.incidentDelayMinutes, 23);
  assert.equal(primaryEval.effectiveDurationMinutes, 57);
  assert.equal(primaryEval.accidentCount, 1);
  assert.equal(primaryEval.constructionCount, 1);
  assert.equal(primaryEval.congestionStatus, 'severe');
  assert.ok(primaryEval.averageSpeedKmh < primaryEval.freeFlowSpeedKmh);
  assert.ok(primaryEval.congestionIndexPercent > 50);
});

test('computeCorridorSegmentTelemetry adapts dynamically to custom origins, destinations, and live steps', () => {
  const primaryEval = calculateEffectiveRouteMetrics(
    sampleRoutes[0],
    sampleIncidents,
    0
  );
  const customSegments = computeCorridorSegmentTelemetry(
    primaryEval,
    sampleIncidents,
    false,
    'HSR Layout Sector 2, Bengaluru',
    'Manyata Tech Park, Bengaluru',
    [
      { instruction: 'Head north on 27th Main Rd', distanceMeters: 2200, durationMillis: 300000 },
      { instruction: 'Turn right onto Outer Ring Rd', distanceMeters: 4500, durationMillis: 600000 },
      { instruction: 'Continue past Marathahalli Bridge', distanceMeters: 3800, durationMillis: 500000 },
      { instruction: 'Merge onto Hebbal Flyover Ramp', distanceMeters: 3300, durationMillis: 450000 },
    ]
  );
  assert.equal(customSegments.length, 4);
  assert.ok(customSegments[0].segmentName.includes('HSR Layout Sector 2'));
  assert.ok(customSegments[3].segmentName.includes('Manyata Tech Park'));
});

test('evaluateBestRouteAndSavings recommends faster bypass when primary has heavy delays', () => {
  const comparison = evaluateBestRouteAndSavings(
    sampleRoutes,
    sampleIncidents,
    'primary',
    0,
    8
  );

  assert.equal(comparison.primaryRoute.effectiveDurationMinutes, 57);
  assert.equal(comparison.recommendedRoute.effectiveDurationMinutes, 43);
  assert.equal(comparison.timeSavedVsPrimaryMinutes, 14);
  assert.equal(comparison.shouldAlertForBypass, true);
});

test('filterAndSortIncidents filters by category, severity, and search query', () => {
  const onlyAccidents = filterAndSortIncidents(sampleIncidents, 'accident');
  assert.equal(onlyAccidents.length, 1);
  assert.equal(onlyAccidents[0].id, 'inc-1');

  const onlyConstruction = filterAndSortIncidents(sampleIncidents, 'construction');
  assert.equal(onlyConstruction.length, 2);

  const searchRes = filterAndSortIncidents(sampleIncidents, 'all', 'viaduct');
  assert.equal(searchRes.length, 1);
  assert.equal(searchRes[0].id, 'inc-2');
});

test('validateIncidentReport enforces required fields and numeric range', () => {
  const invalidResult = validateIncidentReport({
    title: 'ab',
    category: 'invalid',
    routeId: 'primary',
    corridorZoneLabel: '',
    delayMinutes: 0,
    lanesBlocked: 'Left lane',
    description: 'short',
  });
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.title);

  const validResult = validateIncidentReport({
    title: 'Fender bender near flyover',
    category: 'accident',
    routeId: 'primary',
    corridorZoneLabel: 'Mid-Corridor Flyover Ramp',
    delayMinutes: 12,
    lanesBlocked: 'Right lane',
    description: 'Two cars stopped in right lane, traffic merging left.',
  });
  assert.equal(validResult.valid, true);
  assert.equal(Object.keys(validResult.errors).length, 0);
});

test('formatDurationMinutes formats under and over 60 minutes cleanly', () => {
  assert.equal(formatDurationMinutes(38), '38 min');
  assert.equal(formatDurationMinutes(60), '1 hr');
  assert.equal(formatDurationMinutes(75), '1 hr 15 min');
});

test('computeCommuteHistoryAnalytics builds 7-day weekly trends and 10 hourly delay windows for selected corridor', () => {
  const primaryEval = calculateEffectiveRouteMetrics(
    sampleRoutes[0],
    sampleIncidents,
    0
  );
  const analytics = computeCommuteHistoryAnalytics(
    primaryEval,
    sampleIncidents,
    'Sompura Gate, Sarjapur Road, Bengaluru',
    'Zetwerk Bellandur Office, Bengaluru'
  );

  assert.equal(analytics.weeklyTrends.length, 7);
  assert.equal(analytics.hourlyDelayWindows.length, 10);
  assert.equal(analytics.corridorTitle, 'Sompura Gate → Zetwerk Bellandur Office');
  assert.ok(
    analytics.worstCommuteDay.avgTravelMinutes >=
      analytics.bestCommuteDay.avgTravelMinutes
  );
  assert.ok(
    analytics.peakDelayWindow.commonDelayMinutes >
      analytics.optimalDepartureWindow.commonDelayMinutes
  );
  assert.ok(analytics.weeklyTotalBypassSavingsMinutes > 0);
});

test('evaluateDepartureThresholdPush triggers when Estimated Travel Time exceeds typical threshold for saved departure time', () => {
  const comparison = evaluateBestRouteAndSavings(
    sampleRoutes,
    sampleIncidents,
    'primary',
    0,
    8
  );

  const defaultTypical = getTypicalThresholdForSavedDeparture(34, '08:30 AM');
  assert.equal(defaultTypical, 44);

  // Primary route is 57 min, which exceeds the 44 min typical threshold for 08:30 AM by +13 min
  const pushTriggered = evaluateDepartureThresholdPush(
    comparison.selectedRoute,
    comparison.recommendedRoute,
    '08:30 AM',
    defaultTypical,
    'Sompura Gate',
    'Zetwerk Bellandur Office'
  );
  assert.equal(pushTriggered.shouldTriggerPush, true);
  assert.equal(pushTriggered.excessMinutes, 13);
  assert.equal(pushTriggered.severity, 'critical');
  assert.equal(pushTriggered.canSwitchBypass, true);
  assert.equal(pushTriggered.bypassSavingsMinutes, 14);

  // When threshold is set higher than current ETA (e.g. 65 min), push does not trigger
  const pushNotTriggered = evaluateDepartureThresholdPush(
    comparison.selectedRoute,
    comparison.recommendedRoute,
    '08:30 AM',
    65,
    'Sompura Gate',
    'Zetwerk Bellandur Office'
  );
  assert.equal(pushNotTriggered.shouldTriggerPush, false);
  assert.equal(pushNotTriggered.excessMinutes, 0);
  assert.equal(pushNotTriggered.severity, 'nominal');
});

test('buildRouteCongestionHeatmapSegments partitions route coordinates into color-coded speed bands', () => {
  const sampleCoords = Array.from({ length: 25 }, (_, i) => ({
    lat: 12.88 + i * 0.002,
    lng: 77.68 + i * 0.002,
  }));

  const segments = buildRouteCongestionHeatmapSegments(
    sampleCoords,
    sampleIncidents,
    'primary'
  );

  assert.equal(segments.length, 12);
  // First segment near origin should be FAST (#10B981)
  assert.equal(segments[0].speedBand, 'FAST');
  assert.equal(segments[0].strokeColor, '#10B981');
  // Mid-corridor segment near accident (ratio ~0.42) should be SEVERE_JAM (#991B1B)
  const hasSevereJam = segments.some((s) => s.speedBand === 'SEVERE_JAM');
  assert.equal(hasSevereJam, true);
});

test('evaluateWeatherTrafficImpact computes rain-related traffic slowdowns and dry baseline accurately', () => {
  const dryAdvisory = evaluateWeatherTrafficImpact(
    {
      temperatureC: 27.4,
      apparentTemperatureC: 28.5,
      humidityPercent: 58,
      precipitationMm: 0,
      rainMm: 0,
      precipProbabilityPercent: 15,
      windSpeedKmh: 12,
      visibilityKm: 10,
      weatherCode: 1,
      fetchedAtLabel: '09:00 AM',
      sourceLabel: 'Open-Meteo Live Weather API',
    },
    'Sompura Gate',
    'Zetwerk Bellandur Office',
    36
  );
  assert.equal(dryAdvisory.isRainSlowdownActive, false);
  assert.equal(dryAdvisory.extraDelayMinutes, 0);
  assert.equal(dryAdvisory.severity, 'nominal');

  const rainAdvisory = evaluateWeatherTrafficImpact(
    {
      temperatureC: 22.1,
      apparentTemperatureC: 24.0,
      humidityPercent: 92,
      precipitationMm: 6.4,
      rainMm: 6.4,
      precipProbabilityPercent: 95,
      windSpeedKmh: 26,
      visibilityKm: 3.2,
      weatherCode: 65,
      fetchedAtLabel: '09:00 AM',
      sourceLabel: 'Open-Meteo Live Weather API',
    },
    'Sompura Gate',
    'Zetwerk Bellandur Office',
    36
  );
  assert.equal(rainAdvisory.isRainSlowdownActive, true);
  assert.equal(rainAdvisory.severity, 'severe');
  assert.equal(rainAdvisory.extraDelayMinutes, 9);
  assert.equal(rainAdvisory.speedReductionPercent, 28);
});

test('computeActiveCommuteTelemetry tracks route progress and calculates real-time deviation vs original estimate', () => {
  const comparison = evaluateBestRouteAndSavings(
    sampleRoutes,
    sampleIncidents,
    'primary',
    0,
    8
  );
  const segments = computeCorridorSegmentTelemetry(
    comparison.selectedRoute,
    sampleIncidents
  );

  // Commuter is 50% along the 57-min route, but has spent 33.0 actual minutes due to bottleneck (+4.5m behind)
  const behindSnapshot = computeActiveCommuteTelemetry({
    progressRatio: 0.5,
    originalEstimatedMinutes: 57,
    elapsedActualMinutes: 33.0,
    selectedRoute: comparison.selectedRoute,
    segments,
  });

  assert.equal(behindSnapshot.progressPercent, 50);
  assert.equal(behindSnapshot.distanceCoveredKm, 6.9);
  assert.equal(behindSnapshot.distanceRemainingKm, 6.9);
  assert.equal(behindSnapshot.projectedTotalActualMinutes, 61.5);
  assert.equal(behindSnapshot.deviationMinutes, 4.5);
  assert.equal(behindSnapshot.deviationStatus, 'behind');

  // Verify landmark mini-timeline predictions at 50% route progress
  assert.equal(behindSnapshot.landmarks.length, 5);
  assert.equal(behindSnapshot.landmarks[0].status, 'passed');
  assert.equal(behindSnapshot.landmarks[0].remainingMinutes, 0);
  assert.equal(behindSnapshot.landmarks[1].status, 'passed');
  assert.equal(behindSnapshot.landmarks[2].status, 'approaching');
  assert.ok(behindSnapshot.landmarks[2].remainingMinutes > 0);
  assert.equal(behindSnapshot.landmarks[4].status, 'upcoming');
  assert.equal(behindSnapshot.landmarks[4].remainingMinutes, 28.5);

  // If commuter switches to the 43-min recommended bypass route at 50% progress, projected total drops ahead of original 57-min estimate
  const aheadSnapshot = computeActiveCommuteTelemetry({
    progressRatio: 0.5,
    originalEstimatedMinutes: 57,
    elapsedActualMinutes: 24.0,
    selectedRoute: comparison.recommendedRoute,
    segments,
  });

  assert.equal(aheadSnapshot.projectedTotalActualMinutes, 45.5);
  assert.equal(aheadSnapshot.deviationMinutes, -11.5);
  assert.equal(aheadSnapshot.deviationStatus, 'ahead');
});

test('calculateRouteFuelAndCost estimates fuel consumption and trip cost from distance and vehicle efficiency', () => {
  const comparison = evaluateBestRouteAndSavings(
    sampleRoutes,
    sampleIncidents,
    'primary',
    0,
    8
  );

  // Primary route (13.8 km, heavy congestion) with 14.5 km/L average efficiency
  const sedanEstimate = calculateRouteFuelAndCost(
    comparison.selectedRoute,
    14.5,
    102.86
  );

  assert.equal(sedanEstimate.distanceKm, 13.8);
  assert.equal(sedanEstimate.baseEfficiencyKmPerLiter, 14.5);
  assert.equal(sedanEstimate.freeFlowFuelLiters, 0.95);
  assert.ok(sedanEstimate.estimatedFuelLiters > sedanEstimate.freeFlowFuelLiters);
  assert.ok(sedanEstimate.estimatedTripCostInr > sedanEstimate.freeFlowTripCostInr);
  assert.ok(sedanEstimate.formattedFuelLiters.endsWith(' L'));
  assert.ok(sedanEstimate.formattedTripCost.startsWith('₹'));

  // Higher efficiency vehicle (e.g. 22.0 km/L hybrid) consumes less fuel and costs less
  const hybridEstimate = calculateRouteFuelAndCost(
    comparison.selectedRoute,
    22.0,
    102.86
  );
  assert.ok(hybridEstimate.estimatedFuelLiters < sedanEstimate.estimatedFuelLiters);
  assert.ok(hybridEstimate.estimatedTripCostInr < sedanEstimate.estimatedTripCostInr);
});

test('buildCommuteShareSummary formats route link, expected arrival time, and active incident alerts for clipboard sharing', () => {
  const comparison = evaluateBestRouteAndSavings(
    sampleRoutes,
    sampleIncidents,
    'primary',
    0,
    8
  );
  const segments = computeCorridorSegmentTelemetry(
    comparison.selectedRoute,
    sampleIncidents
  );
  const telemetry = computeActiveCommuteTelemetry({
    progressRatio: 0.4,
    originalEstimatedMinutes: 57,
    elapsedActualMinutes: 24.0,
    selectedRoute: comparison.selectedRoute,
    segments,
  });

  const shareSummary = buildCommuteShareSummary({
    originQuery: 'Sompura Gate, Sarjapur Road, Bengaluru',
    destinationQuery: 'Zetwerk Bellandur Office, Bengaluru',
    selectedRoute: comparison.selectedRoute,
    incidents: sampleIncidents,
    isActiveCommute: true,
    telemetry,
    baseUrl: 'https://corridorpulse.app',
    referenceTime: new Date('2026-11-10T09:00:00Z'),
  });

  assert.equal(shareSummary.activeIncidentCount, 2);
  assert.ok(shareSummary.routeLink.includes('origin=Sompura%20Gate'));
  assert.ok(shareSummary.routeLink.includes('destination=Zetwerk%20Bellandur'));
  assert.ok(shareSummary.expectedArrivalTimeLabel.includes('40% complete'));
  assert.ok(shareSummary.activeIncidentsSummary.includes('ACCIDENT +14m'));
  assert.ok(shareSummary.activeIncidentsSummary.includes('CONSTRUCTION +9m'));
  assert.ok(shareSummary.clipboardText.includes(shareSummary.routeLink));
  assert.ok(shareSummary.clipboardText.includes(shareSummary.expectedArrivalTimeLabel));
});







