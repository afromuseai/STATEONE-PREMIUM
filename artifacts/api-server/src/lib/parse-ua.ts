export function parseUserAgent(ua: string | null | undefined): {
  browser: string;
  os: string;
  device: string;
} {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Desktop" };

  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) && !/Chrome/.test(ua) ? "Safari"
    : /Chromium\//.test(ua) ? "Chromium"
    : "Unknown";

  const os =
    /iPhone/.test(ua) ? "iOS"
    : /iPad/.test(ua) ? "iPadOS"
    : /Android/.test(ua) ? "Android"
    : /Windows NT/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown";

  const device =
    /iPad/.test(ua) ? "Tablet"
    : /iPhone|Android.*Mobile|Mobile/.test(ua) ? "Mobile"
    : "Desktop";

  return { browser, os, device };
}
