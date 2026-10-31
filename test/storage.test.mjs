import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySave, isUnlocked, readSave, writeSave } from '../src/storage.ts';
test('malformed/blocked storage is recoverable and does not invent stars', () => {
  for (const value of ['bad json', '{}', 'null', JSON.stringify({ version: 2, stars: [3] })]) assert.deepEqual(readSave({ getItem: () => value }), emptySave());
  assert.deepEqual(readSave({ getItem: () => { throw new Error('blocked'); } }), emptySave());
  assert.equal(writeSave({ setItem: () => { throw new Error('quota'); } }, emptySave()), false);
  const sanitized = readSave({ getItem: () => JSON.stringify({ version: 1, stars: [100, -1, '3', 1.5, 3], language: 'zh', sound: true }) });
  assert.deepEqual(sanitized.stars.slice(0, 5), [0, 0, 0, 0, 3]); assert.equal(sanitized.language, 'zh');
});
test('level progression and language/sound persist locally', () => {
  const save = emptySave(); assert.equal(isUnlocked(0, save), true); assert.equal(isUnlocked(1, save), false);
  save.stars[0] = 2; save.language = 'zh'; save.sound = true;
  let json; writeSave({ setItem: (_key, value) => { json = value; } }, save);
  assert.deepEqual(readSave({ getItem: () => json }), save);
  assert.equal(isUnlocked(1, save), true); assert.equal(isUnlocked(4, save), false);
});
