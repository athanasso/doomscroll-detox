/**
 * Generate all app icons for Doomscroll Detox.
 *
 * Design: A shield shape with a "no scrolling" symbol —
 * a phone/scroll icon with a diagonal strike-through,
 * rendered in indigo (#818cf8) on midnight blue (#0f172a).
 *
 * Generates:
 *   - icon.png (1024x1024) — main app icon
 *   - android-icon-foreground.png (512x512) — adaptive icon foreground
 *   - android-icon-background.png (512x512) — adaptive icon background
 *   - android-icon-monochrome.png (432x432) — monochrome adaptive icon
 *   - favicon.png (48x48)
 *   - splash-icon.png (1024x1024)
 */
const sharp = require("sharp");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "images");

// Brand colors
const MIDNIGHT = "#0f172a";
const SLATE = "#1e293b";
const ACCENT = "#818cf8";
const ACCENT_SOFT = "#6366f1";
const TEXT_BRIGHT = "#f8fafc";

/**
 * Create an SVG shield with a "no-scroll" motif.
 * The shield has a phone icon with a diagonal line through it.
 */
function createIconSvg(
  size,
  { withBackground = true, monochrome = false } = {},
) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;

  const shieldColor = monochrome ? "#ffffff" : ACCENT;
  const phoneColor = monochrome ? "#ffffff" : TEXT_BRIGHT;
  const strikeColor = monochrome ? "#ffffff" : "#f87171";
  const bgColor = MIDNIGHT;

  // Shield path (centered, sized relative to canvas)
  const shieldScale = s * 0.38;
  const shieldY = cy - shieldScale * 0.05;

  // Phone dimensions (inside shield)
  const phoneW = s * 0.12;
  const phoneH = s * 0.2;
  const phoneX = cx - phoneW / 2;
  const phoneY = cy - phoneH / 2 + s * 0.02;
  const phoneR = s * 0.02;

  // Scroll lines on phone screen
  const lineX1 = phoneX + phoneW * 0.2;
  const lineX2 = phoneX + phoneW * 0.8;
  const lineY1 = phoneY + phoneH * 0.3;
  const lineY2 = phoneY + phoneH * 0.45;
  const lineY3 = phoneY + phoneH * 0.6;
  const lineStroke = Math.max(s * 0.012, 1);

  // Diagonal strike
  const strikeLen = s * 0.22;
  const strikeStroke = Math.max(s * 0.025, 2);
  const sx1 = cx - strikeLen * 0.7;
  const sy1 = cy - strikeLen * 0.5;
  const sx2 = cx + strikeLen * 0.7;
  const sy2 = cy + strikeLen * 0.7;

  // Small down-arrow (scroll indicator) below phone
  const arrowY = phoneY + phoneH + s * 0.03;
  const arrowSize = s * 0.035;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`;

  if (withBackground) {
    // Rounded rect background
    svg += `<rect width="${s}" height="${s}" rx="${s * 0.18}" fill="${bgColor}"/>`;
    // Subtle radial glow
    svg += `<defs><radialGradient id="glow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient></defs>`;
    svg += `<rect width="${s}" height="${s}" rx="${s * 0.18}" fill="url(#glow)"/>`;
  }

  // Shield shape
  svg += `<path d="
    M ${cx} ${shieldY - shieldScale * 0.95}
    C ${cx + shieldScale * 0.05} ${shieldY - shieldScale * 0.95}
      ${cx + shieldScale * 0.85} ${shieldY - shieldScale * 0.75}
      ${cx + shieldScale * 0.85} ${shieldY - shieldScale * 0.55}
    L ${cx + shieldScale * 0.85} ${shieldY + shieldScale * 0.05}
    C ${cx + shieldScale * 0.85} ${shieldY + shieldScale * 0.55}
      ${cx + shieldScale * 0.15} ${shieldY + shieldScale * 0.95}
      ${cx} ${shieldY + shieldScale * 1.05}
    C ${cx - shieldScale * 0.15} ${shieldY + shieldScale * 0.95}
      ${cx - shieldScale * 0.85} ${shieldY + shieldScale * 0.55}
      ${cx - shieldScale * 0.85} ${shieldY + shieldScale * 0.05}
    L ${cx - shieldScale * 0.85} ${shieldY - shieldScale * 0.55}
    C ${cx - shieldScale * 0.85} ${shieldY - shieldScale * 0.75}
      ${cx - shieldScale * 0.05} ${shieldY - shieldScale * 0.95}
      ${cx} ${shieldY - shieldScale * 0.95}
    Z
  " fill="${monochrome ? "none" : SLATE}" stroke="${shieldColor}" stroke-width="${s * 0.02}" opacity="0.95"/>`;

  // Phone body (rounded rect)
  svg += `<rect x="${phoneX}" y="${phoneY}" width="${phoneW}" height="${phoneH}"
    rx="${phoneR}" fill="none" stroke="${phoneColor}" stroke-width="${lineStroke * 1.5}"
    opacity="${monochrome ? 1 : 0.9}"/>`;

  // Screen lines (representing scrollable content)
  svg += `<line x1="${lineX1}" y1="${lineY1}" x2="${lineX2}" y2="${lineY1}"
    stroke="${phoneColor}" stroke-width="${lineStroke}" stroke-linecap="round" opacity="0.6"/>`;
  svg += `<line x1="${lineX1}" y1="${lineY2}" x2="${lineX2 - phoneW * 0.15}" y2="${lineY2}"
    stroke="${phoneColor}" stroke-width="${lineStroke}" stroke-linecap="round" opacity="0.6"/>`;
  svg += `<line x1="${lineX1}" y1="${lineY3}" x2="${lineX2}" y2="${lineY3}"
    stroke="${phoneColor}" stroke-width="${lineStroke}" stroke-linecap="round" opacity="0.6"/>`;

  // Down arrows (scroll symbol)
  svg += `<polyline points="${cx - arrowSize},${arrowY} ${cx},${arrowY + arrowSize} ${cx + arrowSize},${arrowY}"
    fill="none" stroke="${phoneColor}" stroke-width="${lineStroke}" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>`;

  // Diagonal strike-through (the "no" symbol)
  svg += `<line x1="${sx1}" y1="${sy1}" x2="${sx2}" y2="${sy2}"
    stroke="${monochrome ? "#ffffff" : strikeColor}" stroke-width="${strikeStroke}"
    stroke-linecap="round" opacity="${monochrome ? 0.9 : 0.85}"/>`;

  svg += `</svg>`;
  return svg;
}

/**
 * Create a simple gradient background for adaptive icon.
 */
function createBackgroundSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${MIDNIGHT}"/>
        <stop offset="100%" stop-color="${SLATE}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <defs><radialGradient id="glow2" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#glow2)"/>
  </svg>`;
}

/**
 * Create splash icon — larger shield, no background.
 */
function createSplashSvg(size) {
  return createIconSvg(size, { withBackground: false });
}

async function generate() {
  console.log("Generating icons...");

  // Main icon (1024x1024)
  await sharp(Buffer.from(createIconSvg(1024)))
    .png()
    .toFile(path.join(OUT, "icon.png"));
  console.log("  ✓ icon.png (1024x1024)");

  // Android adaptive foreground (512x512) — no background, just the motif
  await sharp(Buffer.from(createIconSvg(512, { withBackground: false })))
    .png()
    .toFile(path.join(OUT, "android-icon-foreground.png"));
  console.log("  ✓ android-icon-foreground.png (512x512)");

  // Android adaptive background (512x512)
  await sharp(Buffer.from(createBackgroundSvg(512)))
    .png()
    .toFile(path.join(OUT, "android-icon-background.png"));
  console.log("  ✓ android-icon-background.png (512x512)");

  // Android monochrome (432x432)
  await sharp(
    Buffer.from(
      createIconSvg(432, { withBackground: false, monochrome: true }),
    ),
  )
    .png()
    .toFile(path.join(OUT, "android-icon-monochrome.png"));
  console.log("  ✓ android-icon-monochrome.png (432x432)");

  // Favicon (48x48)
  await sharp(Buffer.from(createIconSvg(256)))
    .resize(48, 48)
    .png()
    .toFile(path.join(OUT, "favicon.png"));
  console.log("  ✓ favicon.png (48x48)");

  // Splash icon (1024x1024) — just the motif, transparent bg
  await sharp(Buffer.from(createSplashSvg(1024)))
    .png()
    .toFile(path.join(OUT, "splash-icon.png"));
  console.log("  ✓ splash-icon.png (1024x1024)");

  console.log("\nAll icons generated successfully!");
}

generate().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
