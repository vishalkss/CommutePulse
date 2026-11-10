# Add a Traffic Layer to a Map

The Maps JavaScript API allows you to display real-time traffic conditions,
public transit networks, or bicycling route information on your base map using
built-in layer objects (`TrafficLayer`, `TransitLayer`, and `BicyclingLayer`).
These layers modify the base map layer and are available in
[select regions](https://developers.google.com/maps/coverage).

## Prerequisites

Before adding a traffic layer, ensure you have already added a customizable,
interactive map to your web page or mobile app using either the `<gmp-map>` web
component or the `google.maps.Map` JavaScript class.

--------------------------------------------------------------------------------

## Traffic Layer

The `TrafficLayer` object overlays real-time traffic information (where
supported) onto your map. Traffic information is refreshed frequently, though
not instantly; rapid consecutive requests for the same area are unlikely to
yield different results.

### 1. Using the `<gmp-map>` Web Component

When using the `<gmp-map>` custom element, retrieve its underlying `innerMap`
instance and attach the `TrafficLayer` to it.

#### HTML

```html
<gmp-map
  center="34.04924594193164,-118.24104309082031"
  zoom="13"
  map-id="DEMO_MAP_ID"
  internal-usage-attribution-ids="gmp_git_agentskills_v1"
  style="height: 400px; width: 100%;"
></gmp-map>
```

#### TypeScript

```typescript
async function init(): Promise<void> {
  const { TrafficLayer } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;

  const mapElement = document.querySelector<google.maps.MapElement>('gmp-map')!;
  const innerMap = mapElement.innerMap;

  const trafficLayer = new TrafficLayer();

  trafficLayer.setMap(innerMap);
}

void init();
```

#### JavaScript

```javascript
async function init() {
  const { TrafficLayer } = await google.maps.importLibrary('maps');

  const mapElement = document.querySelector('gmp-map');
  const innerMap = mapElement.innerMap;

  const trafficLayer = new TrafficLayer();

  trafficLayer.setMap(innerMap);
}

void init();
```

--------------------------------------------------------------------------------

### 2. Using `google.maps.Map` (Programmatic Initialization)

If you instantiate your map programmatically on a standard HTML `<div>` element,
pass the `Map` instance directly to `trafficLayer.setMap(map)`.

*Source:
[samples/layer-traffic/index.ts](https://github.com/googlemaps/js-samples/blob/HEAD/samples/layer-traffic/index.ts?utm_campaign=gmp_git_agentskills_v1)*

#### TypeScript

```typescript
async function initMap(): Promise<void> {
  const { Map, TrafficLayer } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;

  const map = new Map(
    document.getElementById("map") as HTMLElement,
    {
      zoom: 13,
      center: { lat: 34.04924594193164, lng: -118.24104309082031 },
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
    }
  );

  const trafficLayer = new TrafficLayer();

  trafficLayer.setMap(map);
}

void initMap();
```

--------------------------------------------------------------------------------

## Managing Layer Lifecycle (Toggling and Removing)

To remove or hide the `TrafficLayer` from the map (or to toggle it dynamically
in response to user interaction), call `setMap(null)`. You can check if a layer
is currently active using `getMap()`.

```typescript
function toggleTrafficLayer(
  trafficLayer: google.maps.TrafficLayer,
  map: google.maps.Map
): void {
  if (trafficLayer.getMap()) {
    // Remove layer from the map
    trafficLayer.setMap(null);
  } else {
    // Re-attach layer to the map
    trafficLayer.setMap(map);
  }
}
```

--------------------------------------------------------------------------------

## Related Base Map Layers: Transit and Bicycling

In addition to `TrafficLayer`, the `maps` library provides two other
base-map-modifying layers that follow the exact same initialization and
lifecycle pattern.

### Transit Layer

The `TransitLayer` displays the public transit network of a city on your map.
When enabled on a supported city, major transit lines appear as thick, colored
lines (colored according to the transit line operator), and the base map style
is altered to emphasize transit routes.

*Source:
[samples/layer-transit/index.ts](https://github.com/googlemaps/js-samples/blob/HEAD/samples/layer-transit/index.ts?utm_campaign=gmp_git_agentskills_v1)*

#### Web Component (`gmp-map`)

```typescript
async function init(): Promise<void> {
  const { TransitLayer } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;

  const mapElement = document.querySelector<google.maps.MapElement>('gmp-map')!;
  const innerMap = mapElement.innerMap;

  const transitLayer = new TransitLayer();

  transitLayer.setMap(innerMap);
}

void init();
```

#### Programmatic (`google.maps.Map`)

```typescript
async function initMap(): Promise<void> {
  const { Map, TransitLayer } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;

  const map = new Map(
    document.getElementById("map") as HTMLElement,
    {
      zoom: 13,
      center: { lat: 51.501904, lng: -0.115871 }, // London, UK
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
    }
  );

  const transitLayer = new TransitLayer();

  transitLayer.setMap(map);
}

void initMap();
```

### Bicycling Layer

The `BicyclingLayer` renders bike paths, suggested bike routes, and other
bicycling-specific overlays while altering the base map style to emphasize
streets supporting bicycle routes:

*   **Dark green routes:** Dedicated bicycle routes.
*   **Light green routes:** Streets with dedicated "bike lanes."
*   **Dashed routes:** Streets or paths otherwise recommended for bicycle usage.

*Source:
[samples/layer-bicycling/index.ts](https://github.com/googlemaps/js-samples/blob/HEAD/samples/layer-bicycling/index.ts?utm_campaign=gmp_git_agentskills_v1)*

#### Web Component (`gmp-map`)

```typescript
async function init(): Promise<void> {
  const { BicyclingLayer } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;

  const mapElement = document.querySelector<google.maps.MapElement>('gmp-map')!;
  const innerMap = mapElement.innerMap;

  const bikeLayer = new BicyclingLayer();

  bikeLayer.setMap(innerMap);
}

void init();
```

#### Programmatic (`google.maps.Map`)

```typescript
async function initMap(): Promise<void> {
  const { Map, BicyclingLayer } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;

  const map = new Map(
    document.getElementById("map") as HTMLElement,
    {
      zoom: 14,
      center: { lat: 42.3726399, lng: -71.1096528 }, // Cambridge, MA
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
    }
  );

  const bikeLayer = new BicyclingLayer();

  bikeLayer.setMap(map);
}

void initMap();
```
