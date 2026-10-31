import type { ItemKind, Point } from './levels.ts';

export function icon(name: string, cls = ''): string {
  const paths: Record<string, string> = {
    rotate: '<path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/>',
    undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14" transform="translate(0 -2)"/>',
    restart: '<path d="M4 9a8 8 0 1 1 0 6M4 3v6h6"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16"/>',
    mute: '<path d="m11 4-6 5H2v6h3l6 5zM16 9l6 6m0-6-6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2M12 17h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    bolt: '<path d="m14 2-9 12h6l-1 8 9-12h-6z"/>',
    moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
    leaf: '<path d="M4 20c-3-9 2-16 16-16 0 14-7 19-16 16Zm0 0L15 9"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    external: '<path d="M14 3h7v7M21 3 10 14M10 4H4v16h16v-6"/>',
    seed: '<path d="M5 19C0 12 8 3 19 3c0 11-7 19-14 16Z"/><path d="m5 19 9-10"/>',
  };
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.seed}</svg>`;
}
const drawings: Record<ItemKind, string> = {
  seed: '<path d="M17 29C8 25 11 12 27 8c6 15 0 25-10 21Z" fill="#f8df9a" stroke="#956329" stroke-width="1.6"/><path d="m17 27 8-15m-6 11-3-4m6-2 3-1" fill="none" stroke="#956329" stroke-width="1.4" stroke-linecap="round"/>',
  nut: '<path d="M12 17c-4 9 0 16 8 16s12-7 8-16" fill="#dd9b63" stroke="#85502f" stroke-width="1.6"/><path d="M10 19c-2-9 22-9 20 0Z" fill="#85502f"/><path d="m20 12 2-5" stroke="#85502f" stroke-width="2.5" stroke-linecap="round"/><path d="M17 22v6" stroke="#f7d1a0" stroke-width="2" stroke-linecap="round"/>',
  berry: '<circle cx="15" cy="23" r="7" fill="#a38ab9" stroke="#66517c" stroke-width="1.5"/><circle cx="26" cy="23" r="7" fill="#a38ab9" stroke="#66517c" stroke-width="1.5"/><circle cx="20" cy="15" r="7" fill="#bfa8ce" stroke="#66517c" stroke-width="1.5"/><path d="m20 9 1-5 5 3" fill="none" stroke="#486b4c" stroke-width="2"/><path d="m17 14 2-2" stroke="#ede5f3" stroke-width="2" stroke-linecap="round"/>',
  leaf: '<path d="M11 29C5 15 15 7 31 8c0 15-8 25-20 21Z" fill="#a9c492" stroke="#526c3d" stroke-width="1.6"/><path d="M9 32 25 14m-8 10v-8m4 4h6" fill="none" stroke="#526c3d" stroke-width="1.6" stroke-linecap="round"/>',
  loot: '<path d="m20 6 11 8v13l-11 7-11-7V14Z" fill="#8dbdb7" stroke="#346b66" stroke-width="1.6"/><path d="m9 14 11 7 11-7M20 21v13M15 10l11 8" fill="none" stroke="#346b66" stroke-width="1.4"/><path d="m12 15 7 4" stroke="#dcf0e8" stroke-width="2" stroke-linecap="round"/>',
  paw: '<path d="M12 23c0-8 16-8 16 0 9 10-25 10-16 0Z" fill="#dda38d" stroke="#985f4c" stroke-width="1.5"/><ellipse cx="11" cy="15" rx="3" ry="4" fill="#dda38d" stroke="#985f4c" stroke-width="1.5"/><ellipse cx="20" cy="11" rx="3" ry="4" fill="#dda38d" stroke="#985f4c" stroke-width="1.5"/><ellipse cx="29" cy="15" rx="3" ry="4" fill="#dda38d" stroke="#985f4c" stroke-width="1.5"/>',
};
export function snack(kind: ItemKind, cls = ''): string {
  return `<svg class="snack-art ${cls}" viewBox="0 0 40 40" aria-hidden="true">${drawings[kind]}</svg>`;
}
export function miniShape(cells: Point[], kind: ItemKind): string {
  const width = Math.max(...cells.map(p => p[0])) + 1, height = Math.max(...cells.map(p => p[1])) + 1;
  return `<svg class="mini-shape ${kind}" viewBox="0 0 ${width * 28} ${height * 28}" aria-hidden="true">${cells.map(([x, y], i) => `<rect x="${x * 28 + 1}" y="${y * 28 + 1}" width="26" height="26" rx="6" fill="currentColor"/>${i === 0 ? `<g transform="translate(${x * 28} ${y * 28}) scale(.7)">${drawings[kind]}</g>` : `<circle cx="${x * 28 + 14}" cy="${y * 28 + 14}" r="2" fill="#fff8e9" opacity=".7"/>`}`).join('')}</svg>`;
}
export function hamster(cls = '', happy = false): string {
  return `<svg class="hamster ${cls}" viewBox="0 0 280 260" fill="none" aria-hidden="true">
    <ellipse cx="140" cy="236" rx="94" ry="12" fill="#e4d8c0"/>
    <path d="M74 83C42 58 54 24 77 28c16 2 22 20 26 32m74 0c4-12 10-30 26-32 23-4 35 30 3 55" fill="#c8945f" stroke="#5c4231" stroke-width="3"/>
    <path d="M77 66c-16-13-14-28-5-27 12 1 14 12 16 20m115 7c16-13 14-28 5-27-12 1-14 12-16 20" fill="#e7b29b"/>
    <path d="M68 204C17 158 46 51 139 50c92-1 123 108 73 154-4 25-37 35-72 34-35 1-68-9-72-34Z" fill="#d5a36b" stroke="#5c4231" stroke-width="3"/>
    <path d="M129 53c-20 41-11 59-50 75-35 15-37 52-8 74 12 26 45 31 69 31 27 0 56-6 69-31 29-23 25-59-8-73-39-16-31-35-50-76" fill="#fff1d6"/>
    <ellipse cx="70" cy="159" rx="25" ry="22" fill="#edc2a0"/><ellipse cx="210" cy="159" rx="25" ry="22" fill="#edc2a0"/>
    ${happy ? '<path d="m100 119 8-6 8 6m48 0 8-6 8 6" stroke="#4b3528" stroke-width="4" stroke-linecap="round"/>' : '<ellipse cx="108" cy="116" rx="5" ry="7" fill="#4b3528"/><ellipse cx="172" cy="116" rx="5" ry="7" fill="#4b3528"/><circle cx="110" cy="114" r="1.6" fill="#fff8e9"/><circle cx="174" cy="114" r="1.6" fill="#fff8e9"/>'}
    <path d="M134 137q6-6 12 0l-6 5Z" fill="#ab725a"/><path d="M140 142v6m0 0c-9 8-14 1-14-2m14 2c9 8 14 1 14-2" stroke="#5c4231" stroke-width="2.5" stroke-linecap="round"/>
    <path d="m50 137-18-4m17 15-21 3m202-14 18-4m-17 15 21 3" stroke="#8c6d52" stroke-width="2" stroke-linecap="round"/>
    <path d="M106 193q34-18 68 0l-3 44h-62Z" fill="#236b60"/>
    <path d="m109 203 60 0m-54 0 4 32m46-32-4 32" stroke="#a8c6a1" stroke-width="2" stroke-dasharray="4 5"/>
    <ellipse cx="102" cy="194" rx="14" ry="10" transform="rotate(25 102 194)" fill="#edc2a0" stroke="#5c4231" stroke-width="2.5"/>
    <ellipse cx="178" cy="194" rx="14" ry="10" transform="rotate(-25 178 194)" fill="#edc2a0" stroke="#5c4231" stroke-width="2.5"/>
    <path d="M82 230c-17-7-24 7-10 10h25m101-10c17-7 24 7 10 10h-25" fill="#edc2a0" stroke="#5c4231" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}
export function wheel(spinning: boolean): string {
  return `<svg class="wheel ${spinning ? 'is-spinning' : ''}" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="m50 51-19 39m19-39 19 39M21 91h58" stroke="#6e7160" stroke-width="4" stroke-linecap="round"/><g class="wheel-spokes"><circle cx="50" cy="43" r="34" fill="#eff0dc" stroke="#3c7568" stroke-width="4"/><circle cx="50" cy="43" r="27" stroke="#a9bda2" stroke-width="1.5" stroke-dasharray="3 5"/><path d="M50 9v68M16 43h68M26 19l48 48m0-48L26 67" stroke="#6e9a86" stroke-width="2"/><circle cx="50" cy="43" r="6" fill="#3c7568"/></g></svg>`;
}
