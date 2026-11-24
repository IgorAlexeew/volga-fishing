'use strict';

const api = acquireVsCodeApi();
const byId = id => document.getElementById(id);
const trip = new FishingTrip();
const canvas = byId('water');
const renderRiver = createRiverRenderer(canvas);
const renderWeather = createRiverWeather(byId('weather'));
const results = {
  early: 'Слишком ранняя подсечка', missed: 'Рыба сняла наживку', escaped: 'Рыба сошла',
  reel: 'Катушка сломалась', rod: 'Удилище сломалось'
};
const mediaUrl = new URL('.', document.currentScript.src);
let periodName = 'morning';
let light;
let focused = true;
let animationId;
let backgroundTimer;
let previousFrame;
let sceneTime = 0;
const held = new Set();

let catches = [];

const dialogOpen = () => byId('net').open || byId('guide').open;
const formatWeight = grams => grams >= 1000
  ? (grams / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 }) + ' кг'
  : grams + ' г';
const settings = api.getState() || {};
trip.baitId = Object.hasOwn(baits, settings.bait) ? settings.bait : 'worm';
for (const [id, bait] of Object.entries(baits)) {
  const card = document.createElement('label');
  card.className = 'field-paper bait-card';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'bait';
  radio.value = id;
  radio.checked = id === trip.baitId;
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    trip.baitId = id;
    api.setState({ bait:id });
  });
  const image = document.createElement('img');
  image.src = new URL('assets/bait-' + id + '.png', mediaUrl).href;
  image.alt = '';
  card.append(radio, image, document.createTextNode(bait.name));
  byId('baitCards').append(card);
}

function showCatches() {
  byId('empty').hidden = catches.length > 0;
  const list = byId('catchList');
  list.replaceChildren(...catches.map(item => {
    const species = speciesList.find(fish => fish.id === item.species);
    const card = document.createElement('button');
    card.className = 'field-paper catch-card';
    card.type = 'button';
    card.setAttribute('aria-haspopup', 'dialog');
    const image = document.createElement('img');
    image.src = new URL('assets/' + species.id + '.webp', mediaUrl).href;
    image.alt = '';
    image.loading = 'lazy';
    image.style.transform = 'scale(' + (.32 + .68 * Math.cbrt(item.grams / largestFishGrams)) + ')';
    const name = document.createElement('strong');
    name.textContent = species.name;
    const weight = document.createElement('span');
    weight.textContent = formatWeight(item.grams);
    const trophy = item.grams >= species.trophyGrams;
    if (trophy) {
      card.classList.add('trophy');
      card.title = 'Зачётная рыба';
      card.setAttribute('aria-label', species.name + ', ' + weight.textContent + ', зачётная рыба');
    }
    const label = document.createElement('div');
    label.className = 'catch-label';
    label.append(name, weight);
    card.append(image, label);
    card.addEventListener('click', () => {
      byId('catchName').textContent = species.name;
      byId('catchPortrait').src = image.src;
      byId('catchWeight').textContent = weight.textContent;
      byId('catchDescription').textContent = species.description + ' ' + species.habits;
      byId('catchThreshold').textContent = (trophy ? 'Зачётная рыба. ' : '') + 'Зачёт для вида — от ' + formatWeight(species.trophyGrams) + '.';
      const bait = baits[item.baitId];
      byId('catchBait').hidden = !bait;
      byId('catchBait').textContent = bait ? 'Насадка — ' + bait.name.toLowerCase() + '.' : '';
      byId('catchTime').hidden = !item.caughtAt;
      byId('catchTime').textContent = item.caughtAt ? 'Время поимки — ' + new Date(item.caughtAt).toLocaleString('ru-RU') : '';
      openDialog(byId('catchInfo'));
    });
    return card;
  }).reverse());
}

function updatePeriod() {
  const selection = byId('period').value;
  light = riverLight(new Date(), selection);
  periodName = light.period;
  trip.ground.period = periodName;
  byId('scene').className = 'scene ' + periodName;
  byId('scene').style.setProperty('--light','brightness('+light.brightness+')');
}
byId('period').addEventListener('change', updatePeriod);
updatePeriod();
setInterval(updatePeriod, 1000 * 15);

function showStatus() {
  const highLoad = Math.max(trip.reelLoad, trip.rodLoad) >= 75;
  let title;
  switch (trip.phase) {
    case 'ready': title = 'Забросить · ЛКМ'; break;
    case 'casting': title = 'Заброс…'; break;
    case 'waiting': case 'nibbling': case 'bite': title = 'Следите за поплавком'; break;
    case 'fight':
      title = highLoad ? 'Отпустите ' + (trip.reelLoad >= trip.rodLoad ? 'ЛКМ' : 'ПКМ') : 'Подводите к берегу';
      break;
    case 'result':
      title = trip.outcome === 'caught' ? 'В садке · ' + trip.species.name + ', ' + formatWeight(trip.grams) : results[trip.outcome];
      break;
  }
  if (byId('title').textContent !== title) byId('title').textContent = title;
  byId('period').disabled = !trip.canCast;
  byId('bait').disabled = !trip.canCast;
  byId('loads').hidden = trip.phase === 'result';
  const landed = trip.phase === 'result' && trip.outcome === 'caught';
  byId('landedTag').hidden = !landed;
  if (landed) {
    byId('landedName').textContent = trip.species.name;
    byId('landedWeight').textContent = formatWeight(trip.grams);
  }
  const feedback = byId('feedback');
  feedback.hidden = trip.phase !== 'result' || trip.outcome === 'caught';
  if (!feedback.hidden) feedback.textContent = { early:'Рано', missed:'Поздно', escaped:'Сход', reel:'Поломка катушки', rod:'Поломка удилища' }[trip.outcome];
  for (const [id, load] of [['rod', trip.rodLoad], ['reel', trip.reelLoad]]) {
    const value = Math.floor(load);
    const gauge = byId(id);
    if (gauge.value !== value) {
      gauge.value = value;
      gauge.classList.toggle('hot', value >= 75);
    }
  }
}

function act(action, key, x = .77, y = .79) {
  if (dialogOpen()) return;
  advance(Date.now());
  if (action === 'reel' && trip.canCast) {
    const photo = riverPhotoFrame(canvas.clientWidth,canvas.clientHeight);
    if (trip.cast((x*canvas.clientWidth-photo.left)/photo.width, (y*canvas.clientHeight-photo.top)/photo.height, trip.baitId)) {
      updatePeriod();
      showStatus();
    }
    else byId('title').textContent = 'Забрасывайте в ближнюю воду';
    return;
  }
  if (action === 'rod') trip.hook();
  if (trip.phase === 'fight') held.add(key);
  showStatus();
}

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('mousedown', event => {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  if (!focused) { focused = true; syncPause(); }
  const rect = canvas.getBoundingClientRect();
  act(event.button === 0 ? 'reel' : 'rod', 'mouse' + event.button, (event.clientX-rect.left)/rect.width, (event.clientY-rect.top)/rect.height);
});
window.addEventListener('mouseup', event => held.delete('mouse' + event.button));
canvas.addEventListener('mousemove', event => {
  if (!(event.buttons & 1)) held.delete('mouse0');
  if (!(event.buttons & 2)) held.delete('mouse2');
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || dialogOpen() ||
      event.target.closest('button,select') || !['Space','ArrowUp'].includes(event.code)) return;
  event.preventDefault();
  if (!event.repeat) act(event.code === 'Space' ? 'reel' : 'rod', event.code);
});
window.addEventListener('keyup', event => held.delete(event.code));

function advance(timestamp) {
  let remaining = previousFrame === undefined ? 0 : Math.max(0,(timestamp-previousFrame)/1000);
  previousFrame = timestamp;
  sceneTime += remaining;
  const before = trip.phase;
  const reeling = held.has('mouse0') || held.has('Space');
  const lifting = held.has('mouse2') || held.has('ArrowUp');
  while (remaining > 0) {
    // After many visits have passed offscreen, rebuild the idle population.
    // An outstanding cast or fight always runs through its normal transitions.
    if (remaining > 180 && trip.canCast) {
      trip.ground = new FishingGround(periodName);
      trip.elapsed += remaining - 20;
      remaining = 20;
    }
    const step = Math.min(.08,remaining);
    trip.step(step,reeling,lifting);
    remaining -= step;
  }
  if (trip.phase === 'result' && before !== 'result') {
    held.clear();
    if (trip.outcome === 'caught') {
      api.postMessage({ type: 'catch', catchId: trip.catchId, species: trip.species.id, grams: trip.grams, baitId: trip.baitId });
    }
  }
  if (before !== trip.phase || trip.phase === 'fight') showStatus();
}
function frame() {
  advance(Date.now());
  if (!document.hidden) {
    renderWeather(sceneTime, light);
    renderRiver(trip, sceneTime, light);
  }
  if (document.hidden) backgroundTimer = setTimeout(frame,500);
  else animationId = requestAnimationFrame(frame);
}
function syncPause() {
  updatePeriod();
  cancelAnimationFrame(animationId);
  clearTimeout(backgroundTimer);
  if (previousFrame !== undefined) advance(Date.now());
  held.clear();
  if (dialogOpen()) previousFrame = undefined;
  else frame();
}
window.addEventListener('blur', () => { focused = false; syncPause(); });
window.addEventListener('focus', () => { focused = true; syncPause(); });
document.addEventListener('visibilitychange', syncPause);
function openDialog(dialog) {
  dialog.showModal();
  syncPause();
}
byId('help').addEventListener('click', () => openDialog(byId('guide')));
byId('netButton').addEventListener('click', () => {
  showCatches();
  openDialog(byId('net'));
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (!dialogOpen()) canvas.focus();
    syncPause();
  });
}
window.addEventListener('message', ({ data }) => {
  if (data?.type !== 'keepnet') return;
  catches = data.catches;
  byId('count').textContent = catches.length;
  if (byId('net').open) showCatches();
  const rows = speciesList.filter(fish => data.oldJournal[fish.id]?.count).map(fish => {
    const entry = data.oldJournal[fish.id];
    return fish.name + ' · ' + entry.count + ' шт., рекорд ' + formatWeight(entry.best);
  });
  byId('archive').hidden = !rows.length;
  byId('records').textContent = rows.join('\n');
});
showStatus();
api.postMessage({ type:'ready' });
syncPause();
