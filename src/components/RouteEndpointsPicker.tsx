import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  ArrowLeftRight,
  Clock,
  Search,
  Bookmark,
  X,
} from 'lucide-react';
import { validateRouteEndpoints } from '../utils/trafficLogic';

interface PlaceSuggestionItem {
  placeId: string;
  mainText: string;
  fullText: string;
  rawSuggestion: any;
}

function usePlaceAutocomplete(inputValue: string, isFocused: boolean) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<any>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!placesLib || !isFocused || inputValue.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const AutocompleteSessionToken = (placesLib as any).AutocompleteSessionToken;
    const AutocompleteSuggestion = (placesLib as any).AutocompleteSuggestion;
    if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        if (!sessionTokenRef.current && AutocompleteSessionToken) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setLoading(true);
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: inputValue.trim(),
          sessionToken: sessionTokenRef.current,
        });
        if (cancelled) return;
        const list: PlaceSuggestionItem[] = (res?.suggestions || [])
          .map((s: any, idx: number) => {
            const pred = s?.placePrediction;
            if (!pred) return null;
            const fullText =
              pred.text?.text ||
              pred.structuredFormat?.mainText?.text ||
              inputValue;
            const mainText =
              pred.structuredFormat?.mainText?.text ||
              fullText.split(',')[0] ||
              fullText;
            return {
              placeId: pred.placeId || `sug-${idx}`,
              mainText,
              fullText,
              rawSuggestion: s,
            };
          })
          .filter(Boolean);
        setSuggestions(list.slice(0, 5));
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setLoading(false);
        const msg = String(err?.message || err || '');
        if (
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, inputValue, isFocused]);

  const resolveSelectedSuggestion = async (
    item: PlaceSuggestionItem
  ): Promise<string> => {
    try {
      const pred = item.rawSuggestion?.placePrediction;
      if (pred && typeof pred.toPlace === 'function') {
        const place = pred.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        sessionTokenRef.current = null;
        setSuggestions([]);
        const name = place.displayName || item.mainText;
        const addr = place.formattedAddress || item.fullText;
        return addr.toLowerCase().includes(name.toLowerCase())
          ? addr
          : `${name}, ${addr}`;
      }
    } catch {
      // Fallback to prediction fullText
    }
    sessionTokenRef.current = null;
    setSuggestions([]);
    return item.fullText;
  };

  return {
    suggestions,
    loading,
    clearSuggestions: () => setSuggestions([]),
    resolveSelectedSuggestion,
  };
}

export interface CommutePreset {
  id: string;
  label: string;
  origin: string;
  destination: string;
}

interface RouteEndpointsPickerProps {
  originQuery: string;
  destinationQuery: string;
  onApplyEndpoints: (nextOrigin: string, nextDestination: string) => void;
  departureOffsetMinutes: number;
  onSelectDepartureOffset: (offset: number) => void;
}

export function RouteEndpointsPicker({
  originQuery,
  destinationQuery,
  onApplyEndpoints,
  departureOffsetMinutes,
  onSelectDepartureOffset,
}: RouteEndpointsPickerProps) {
  const [originDraft, setOriginDraft] = useState<string>(originQuery);
  const [destinationDraft, setDestinationDraft] =
    useState<string>(destinationQuery);
  const [originFocused, setOriginFocused] = useState<boolean>(false);
  const [destFocused, setDestFocused] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedCommutes, setSavedCommutes] = useState<CommutePreset[]>(() => {
    try {
      const raw = window.localStorage.getItem('corridorpulse-user-saved-commutes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    setOriginDraft(originQuery);
  }, [originQuery]);

  useEffect(() => {
    setDestinationDraft(destinationQuery);
  }, [destinationQuery]);

  const originAutocomplete = usePlaceAutocomplete(originDraft, originFocused);
  const destAutocomplete = usePlaceAutocomplete(destinationDraft, destFocused);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateRouteEndpoints(originDraft, destinationDraft);
    if (!check.valid) {
      setValidationError(check.error);
      return;
    }
    setValidationError(null);
    originAutocomplete.clearSuggestions();
    destAutocomplete.clearSuggestions();
    setOriginFocused(false);
    setDestFocused(false);
    onApplyEndpoints(originDraft.trim(), destinationDraft.trim());
  };

  const handleSwapEndpoints = () => {
    const nextOrigin = destinationDraft.trim() || destinationQuery;
    const nextDest = originDraft.trim() || originQuery;
    setOriginDraft(nextOrigin);
    setDestinationDraft(nextDest);
    setValidationError(null);
    if (nextOrigin && nextDest) {
      onApplyEndpoints(nextOrigin, nextDest);
    }
  };

  const handlePresetClick = (preset: CommutePreset) => {
    setOriginDraft(preset.origin);
    setDestinationDraft(preset.destination);
    setValidationError(null);
    onApplyEndpoints(preset.origin, preset.destination);
  };

  const handleSaveCurrentCommute = () => {
    const check = validateRouteEndpoints(originDraft, destinationDraft);
    if (!check.valid) {
      setValidationError(check.error);
      return;
    }
    const cleanOrig = originDraft.trim();
    const cleanDest = destinationDraft.trim();
    const shortOrig = cleanOrig.split(',')[0].trim();
    const shortDest = cleanDest.split(',')[0].trim();
    const newPreset: CommutePreset = {
      id: `${shortOrig.toLowerCase()}-${shortDest.toLowerCase()}-${Date.now()}`,
      label: `${shortOrig} → ${shortDest}`,
      origin: cleanOrig,
      destination: cleanDest,
    };
    const nextList = [
      newPreset,
      ...savedCommutes.filter(
        (p) =>
          !(
            p.origin.toLowerCase() === cleanOrig.toLowerCase() &&
            p.destination.toLowerCase() === cleanDest.toLowerCase()
          )
      ),
    ].slice(0, 6);
    setSavedCommutes(nextList);
    try {
      window.localStorage.setItem(
        'corridorpulse-user-saved-commutes',
        JSON.stringify(nextList)
      );
    } catch {
      // Ignore storage errors
    }
  };

  const handleRemoveSavedCommute = (id: string) => {
    const nextList = savedCommutes.filter((p) => p.id !== id);
    setSavedCommutes(nextList);
    try {
      window.localStorage.setItem(
        'corridorpulse-user-saved-commutes',
        JSON.stringify(nextList)
      );
    } catch {
      // Ignore storage errors
    }
  };

  const hasSelectedCorridor =
    originQuery.trim().length > 0 && destinationQuery.trim().length > 0;
  const shortOriginTitle = originQuery.split(',')[0].trim();
  const shortDestTitle = destinationQuery.split(',')[0].trim();

  return (
    <section
      aria-label="Corridor Origin, Destination, and Departure Controls"
      className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5"
    >
      {/* Top Row: Dynamic Title & Departure Time Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">
            <span>Custom Commute Route Selector</span>
            <span aria-hidden="true"> · </span>
            <span>Search or choose any starting point and destination</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
            {hasSelectedCorridor
              ? `${shortOriginTitle} → ${shortDestTitle}`
              : 'Select Starting Point & Destination'}
          </h1>
        </div>

        {/* Departure Time Window Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Departure:</span>
          </span>
          <div
            role="group"
            aria-label="Select departure window"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {[
              { offset: 0, label: 'Leave Now' },
              { offset: 15, label: 'In 15 min' },
              { offset: 30, label: 'In 30 min' },
              { offset: 60, label: 'Peak 9:00 AM' },
            ].map((win) => (
              <button
                key={win.offset}
                type="button"
                onClick={() => onSelectDepartureOffset(win.offset)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  departureOffsetMinutes === win.offset
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {win.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Origin & Destination Form */}
      <form
        onSubmit={handleFormSubmit}
        noValidate
        className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start"
      >
        {/* Origin Input with Google Places Autocomplete */}
        <div className="lg:col-span-5 relative">
          <label
            htmlFor="origin-place-input"
            className="block text-[11px] font-semibold text-slate-600 mb-1"
          >
            From (Origin Location)
          </label>
          <div className="relative">
            <MapPin className="w-3.5 h-3.5 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="origin-place-input"
              type="text"
              value={originDraft}
              onFocus={() => setOriginFocused(true)}
              onBlur={() => window.setTimeout(() => setOriginFocused(false), 180)}
              onChange={(e) => {
                setOriginDraft(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Search or enter starting location..."
              aria-label="Origin location"
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {originDraft && (
              <button
                type="button"
                onClick={() => setOriginDraft('')}
                aria-label="Clear origin location"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Origin Autocomplete Dropdown */}
          {originFocused && originAutocomplete.suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Origin autocomplete suggestions"
              className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100 max-h-56 overflow-y-auto"
            >
              {originAutocomplete.suggestions.map((item) => (
                <li key={item.placeId}>
                  <button
                    type="button"
                    onMouseDown={async (e) => {
                      e.preventDefault();
                      const resolved =
                        await originAutocomplete.resolveSelectedSuggestion(item);
                      setOriginDraft(resolved);
                      setOriginFocused(false);
                      const check = validateRouteEndpoints(
                        resolved,
                        destinationDraft
                      );
                      if (check.valid) {
                        onApplyEndpoints(resolved, destinationDraft.trim());
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-start gap-2 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="truncate">
                      <span className="font-semibold text-slate-900">
                        {item.mainText}
                      </span>
                      <span className="text-slate-500 ml-1">
                        {item.fullText}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Swap Button & Destination Input */}
        <div className="lg:col-span-5 relative">
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="destination-place-input"
              className="block text-[11px] font-semibold text-slate-600"
            >
              To (Destination Location)
            </label>
            <button
              type="button"
              onClick={handleSwapEndpoints}
              aria-label="Swap origin and destination"
              className="text-[11px] font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Swap Origin &amp; Destination</span>
            </button>
          </div>
          <div className="relative">
            <Navigation className="w-3.5 h-3.5 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="destination-place-input"
              type="text"
              value={destinationDraft}
              onFocus={() => setDestFocused(true)}
              onBlur={() => window.setTimeout(() => setDestFocused(false), 180)}
              onChange={(e) => {
                setDestinationDraft(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Search or enter destination location..."
              aria-label="Destination location"
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {destinationDraft && (
              <button
                type="button"
                onClick={() => setDestinationDraft('')}
                aria-label="Clear destination location"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Destination Autocomplete Dropdown */}
          {destFocused && destAutocomplete.suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Destination autocomplete suggestions"
              className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100 max-h-56 overflow-y-auto"
            >
              {destAutocomplete.suggestions.map((item) => (
                <li key={item.placeId}>
                  <button
                    type="button"
                    onMouseDown={async (e) => {
                      e.preventDefault();
                      const resolved =
                        await destAutocomplete.resolveSelectedSuggestion(item);
                      setDestinationDraft(resolved);
                      setDestFocused(false);
                      const check = validateRouteEndpoints(
                        originDraft,
                        resolved
                      );
                      if (check.valid) {
                        onApplyEndpoints(originDraft.trim(), resolved);
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-start gap-2 cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="truncate">
                      <span className="font-semibold text-slate-900">
                        {item.mainText}
                      </span>
                      <span className="text-slate-500 ml-1">
                        {item.fullText}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Submit Route Button */}
        <div className="lg:col-span-2 lg:pt-5">
          <button
            type="submit"
            className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Update Route</span>
          </button>
        </div>
      </form>

      {validationError && (
        <p role="alert" className="text-xs text-red-600 font-medium">
          {validationError}
        </p>
      )}

      {/* User-Saved Commutes Strip (no pre-filled hardcoded locations) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 inline-flex items-center gap-1">
            <Bookmark className="w-3 h-3 text-slate-400" />
            <span>Saved Commutes:</span>
          </span>
          {savedCommutes.length === 0 ? (
            <span className="text-[11px] text-slate-400">
              No saved routes yet — enter an origin and destination above to search or save your commute.
            </span>
          ) : (
            savedCommutes.map((preset) => {
              const isCurrent =
                originQuery.toLowerCase() === preset.origin.toLowerCase() &&
                destinationQuery.toLowerCase() ===
                  preset.destination.toLowerCase();
              return (
                <div
                  key={preset.id}
                  className={`inline-flex items-center rounded-md border text-xs transition-colors ${
                    isCurrent
                      ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="px-2.5 py-1 cursor-pointer whitespace-nowrap"
                  >
                    {preset.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSavedCommute(preset.id)}
                    aria-label={`Remove saved commute ${preset.label}`}
                    className="pr-2 pl-0.5 py-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {(originDraft.trim().length >= 2 || destinationDraft.trim().length >= 2) && (
          <button
            type="button"
            onClick={handleSaveCurrentCommute}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Bookmark className="w-3 h-3" />
            <span>Save Route</span>
          </button>
        )}
      </div>
    </section>
  );
}
