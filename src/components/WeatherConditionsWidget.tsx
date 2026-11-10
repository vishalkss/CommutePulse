import React from 'react';
import {
  CloudRain,
  Sun,
  Cloud,
  Wind,
  Droplets,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Thermometer,
} from 'lucide-react';
import type {
  CorridorWeatherRawData,
  WeatherTrafficAdvisory,
} from '../utils/trafficLogic';

export type WeatherSimulationMode = 'live' | 'light_rain' | 'heavy_rain';

interface WeatherConditionsWidgetProps {
  originQuery: string;
  destinationQuery: string;
  weatherData: CorridorWeatherRawData;
  advisory: WeatherTrafficAdvisory;
  simulationMode: WeatherSimulationMode;
  onChangeSimulationMode: (mode: WeatherSimulationMode) => void;
  isLoading: boolean;
  onRefreshWeather: () => void;
}

export const WeatherConditionsWidget: React.FC<
  WeatherConditionsWidgetProps
> = ({
  originQuery,
  destinationQuery,
  weatherData,
  advisory,
  simulationMode,
  onChangeSimulationMode,
  isLoading,
  onRefreshWeather,
}) => {
  const shortOrigin = originQuery.split(',')[0].trim() || 'Origin';
  const shortDest = destinationQuery.split(',')[0].trim() || 'Destination';

  const renderWeatherIcon = () => {
    if (advisory.severity === 'severe' || weatherData.precipitationMm >= 4) {
      return <CloudRain className="w-5 h-5 text-blue-600 shrink-0" />;
    }
    if (advisory.isRainSlowdownActive || weatherData.precipitationMm > 0) {
      return <CloudRain className="w-5 h-5 text-amber-600 shrink-0" />;
    }
    if (weatherData.weatherCode === 0) {
      return <Sun className="w-5 h-5 text-amber-500 shrink-0" />;
    }
    return <Cloud className="w-5 h-5 text-slate-600 shrink-0" />;
  };

  return (
    <section
      id="weather-conditions-widget"
      aria-label="Corridor Local Weather Conditions and Traffic Impact"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Header Row */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {renderWeatherIcon()}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Weather Conditions: {shortOrigin} → {shortDest}
              </h2>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                · {weatherData.sourceLabel} ({weatherData.fetchedAtLabel})
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live meteorological telemetry &amp; rain-related traffic slowdown
              overlay
            </p>
          </div>
        </div>

        {/* Weather Mode Switcher (Live API vs Rain Slowdown Overlay Simulation) & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Weather condition mode"
            className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              onClick={() => onChangeSimulationMode('live')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                simulationMode === 'live'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live API Weather
            </button>
            <button
              type="button"
              onClick={() => onChangeSimulationMode('light_rain')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                simulationMode === 'light_rain'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Light Rain Slowdown
            </button>
            <button
              type="button"
              onClick={() => onChangeSimulationMode('heavy_rain')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                simulationMode === 'heavy_rain'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Heavy Rain Overlay
            </button>
          </div>

          <button
            type="button"
            onClick={onRefreshWeather}
            disabled={isLoading}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`}
            />
            <span>Sync Weather</span>
          </button>
        </div>
      </div>

      {/* Weather Telemetry & Traffic Slowdown Impact Strip */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left 7 Cols: 5-Metric Weather Telemetry Strip */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-md">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-600" />
              <span>Temperature</span>
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {weatherData.temperatureC.toFixed(1)}°C
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums">
              Feels {weatherData.apparentTemperatureC.toFixed(1)}°C
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-md">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <CloudRain className="w-3 h-3 text-blue-600" />
              <span>Precipitation</span>
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {weatherData.precipitationMm.toFixed(1)} mm/h
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums">
              Rain prob: {weatherData.precipProbabilityPercent}%
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-md">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Droplets className="w-3 h-3 text-sky-600" />
              <span>Humidity</span>
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {weatherData.humidityPercent}%
            </div>
            <div className="text-[11px] text-slate-500">
              {weatherData.humidityPercent > 80 ? 'Wet surface' : 'Normal grip'}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-md">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Wind className="w-3 h-3 text-slate-600" />
              <span>Wind Speed</span>
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {weatherData.windSpeedKmh.toFixed(1)} km/h
            </div>
            <div className="text-[11px] text-slate-500">
              {weatherData.windSpeedKmh > 22 ? 'Gusty crosswind' : 'Calm breeze'}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-md col-span-2 sm:col-span-1">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Eye className="w-3 h-3 text-emerald-600" />
              <span>Visibility</span>
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {weatherData.visibilityKm.toFixed(1)} km
            </div>
            <div className="text-[11px] text-slate-500">
              {weatherData.visibilityKm < 4 ? 'Low visibility' : 'Clear sightline'}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Weather-Related Traffic Slowdown Alert Box */}
        <div
          data-testid="weather-traffic-advisory-box"
          className={`lg:col-span-5 p-3.5 rounded-lg border ${
            advisory.severity === 'severe'
              ? 'bg-red-50 border-red-200 text-red-950'
              : advisory.isRainSlowdownActive
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              {advisory.isRainSlowdownActive ? (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{advisory.alertTitle}</span>
            </div>

            <span className="text-xs font-mono tabular-nums font-bold shrink-0">
              {advisory.extraDelayMinutes > 0
                ? `+${advisory.extraDelayMinutes}m · -${advisory.speedReductionPercent}% speed`
                : '0 min weather delay'}
            </span>
          </div>

          <p className="text-xs mt-1 opacity-90 leading-relaxed">
            {advisory.alertDescription}
          </p>

          <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium truncate">
              Zone: {advisory.affectedCheckpointLabel}
            </span>
            <span className="font-semibold shrink-0">
              {advisory.isRainSlowdownActive
                ? 'Overlaid on Map & Alerts'
                : 'Dry Baseline Active'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
