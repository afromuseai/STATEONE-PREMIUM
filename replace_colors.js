const fs = require('fs');
const path = require('path');

const dir = 'artifacts/stageone/src/components/website-v2/ide';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

// Also include StudioLayout.tsx
files.push('../StudioLayout.tsx');

const replaceColors = (content) => {
  let newContent = content;

  // Backgrounds -> #1A1A1A
  newContent = newContent.replace(/bg-\[#(070707|080808|090909|0a0a0a|0b0b0b|0c0c0c|0d0d0d|0e0e0e|0f0f0f|111111|141414|050505|060606)\]/g, 'bg-[#1A1A1A]');
  newContent = newContent.replace(/bg-black\/[0-9]+/g, 'bg-[#202020]');
  newContent = newContent.replace(/bg-zinc-950/g, 'bg-[#1A1A1A]');
  
  // Secondary panels -> #252525
  newContent = newContent.replace(/bg-white\/\[0\.0[2-9]\]/g, 'bg-[#252525]');
  newContent = newContent.replace(/bg-white\/\[0\.1[0-9]?\]/g, 'bg-[#252525]');

  // Primary text -> #ECECEC
  newContent = newContent.replace(/text-white\/[7-9][0-9]/g, 'text-[#ECECEC]');
  newContent = newContent.replace(/text-white\b/g, 'text-[#ECECEC]');

  // Secondary text -> #A0A0A0
  newContent = newContent.replace(/text-white\/[1-6][0-9]/g, 'text-[#A0A0A0]');
  newContent = newContent.replace(/text-zinc-[3-5]00/g, 'text-[#A0A0A0]');

  // Borders -> rgba(255,255,255,0.08)
  newContent = newContent.replace(/border-white\/\[?[0-9\.]+\]?/g, 'border-[rgba(255,255,255,0.08)]');
  newContent = newContent.replace(/border-white\/[0-9]+/g, 'border-[rgba(255,255,255,0.08)]');

  // Remove amber/gold accents - convert to neutral #ECECEC or #A0A0A0 depending on context
  newContent = newContent.replace(/text-amber-[3-5]00\/[0-9]+/g, 'text-[#ECECEC]');
  newContent = newContent.replace(/text-amber-[3-5]00/g, 'text-[#ECECEC]');
  newContent = newContent.replace(/bg-amber-[3-5]00\/[0-9]+/g, 'bg-[#252525]');
  newContent = newContent.replace(/bg-amber-[3-5]00/g, 'bg-[#ECECEC] text-[#1A1A1A]'); // For solid buttons
  newContent = newContent.replace(/border-amber-[3-5]00\/[0-9]+/g, 'border-[rgba(255,255,255,0.08)]');
  newContent = newContent.replace(/ring-amber-[3-5]00\/[0-9]+/g, 'ring-[rgba(255,255,255,0.08)]');
  newContent = newContent.replace(/text-yellow-[3-5]00\/[0-9]+/g, 'text-[#ECECEC]');
  newContent = newContent.replace(/text-yellow-[3-5]00/g, 'text-[#ECECEC]');
  newContent = newContent.replace(/text-gold-gradient/g, 'text-[#ECECEC]');
  newContent = newContent.replace(/bg-gradient-to-br from-amber-[0-9]+\/[0-9]+ to-amber-[0-9]+\/[0-9]+/g, 'bg-[#252525]');

  // Remove glows
  newContent = newContent.replace(/shadow-\[0_0_[^\]]+\]/g, 'shadow-none');
  newContent = newContent.replace(/shadow-2xl/g, 'shadow-md');
  newContent = newContent.replace(/shadow-xl/g, 'shadow-sm');

  // Remove rounded-xl -> rounded-md or rounded-lg
  newContent = newContent.replace(/rounded-2xl/g, 'rounded-lg');
  newContent = newContent.replace(/rounded-xl/g, 'rounded-lg');

  return newContent;
};

for (const file of files) {
  const filePath = path.join(dir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = replaceColors(content);
    if (content !== updated) {
      fs.writeFileSync(filePath, updated);
      console.log(`Updated ${file}`);
    }
  }
}
