import './style.css';
import { LEVELS, type Point } from './levels.ts';
import { availableMoves, canFinish, canPlace, drops, finish, moveCursor, newGame, occupied, pack, rotated, rulesFor, stars, undo, unpack, type GameState } from './engine.ts';
import { currentRules, isFresh, LivePoller, STATUS_URL, type LiveState } from './live.ts';
import { emptySave, isUnlocked, readSave, writeSave } from './storage.ts';
import { translate, type Message } from './i18n.ts';
import { hamster, icon, miniShape, snack, wheel } from './art.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const modal = document.querySelector<HTMLDialogElement>('#modal')!;
const announcer = document.querySelector<HTMLDivElement>('#announcer')!;
let save = emptySave();
let storageOK = true;
try { save = readSave(localStorage); } catch { storageOK = false; }
let live: LiveState = { problem: 'loading', failures: 0 };
let game = newGame(LEVELS[0], rulesFor('practice'));
let locked = false;
let selected = 'A';
let rotation = 0;
let cursor: Point = [0, 0];
let notice: { key: Message; values?: Record<string, string | number> } | undefined;
let focusReturn = '';
let audio: AudioContext | undefined;
const t = (key: Message, values?: Record<string, string | number>) => translate(save.language, key, values);
const pct = () => Math.round(occupied(game).size / game.level.capacity * 100);
const goalPct = () => Math.round(game.level.target / game.level.capacity * 100);
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const action = (id: string, label: string, symbol: string, cls = 'quiet', disabled = false) => `<button type="button" class="button ${cls}" data-action="${id}" data-focus="${id}" ${disabled ? 'disabled' : ''}>${icon(symbol)}<span>${label}</span></button>`;
const routeName = () => t(game.rules.route === 'spinning' ? 'spinning' : game.rules.route === 'nap' ? 'nap' : 'practice');
function persist() { try { storageOK = writeSave(localStorage, save); } catch { storageOK = false; } }
function announce(text: string) { announcer.textContent = ''; queueMicrotask(() => { announcer.textContent = text; }); }
function say(key: Message, values?: Record<string, string | number>) { notice = { key, values }; announce(t(key, values)); }
function playSound(win = false) {
  if (!save.sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    for (let i = 0; i < (win ? 3 : 1); i++) {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const at = audio.currentTime + i * 0.13;
      oscillator.type = 'sine'; oscillator.frequency.value = [523.25, 659.25, 783.99][i];
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.055, at + 0.012); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + 0.16);
    }
  } catch { /* Play remains available without browser audio support. */ }
}
function liveMarkup(): string {
  const fresh = isFresh(live), spinning = fresh && live.measurement?.coreStatus === 'SPINNING';
  const label = fresh ? (spinning ? 'liveSpin' : 'liveNap') : live.problem === 'loading' ? 'loading' : live.measurement || live.problem === 'stale' ? 'stale' : 'unavailable';
  const stamp = live.measurement?.observedAt;
  return `<div class="live-heading">${wheel(spinning)}<div><h3>${t('sourceTitle')}</h3><p class="live-state"><span class="status-dot ${fresh ? 'online' : ''}" aria-hidden="true"></span>${t(label)}</p></div></div>
    <div class="live-meta">${live.measurement?.rpmMilli !== undefined ? `<span>${t('speed', { n: new Intl.NumberFormat(save.language, { maximumFractionDigits: 2 }).format(live.measurement.rpmMilli / 1000) })}${!fresh ? ` · ${t('lastKnown')}` : ''}</span>` : `<span>${t('noSpeed')}</span>`}
    ${stamp ? `<span>${t(fresh ? 'observed' : 'lastKnown')} <time datetime="${esc(stamp)}" title="${esc(stamp)}">${new Date(stamp).toLocaleTimeString(save.language === 'zh' ? 'zh-CN' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></span>` : ''}</div>
    <p class="live-explainer">${!fresh && live.problem !== 'loading' ? t('retryExplain') : t('liveDetail')}</p>
    <div class="source-row"><a href="${STATUS_URL}" target="_blank" rel="noopener noreferrer">${t('source')}${icon('external')}</a>${!fresh && live.problem !== 'loading' ? `<button type="button" class="text-button" data-action="retry">${t('retry')}</button>` : ''}</div>`;
}
function seedMarkup(): string {
  const seeds = drops(game);
  return `<div class="seed-goal"><span class="seed-goal-label">${icon('seed')}${t(game.rules.special ? 'seeds' : 'napSeeds')}</span><span class="seed-dots" role="img" aria-label="${t('collected', { n: seeds.filter(s => s.cleared).length, total: seeds.length })}">${seeds.map(s => `<span class="seed-dot ${s.cleared ? 'cleared' : s.arrived ? 'arrived' : ''}" title="${s.arrived ? t('dropNow') : t('drop', { n: s.atMove })}">${icon(s.cleared ? 'check' : 'seed')}</span>`).join('')}</span></div>`;
}
function boardMarkup(): string {
  const filled = occupied(game);
  const item = game.level.pieces.find(p => p.id === selected);
  const isPacked = game.placements.some(p => p.piece === selected);
  const placement = { piece: selected, x: cursor[0], y: cursor[1], rotation };
  const valid = canPlace(game, placement);
  const ghost = new Set(item && !isPacked && !game.finished ? rotated(item, rotation).map(([x, y]) => `${x + cursor[0]},${y + cursor[1]}`) : []);
  const seedList = drops(game);
  return Array.from({ length: game.level.size }, (_, y) => `<div class="grid-row" role="row">${Array.from({ length: game.level.size }, (_, x) => {
    const key = `${x},${y}`, id = filled.get(key), p = game.level.pieces.find(item => item.id === id);
    const blocked = game.level.blocked.some(([bx, by]) => bx === x && by === y);
    const isGhost = ghost.has(key), isCursor = cursor[0] === x && cursor[1] === y;
    const seed = seedList.find(s => s.cell[0] === x && s.cell[1] === y);
    let label = t('cell', { x: x + 1, y: y + 1 }) + ', ' + (blocked ? t('blocked') : p ? t(p.kind) + ' ' + p.id : t('empty'));
    if (isGhost) label += ', ' + t(valid ? 'preview' : 'invalid');
    if (seed?.arrived && !seed.cleared) label += ', ' + t(game.rules.special ? 'seeds' : 'napSeeds');
    const isFirst = p && game.placements.some(pp => pp.piece === p.id && rotated(p, pp.rotation)[0][0] + pp.x === x && rotated(p, pp.rotation)[0][1] + pp.y === y);
    return `<button type="button" role="gridcell" class="cell ${blocked ? 'stitched' : ''} ${p ? `filled ${p.kind}` : ''} ${isGhost ? `ghost ${valid ? item!.kind : 'invalid'}` : ''} ${isCursor ? 'cursor' : ''} ${p && selected === p.id ? 'piece-selected' : ''}" aria-label="${esc(label)}" aria-selected="${isCursor}" data-cell="${x},${y}" data-focus="cell-${x}-${y}" tabindex="${isCursor ? 0 : -1}" ${blocked ? 'aria-disabled="true"' : ''}>
      ${blocked ? '<span class="stitch-mark" aria-hidden="true">×</span>' : p ? (isFirst ? snack(p.kind) : '<span class="piece-grain" aria-hidden="true"></span>') : isGhost ? '<span class="ghost-dot" aria-hidden="true"></span>' : ''}
      ${seed?.arrived && !seed.cleared ? `<span class="board-seed ${game.rules.special ? 'special' : ''}" aria-hidden="true">${icon(game.rules.special ? 'bolt' : 'seed')}</span>` : ''}
      ${isCursor && !p && !blocked ? `<span class="anchor" aria-hidden="true">+</span>` : ''}
    </button>`;
  }).join('')}</div>`).join('');
}
function trayMarkup(): string {
  return `<div class="tray-head"><h3>${t('tray')}</h3><span class="tray-caption">${t('trayHint')}</span></div><div class="snack-tray">${game.level.pieces.map((item, i) => {
    const placed = game.placements.some(p => p.piece === item.id), active = selected === item.id;
    return `<button type="button" class="snack-button ${active ? 'selected' : ''} ${placed ? 'is-packed' : ''}" data-piece="${item.id}" data-focus="piece-${item.id}" aria-pressed="${active}" aria-label="${t(item.kind)} ${item.id}, ${t('cells', { n: item.cells.length })}${placed ? ', ' + t('packed') : ''}">
      <span class="piece-shortcut" aria-hidden="true">${i === 9 ? '0' : i + 1}</span>${miniShape(rotated(item, active ? rotation : item.startRotation), item.kind)}
      <span class="snack-name">${t(item.kind)}</span>${placed ? `<span class="packed-check" aria-hidden="true">${icon('check')}</span>` : ''}</button>`;
  }).join('')}</div>`;
}
function render() {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus : undefined;
  document.documentElement.lang = save.language === 'zh' ? 'zh-CN' : 'en';
  const current = game.level, item = current.pieces.find(p => p.id === selected), isPacked = game.placements.some(p => p.piece === selected);
  const ready = canFinish(game), filled = occupied(game).size;
  const remaining = current.moves + game.rules.extraMoves - game.moves;
  const stuck = !game.finished && !ready && game.moves > 0 && availableMoves(game).length === 0;
  const routeIcon = game.rules.route === 'spinning' ? 'bolt' : 'moon';
  app.innerHTML = `<a class="skip-link" href="#pouch-grid">${t('pack')}</a>
    <header class="site-header"><div class="brand"><a href="#" data-action="home" aria-label="Squeek Pouch, ${t('level', { n: 1 })}" class="brand-mark">${hamster('logo-hamster')}</a><div><h1>Squeek Pouch<span class="wordmark-dot">.</span></h1><p>${t('subtitle')}</p></div></div>
      <nav class="utilities" aria-label="${t('help')}"><button type="button" class="utility language" data-action="language" data-focus="language" aria-label="${t('language')}">${save.language === 'en' ? '中' : 'EN'}</button><button type="button" class="utility" data-action="sound" data-focus="sound" aria-label="${t('sound')}" aria-pressed="${save.sound}">${icon(save.sound ? 'sound' : 'mute')}</button><button type="button" class="utility" data-action="help" data-focus="help" aria-label="${t('help')}">${icon('help')}</button></nav>
    </header>
    <main class="main-shell">
      <div class="level-heading"><div class="level-title"><span class="level-number" aria-hidden="true">${String(current.id).padStart(2, '0')}</span><div><h2>${current.name[save.language === 'en' ? 0 : 1]}</h2><p>${t('tip', { n: goalPct() })}</p></div></div><button type="button" class="level-selector" aria-label="${t('levels')}, ${t('level', { n: current.id })}" data-action="levels" data-focus="levels">${icon('grid')}<span>${t('level', { n: current.id })} <span class="muted">${t('of')}</span></span>${icon('chevron')}</button></div>
      <div class="play-layout">
        <aside class="companion"><div class="companion-art">${hamster('', game.finished)}<span class="doodle-spark spark-one" aria-hidden="true">${icon('star')}</span><span class="doodle-spark spark-two" aria-hidden="true">${icon('leaf')}</span></div><p class="hamster-note">${current.note[save.language === 'en' ? 0 : 1]}</p><div class="little-plan"><div>${icon('star')}<span>${t('goal', { n: goalPct() })}</span></div><p>${current.target === current.capacity ? t('perfectGoal') : t('starRules', { bronze: goalPct(), silver: Math.round(current.silver / current.capacity * 100) })}</p><p>${t('freeUndo')}</p></div><button type="button" class="text-button tutorial-link" data-action="tutorial" data-focus="tutorial">${icon('help')}${t('tutorialLink')}</button></aside>
        <section class="tray-area" aria-label="${t('tray')}">${trayMarkup()}<section class="wheel-panel" id="live-panel" aria-label="${t('sourceTitle')}">${liveMarkup()}</section></section>
        <section class="pouch-area" aria-label="${t('board')}">
          <div class="scoreboard"><div class="fill-stat"><div class="stat-top"><span>${t('fill')}</span><strong>${pct()}<span class="percent">%</span></strong></div><div class="fill-track" role="progressbar" aria-label="${t('fill')}" aria-valuenow="${pct()}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct()}%"></span><i style="left:${goalPct()}%" title="${t('goal', { n: goalPct() })}"></i></div></div><div class="moves-stat"><span>${t('moves')}</span><strong>${remaining}<span class="stat-total"> / ${current.moves + game.rules.extraMoves}</span></strong></div></div>
          <div class="pouch"><div class="pouch-seam" aria-hidden="true"></div><div class="pouch-label"><span>${icon(routeIcon)}${routeName()} · ${current.size} × ${current.size}</span><span>${t('goal', { n: goalPct() })}</span></div><div id="pouch-grid" class="pouch-grid" role="grid" aria-label="${t('board')}" aria-describedby="board-help" aria-rowcount="${current.size}" aria-colcount="${current.size}" style="--grid-size:${current.size}">${boardMarkup()}</div><div class="pouch-bottom">${seedMarkup()}<span class="pouch-signature" aria-hidden="true">squeek</span></div></div>
          <div class="placement-caption"><span class="selected-piece">${item ? snack(item.kind) + t(item.kind) : t('allPacked')}</span><span>${item ? t('cells', { n: item.cells.length }) : ''}</span></div>
          <div class="primary-actions">${action('pack', t(isPacked ? 'unpack' : 'pack'), isPacked ? 'undo' : 'arrow', 'primary', game.finished || !item || remaining === 0)}${ready && !game.finished ? action('finish', t('finish'), 'check', 'finish-button') : ''}${game.finished ? action('result', t('next'), 'arrow', 'primary') : ''}</div>
          <div class="board-tools">${action('rotate', t('rotate'), 'rotate', 'quiet', game.finished || !item || isPacked)}${action('undo', t('undo'), 'undo', 'quiet', game.history.length === 0)}${action('restart', t('restart'), 'restart')}</div>
          <p id="board-help" class="board-help">${save.tutorialDone ? t('mobileHint') : t('intro')}</p><p class="keyboard-hint">${t('keyboard')}</p>
          <div class="notice ${notice?.key === 'blockedNotice' || stuck ? 'notice-warning' : ''}" aria-hidden="true">${notice ? t(notice.key, notice.values) : ready && !game.finished ? t('ready') : stuck ? t(remaining === 0 ? 'spent' : 'stuck') : !save.tutorialDone && current.id === 1 ? t('firstHint') : ''}</div>
          <div class="route-strip"><div><span class="route-name">${icon(routeIcon)}${routeName()}</span>${game.rules.extraMoves ? `<span class="energy-bonus">${t('bonus')}</span>` : ''}<span class="route-lock">${icon(locked ? 'lock' : 'leaf')}${t(locked ? 'routeLocked' : 'routeOpen')}</span></div><p>${t(game.rules.route === 'spinning' ? 'spinExplain' : game.rules.route === 'nap' ? 'napExplain' : 'practiceExplain')}</p></div>
        </section>
      </div>
      <div class="mobile-live" id="mobile-live">${liveMarkup()}</div>
    </main>
    <footer class="site-footer"><span>${t('footer')}</span><div><span class="save-status">${icon(storageOK ? 'check' : 'help')}${t(storageOK ? 'saved' : 'unsaved')}</span><button type="button" class="text-button" data-action="about" data-focus="about">${t('about')}${icon('external')}</button></div></footer>`;
  if (focused) app.querySelector<HTMLElement>(`[data-focus="${focused}"]`)?.focus({ preventScroll: true });
  app.dataset.moves = String(game.moves);
  app.dataset.route = game.rules.route;
  app.dataset.filled = String(filled);
  app.dataset.locked = String(locked);
}
function reset(levelIndex = game.level.id - 1) {
  game = newGame(LEVELS[levelIndex], currentRules(live)); locked = false;
  selected = game.level.pieces[0].id; rotation = game.level.pieces[0].startRotation; cursor = [0, 0]; notice = undefined;
  closeModal(); render();
}
function selectPiece(id: string) {
  const piece = game.level.pieces.find(p => p.id === id); if (!piece || game.finished) return;
  selected = id; rotation = piece.startRotation; notice = undefined; render();
}
function updateGame(next: GameState) {
  if (next === game) return;
  game = next;
  if (game.finished) {
    save.stars[game.level.id - 1] = Math.max(save.stars[game.level.id - 1], stars(game));
    save.tutorialDone = true; persist(); playSound(true); render(); showResult(); return;
  }
  render();
}
function doPack() {
  if (game.finished) return;
  if (!locked) game = { ...game, rules: currentRules(live) };
  const p = { piece: selected, x: cursor[0], y: cursor[1], rotation };
  if (game.placements.some(item => item.piece === selected)) {
    const next = unpack(game, selected);
    if (next !== game) { locked = true; say('unpackNotice'); playSound(); updateGame(next); }
    return;
  }
  if (!canPlace(game, p)) { say('blockedNotice'); render(); return; }
  locked = true;
  const item = game.level.pieces.find(piece => piece.id === selected)!;
  const next = pack(game, p);
  say('packNotice', { name: t(item.kind), n: Math.round(occupied(next).size / game.level.capacity * 100) });
  const nextPiece = game.level.pieces.find(piece => !next.placements.some(p => p.piece === piece.id));
  selected = nextPiece?.id || ''; rotation = nextPiece?.startRotation || 0;
  playSound(); updateGame(next);
  if (canFinish(game) && !game.finished) { say('ready'); render(); }
  else if (!game.finished && occupied(game).size >= game.level.target && game.rules.special) { say('pendingSeeds'); render(); }
  else if (!game.finished && !availableMoves(game).length) { say('stuck'); render(); }
}
function openModal(kind: string, content: string) {
  if (!modal.open) focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus || '' : '';
  modal.innerHTML = `<button type="button" class="modal-close utility" data-action="close" aria-label="${t('close')}">${icon('close')}</button>${content}`;
  if (!modal.open) modal.showModal();
  if (['tutorial', 'about', 'levels'].includes(kind)) {
    const heading = modal.querySelector<HTMLElement>('#modal-title')!;
    heading.tabIndex = -1; heading.focus({ preventScroll: true }); modal.scrollTop = 0;
  } else modal.querySelector<HTMLElement>('[autofocus]')?.focus();
}
function closeModal() { modal.close(); if (focusReturn) app.querySelector<HTMLElement>(`[data-focus="${focusReturn}"]`)?.focus({ preventScroll: true }); }
function showHelp(aboutOnly = false) {
  openModal(aboutOnly ? 'about' : 'tutorial', `<div class="modal-illustration">${hamster('', true)}</div><h2 id="modal-title">${t(aboutOnly ? 'about' : 'tutorialTitle')}</h2>
    ${aboutOnly ? '' : `<div class="tutorial-steps"><section><h3>${t('step1')}</h3><p>${t('step1Text')}</p></section><section><h3>${t('step2')}</h3><p>${t('step2Text')}</p></section><section><h3>${t('step3')}</h3><p>${t('step3Text')}</p></section></div><p>${t('tutorialMore')}</p><div class="help-seeds">${icon('bolt')}<p>${t('seedHelp')}</p></div>`}
    <p>${t('aboutText')}</p><p class="official-links"><a href="https://squeekchain.com/genesis/d4sp8cje" target="_blank" rel="noopener noreferrer">${t('genesis')}${icon('external')}</a><a href="https://squeekchain.com" target="_blank" rel="noopener noreferrer">${t('official')}${icon('external')}</a></p><p class="small-text">${t('privacy')}</p><button type="button" class="button primary modal-primary" data-action="start" autofocus>${t('start')}${icon('arrow')}</button>`);
}
function showLevels() {
  openModal('levels', `<h2 id="modal-title">${t('levelTitle')}</h2><p>${t('levelHelp')}</p><div class="level-groups">${[4, 5, 6].map((size, group) => `<section><h3>${t(`pouch${size}` as Message)}</h3><div class="level-grid">${LEVELS.slice(group * 4, group * 4 + 4).map((level, j) => {
    const index = group * 4 + j, unlocked = isUnlocked(index, save), count = save.stars[index];
    return `<button type="button" class="level-card ${game.level.id === level.id ? 'current' : ''}" data-level="${index}" ${unlocked ? '' : 'disabled'} aria-label="${t('level', { n: level.id })}: ${level.name[save.language === 'en' ? 0 : 1]}, ${unlocked ? t('starCount', { n: count }) : t('unlock', { n: level.id - 1 })}"><span>${unlocked ? String(level.id).padStart(2, '0') : icon('lock')}</span><span class="level-stars" aria-hidden="true">${[1, 2, 3].map(n => icon('star', n <= count ? 'earned' : '')).join('')}</span></button>`;
  }).join('')}</div></section>`).join('')}</div><p class="small-text">${t(storageOK ? 'saved' : 'unsaved')}</p>`);
}
function showResult() {
  const count = stars(game), last = game.level.id === 12;
  openModal('result', `<div class="result-art">${hamster('', true)}</div><div class="result-stars" role="img" aria-label="${t('starCount', { n: count })}">${[1, 2, 3].map(n => icon('star', n <= count ? 'earned' : '')).join('')}</div><h2 id="modal-title">${t(last ? 'collectionDone' : count === 3 ? 'winTitle' : 'winSmall')}</h2><p>${t('winText', { n: pct(), moves: game.moves })}</p>${count === 3 ? `<p class="perfect-caption">${t('threeStars')}</p>` : ''}${last ? `<p>${t('collectionText')}</p>` : ''}<p class="small-text">${game.rules.route === 'practice' ? t('practiceWin') : t('routeWin', { route: routeName() })}</p><div class="result-actions"><button type="button" class="button primary" data-action="${last ? 'levels' : 'next'}" autofocus>${t(last ? 'levels' : 'next')}${icon('arrow')}</button>${action('replay', t('replay'), 'restart')}</div><p class="small-text">${t(storageOK ? 'saved' : 'unsaved')}</p>`);
}
function confirmRestart(index?: number) {
  if (game.moves === 0 || game.finished) { reset(index); return; }
  openModal('confirm', `<h2 id="modal-title">${t(index === undefined ? 'restartTitle' : 'switchTitle')}</h2><p>${t(index === undefined ? 'restartText' : 'switchText')}</p><div class="result-actions"><button type="button" class="button primary" ${index === undefined ? 'data-action="restart-confirm"' : `data-reset="${index}"`}>${t(index === undefined ? 'restartConfirm' : 'switchConfirm')}</button><button type="button" class="button quiet" data-action="close" autofocus>${t('cancel')}</button></div>`);
}
function handleAction(id: string) {
  switch (id) {
    case 'pack': doPack(); break;
    case 'rotate': if (!game.finished && selected && !game.placements.some(p => p.piece === selected)) { rotation = (rotation + 1) % 4; notice = undefined; render(); } break;
    case 'undo': {
      const previous = game, next = undo(game);
      if (next !== previous) {
        const returned = previous.placements.find(p => !next.placements.some(q => q.piece === p.piece));
        if (returned) { selected = returned.piece; rotation = returned.rotation; cursor = [returned.x, returned.y]; }
        say('undoNotice'); closeModal(); updateGame(next);
      }
      break;
    }
    case 'finish': updateGame(finish(game)); break;
    case 'restart': confirmRestart(); break;
    case 'restart-confirm': case 'replay': reset(); break;
    case 'home': confirmRestart(0); break;
    case 'next': reset(Math.min(11, game.level.id)); break;
    case 'result': showResult(); break;
    case 'levels': showLevels(); break;
    case 'help': case 'tutorial': showHelp(); break;
    case 'about': showHelp(true); break;
    case 'start': save.tutorialDone = true; persist(); closeModal(); render(); focusGrid(); break;
    case 'close': closeModal(); break;
    case 'sound': save.sound = !save.sound; persist(); playSound(); render(); break;
    case 'language': save.language = save.language === 'en' ? 'zh' : 'en'; persist(); render(); break;
    case 'retry': poller.retry(); break;
  }
}
function focusGrid() { app.querySelector<HTMLButtonElement>(`[data-cell="${cursor.join(',')}"]`)?.focus({ preventScroll: true }); }
function click(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a'); if (!target) return;
  if (target.dataset.action) { if (target.tagName === 'A') event.preventDefault(); handleAction(target.dataset.action); }
  if (target.dataset.piece) selectPiece(target.dataset.piece);
  if (target.dataset.cell) {
    cursor = target.dataset.cell.split(',').map(Number) as unknown as Point;
    const id = occupied(game).get(cursor.join(','));
    // A shape's bounding-box corner can sit over an occupied square even when
    // the actual shape fits around it. Keep the unplaced selection in that case.
    // Packed pieces can always be selected explicitly from the tray.
    if (id && (!selected || game.placements.some(p => p.piece === selected))) { selected = id; rotation = game.placements.find(p => p.piece === id)!.rotation; }
    notice = undefined; render(); focusGrid();
  }
  if (target.dataset.level !== undefined && isUnlocked(Number(target.dataset.level), save)) confirmRestart(Number(target.dataset.level));
  if (target.dataset.reset !== undefined && isUnlocked(Number(target.dataset.reset), save)) reset(Number(target.dataset.reset));
}
app.addEventListener('click', click); modal.addEventListener('click', click);
modal.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeModal(); } });
app.addEventListener('keydown', event => {
  if (modal.open || event.ctrlKey || event.altKey || event.metaKey) return;
  const onGrid = (event.target as HTMLElement).dataset.cell !== undefined;
  const inGame = onGrid || !!(event.target as HTMLElement).closest('.pouch-area, .snack-tray');
  if (!inGame) return;
  const directions: Record<string, Point> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (onGrid && directions[event.key]) { event.preventDefault(); const [dx, dy] = directions[event.key]; cursor = moveCursor(cursor, dx, dy, game.level.size); notice = undefined; render(); focusGrid(); }
  else if (onGrid && event.key === 'Enter') { event.preventDefault(); doPack(); if (!modal.open) focusGrid(); }
  else if (event.key.toLowerCase() === 'r') { event.preventDefault(); handleAction('rotate'); }
  else if (event.key.toLowerCase() === 'u') { event.preventDefault(); handleAction('undo'); }
  else if (/^[0-9]$/.test(event.key)) { const i = event.key === '0' ? 9 : Number(event.key) - 1; const piece = game.level.pieces[i]; if (piece) { event.preventDefault(); selectPiece(piece.id); focusGrid(); } }
});
const poller = new LivePoller(state => {
  live = state;
  if (!locked) { game = { ...game, rules: currentRules(live) }; render(); }
  else { document.querySelector('#live-panel')!.innerHTML = liveMarkup(); document.querySelector('#mobile-live')!.innerHTML = liveMarkup(); }
});
// The stale clock updates only telemetry, never a locked attempt. On a long-sleeping
// tab, the next pack rechecks freshness even before this timer has had a turn.
const freshnessTimer = setInterval(() => {
  if (live.measurement && !live.problem && !isFresh(live)) {
    live = { ...live, problem: 'stale' };
    if (!locked) { game = { ...game, rules: currentRules(live) }; render(); }
    else { document.querySelector('#live-panel')!.innerHTML = liveMarkup(); document.querySelector('#mobile-live')!.innerHTML = liveMarkup(); }
  }
}, 1000);
window.addEventListener('pagehide', () => { poller.stop(); clearInterval(freshnessTimer); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poller.retry(); });
render(); poller.start();
