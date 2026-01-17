const STORAGE_KEY = 'coffeeGrinderDialer:shots';
const MAX_SHOTS = 12;

const els = {
  scaleMin: document.getElementById('scaleMin'),
  scaleMax: document.getElementById('scaleMax'),
  currentGrind: document.getElementById('currentGrind'),
  currentGrindValue: document.getElementById('currentGrindValue'),
  targetRatio: document.getElementById('targetRatio'),
  dose: document.getElementById('dose'),
  yield: document.getElementById('yield'),
  brewTime: document.getElementById('brewTime'),
  grindTime: document.getElementById('grindTime'),
  waterTemp: document.getElementById('waterTemp'),
  pressure: document.getElementById('pressure'),
  channeling: document.getElementById('channeling'),
  taste: document.getElementById('taste'),
  coffeeScreen: document.getElementById('coffeeScreen'),
  notes: document.getElementById('notes'),
  evaluate: document.getElementById('evaluate'),
  resultsCard: document.querySelector('.card.results'),
  evaluationBanner: document.getElementById('evaluationBanner'),
  recommendation: document.getElementById('recommendation'),
  ratioMetric: document.getElementById('ratioMetric'),
  timeMetric: document.getElementById('timeMetric'),
  nextGrind: document.getElementById('nextGrind'),
  gaugeScore: document.getElementById('gaugeScore'),
  gaugeNeedle: document.getElementById('gaugeNeedle'),
  shotList: document.getElementById('shotList'),
  puckWetness: document.getElementById('puckWetness'),
  puckWetnessValue: document.getElementById('puckWetnessValue'),
  pressureNeedle: document.getElementById('pressureNeedle'),
  pressureValue: document.getElementById('pressureValue'),
  puckDialNeedle: document.getElementById('puckDialNeedle'),
  puckDialValue: document.getElementById('puckDialValue'),
};

const state = {
  shots: [],
  lastId: 0,
};

const uiState = {
  bannerTimeout: null,
  highlightTimeout: null,
  buttonTimeout: null,
  evaluateLabel: null,
};

function parseNumber(value, fallback = null) {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function setNeedle(needleEl, value, min, max) {
  if (!needleEl) return;
  const safeValue = clamp(value, min, max);
  const angle = -120 + ((safeValue - min) / (max - min)) * 240;
  needleEl.style.transform = `rotate(${angle}deg)`;
}

function updateSliderBounds() {
  const min = parseNumber(els.scaleMin.value, 0);
  const max = parseNumber(els.scaleMax.value, min + 1);
  const slider = els.currentGrind;
  slider.min = min;
  slider.max = max;

  if (parseNumber(slider.value, min) < min) {
    slider.value = min;
  }

  if (parseNumber(slider.value, max) > max) {
    slider.value = max;
  }

  els.currentGrindValue.textContent = slider.value;
}

function setGauge(score) {
  const safeScore = clamp(Math.round(score), 0, 100);
  const angle = -120 + (safeScore / 100) * 240;
  els.gaugeScore.textContent = `${safeScore}%`;
  els.gaugeNeedle.style.transform = `rotate(${angle}deg)`;
}

function formatNumber(num, digits = 1) {
  if (num == null || Number.isNaN(num)) return '—';
  return Number(num).toFixed(digits);
}

function describePuckWetness(value) {
  if (value <= 3) {
    return { label: 'Soaked', note: 'Soupy puck, consider longer dry time or finer distribution.' };
  }
  if (value <= 6) {
    return { label: 'Balanced', note: 'Moisture looked good—keep prep steady.' };
  }
  if (value <= 8) {
    return { label: 'Dry', note: 'Leaning dry. Check shot length or lower dose slightly.' };
  }
  return { label: 'Desert dry', note: 'Very dry puck. Consider coarser grind or shorter shot.' };
}

function updatePuckWetnessLabel() {
  const value = parseNumber(els.puckWetness.value, 5);
  const descriptor = describePuckWetness(value);
  els.puckWetnessValue.textContent = `${value} · ${descriptor.label}`;
  return descriptor;
}

function updatePressureDial(pressureValue) {
  if (!els.pressureNeedle) return;
  if (pressureValue == null || Number.isNaN(pressureValue)) {
    els.pressureNeedle.style.opacity = 0.3;
    setNeedle(els.pressureNeedle, 0, 0, 12);
    els.pressureValue.textContent = '—';
    return;
  }
  els.pressureNeedle.style.opacity = 1;
  setNeedle(els.pressureNeedle, pressureValue, 0, 12);
  els.pressureValue.textContent = `${formatNumber(pressureValue, 1)} bar`;
}

function updatePuckDial(puckWetness, labelText) {
  if (!els.puckDialNeedle) return;
  const safeValue = puckWetness == null || Number.isNaN(puckWetness) ? 5 : puckWetness;
  setNeedle(els.puckDialNeedle, safeValue, 1, 10);
  els.puckDialValue.textContent = `${formatNumber(safeValue, 0)} · ${labelText || describePuckWetness(safeValue).label}`;
}

function persistShots() {
  try {
    const serialized = state.shots.map((shot) => ({
      ...shot,
      timestamp: shot.timestamp.toISOString(),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (err) {
    console.warn('Unable to persist shots locally:', err);
  }
}

function renderShots() {
  els.shotList.innerHTML = '';
  const entries = [...state.shots].slice().reverse();
  entries.forEach((entry, idx) => {
    const card = document.createElement('article');
    card.className = 'shot-entry';
    const timestamp = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
    const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const stateIndex = state.shots.indexOf(entry);
    const fallbackNumber = stateIndex >= 0 ? stateIndex + 1 : entries.length - idx;
    const shotNumber = entry.id || fallbackNumber;
    const puckLabel = entry.puckDescription || 'n/a';
    const puckValue = entry.puckWetness != null ? `${entry.puckWetness}/10` : 'n/a';
    const screenLabel = entry.coffeeScreen == null ? 'n/a' : entry.coffeeScreen ? 'On' : 'Off';

    card.innerHTML = `
      <header>
        <span>Shot #${shotNumber}</span>
        <span>${timeString}</span>
      </header>
      <p><strong>Ratio:</strong> ${formatNumber(entry.ratio)}:1 · <strong>Grind:</strong> ${formatNumber(entry.currentGrind, 1)} → ${formatNumber(entry.nextGrind, 1)}</p>
      <p><strong>Brew:</strong> ${entry.brewTime ? `${formatNumber(entry.brewTime, 0)}s` : 'n/a'} · <strong>Puck:</strong> ${puckLabel} (${puckValue}) · <strong>Screen:</strong> ${screenLabel} · <strong>Taste:</strong> ${entry.taste || 'n/a'}</p>
      ${entry.notes ? `<p class="muted">${entry.notes}</p>` : ''}
    `;

    els.shotList.appendChild(card);
  });
}

function restoreShots() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    state.shots = parsed
      .map((shot) => ({
        ...shot,
        timestamp: new Date(shot.timestamp),
      }))
      .slice(-MAX_SHOTS);
    state.lastId = state.shots.reduce((max, shot) => Math.max(max, shot.id || 0), 0);
    renderShots();
    const latest = state.shots[state.shots.length - 1];
    if (latest) {
      setGauge(latest.score || 0);
      updatePressureDial(latest.pressure);
      updatePuckDial(latest.puckWetness, latest.puckDescription);
    }
  } catch (err) {
    console.warn('Unable to restore shot history:', err);
  }
}

function announceEvaluation() {
  if (els.evaluationBanner) {
    els.evaluationBanner.textContent = 'Shot logged. Guidance updated.';
    els.evaluationBanner.classList.add('is-visible');
    if (uiState.bannerTimeout) {
      clearTimeout(uiState.bannerTimeout);
    }
    uiState.bannerTimeout = setTimeout(() => {
      els.evaluationBanner.classList.remove('is-visible');
    }, 2600);
  }

  if (els.resultsCard) {
    els.resultsCard.classList.remove('is-highlighted');
    void els.resultsCard.offsetWidth;
    els.resultsCard.classList.add('is-highlighted');
    if (uiState.highlightTimeout) {
      clearTimeout(uiState.highlightTimeout);
    }
    uiState.highlightTimeout = setTimeout(() => {
      els.resultsCard.classList.remove('is-highlighted');
    }, 1600);

    if (window.matchMedia('(max-width: 700px)').matches) {
      els.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (els.evaluate) {
    if (!uiState.evaluateLabel) {
      uiState.evaluateLabel = els.evaluate.textContent;
    }
    els.evaluate.textContent = 'Logged!';
    els.evaluate.classList.add('is-confirmed');
    els.evaluate.disabled = true;
    if (uiState.buttonTimeout) {
      clearTimeout(uiState.buttonTimeout);
    }
    uiState.buttonTimeout = setTimeout(() => {
      els.evaluate.textContent = uiState.evaluateLabel;
      els.evaluate.classList.remove('is-confirmed');
      els.evaluate.disabled = false;
    }, 1200);
  }
}

function evaluateShot() {
  const dose = parseNumber(els.dose.value);
  const yieldVal = parseNumber(els.yield.value);
  const brewTime = parseNumber(els.brewTime.value);
  const targetRatio = parseNumber(els.targetRatio.value, 2);
  const currentGrind = parseNumber(els.currentGrind.value, 0);
  const grindTime = parseNumber(els.grindTime.value);
  const waterTemp = parseNumber(els.waterTemp.value);
  const pressure = parseNumber(els.pressure.value);
  const puckWetness = parseNumber(els.puckWetness.value, 5);
  const puckDescriptor = describePuckWetness(puckWetness);
  const coffeeScreen = Boolean(els.coffeeScreen?.checked);

  if (!dose || !yieldVal) {
    els.recommendation.textContent = 'Dose and yield are required to evaluate a shot.';
    return;
  }

  const ratio = yieldVal / dose;
  let scorePieces = [];

  const ratioScore = 100 - Math.min(100, Math.abs(ratio - targetRatio) / targetRatio * 100);
  scorePieces.push(ratioScore);

  if (brewTime) {
    const timeScore = 100 - Math.min(100, Math.abs(brewTime - 30) / 30 * 100);
    scorePieces.push(timeScore);
  }

  if (pressure) {
    const pressureScore = 100 - Math.min(100, Math.abs(pressure - 9) / 9 * 80);
    scorePieces.push(pressureScore);
  }

  if (waterTemp) {
    const tempScore = 100 - Math.min(100, Math.abs(waterTemp - 93) / 93 * 80);
    scorePieces.push(tempScore);
  }

  let grindDelta = 0;
  let recs = [];

  if (ratio < targetRatio - 0.1) {
    recs.push('Shot is short and intense. Increase the grind number or reduce dose.');
    grindDelta += 1;
  } else if (ratio > targetRatio + 0.1) {
    recs.push('Shot is long or watery. Decrease the grind number or increase dose.');
    grindDelta -= 1;
  } else {
    recs.push('Ratio is close to target. Leave the dose and yield steady.');
  }

  if (brewTime) {
    if (brewTime < 25) {
      recs.push('Brew time is quick. Aim for a finer grind or a slightly higher dose.');
      grindDelta -= 0.5;
    } else if (brewTime > 35) {
      recs.push('Brew time is slow. Make the grind a touch coarser or lower the dose.');
      grindDelta += 0.5;
    } else {
      recs.push('Brew time is in a healthy 25–35s window.');
    }
  }

  const puckScore = 100 - Math.min(100, Math.abs(puckWetness - 6) / 4 * 100);
  scorePieces.push(puckScore);
  if (puckWetness <= 3) {
    recs.push('Puck landed on the soupy side. Dial in prep or extend the shot a touch for better structure.');
  } else if (puckWetness >= 9) {
    recs.push('Puck slammed out desert-dry. Ease up the shot (coarser or shorter) to keep sweetness in play.');
  } else if (puckWetness >= 7) {
    recs.push('Puck leaned dry. Consider shaving a second or two off brew time.');
  } else {
    recs.push('Puck moisture looked balanced—prep routine is on track.');
  }

  const channeling = els.channeling.value;
  if (channeling === 'lots') {
    recs.push('Heavy channeling spotted. Focus on puck prep and consider WDT/tapping.');
  } else if (channeling === 'some') {
    recs.push('Minor channeling. Evaluate tamp pressure and distribution.');
  }

  const taste = els.taste.value;
  if (taste === 'sour') {
    recs.push('Taste skewed sour. Go a little finer and extend contact time.');
    grindDelta -= 0.5;
    scorePieces.push(60);
  } else if (taste === 'bitter') {
    recs.push('Taste leaned bitter/dry. Go coarser or shorten the shot.');
    grindDelta += 0.5;
    scorePieces.push(60);
  } else {
    scorePieces.push(90);
  }

  const avgScore = scorePieces.length ? scorePieces.reduce((a, b) => a + b, 0) / scorePieces.length : 50;
  setGauge(avgScore);

  const minStep = parseNumber(els.scaleMin.value, 0);
  const maxStep = parseNumber(els.scaleMax.value, 40);
  const nextGrind = clamp(currentGrind + grindDelta, minStep, maxStep);

  els.ratioMetric.textContent = `${formatNumber(ratio)}:1`;
  els.timeMetric.textContent = brewTime ? `${formatNumber(brewTime, 0)} s` : '—';
  els.nextGrind.textContent = `${formatNumber(nextGrind, 1)} (${grindDelta > 0 ? 'coarser' : grindDelta < 0 ? 'finer' : 'same'})`;

  const recommendationText = recs.join(' ');
  els.recommendation.textContent = recommendationText;

  updatePressureDial(pressure);
  updatePuckDial(puckWetness, puckDescriptor.label);

  logShot({
    dose,
    yieldVal,
    ratio,
    brewTime,
    grindDelta,
    currentGrind,
    nextGrind,
    grindTime,
    waterTemp,
    pressure,
    taste,
    puckWetness,
    puckDescription: puckDescriptor.label,
    channeling,
    coffeeScreen,
    notes: els.notes.value.trim(),
    targetRatio,
    score: avgScore,
  });

  announceEvaluation();
}

function logShot(entry) {
  const timestamp = new Date();
  const id = state.lastId + 1;
  state.lastId = id;

  state.shots.push({ ...entry, timestamp, id });
  if (state.shots.length > MAX_SHOTS) {
    state.shots = state.shots.slice(state.shots.length - MAX_SHOTS);
  }

  persistShots();
  renderShots();
}

['input', 'change'].forEach((evt) => {
  [els.scaleMin, els.scaleMax].forEach((input) => input.addEventListener(evt, updateSliderBounds));
});

els.currentGrind.addEventListener('input', () => {
  els.currentGrindValue.textContent = els.currentGrind.value;
});

els.pressure.addEventListener('input', () => {
  updatePressureDial(parseNumber(els.pressure.value));
});

els.puckWetness.addEventListener('input', () => {
  const descriptor = updatePuckWetnessLabel();
  const value = parseNumber(els.puckWetness.value, 5);
  updatePuckDial(value, descriptor.label);
});

els.evaluate.addEventListener('click', evaluateShot);

updateSliderBounds();
setGauge(0);
const initialDescriptor = updatePuckWetnessLabel();
updatePuckDial(parseNumber(els.puckWetness.value, 5), initialDescriptor.label);
updatePressureDial(parseNumber(els.pressure.value));
restoreShots();
