import { useState } from "react"
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps"

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

interface GeoCountry {
  country: string
  users: number
  sessions: number
  activeUsers: number
}

interface GeoWorldMapProps {
  countries: GeoCountry[]
}

const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [-95.71, 37.09],
  "USA": [-95.71, 37.09],
  "United Kingdom": [-3.43, 55.37],
  "UK": [-3.43, 55.37],
  "Canada": [-106.34, 56.13],
  "Germany": [10.45, 51.16],
  "France": [2.21, 46.22],
  "Australia": [133.77, -25.27],
  "India": [78.96, 20.59],
  "Brazil": [-51.92, -14.23],
  "Japan": [138.25, 36.20],
  "Netherlands": [5.29, 52.13],
  "Sweden": [18.64, 60.12],
  "Spain": [-3.74, 40.46],
  "Italy": [12.56, 41.87],
  "Mexico": [-102.55, 23.63],
  "Singapore": [103.81, 1.35],
  "South Korea": [127.76, 35.90],
  "Poland": [19.14, 51.91],
  "Norway": [8.46, 60.47],
  "Denmark": [9.50, 56.26],
  "Switzerland": [8.22, 46.81],
  "Argentina": [-63.61, -38.41],
  "Nigeria": [8.67, 9.08],
  "South Africa": [22.93, -30.55],
  "China": [104.19, 35.86],
  "Russia": [105.31, 61.52],
  "Pakistan": [69.34, 30.37],
  "Bangladesh": [90.35, 23.68],
  "Philippines": [121.77, 12.87],
  "Vietnam": [108.27, 14.05],
  "Thailand": [100.99, 15.87],
  "Malaysia": [101.97, 4.21],
  "Indonesia": [113.92, -0.78],
  "Egypt": [30.80, 26.82],
  "Kenya": [37.90, -0.02],
  "Turkey": [35.24, 38.96],
  "Ukraine": [31.16, 48.37],
  "Portugal": [-8.22, 39.39],
  "Belgium": [4.46, 50.50],
  "Austria": [14.55, 47.51],
  "Finland": [25.74, 61.92],
  "Czech Republic": [15.47, 49.81],
  "Romania": [24.96, 45.94],
  "Greece": [21.82, 39.07],
  "New Zealand": [174.88, -40.90],
  "Ireland": [-8.24, 53.41],
  "Israel": [34.85, 31.04],
  "Saudi Arabia": [45.07, 23.88],
  "UAE": [53.84, 23.42],
  "United Arab Emirates": [53.84, 23.42],
  "Colombia": [-74.29, 4.57],
  "Chile": [-71.54, -35.67],
  "Peru": [-75.01, -9.19],
  "Morocco": [-7.09, 31.79],
  "Ethiopia": [40.48, 9.14],
  "Ghana": [-1.02, 7.95],
  "Sri Lanka": [80.77, 7.87],
  "Nepal": [84.12, 28.39],
  "Jordan": [36.23, 30.58],
  "Lebanon": [35.86, 33.85],
  "Qatar": [51.18, 25.35],
  "Ecuador": [-78.18, -1.83],
  "Bolivia": [-63.58, -16.29],
  "Venezuela": [-66.58, 6.42],
  "Cuba": [-77.78, 21.52],
  "Slovakia": [19.69, 48.66],
  "Croatia": [15.20, 45.10],
  "Bulgaria": [25.48, 42.73],
  "Lithuania": [23.88, 55.16],
  "Latvia": [24.60, 56.87],
  "Estonia": [25.01, 58.59],
  "Kazakhstan": [66.92, 48.01],
  "Algeria": [1.65, 28.03],
  "Tunisia": [9.53, 33.88],
  "Sudan": [30.21, 12.86],
  "DR Congo": [21.75, -4.03],
  "Iran": [53.68, 32.42],
  "Iraq": [43.68, 33.22],
  "Syria": [38.99, 34.80],
  "Taiwan": [120.96, 23.69],
  "Hong Kong": [114.10, 22.39],
}

export function GeoWorldMap({ countries }: GeoWorldMapProps) {
  const [tooltip, setTooltip] = useState<{ country: string; users: number; activeUsers: number } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const maxUsers = Math.max(...countries.map(c => c.users), 1)
  const countryMap = new Map(countries.map(c => [c.country, c]))

  const markers = countries
    .map(c => {
      const coords = COUNTRY_COORDS[c.country]
      if (!coords) return null
      return { ...c, coords }
    })
    .filter(Boolean) as (GeoCountry & { coords: [number, number] })[]

  return (
    <div className="relative w-full" style={{ background: "#050e1f", borderRadius: 12, overflow: "hidden" }}>
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 147 }}
        width={900}
        height={460}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup zoom={1} minZoom={1} maxZoom={4}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: import("react-simple-maps").GeographyItem[] }) =>
              geographies.map((geo: import("react-simple-maps").GeographyItem) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: "#0b2040", stroke: "#0d2a55", strokeWidth: 0.4, outline: "none" },
                    hover:   { fill: "#0f2d5a", stroke: "#1a3d70", strokeWidth: 0.5, outline: "none" },
                    pressed: { fill: "#0b2040", outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Lat/lng grid lines */}
          {[-60, -30, 0, 30, 60].map(lat => (
            <line key={`lat-${lat}`} />
          ))}

          {markers.map(marker => {
            const pct = Math.sqrt(marker.users / maxUsers)
            const r = 3 + pct * 9
            const isActive = marker.activeUsers > 0
            const color = isActive ? "#10B981" : "#D4AF37"
            const glowColor = isActive ? "rgba(16,185,129,0.35)" : "rgba(212,175,55,0.35)"

            return (
              <Marker
                key={marker.country}
                coordinates={marker.coords}
                onMouseEnter={(e: React.MouseEvent) => {
                  setTooltip({ country: marker.country, users: marker.users, activeUsers: marker.activeUsers })
                  setTooltipPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Glow ring */}
                <circle r={r * 2.2} fill={glowColor} />
                {/* Dot */}
                <circle r={r} fill={color} opacity={0.9} />
                {/* Highlight */}
                <circle r={r * 0.35} cx={-r * 0.25} cy={-r * 0.3} fill="rgba(255,255,255,0.4)" />
              </Marker>
            )
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border border-white/10 bg-black/90 backdrop-blur px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 40 }}
        >
          <p className="font-black text-foreground">{tooltip.country}</p>
          <p className="text-muted-foreground">{tooltip.users.toLocaleString()} user{tooltip.users !== 1 ? "s" : ""}</p>
          {tooltip.activeUsers > 0 && (
            <p className="text-green-400 text-[10px]">{tooltip.activeUsers} active now</p>
          )}
        </div>
      )}

      {/* Ocean label */}
      <div className="absolute bottom-2 right-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span className="text-[9px] text-muted-foreground/60">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
          <span className="text-[9px] text-muted-foreground/60">Registered</span>
        </div>
        <span className="text-[9px] text-muted-foreground/40">Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  )
}
