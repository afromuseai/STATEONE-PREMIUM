import { useRef, useEffect, useState, useCallback } from "react";

interface GlobeCountry {
  country: string;
  users: number;
  sessions: number;
  activeUsers: number;
}

interface GeoGlobeProps {
  countries: GlobeCountry[];
  size?: number;
}

// Country name → [lat, lng] centroid
const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [37.09, -95.71],
  "USA": [37.09, -95.71],
  "United Kingdom": [55.37, -3.43],
  "UK": [55.37, -3.43],
  "Canada": [56.13, -106.34],
  "Germany": [51.16, 10.45],
  "France": [46.22, 2.21],
  "Australia": [-25.27, 133.77],
  "India": [20.59, 78.96],
  "Brazil": [-14.23, -51.92],
  "Japan": [36.20, 138.25],
  "Netherlands": [52.13, 5.29],
  "Sweden": [60.12, 18.64],
  "Spain": [40.46, -3.74],
  "Italy": [41.87, 12.56],
  "Mexico": [23.63, -102.55],
  "Singapore": [1.35, 103.81],
  "South Korea": [35.90, 127.76],
  "Poland": [51.91, 19.14],
  "Norway": [60.47, 8.46],
  "Denmark": [56.26, 9.50],
  "Switzerland": [46.81, 8.22],
  "Argentina": [-38.41, -63.61],
  "Nigeria": [9.08, 8.67],
  "South Africa": [-30.55, 22.93],
  "China": [35.86, 104.19],
  "Russia": [61.52, 105.31],
  "Pakistan": [30.37, 69.34],
  "Bangladesh": [23.68, 90.35],
  "Philippines": [12.87, 121.77],
  "Vietnam": [14.05, 108.27],
  "Thailand": [15.87, 100.99],
  "Malaysia": [4.21, 101.97],
  "Indonesia": [-0.78, 113.92],
  "Egypt": [26.82, 30.80],
  "Kenya": [-0.02, 37.90],
  "Ghana": [7.95, -1.02],
  "Turkey": [38.96, 35.24],
  "Ukraine": [48.37, 31.16],
  "Portugal": [39.39, -8.22],
  "Belgium": [50.50, 4.46],
  "Austria": [47.51, 14.55],
  "Finland": [61.92, 25.74],
  "Czech Republic": [49.81, 15.47],
  "Romania": [45.94, 24.96],
  "Hungary": [47.16, 19.50],
  "Greece": [39.07, 21.82],
  "New Zealand": [-40.90, 174.88],
  "Ireland": [53.41, -8.24],
  "Israel": [31.04, 34.85],
  "Saudi Arabia": [23.88, 45.07],
  "UAE": [23.42, 53.84],
  "United Arab Emirates": [23.42, 53.84],
  "Colombia": [4.57, -74.29],
  "Chile": [-35.67, -71.54],
  "Peru": [-9.19, -75.01],
  "Venezuela": [6.42, -66.58],
  "Morocco": [31.79, -7.09],
  "Ethiopia": [9.14, 40.48],
  "Tanzania": [-6.36, 34.88],
  "Zimbabwe": [-19.01, 29.15],
  "Cameroon": [7.36, 12.35],
  "Sri Lanka": [7.87, 80.77],
  "Nepal": [28.39, 84.12],
  "Myanmar": [17.11, 96.00],
  "Cambodia": [12.56, 104.99],
  "Jordan": [30.58, 36.23],
  "Lebanon": [33.85, 35.86],
  "Kuwait": [29.31, 47.48],
  "Qatar": [25.35, 51.18],
  "Bahrain": [26.00, 50.55],
  "Oman": [21.51, 55.92],
  "Ecuador": [-1.83, -78.18],
  "Bolivia": [-16.29, -63.58],
  "Paraguay": [-23.44, -58.44],
  "Uruguay": [-32.52, -55.76],
  "Panama": [8.53, -80.78],
  "Costa Rica": [9.74, -83.75],
  "Guatemala": [15.78, -90.23],
  "Honduras": [15.19, -86.24],
  "Nicaragua": [12.86, -85.20],
  "Cuba": [21.52, -77.78],
  "Jamaica": [18.10, -77.29],
  "Trinidad and Tobago": [10.69, -61.22],
  "Slovakia": [48.66, 19.69],
  "Croatia": [45.10, 15.20],
  "Serbia": [44.01, 21.00],
  "Bulgaria": [42.73, 25.48],
  "Lithuania": [55.16, 23.88],
  "Latvia": [56.87, 24.60],
  "Estonia": [58.59, 25.01],
  "Belarus": [53.70, 27.95],
  "Kazakhstan": [48.01, 66.92],
  "Uzbekistan": [41.37, 64.58],
  "Azerbaijan": [40.14, 47.57],
  "Georgia": [42.31, 43.35],
  "Armenia": [40.06, 45.03],
  "Algeria": [28.03, 1.65],
  "Tunisia": [33.88, 9.53],
  "Libya": [26.33, 17.22],
  "Sudan": [12.86, 30.21],
  "Somalia": [5.15, 46.19],
  "Mozambique": [-18.66, 35.52],
  "Madagascar": [-18.76, 46.86],
  "Angola": [-11.20, 17.87],
  "Zambia": [-13.13, 27.84],
  "Malawi": [-13.25, 34.30],
  "Rwanda": [-1.94, 29.87],
  "Uganda": [1.37, 32.29],
  "Ivory Coast": [7.54, -5.55],
  "Senegal": [14.49, -14.45],
  "Mali": [17.57, -3.99],
  "Niger": [17.60, 8.08],
  "Chad": [15.45, 18.73],
  "Burkina Faso": [12.36, -1.56],
  "Guinea": [11.80, -15.18],
  "Benin": [9.30, 2.31],
  "Togo": [8.61, 0.82],
  "Sierra Leone": [8.46, -11.78],
  "Liberia": [6.42, -9.42],
  "Mauritius": [-20.34, 57.55],
  "Botswana": [-22.32, 24.68],
  "Namibia": [-22.95, 18.49],
  "Lesotho": [-29.60, 28.23],
  "Eswatini": [-26.52, 31.46],
  "Gabon": [-0.80, 11.60],
  "Congo": [-0.22, 15.82],
  "DR Congo": [-4.03, 21.75],
  "Afghanistan": [33.93, 67.70],
  "Iraq": [33.22, 43.68],
  "Iran": [32.42, 53.68],
  "Syria": [34.80, 38.99],
  "Yemen": [15.55, 48.51],
  "Mongolia": [46.86, 103.84],
  "North Korea": [40.33, 127.51],
  "Taiwan": [23.69, 120.96],
  "Hong Kong": [22.39, 114.10],
  "Macau": [22.19, 113.54],
  "Papua New Guinea": [-6.31, 143.95],
  "Fiji": [-17.71, 178.06],
};

function latLngToXYZ(lat: number, lng: number, rotY: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + rotY) * (Math.PI / 180);
  return [
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ];
}

export function GeoGlobe({ countries, size = 340 }: GeoGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; country: string; users: number } | null>(null);
  const [paused, setPaused] = useState(false);

  const countryMap = new Map(countries.map(c => [c.country, c]));
  const maxUsers = Math.max(...countries.map(c => c.users), 1);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 4;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw sphere background with radial gradient
    const bg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r);
    bg.addColorStop(0, "rgba(99,102,241,0.18)");
    bg.addColorStop(0.5, "rgba(30,27,75,0.55)");
    bg.addColorStop(1, "rgba(10,8,30,0.95)");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // Sphere border glow
    const glow = ctx.createRadialGradient(cx, cy, r - 2, cx, cy, r + 6);
    glow.addColorStop(0, "rgba(99,102,241,0.35)");
    glow.addColorStop(1, "rgba(99,102,241,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Grid lines (lat/lng)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = "rgba(99,102,241,0.12)";
    ctx.lineWidth = 0.5;

    // Longitude lines
    for (let lng = -180; lng < 180; lng += 30) {
      ctx.beginPath();
      let first = true;
      for (let lat = -90; lat <= 90; lat += 2) {
        const [x3, y3, z3] = latLngToXYZ(lat, lng, rotRef.current);
        const px = cx + x3 * r;
        const py = cy - y3 * r;
        if (z3 < 0) { first = true; continue; }
        if (first) { ctx.moveTo(px, py); first = false; } else { ctx.lineTo(px, py); }
      }
      ctx.stroke();
    }

    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let first = true;
      for (let lng2 = -180; lng2 <= 180; lng2 += 2) {
        const [x3, y3, z3] = latLngToXYZ(lat, lng2, rotRef.current);
        const px = cx + x3 * r;
        const py = cy - y3 * r;
        if (z3 < 0) { first = true; continue; }
        if (first) { ctx.moveTo(px, py); first = false; } else { ctx.lineTo(px, py); }
      }
      ctx.stroke();
    }

    ctx.restore();

    // Country dots
    let hoveredCountry: { country: string; users: number; px: number; py: number } | null = null;
    const mouse = mouseRef.current;

    for (const [name, data] of countryMap) {
      const coords = COUNTRY_COORDS[name];
      if (!coords) continue;
      const [lat, lng] = coords;
      const [x3, y3, z3] = latLngToXYZ(lat, lng, rotRef.current);
      if (z3 < 0.05) continue; // behind globe

      const px = cx + x3 * r;
      const py = cy - y3 * r;
      const pct = Math.sqrt(data.users / maxUsers);
      const dotR = 3 + pct * 9;

      // Check hover
      const isHovered = mouse && Math.hypot(mouse.x - px, mouse.y - py) < dotR + 4;
      if (isHovered) hoveredCountry = { country: name, users: data.users, px, py };

      // Outer glow
      const glow2 = ctx.createRadialGradient(px, py, 0, px, py, dotR * 2.5);
      if (data.activeUsers > 0) {
        glow2.addColorStop(0, "rgba(16,185,129,0.5)");
        glow2.addColorStop(1, "rgba(16,185,129,0)");
      } else {
        glow2.addColorStop(0, "rgba(212,175,55,0.45)");
        glow2.addColorStop(1, "rgba(212,175,55,0)");
      }
      ctx.beginPath();
      ctx.arc(px, py, dotR * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = glow2;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? dotR + 2 : dotR, 0, Math.PI * 2);
      ctx.fillStyle = data.activeUsers > 0 ? "#10B981" : "#D4AF37";
      ctx.fill();

      // Dot highlight
      ctx.beginPath();
      ctx.arc(px - dotR * 0.25, py - dotR * 0.3, dotR * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fill();
    }

    // Hover tooltip (inline on canvas)
    if (hoveredCountry && mouse) {
      setTooltip({ x: hoveredCountry.px, y: hoveredCountry.py, country: hoveredCountry.country, users: hoveredCountry.users });
    } else if (!mouse) {
      setTooltip(null);
    }
  }, [countryMap, maxUsers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, [size]);

  useEffect(() => {
    let last = performance.now();
    const loop = (now: number) => {
      if (!pausedRef.current) {
        rotRef.current = (rotRef.current + (now - last) * 0.02) % 360;
      }
      last = now;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseLeave = () => {
    mouseRef.current = null;
    setTooltip(null);
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(p => !p);
  };

  return (
    <div className="relative inline-flex flex-col items-center select-none">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, cursor: "pointer" }}
        onClick={togglePause}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-black/80 backdrop-blur px-3 py-2 text-xs shadow-xl"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 12,
            transform: tooltip.x > size * 0.65 ? "translateX(-110%)" : undefined,
          }}
        >
          <p className="font-black text-foreground">{tooltip.country}</p>
          <p className="text-muted-foreground">{tooltip.users.toLocaleString()} user{tooltip.users !== 1 ? "s" : ""}</p>
        </div>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground/50 tracking-widest uppercase">
        {paused ? "Click to resume" : "Click to pause · Hover for details"}
      </p>
    </div>
  );
}
