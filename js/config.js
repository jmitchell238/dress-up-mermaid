'use strict';

// Mermaid Dress-Up — Keep CACHE in sw.js in sync: 'dress-up-mermaid-' + GAME_VERSION
const GAME_VERSION = '1.0.004';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Mermaid Dress-Up';

const W = 390;
const H = 700;
const SAVE_KEY = 'dress-up-mermaid-save-v1';

/** Source layer art size (drawn scaled into the stage). */
const LAYER_W = 768;
const LAYER_H = 1024;

const MODES = {
  free:  { id: 'free',  name: 'Free Play',  tagline: 'Dress forever', challenge: false },
  match: { id: 'match', name: 'Match Me',   tagline: 'Copy the look', challenge: true },
};
const MODE_ORDER = ['free', 'match'];

const MAX_FAVORITES = 8;
const PRAISE = ['Pretty!', 'Wow!', 'Sparkly!', 'Yay!', 'Beautiful!', 'Magic!', 'Yes!', 'Splash!'];

/**
 * Draw order (back → front).
 * `look` = full illustrated mermaid (style + pose).
 * `prop` = handheld item she holds (shell, harp, …).
 */
const LAYER_ORDER = ['bg', 'look', 'jewelry', 'crown', 'prop'];

/** Background scenes */
const BACKGROUNDS = [
  { id: 'lagoon', label: 'Lagoon', src: 'art/layers/bg/lagoon.png', swatch: '#4FC3F7' },
  { id: 'coral',  label: 'Coral',  src: 'art/layers/bg/coral.png',  swatch: '#F48FB1' },
  { id: 'sunset', label: 'Sunset', src: 'art/layers/bg/sunset.png', swatch: '#FFB74D' },
  { id: 'cave',   label: 'Cave',   src: 'art/layers/bg/cave.png',   swatch: '#7E57C2' },
  { id: 'palace', label: 'Palace', src: 'art/layers/bg/palace.png', swatch: '#81D4FA' },
];

/**
 * Mermaid styles + poses (complete illustrated characters).
 * Colors = different outfits; pose-* = different body poses of the classic gold mermaid.
 */
const LOOKS = [
  { id: 'gold-teal',      label: 'Gold',     src: 'art/layers/look/gold-teal.png',      swatch: '#F5D76E' },
  { id: 'pink-sparkle',   label: 'Pink',     src: 'art/layers/look/pink-sparkle.png',   swatch: '#F48FB1' },
  { id: 'purple-night',   label: 'Purple',   src: 'art/layers/look/purple-night.png',   swatch: '#CE93D8' },
  { id: 'teal-braid',     label: 'Teal',     src: 'art/layers/look/teal-braid.png',     swatch: '#4DB6AC' },
  { id: 'ruby-sunset',    label: 'Ruby',     src: 'art/layers/look/ruby-sunset.png',    swatch: '#EF5350' },
  { id: 'silver-ice',     label: 'Silver',   src: 'art/layers/look/silver-ice.png',     swatch: '#E0E0E0' },
  { id: 'rainbow',        label: 'Rainbow',  src: 'art/layers/look/rainbow.png',        swatch: '#FF7043' },
  { id: 'peach-coral',    label: 'Peach',    src: 'art/layers/look/peach-coral.png',    swatch: '#FFAB91' },
  { id: 'deep-emerald',   label: 'Emerald',  src: 'art/layers/look/deep-emerald.png',   swatch: '#66BB6A' },
  { id: 'lavender-pearl', label: 'Lavender', src: 'art/layers/look/lavender-pearl.png', swatch: '#B39DDB' },
  { id: 'pose-wave',      label: 'Wave',     src: 'art/layers/look/pose-wave.png',      swatch: '#81D4FA' },
  { id: 'pose-side',      label: 'Side',     src: 'art/layers/look/pose-side.png',      swatch: '#CE93D8' },
  { id: 'pose-swim',      label: 'Swim',     src: 'art/layers/look/pose-swim.png',      swatch: '#4DB6AC' },
];

/** Crowns / tiaras (none = bare) */
const CROWNS = [
  { id: 'none',         label: 'None',    src: null, swatch: '#90A4AE' },
  { id: 'tiara-gold',   label: 'Gold',    src: 'art/layers/crown/tiara-gold.png',   swatch: '#FFD54F' },
  { id: 'tiara-pearl',  label: 'Pearl',   src: 'art/layers/crown/tiara-pearl.png',  swatch: '#ECEFF1' },
  { id: 'coral-crown',  label: 'Coral',   src: 'art/layers/crown/coral-crown.png',  swatch: '#FF8A65' },
  { id: 'starfish',     label: 'Star',    src: 'art/layers/crown/starfish.png',     swatch: '#FFB74D' },
  { id: 'crystal',      label: 'Crystal', src: 'art/layers/crown/crystal.png',      swatch: '#80DEEA' },
  { id: 'flower-crown', label: 'Flower',  src: 'art/layers/crown/flower-crown.png', swatch: '#F48FB1' },
];

/** Necklaces / jewelry (none = bare) — open U-necklaces, not bracelets */
const JEWELRY = [
  { id: 'none',         label: 'None',     src: null, swatch: '#90A4AE' },
  { id: 'pearls',       label: 'Pearls',   src: 'art/layers/jewelry/pearls.png',       swatch: '#FFF8E1' },
  { id: 'shell-choker', label: 'Shell',    src: 'art/layers/jewelry/shell-choker.png', swatch: '#FFE0B2' },
  { id: 'gem-blue',     label: 'Sapphire', src: 'art/layers/jewelry/gem-blue.png',     swatch: '#4FC3F7' },
  { id: 'gem-pink',     label: 'Ruby',     src: 'art/layers/jewelry/gem-pink.png',     swatch: '#F06292' },
  { id: 'gold-chain',   label: 'Gold',     src: 'art/layers/jewelry/gold-chain.png',   swatch: '#FFD54F' },
  { id: 'sea-glass',    label: 'Glass',    src: 'art/layers/jewelry/sea-glass.png',    swatch: '#80CBC4' },
];

/**
 * Handheld props — things she holds in her hand (not part of her body).
 * Clean isolated icons only (no mermaid leftovers).
 */
const PROPS = [
  { id: 'none',    label: 'None',    src: null, swatch: '#90A4AE' },
  { id: 'shell',   label: 'Shell',   src: 'art/layers/prop/shell.png',   swatch: '#FFCCBC' },
  { id: 'harp',    label: 'Harp',    src: 'art/layers/prop/harp.png',    swatch: '#FFD54F' },
  { id: 'trident', label: 'Trident', src: 'art/layers/prop/trident.png', swatch: '#90CAF9' },
  { id: 'mirror',  label: 'Mirror',  src: 'art/layers/prop/mirror.png',  swatch: '#CE93D8' },
  { id: 'bubble',  label: 'Bubbles', src: 'art/layers/prop/bubble.png',  swatch: '#B3E5FC' },
];

const CATEGORIES = [
  { id: 'bg',      label: 'Scene',   items: BACKGROUNDS, required: true },
  { id: 'look',    label: 'Mermaid', items: LOOKS,       required: true },
  { id: 'crown',   label: 'Crown',   items: CROWNS,      required: false },
  { id: 'jewelry', label: 'Gems',    items: JEWELRY,     required: false },
  { id: 'prop',    label: 'Hold',    items: PROPS,       required: false },
];

const DEFAULT_OUTFIT = {
  bg: 'lagoon',
  look: 'gold-teal',
  crown: 'none',
  jewelry: 'none',
  prop: 'none',
};

/** All image paths used by the game (for SW precache + loader). */
function allLayerSrcs() {
  const set = new Set();
  for (const cat of CATEGORIES) {
    for (const item of cat.items) {
      if (item.src) set.add(item.src);
    }
  }
  return [...set];
}
