export type Point = readonly [number, number];
export type ItemKind = 'seed' | 'nut' | 'berry' | 'leaf' | 'loot' | 'paw';
export interface Piece {
  id: string;
  kind: ItemKind;
  cells: Point[];
  startRotation: number;
}
export interface Level {
  id: number;
  name: [string, string];
  note: [string, string];
  size: number;
  map: string[];
  pieces: Piece[];
  blocked: Point[];
  capacity: number;
  target: number;
  silver: number;
  moves: number;
  seeds: Point[];
}

// These are authored packing layouts, not random boards. Letters are connected
// pieces; # is a stitched pocket corner. The layouts also provide test witnesses.
const layouts: { name: [string, string]; note: [string, string]; map: string[]; target: number; seeds: Point[] }[] = [
  { name: ['First handful', '第一把零食'], note: ['Every great stash starts small.', '每个大宝藏，都从一小把开始。'], map: ['AABB', 'AABB', 'CCDD', 'CCDD'], target: 50, seeds: [[2, 2]] },
  { name: ['Around the bend', '转个小弯'], note: ['A little turn makes room.', '转一转，就多一点空间。'], map: ['AAAB', 'ACBB', 'CCDB', 'CDDD'], target: 50, seeds: [[3, 0]] },
  { name: ['Pocket of sunshine', '一袋阳光'], note: ['Long snacks, small spaces.', '长长的零食，小小的空间。'], map: ['AAAA', 'BBCC', 'BBDC', 'EDDD'], target: 75, seeds: [[3, 3], [0, 1]] },
  { name: ['Mind the stitches', '留意缝线'], note: ['The sewn corners stay empty.', '缝好的角落不能放零食。'], map: ['#AAA', 'BBAC', 'BDDC', 'BEE#'], target: 71, seeds: [[1, 0], [2, 2]] },
  { name: ['Room to forage', '觅食新天地'], note: ['A bigger pouch, a bigger picnic.', '更大的颊囊，更多的美味。'], map: ['AABBB', 'AACBD', 'ECCDD', 'EECFD', 'EFFFD'], target: 80, seeds: [[1, 4], [0, 0]] },
  { name: ['Little paw prints', '小小爪印'], note: ['Leave a space for something odd.', '给奇妙的形状留个位置。'], map: ['AABBB', 'AAABC', 'DDDCC', 'EDFCC', 'EEFFF'], target: 84, seeds: [[2, 1], [3, 2]] },
  { name: ['The berry patch', '浆果小园'], note: ['Sweet things fit together.', '甜甜的果子，刚好拼在一起。'], map: ['AABBB', 'ACBBD', 'ACCED', 'FCCED', 'FFEED'], target: 84, seeds: [[0, 2], [4, 4]] },
  { name: ['Secret compartments', '秘密夹层'], note: ['Find the shape of the spaces.', '发现空隙的形状。'], map: ['#AAAB', 'CCABB', 'CDDEB', 'CDDEB', 'FFEE#'], target: 82, seeds: [[3, 0], [0, 3], [3, 3]] },
  { name: ['The grand pantry', '大大的储藏室'], note: ['Small treasures. Grand ambitions.', '小小宝藏，大大心愿。'], map: ['AAABBB', 'ACCBBD', 'ACCEED', 'FFGEED', 'FGGHHD', 'IIJJHH'], target: 84, seeds: [[4, 0], [0, 4], [5, 5]] },
  { name: ['A knotty little puzzle', '弯弯绕绕'], note: ['Give every crooked snack a home.', '给每块弯弯的零食找个家。'], map: ['AABBCC', 'AABCCD', 'EEBBDD', 'EFFGDH', 'IFGGHH', 'IIJJJH'], target: 84, seeds: [[2, 3], [5, 0], [0, 5]] },
  { name: ['Winter provisions', '冬日储备'], note: ['A snug fit for a long nap.', '装得满满，睡得香香。'], map: ['#AABBB', 'CAADDB', 'CCEDFF', 'GCEEFF', 'GGHHII', 'GJHHI#'], target: 91, seeds: [[0, 4], [5, 3], [2, 5]] },
  { name: ['Cheeky perfection', '满满的幸福'], note: ['Not a crumb of space to spare.', '不浪费任何一小格。'], map: ['AABBCC', 'AABDDC', 'EEBDDC', 'EFFGHH', 'IFFGGH', 'IIJJJH'], target: 100, seeds: [[5, 5], [2, 2], [0, 0]] },
];
const kinds: ItemKind[] = ['seed', 'nut', 'berry', 'leaf', 'loot', 'paw'];
export const LEVELS: Level[] = layouts.map((layout, index) => {
  const letters = [...new Set(layout.map.join('').replaceAll('#', ''))].sort();
  const blocked: Point[] = [];
  layout.map.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === '#') blocked.push([x, y]); }));
  const capacity = layout.map.length ** 2 - blocked.length;
  const target = Math.ceil(capacity * layout.target / 100);
  // Choose a silver threshold that real, indivisible snacks can attain.
  // Every subset of this authored tiling is itself a valid packing witness.
  let sums = new Set([0]);
  for (const id of letters) {
    const area = [...layout.map.join('')].filter(letter => letter === id).length;
    sums = new Set([...sums, ...[...sums].map(n => n + area)]);
  }
  const middle = (target + capacity) / 2;
  const silver = [...sums].filter(n => n > target && n < capacity).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || b - a)[0] ?? capacity;
  return {
    id: index + 1, ...layout, size: layout.map.length, blocked, capacity,
    target, silver,
    moves: letters.length,
    pieces: letters.map((id, i) => {
      const points: Point[] = [];
      layout.map.forEach((row, y) => [...row].forEach((letter, x) => { if (letter === id) points.push([x, y]); }));
      const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
      return { id, kind: kinds[i % kinds.length], cells: points.map(([x, y]) => [x - minX, y - minY] as Point), startRotation: index === 0 ? 0 : (index + i) % 4 };
    }),
  };
});
