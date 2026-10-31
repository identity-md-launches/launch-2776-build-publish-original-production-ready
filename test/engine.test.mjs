import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.ts';
import { availableMoves, canFinish, canPlace, drops, finish, moveCursor, newGame, occupied, pack, rotated, rulesFor, stars, undo, unpack } from '../src/engine.ts';

function witness(level, reverse = false) {
  const moves = level.pieces.map(piece => {
    const coords = level.map.flatMap((row, y) => [...row].flatMap((letter, x) => letter === piece.id ? [[x, y]] : []));
    return { piece: piece.id, x: Math.min(...coords.map(p => p[0])), y: Math.min(...coords.map(p => p[1])), rotation: 0 };
  });
  return reverse ? moves.reverse() : moves;
}
for (const level of LEVELS) {
  for (const route of ['spinning', 'nap', 'practice']) {
    test(`level ${level.id}: ${route} has a legal three-star solution in both drop orders`, () => {
      for (const reverse of [false, true]) {
        let game = newGame(level, rulesFor(route));
        for (const move of witness(level, reverse)) {
          assert.equal(canPlace(game, move), true, `illegal witness ${move.piece}`);
          game = pack(game, move);
        }
        assert.equal(occupied(game).size, level.capacity);
        assert.ok(game.moves <= level.moves + game.rules.extraMoves);
        assert.equal(game.finished, true);
        assert.equal(canFinish(game), true);
        assert.equal(stars(game), 3);
        assert.equal(drops(game).every(d => d.cleared), true);
      }
    });
  }
  test(`level ${level.id}: authored pieces are connected and board/target are valid`, () => {
    assert.equal(level.map.length, level.size);
    assert.ok(level.map.every(row => row.length === level.size));
    assert.ok(level.target <= level.capacity && level.target > 0);
    for (const piece of level.pieces) {
      const pending = new Set(piece.cells.map(c => c.join(','))), queue = [piece.cells[0]];
      while (queue.length) {
        const [x, y] = queue.pop();
        if (!pending.delete(`${x},${y}`)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (pending.has(`${x + dx},${y + dy}`)) queue.push([x + dx, y + dy]);
      }
      assert.equal(pending.size, 0, `disconnected ${piece.id}`);
      assert.ok(piece.cells.length <= 5, `oversized ${piece.id}`);
    }
  });
}
test('invalid placements never spend a move or mutate history', () => {
  let game = newGame(LEVELS[0], rulesFor('nap'));
  for (const move of [{ piece: 'A', x: -1, y: 0, rotation: 0 }, { piece: 'A', x: 3, y: 3, rotation: 0 }, { piece: 'Z', x: 0, y: 0, rotation: 0 }, { piece: 'A', x: NaN, y: 0, rotation: 0 }]) assert.equal(pack(game, move), game);
  game = pack(game, { piece: 'A', x: 0, y: 0, rotation: 0 });
  assert.equal(pack(game, { piece: 'A', x: 2, y: 2, rotation: 0 }), game);
  assert.equal(pack(game, { piece: 'B', x: 1, y: 1, rotation: 0 }), game);
  assert.equal(game.moves, 1);
  assert.equal(game.history.length, 1);
});
for (const level of LEVELS.slice(0, 11)) {
  for (const route of ['spinning', 'nap']) {
    test(`level ${level.id}: ${route} bronze and silver thresholds are actually attainable`, () => {
      const attained = new Set();
      const moves = witness(level);
      for (let mask = 1; mask < (1 << moves.length) - 1 && attained.size < 2; mask++) {
        let game = newGame(level, rulesFor(route));
        moves.forEach((move, i) => { if (mask & (1 << i)) game = pack(game, move); });
        const count = stars(game);
        if (count > 0 && count < 3) attained.add(count);
      }
      assert.deepEqual([...attained].sort(), [1, 2], `unreachable star tier in level ${level.id} (${route})`);
    });
  }
}
test('rotation and keyboard movement are bounded and reversible', () => {
  const piece = LEVELS[1].pieces[0];
  assert.deepEqual(rotated(piece, 4), piece.cells);
  assert.notDeepEqual(rotated(piece, 1), piece.cells);
  assert.deepEqual(rotated(piece, -1), rotated(piece, 3));
  assert.deepEqual(moveCursor([0, 0], -1, -1, 4), [0, 0]);
  assert.deepEqual(moveCursor([3, 3], 1, 1, 4), [3, 3]);
  assert.deepEqual(moveCursor([1, 1], 1, -1, 4), [2, 0]);
});
test('undo restores occupancy, move budget, seed arrival, and win state', () => {
  let game = newGame(LEVELS[2], rulesFor('spinning'));
  const first = game;
  game = pack(game, witness(game.level)[0]);
  assert.equal(drops(game)[1].arrived, true);
  game = undo(game);
  assert.equal(drops(game)[1].arrived, false);
  assert.deepEqual(game, first);
  for (const move of witness(game.level)) game = pack(game, move);
  assert.equal(game.finished, true);
  game = undo(game);
  assert.equal(game.finished, false);
  assert.equal(game.moves, game.level.pieces.length - 1);
  assert.equal(occupied(game).size, game.level.capacity - game.level.pieces.at(-1).cells.length);
});
test('spinning energy permits a lift-and-repack that exceeds the nap move budget', () => {
  for (const route of ['spinning', 'nap']) {
    let game = newGame(LEVELS[0], rulesFor(route));
    const moves = witness(game.level);
    game = pack(game, moves[0]); game = pack(game, moves[1]);
    const before = game;
    game = unpack(game, 'A');
    assert.equal(game.moves, 3); assert.equal(occupied(game).size, 4);
    assert.deepEqual(undo(game), before);
    game = pack(game, moves[0]); game = pack(game, moves[2]); game = pack(game, moves[3]);
    assert.equal(stars(game), route === 'spinning' ? 3 : 1);
    assert.equal(occupied(game).size, route === 'spinning' ? 16 : 8);
  }
});
test('spin seeds are mandatory; ordinary nap seeds are optional and arrive slower', () => {
  let spin = newGame(LEVELS[2], rulesFor('spinning')), nap = newGame(LEVELS[2], rulesFor('nap'));
  spin = pack(spin, witness(spin.level)[0]); nap = pack(nap, witness(nap.level)[0]);
  assert.equal(drops(spin)[1].arrived, true); assert.equal(drops(nap)[1].arrived, false);
  const level = { ...LEVELS[0], seeds: [[3, 3]] };
  let a = newGame(level, rulesFor('spinning')), b = newGame(level, rulesFor('nap'));
  for (const move of witness(level).slice(0, 3)) { a = pack(a, move); b = pack(b, move); }
  assert.equal(canFinish(a), false); assert.equal(canFinish(b), true);
  assert.equal(finish(a).finished, false); assert.equal(finish(b).finished, true);
});
test('early finish and star thresholds are consistent', () => {
  let game = newGame(LEVELS[0], rulesFor('nap'));
  for (const move of witness(game.level).slice(0, 2)) game = pack(game, move);
  assert.equal(game.finished, false); assert.equal(stars(game), 1);
  assert.equal(finish(game).finished, true);
  const level = { ...LEVELS[3], target: 10 };
  let silver = newGame(level, rulesFor('nap'));
  for (const move of witness(level).filter(p => p.piece !== 'C')) silver = pack(silver, move);
  assert.equal(stars(silver), 2);
});
test('stitches block placements; no-fit is detectable; restart is clean', () => {
  const stitched = newGame(LEVELS[3], rulesFor('nap'));
  assert.equal(canPlace(stitched, { piece: 'A', x: 0, y: 0, rotation: 0 }), false);
  let game = newGame(LEVELS[0], rulesFor('nap'));
  game = pack(game, { piece: 'A', x: 1, y: 1, rotation: 0 });
  assert.equal(availableMoves(game).length, 0);
  assert.ok(availableMoves(undo(game)).length > 0);
  const reset = newGame(game.level, rulesFor('spinning'));
  assert.equal(reset.moves, 0); assert.equal(reset.history.length, 0); assert.equal(reset.rules.extraMoves, 2);
});
