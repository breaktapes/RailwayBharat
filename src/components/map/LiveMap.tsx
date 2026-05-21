'use client';
import { useCallback, useRef, useState, useEffect } from 'react';
import Map, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import { ScatterplotLayer } from '@deck.gl/layers';
import { DeckGL } from '@deck.gl/react';
import type { PickingInfo } from '@deck.gl/core';
import type { LiveTrain } from '@/types';
import { delayColor } from '@/components/ui/DelayBadge';
import 'maplibre-gl/dist/maplibre-gl.css';

// Dark base map — no API key required
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// OpenRailwayMap track overlay
const ORM_TILES = ['https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'];

const INDIA_VIEWPORT = {
  longitude: 80.9,
  latitude: 22.5,
  zoom: 4.8,
  pitch: 0,
  bearing: 0,
};

interface LiveMapProps {
  trains: LiveTrain[];
  onTrainClick: (train: LiveTrain) => void;
  showTracks?: boolean;
}

function useWebGLAvailable() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setAvailable(!!gl);
    } catch {
      setAvailable(false);
    }
  }, []);
  return available;
}

export function LiveMap({ trains, onTrainClick, showTracks = false }: LiveMapProps) {
  const mapRef = useRef<MapRef>(null);
  const webgl = useWebGLAvailable();
  const [viewport, setViewport] = useState(INDIA_VIEWPORT);
  const rafRef = useRef<number>(0);
  const [pulse, setPulse] = useState(0);

  // Animate dot pulse via requestAnimationFrame
  useEffect(() => {
    let start: number;
    function frame(ts: number) {
      if (!start) start = ts;
      const t = ((ts - start) % 2000) / 2000; // 0→1 over 2s
      setPulse(4 + Math.sin(t * Math.PI * 2) * 1.5); // oscillate 2.5px→5.5px
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const layers = [
    new ScatterplotLayer<LiveTrain>({
      id: 'trains',
      data: trains,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: pulse,
      radiusUnits: 'pixels',
      getFillColor: (d) => delayColor(d.delayMinutes),
      getLineColor: [255, 255, 255, 60],
      lineWidthMinPixels: 0.5,
      stroked: true,
      pickable: true,
      updateTriggers: { getRadius: [pulse] },
    }),
  ];

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info.object) onTrainClick(info.object as LiveTrain);
    },
    [onTrainClick]
  );

  if (webgl === null) return null; // still detecting

  return (
    <div className="map-container">
      <DeckGL
        initialViewState={INDIA_VIEWPORT}
        controller
        layers={layers}
        onClick={handleClick}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map
          ref={mapRef}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          reuseMaps
        >
          {showTracks && (
            <Source
              id="orm-tracks"
              type="raster"
              tiles={ORM_TILES}
              tileSize={256}
              attribution="© <a href='https://www.openrailwaymap.org'>OpenRailwayMap</a> contributors, CC-BY-SA 2.0"
            >
              <Layer
                id="orm-tracks-layer"
                type="raster"
                paint={{ 'raster-opacity': 0.5 }}
              />
            </Source>
          )}
        </Map>
      </DeckGL>
    </div>
  );
}
