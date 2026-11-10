import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Calendar,
  Clock,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  HardHat,
  Gauge,
} from 'lucide-react';
import {
  formatDurationMinutes,
  type CommuteHistoryAnalytics,
  type EvaluatedRoute,
  type WeeklyCommuteTrendPoint,
  type HourlyDelayWindowPoint,
} from '../utils/trafficLogic';

interface CommuteHistoryPanelProps {
  analytics: CommuteHistoryAnalytics;
  selectedRoute: EvaluatedRoute;
  onSelectDepartureWindow?: (offsetMinutes: number) => void;
}

export const CommuteHistoryPanel: React.FC<CommuteHistoryPanelProps> = ({
  analytics,
  selectedRoute,
  onSelectDepartureWindow,
}) => {
  const [chartMode, setChartMode] = useState<'split' | 'weekly' | 'hourly'>(
    'split'
  );
  const [includeWeekends, setIncludeWeekends] = useState<boolean>(true);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    analytics.worstCommuteDay.day
  );
  const [selectedHourKey, setSelectedHourKey] = useState<string>(
    analytics.peakDelayWindow.windowLabel
  );

  const displayedWeeklyTrends = includeWeekends
    ? analytics.weeklyTrends
    : analytics.weeklyTrends.filter((d) => !d.isWeekend);

  const activeDayPoint: WeeklyCommuteTrendPoint =
    analytics.weeklyTrends.find((d) => d.day === selectedDayKey) ||
    analytics.worstCommuteDay;

  const activeHourPoint: HourlyDelayWindowPoint =
    analytics.hourlyDelayWindows.find(
      (w) => w.windowLabel === selectedHourKey
    ) || analytics.peakDelayWindow;

  const getHourlyBarColor = (point: HourlyDelayWindowPoint) => {
    if (point.windowLabel === analytics.optimalDepartureWindow.windowLabel) {
      return '#059669'; // Emerald-600 for optimal departure window
    }
    if (point.severityLevel === 'severe') {
      return '#DC2626'; // Red-600 for severe peak delay
    }
    if (point.severityLevel === 'heavy') {
      return '#D97706'; // Amber-600 for heavy delay
    }
    return '#2563EB'; // Blue-600 for nominal/moderate
  };

  return (
    <section
      id="commute-history"
      aria-label="Commute History and Weekly Delay Analytics"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Panel Header & Interactive View Controls */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <h2 className="text-base font-bold text-slate-900 font-display">
              Commute History: {analytics.corridorTitle}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Weekly traffic trends, accident/construction delay composition, and
            common peak bottleneck hours for {selectedRoute.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Weekday vs Full Week Filter */}
          <button
            type="button"
            onClick={() => setIncludeWeekends((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              !includeWeekends
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {includeWeekends ? 'Showing: Mon–Sun' : 'Showing: Weekdays Only'}
          </button>

          {/* Chart Mode Segmented Switcher */}
          <div
            role="group"
            aria-label="Commute history chart view selector"
            className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              onClick={() => setChartMode('split')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                chartMode === 'split'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Both Charts
            </button>
            <button
              type="button"
              onClick={() => setChartMode('weekly')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                chartMode === 'weekly'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Trends
            </button>
            <button
              type="button"
              onClick={() => setChartMode('hourly')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                chartMode === 'hourly'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Common Delay Times
            </button>
          </div>
        </div>
      </div>

      {/* 4-Column Historical Corridor Insights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/70 border-b border-slate-200">
        <div className="px-4 py-3">
          <div className="text-[11px] font-medium text-slate-500">
            Heaviest Commute Day · Weekday Peak
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-slate-900">
              {analytics.worstCommuteDay.dayFull}
            </span>
            <span className="text-sm font-mono tabular-nums font-bold text-red-600">
              {formatDurationMinutes(analytics.worstCommuteDay.avgTravelMinutes)}{' '}
              (+{analytics.worstCommuteDay.totalDelayMinutes}m)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            Avg speed {analytics.worstCommuteDay.avgSpeedKmh} km/h ·{' '}
            {analytics.worstCommuteDay.congestionPercent}% congestion
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] font-medium text-slate-500">
            Most Common Delay Window · Avoid
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-slate-900">
              {analytics.peakDelayWindow.displayHour}
            </span>
            <span className="text-sm font-mono tabular-nums font-bold text-amber-700">
              +{analytics.peakDelayWindow.commonDelayMinutes} min delay
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            {analytics.peakDelayWindow.periodTag} ·{' '}
            {analytics.peakDelayWindow.accidentRiskPercent}% incident probability
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] font-medium text-slate-500">
            Optimal Departure Slot · Fastest Flow
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-emerald-700">
              {analytics.optimalDepartureWindow.displayHour}
            </span>
            <span className="text-sm font-mono tabular-nums font-bold text-emerald-700">
              Saves{' '}
              {Math.max(
                1,
                analytics.peakDelayWindow.commonDelayMinutes -
                  analytics.optimalDepartureWindow.commonDelayMinutes
              )}{' '}
              min
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            ETA{' '}
            {formatDurationMinutes(
              analytics.optimalDepartureWindow.expectedTravelMinutes
            )}{' '}
            · {analytics.optimalDepartureWindow.avgSpeedKmh} km/h avg
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] font-medium text-slate-500">
            Weekly Smart Bypass Savings · Mon–Fri
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-blue-700 font-mono tabular-nums">
              {formatDurationMinutes(analytics.weeklyTotalBypassSavingsMinutes)}{' '}
              / wk
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              Weekday avg: {analytics.weeklyAverageMinutes}m
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Fastest weekday: {analytics.bestCommuteDay.dayFull} (
            {analytics.bestCommuteDay.avgTravelMinutes}m)
          </div>
        </div>
      </div>

      {/* Recharts Visualizations Grid */}
      <div
        className={`p-4 grid grid-cols-1 ${
          chartMode === 'split' ? 'xl:grid-cols-2' : 'grid-cols-1'
        } gap-5`}
      >
        {/* Chart 1: Weekly Traffic & Delay Breakdown (Mon-Sun) */}
        {(chartMode === 'split' || chartMode === 'weekly') && (
          <div className="border border-slate-200 rounded-lg p-4 bg-white flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Weekly Commute Duration &amp; Delay Composition</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stacked Free-Flow Baseline + Construction &amp; Accident
                  Delays (min) vs. Average Speed (km/h)
                </p>
              </div>

              {/* Inline Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" />
                  <span>Free-Flow</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                  <span>Construction Delay</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                  <span>Accident Delay</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-600 inline-block" />
                  <span>Speed (km/h)</span>
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={displayedWeeklyTrends}
                  margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
                  onClick={(state) => {
                    if (state && state.activeLabel) {
                      setSelectedDayKey(String(state.activeLabel));
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="minutes"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    unit="m"
                  />
                  <YAxis
                    yAxisId="speed"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#2563EB' }}
                    axisLine={false}
                    tickLine={false}
                    unit=" km/h"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#F8FAFC' }}
                    labelStyle={{
                      color: '#94A3B8',
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                    formatter={(value, name) => {
                      const label = String(name ?? '');
                      const numVal = value ?? 0;
                      if (label === 'Avg Speed') return [`${numVal} km/h`, label];
                      return [`${numVal} min`, label];
                    }}
                  />
                  <ReferenceLine
                    yAxisId="minutes"
                    y={selectedRoute.baseDurationMinutes}
                    stroke="#64748B"
                    strokeDasharray="4 4"
                    label={{
                      value: `Free-flow (${selectedRoute.baseDurationMinutes}m)`,
                      position: 'insideTopLeft',
                      fill: '#475569',
                      fontSize: 10,
                    }}
                  />
                  <Bar
                    yAxisId="minutes"
                    dataKey="freeFlowMinutes"
                    name="Free-Flow Base"
                    stackId="commute"
                    fill="#CBD5E1"
                    barSize={28}
                    cursor="pointer"
                  />
                  <Bar
                    yAxisId="minutes"
                    dataKey="constructionDelayMinutes"
                    name="Construction Delay"
                    stackId="commute"
                    fill="#F59E0B"
                    barSize={28}
                    cursor="pointer"
                  />
                  <Bar
                    yAxisId="minutes"
                    dataKey="accidentDelayMinutes"
                    name="Accident Delay"
                    stackId="commute"
                    fill="#DC2626"
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                    cursor="pointer"
                  />
                  <Line
                    yAxisId="speed"
                    type="monotone"
                    dataKey="avgSpeedKmh"
                    name="Avg Speed"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2563EB', strokeWidth: 1.5, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Day Selector & Selected Day Summary Strip */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 font-medium">Inspect day:</span>
                {displayedWeeklyTrends.map((d) => (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => setSelectedDayKey(d.day)}
                    className={`px-2 py-1 rounded text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                      activeDayPoint.day === d.day
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {d.day}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-slate-700 font-mono tabular-nums">
                <span className="font-semibold text-slate-900">
                  {activeDayPoint.dayFull}:
                </span>
                <span>Total {activeDayPoint.avgTravelMinutes}m</span>
                <span className="text-red-600 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />+
                  {activeDayPoint.accidentDelayMinutes}m acc
                </span>
                <span className="text-amber-700 inline-flex items-center gap-1">
                  <HardHat className="w-3 h-3" />+
                  {activeDayPoint.constructionDelayMinutes}m roadwork
                </span>
                <span className="text-emerald-700 font-semibold">
                  Bypass saves {activeDayPoint.bypassSavedMinutes}m
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Chart 2: Common Delay Times by Departure Window (07:00 - 21:00) */}
        {(chartMode === 'split' || chartMode === 'hourly') && (
          <div className="border border-slate-200 rounded-lg p-4 bg-white flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Common Delay Times by Departure Hour</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Historical extra delay minutes above free-flow across morning
                  &amp; evening rush windows
                </p>
              </div>

              {/* Severity Color Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  <span>Optimal Slot</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                  <span>Moderate</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                  <span>Heavy Rush</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                  <span>Severe Bottleneck</span>
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.hourlyDelayWindows}
                  margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
                  onClick={(state) => {
                    if (state && state.activeLabel) {
                      setSelectedHourKey(String(state.activeLabel));
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="windowLabel"
                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    unit="m"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#F8FAFC' }}
                    labelStyle={{
                      color: '#94A3B8',
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                    formatter={(value, name) => [
                      `+${value ?? 0} min`,
                      String(name ?? ''),
                    ]}
                  />
                  <ReferenceLine
                    y={12}
                    stroke="#D97706"
                    strokeDasharray="3 3"
                    label={{
                      value: 'Bypass Advisory Threshold (+12m)',
                      position: 'insideTopRight',
                      fill: '#B45309',
                      fontSize: 10,
                    }}
                  />
                  <Bar
                    dataKey="commonDelayMinutes"
                    name="Common Delay"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                    cursor="pointer"
                  >
                    {analytics.hourlyDelayWindows.map((entry) => (
                      <Cell
                        key={entry.windowLabel}
                        fill={getHourlyBarColor(entry)}
                        stroke={
                          entry.windowLabel === activeHourPoint.windowLabel
                            ? '#0F172A'
                            : 'none'
                        }
                        strokeWidth={
                          entry.windowLabel === activeHourPoint.windowLabel
                            ? 2
                            : 0
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Departure Slot Selector & Actionable Recommendation */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-slate-500 font-medium mr-1">
                  Time slot:
                </span>
                {analytics.hourlyDelayWindows.map((win) => (
                  <button
                    key={win.windowLabel}
                    type="button"
                    onClick={() => setSelectedHourKey(win.windowLabel)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${
                      activeHourPoint.windowLabel === win.windowLabel
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {win.windowLabel}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-slate-700">
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {activeHourPoint.displayHour} ({activeHourPoint.periodTag}):
                </span>
                <span className="font-mono tabular-nums text-amber-700 font-semibold">
                  +{activeHourPoint.commonDelayMinutes}m common delay
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums inline-flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-blue-600" />
                  {activeHourPoint.avgSpeedKmh} km/h
                </span>
                {onSelectDepartureWindow && (
                  <button
                    type="button"
                    onClick={() =>
                      onSelectDepartureWindow(
                        activeHourPoint.severityLevel === 'severe' ? 60 : 0
                      )
                    }
                    className="ml-1 text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 cursor-pointer underline underline-offset-2"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Simulate Slot</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
