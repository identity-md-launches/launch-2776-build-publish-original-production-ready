import type { Level, Point, Piece } from './levels.ts';

export type Route = 'spinning' | 'nap' | 'practice';
export interface Rules {
  route: Route;
  extraMoves: number;
  dropEvery: number;
  special: boolean;
  observedAt?: string;
}
export const rulesFor = (route: Route, observedAt?: string): Rules => Object.freeze({ route, extraMoves: route === 'spinning' ? 2 : 0, dropEvery: route === 'spinning' ? 1 : 2, special: route === 'spinning', observedAt });
export interface Placement { piece: string; x: number; y: number; rotation: number }
export interface GameState {
  level: Level;
  rules: Rules;
  placements: Placement[];
  history: Placement[][];
  moves: number;
  finished: boolean;
}
export function normalize(cells: readonly Point[]): Point[] {
  const x = Math.min(...cells.map(p => p[0])), y = Math.min(...cells.map(p => p[1]));
  return cells.map(p => [p[0] - x, p[1] - y]);
}
export function rotated(piece: Piece, rotation: number): Point[] {
  let cells = piece.cells;
  for (let i = 0; i < ((rotation % 4) + 4) % 4; i++) cells = normalize(cells.map(([x, y]) => [-y, x]));
  return cells;
}
export function newGame(level: Level, rules: Rules): GameState {
  return { level, rules: { ...rules }, placements: [], history: [], moves: 0, finished: false };
}
export function occupied(state: GameState): Map<string, string> {
  const cells = new Map<string, string>();
  for (const p of state.placements) {
    const piece = state.level.pieces.find(item => item.id === p.piece)!;
    for (const [x, y] of rotated(piece, p.rotation)) cells.set(`${x + p.x},${y + p.y}`, p.piece);
  }
  return cells;
}
export function canPlace(state: GameState, placement: Placement): boolean {
  if (state.finished || state.moves >= state.level.moves + state.rules.extraMoves) return false;
  if (![placement.x, placement.y, placement.rotation].every(Number.isInteger)) return false;
  if (state.placements.some(p => p.piece === placement.piece)) return false;
  const piece = state.level.pieces.find(p => p.id === placement.piece);
  if (!piece) return false;
  const filled = occupied(state);
  return rotated(piece, placement.rotation).every(([x, y]) => {
    const nx = x + placement.x, ny = y + placement.y;
    return nx >= 0 && nx < state.level.size && ny >= 0 && ny < state.level.size &&
      !filled.has(`${nx},${ny}`) && !state.level.blocked.some(([bx, by]) => bx === nx && by === ny);
  });
}
export function drops(state: GameState): { cell: Point; arrived: boolean; cleared: boolean; atMove: number }[] {
  const filled = occupied(state);
  return state.level.seeds.map((cell, i) => {
    const atMove = i * state.rules.dropEvery;
    const arrived = state.moves >= atMove;
    // A seed landing on a packed square is safely collected. This makes every
    // placement order valid and prevents a later drop from breaking a solution.
    return { cell, arrived, cleared: arrived && filled.has(cell.join(',')), atMove };
  });
}
export function canFinish(state: GameState): boolean {
  return occupied(state).size >= state.level.target && (!state.rules.special || drops(state).every(s => s.cleared));
}
export function stars(state: GameState): number {
  if (!canFinish(state)) return 0;
  const n = occupied(state).size;
  if (n === state.level.capacity) return 3;
  return n >= state.level.silver ? 2 : 1;
}
export function pack(state: GameState, placement: Placement): GameState {
  if (!canPlace(state, placement)) return state;
  const next = { ...state, placements: [...state.placements, { ...placement }], moves: state.moves + 1, history: [...state.history, state.placements] };
  next.finished = canFinish(next) && (occupied(next).size === state.level.capacity || next.moves === state.level.moves + state.rules.extraMoves);
  return next;
}
export function undo(state: GameState): GameState {
  if (!state.history.length) return state;
  return { ...state, placements: state.history[state.history.length - 1], history: state.history.slice(0, -1), moves: state.moves - 1, finished: false };
}
export function unpack(state: GameState, piece: string): GameState {
  if (state.finished || state.moves >= state.level.moves + state.rules.extraMoves || !state.placements.some(p => p.piece === piece)) return state;
  return { ...state, placements: state.placements.filter(p => p.piece !== piece), moves: state.moves + 1, history: [...state.history, state.placements] };
}
export function finish(state: GameState): GameState { return canFinish(state) ? { ...state, finished: true } : state; }
export function moveCursor(point: Point, dx: number, dy: number, size: number): Point {
  return [Math.max(0, Math.min(size - 1, point[0] + dx)), Math.max(0, Math.min(size - 1, point[1] + dy))];
}
export function availableMoves(state: GameState): Placement[] {
  const moves: Placement[] = [];
  for (const item of state.level.pieces) {
    if (state.placements.some(p => p.piece === item.id)) continue;
    for (let rotation = 0; rotation < 4; rotation++) for (let y = 0; y < state.level.size; y++) for (let x = 0; x < state.level.size; x++) {
      const p = { piece: item.id, x, y, rotation };
      if (canPlace(state, p)) moves.push(p);
    }
  }
  return moves;
}
