(() => {
  const N_PER_CLASS = 45;
  const BINS = 36;

  const PRESETS = {
    blind: { k: 0, label: 'Coin Flip (0%)' },
    weak: { k: 25, label: 'Weak Model (25%)' },
    good: { k: 60, label: 'Realistic Good Model (60%)' },
    strong: { k: 100, label: 'Strong Model (100%)' }
  };

  // Build 45 deterministic Class 0 and 45 Class 1 score trajectories across capability k ∈ [0, 1]
  const buildCases = () => {
    const class0 = [];
    const class1 = [];
    for (let i = 0; i < N_PER_CLASS; i += 1) {
      const q = (i + 0.5) / N_PER_CLASS;
      const r0 = 0.028 * Math.sin(i * 2.3 + 0.4) + 0.015 * Math.cos(i * 5.1);
      const r1 = 0.028 * Math.sin(i * 2.1 + 1.2) - 0.015 * Math.cos(i * 4.7);

      // k = 0.0: Blind / coin-flip model — both classes mixed together in the middle [0.24, 0.77]
      const s0Blind = 0.24 + 0.52 * q + r0 * 0.7;
      const s1Blind = 0.24 + 0.52 * q + r1 * 0.7;

      // k = 0.60: Realistic good model — mirrors the classic stacked binary dot-plot with middle overlap
      const s0Mid = 0.012 + 0.635 * Math.pow(q, 1.15) + r0;
      const s1Mid = 0.988 - 0.685 * Math.pow(1 - q, 1.18) + r1;

      // k = 1.0: Strong capability — True 0s gather tightly near 0.0, True 1s gather tightly near 1.0
      const s0Strong = 0.006 + 0.178 * Math.pow(q, 0.96) + r0 * 0.22;
      const s1Strong = 0.994 - 0.178 * Math.pow(1 - q, 0.96) + r1 * 0.22;

      class0.push([s0Blind, s0Mid, s0Strong]);
      class1.push([s1Blind, s1Mid, s1Strong]);
    }
    return { class0, class1 };
  };

  const CASES = buildCases();

  const interpScore = (triple, kFrac) => {
    const [a, b, c] = triple;
    const raw = kFrac <= 0.6
      ? a + (b - a) * (kFrac / 0.6)
      : b + (c - b) * ((kFrac - 0.6) / 0.4);
    return Math.min(0.995, Math.max(0.005, raw));
  };

  const drawOrangeCircle = (cx, cy, r, isWrong) => {
    const ring = isWrong
      ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r + 1.6).toFixed(1)}" fill="none" stroke="#b33a2b" stroke-width="1.8"/>`
      : '';
    return `${ring}<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="#f59e0b"/>`;
  };

  const drawPurpleCrossSquare = (cx, cy, r, isWrong) => {
    const x = cx - r;
    const y = cy - r;
    const size = r * 2;
    const d = r * 0.48;
    const ring = isWrong
      ? `<rect x="${(x - 1.6).toFixed(1)}" y="${(y - 1.6).toFixed(1)}" width="${(size + 3.2).toFixed(1)}" height="${(size + 3.2).toFixed(1)}" rx="4.2" fill="none" stroke="#b33a2b" stroke-width="1.8"/>`
      : '';
    return `
      ${ring}
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="3.2" fill="#8b3dff"/>
      <line x1="${(cx - d).toFixed(1)}" y1="${(cy - d).toFixed(1)}" x2="${(cx + d).toFixed(1)}" y2="${(cy + d).toFixed(1)}" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round"/>
      <line x1="${(cx - d).toFixed(1)}" y1="${(cy + d).toFixed(1)}" x2="${(cx + d).toFixed(1)}" y2="${(cy - d).toFixed(1)}" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round"/>
    `;
  };

  const initCapabilityPlot = (root) => {
    let showCutoff = false;

    const capInput = root.querySelector('[data-cap-slider]');
    const capVal = root.querySelector('[data-cap-val]');
    const presetBtns = root.querySelectorAll('[data-cap-preset]');
    const toggleCutoffBtn = root.querySelector('[data-cap-toggle-cutoff]');
    const cutoffBox = root.querySelector('[data-cap-cutoff-box]');
    const cutoffInput = root.querySelector('[data-cap-cutoff]');
    const cutoffVal = root.querySelector('[data-cap-cutoff-val]');
    const svg = root.querySelector('[data-cap-svg]');
    const kpi0 = root.querySelector('[data-cap-kpi-0]');
    const kpi1 = root.querySelector('[data-cap-kpi-1]');
    const kpiSep = root.querySelector('[data-cap-kpi-sep]');
    const captionEl = root.querySelector('[data-cap-caption]');

    const syncPresetHighlight = (kPct) => {
      presetBtns.forEach((btn) => {
        const p = PRESETS[btn.dataset.capPreset];
        btn.setAttribute('aria-selected', p && Math.abs(p.k - kPct) <= 2 ? 'true' : 'false');
      });
    };

    const render = () => {
      const kPct = Number(capInput.value);
      const k = kPct / 100;
      const t = Number(cutoffInput.value);

      if (capVal) capVal.textContent = `${kPct}%`;
      if (cutoffVal) cutoffVal.textContent = t.toFixed(2);
      syncPresetHighlight(kPct);

      const s0 = CASES.class0.map((tr) => interpScore(tr, k));
      const s1 = CASES.class1.map((tr) => interpScore(tr, k));

      const mean0 = s0.reduce((a, b) => a + b, 0) / s0.length;
      const mean1 = s1.reduce((a, b) => a + b, 0) / s1.length;

      let wins = 0;
      s1.forEach((p) => {
        s0.forEach((n) => {
          if (p > n + 1e-9) wins += 1;
          else if (Math.abs(p - n) <= 1e-9) wins += 0.5;
        });
      });
      const auc = wins / (s0.length * s1.length);

      // Bin items into 36 columns across [0.0, 1.0]
      const cols = Array.from({ length: BINS }, () => ({ zeros: [], ones: [] }));
      s0.forEach((v) => {
        const idx = Math.min(BINS - 1, Math.max(0, Math.floor(v * BINS)));
        cols[idx].zeros.push(v);
      });
      s1.forEach((v) => {
        const idx = Math.min(BINS - 1, Math.max(0, Math.floor(v * BINS)));
        cols[idx].ones.push(v);
      });

      const mixedCols = cols.filter((c) => c.zeros.length > 0 && c.ones.length > 0).length;

      // Confusion counts if cutoff overlay is active
      let tp = 0, fn = 0, fp = 0, tn = 0;
      s1.forEach((v) => { if (v >= t - 1e-9) tp += 1; else fn += 1; });
      s0.forEach((v) => { if (v >= t - 1e-9) fp += 1; else tn += 1; });
      const acc = (tp + tn) / (s0.length + s1.length);

      // KPI Readout Cards
      if (kpi0) {
        kpi0.innerHTML = `
          <div class="stage-step">True Class 0 (<span class="cls-badge cls-0"></span> Healthy / Normal)</div>
          <div class="stage-main" style="color:#b45309">Avg Score = ${mean0.toFixed(2)}</div>
          <div class="stage-sub">${mean0 <= 0.16 ? 'Crowded tightly near 0.0!' : (mean0 <= 0.35 ? 'Mostly staying toward 0.0 (left side).' : 'Still stuck near the middle (~0.50).')}</div>
        `;
      }
      if (kpi1) {
        kpi1.innerHTML = `
          <div class="stage-step">True Class 1 (<span class="cls-badge cls-1">×</span> Sick / Fraud)</div>
          <div class="stage-main" style="color:#6d28d9">Avg Score = ${mean1.toFixed(2)}</div>
          <div class="stage-sub">${mean1 >= 0.84 ? 'Crowded tightly near 1.0!' : (mean1 >= 0.65 ? 'Mostly staying toward 1.0 (right side).' : 'Still stuck near the middle (~0.50).')}</div>
        `;
      }
      if (kpiSep) {
        if (!showCutoff) {
          kpiSep.innerHTML = `
            <div class="stage-step">Overall Separation (90 Cases)</div>
            <div class="stage-main" style="color:${auc < 0.55 ? 'var(--warn)' : 'var(--ok)'}">
              ROC-AUC = ${auc.toFixed(3)}
            </div>
            <div class="stage-sub">Mixed overlap columns: <strong>${mixedCols}</strong> ${mixedCols === 0 ? '(clean daylight!)' : 'where both classes collide.'}</div>
          `;
        } else {
          kpiSep.innerHTML = `
            <div class="stage-step">Sliced at Cutoff \\(t = ${t.toFixed(2)}\\)</div>
            <div class="stage-main" style="color:var(--accent);font-size:0.96rem">
              Acc ${(acc * 100).toFixed(1)}% · Mistakes: ${fp + fn}
            </div>
            <div class="stage-sub">Red rings: <strong>${fn}</strong> missed 1s (left) + <strong>${fp}</strong> false alarms (right).</div>
          `;
          if (window.TeachingMath) {
            window.TeachingMath.render(kpiSep);
          }
        }
      }

      // SVG geometry (matches the warm cream dot-stack visual language)
      const W = 760;
      const H = 242;
      const padL = 18;
      const padR = 18;
      const plotW = W - padL - padR; // 724
      const boxTop = 30;
      const axisY = 198;
      const boxH = axisY - boxTop; // 168
      const binW = plotW / BINS;
      const r = 7.5;
      const rowStep = 17.6;

      const xPos = (val) => padL + Math.max(0, Math.min(1, val)) * plotW;

      // Render stacked icons per column (Class 0 orange circles at bottom, Class 1 purple x-squares stacked above)
      let iconsSvg = '';
      cols.forEach((col, bIdx) => {
        const cx = padL + (bIdx + 0.5) * binW;
        let row = 0;
        col.zeros.forEach((v) => {
          const cy = axisY - 10.5 - row * rowStep;
          const wrong = showCutoff && v >= t - 1e-9;
          iconsSvg += drawOrangeCircle(cx, cy, r, wrong);
          row += 1;
        });
        col.ones.forEach((v) => {
          const cy = axisY - 10.5 - row * rowStep;
          const wrong = showCutoff && v < t - 1e-9;
          iconsSvg += drawPurpleCrossSquare(cx, cy, r, wrong);
          row += 1;
        });
      });

      // Axis ticks every 0.1
      let ticksSvg = '';
      for (let i = 0; i <= 10; i += 1) {
        const val = i / 10;
        const tx = xPos(val);
        ticksSvg += `
          <line x1="${tx.toFixed(1)}" y1="${axisY}" x2="${tx.toFixed(1)}" y2="${axisY + 6}" stroke="#6e7781" stroke-width="1.4"/>
          <text x="${tx.toFixed(1)}" y="${axisY + 20}" font-size="11.5" text-anchor="middle" fill="#59636e">${val.toFixed(1)}</text>
        `;
      }

      // Optional cutoff knife overlay
      const cutX = xPos(t);
      const cutoffSvg = showCutoff ? `
        <rect x="${cutX.toFixed(1)}" y="${boxTop}" width="${(padL + plotW - cutX).toFixed(1)}" height="${boxH}" fill="rgba(139, 61, 255, 0.06)"/>
        <line x1="${cutX.toFixed(1)}" y1="${boxTop - 2}" x2="${cutX.toFixed(1)}" y2="${axisY + 4}" stroke="#1e2328" stroke-width="2.4" stroke-dasharray="5,3"/>
        <rect x="${Math.min(W - 118, Math.max(padL + 4, cutX - 48)).toFixed(1)}" y="${boxTop + 5}" width="96" height="19" rx="4" fill="#1e2328"/>
        <text x="${Math.min(W - 70, Math.max(padL + 52, cutX)).toFixed(1)}" y="${boxTop + 18}" font-size="10.5" font-weight="700" text-anchor="middle" fill="#ffffff">
          Cutoff t = ${t.toFixed(2)}
        </text>
      ` : '';

      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = `
        <!-- Top directional anchors & legend -->
        <text x="${padL}" y="18" font-size="11" font-weight="700" fill="#b45309">← Near 0.0: True 0s gather here</text>
        ${drawOrangeCircle(W / 2 - 112, 14, 6.2, false)}
        <text x="${W / 2 - 101}" y="18" font-size="11" font-weight="600" fill="#1e2328">True 0 (n = 45)</text>
        ${drawPurpleCrossSquare(W / 2 + 12, 14, 6.2, false)}
        <text x="${W / 2 + 23}" y="18" font-size="11" font-weight="600" fill="#1e2328">True 1 (n = 45)</text>
        <text x="${W - padR}" y="18" font-size="11" font-weight="700" text-anchor="end" fill="#6d28d9">Near 1.0: True 1s gather here →</text>

        <!-- Warm cream dot-stack canvas -->
        <rect x="${padL}" y="${boxTop}" width="${plotW}" height="${boxH}" fill="#fcefc7"/>
        ${cutoffSvg}
        ${iconsSvg}

        <!-- [0.0, 1.0] Horizontal Axis -->
        <line x1="${padL}" y1="${axisY}" x2="${padL + plotW}" y2="${axisY}" stroke="#6e7781" stroke-width="1.5"/>
        ${ticksSvg}
        <text x="${W / 2}" y="${H - 4}" font-size="11" font-weight="600" text-anchor="middle" fill="#424a53">
          Model’s Predicted Score / Probability s ∈ [0.0, 1.0] (each icon = 1 real case)
        </text>
      `;

      if (captionEl) {
        if (kPct <= 10) {
          captionEl.textContent = 'Zero capability (Coin Flip): The model cannot tell the two classes apart, so orange circles (0s) and purple ×-squares (1s) pile up together in the uncertain middle (~0.50).';
        } else if (kPct <= 40) {
          captionEl.textContent = 'Weak capability: True 0s drift slightly left and true 1s drift slightly right, but most columns in the middle still mix both classes.';
        } else if (kPct <= 80) {
          captionEl.textContent = 'Realistic good model: Most true 0s stay left toward 0.0 and most true 1s stay right toward 1.0, while genuinely ambiguous cases overlap in the middle (~0.32–0.66).';
        } else {
          captionEl.textContent = 'Strong capability: Exactly as intuition expects—true 0s pack tightly near 0.0 and true 1s pack tightly near 1.0, leaving wide daylight in the middle!';
        }
      }
    };

    capInput.addEventListener('input', render);

    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = PRESETS[btn.dataset.capPreset];
        if (!p) return;
        capInput.value = String(p.k);
        render();
      });
    });

    if (toggleCutoffBtn) {
      toggleCutoffBtn.addEventListener('click', () => {
        showCutoff = !showCutoff;
        toggleCutoffBtn.textContent = showCutoff ? 'Slice with Cutoff t: ON' : 'Slice with Cutoff t: OFF';
        toggleCutoffBtn.classList.toggle('btn-primary', showCutoff);
        if (cutoffBox) cutoffBox.style.opacity = showCutoff ? '1' : '0.6';
        render();
      });
    }

    if (cutoffInput) {
      cutoffInput.addEventListener('input', () => {
        if (!showCutoff) {
          showCutoff = true;
          if (toggleCutoffBtn) {
            toggleCutoffBtn.textContent = 'Slice with Cutoff t: ON';
            toggleCutoffBtn.classList.add('btn-primary');
          }
          if (cutoffBox) cutoffBox.style.opacity = '1';
        }
        render();
      });
    }

    render();
  };

  const boot = () => {
    document.querySelectorAll('[data-binary-capability-plot]').forEach(initCapabilityPlot);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
