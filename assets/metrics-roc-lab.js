(() => {
  const DATASETS = {
    clinic: {
      title: '5 Clinic Patients (Perfect Order, Bad 0.50 Cutoff)',
      posLabel: 'Sick (1)',
      negLabel: 'Healthy (0)',
      defaultCutoff: 0.50,
      rows: [
        { name: 'P1', y: 0, s: 0.08 },
        { name: 'P2', y: 0, s: 0.18 },
        { name: 'P3', y: 0, s: 0.32 },
        { name: 'P4', y: 1, s: 0.42 },
        { name: 'P5', y: 1, s: 0.48 }
      ],
      note: 'Notice: Every Sick patient (0.42, 0.48) scored higher than every Healthy patient (0.08, 0.18, 0.32). Yet at cutoff t = 0.50, Accuracy is only 60% and catches 0 sick people! Drag t to 0.40 to watch Accuracy jump to 100% while AUC stays 1.000 the entire time.'
    },
    overlap: {
      title: '5 Patients with Overlap (AUC = 5/6 ≈ 0.833)',
      posLabel: 'Sick (1)',
      negLabel: 'Healthy (0)',
      defaultCutoff: 0.42,
      rows: [
        { name: 'Anna', y: 0, s: 0.10 },
        { name: 'Ben', y: 0, s: 0.30 },
        { name: 'Cara', y: 1, s: 0.40 },
        { name: 'Dan', y: 0, s: 0.45 },
        { name: 'Eva', y: 1, s: 0.80 }
      ],
      note: 'Out of 2 × 3 = 6 (Sick, Healthy) pairs, Sick beats Healthy in 5 pairs and loses only 1 pair (Cara 0.40 vs. Dan 0.45). Both the pairwise win rate and the shaded ROC area equal 5/6 ≈ 0.833!'
    },
    lazy: {
      title: 'Rare Card Fraud: Lazy Detector (90% Acc, 0.500 AUC)',
      posLabel: 'Stolen (1)',
      negLabel: 'Honest (0)',
      defaultCutoff: 0.50,
      rows: [
        { name: 'C1', y: 0, s: 0.10 },
        { name: 'C2', y: 0, s: 0.10 },
        { name: 'C3', y: 0, s: 0.10 },
        { name: 'C4', y: 0, s: 0.10 },
        { name: 'C5', y: 0, s: 0.10 },
        { name: 'C6', y: 0, s: 0.10 },
        { name: 'C7', y: 0, s: 0.10 },
        { name: 'C8', y: 0, s: 0.10 },
        { name: 'C9', y: 0, s: 0.10 },
        { name: 'Thief', y: 1, s: 0.10 }
      ],
      note: '9 honest cards and 1 stolen card all receive the exact same lazy score (0.10). At t = 0.50, Accuracy looks impressive (90.0%) while catching 0 thieves! Every pair ties (0.5 credit), so AUC = 4.5 / 9 = 0.500 exposes pure coin-flipping.'
    }
  };

  const computeRocAndPairs = (rows) => {
    const positives = rows.filter((r) => r.y === 1);
    const negatives = rows.filter((r) => r.y === 0);
    const P = positives.length;
    const N = negatives.length;

    let pairWins = 0;
    const matrix = positives.map((pos) =>
      negatives.map((neg) => {
        if (pos.s > neg.s + 1e-12) {
          pairWins += 1;
          return 'win';
        }
        if (Math.abs(pos.s - neg.s) <= 1e-12) {
          pairWins += 0.5;
          return 'tie';
        }
        return 'loss';
      })
    );
    const auc = (P * N) > 0 ? pairWins / (P * N) : 0;

    // Empirical ROC points (Fawcett 2006 Algorithm 1 — handles ties via diagonal segments)
    const distinctScores = Array.from(new Set(rows.map((r) => Number(r.s.toFixed(6)))))
      .sort((a, b) => b - a);

    const rocPoints = [{ fpr: 0, tpr: 0, label: 't > max' }];
    distinctScores.forEach((sc) => {
      const tp = positives.filter((r) => r.s >= sc - 1e-9).length;
      const fp = negatives.filter((r) => r.s >= sc - 1e-9).length;
      rocPoints.push({ fpr: fp / N, tpr: tp / P, label: `t = ${sc.toFixed(2)}` });
    });
    if (rocPoints[rocPoints.length - 1].fpr < 1 || rocPoints[rocPoints.length - 1].tpr < 1) {
      rocPoints.push({ fpr: 1, tpr: 1, label: 't = 0.00' });
    }

    return { positives, negatives, P, N, pairWins, totalPairs: P * N, auc, matrix, rocPoints };
  };

  const initLab = (root) => {
    let scenarioKey = 'clinic';
    let squashed = false;

    const cutoffInput = root.querySelector('[data-cutoff]');
    const cutoffVal = root.querySelector('[data-cutoff-val]');
    const squashBtn = root.querySelector('[data-toggle-squash]');
    const presetDefaultBtn = root.querySelector('[data-preset-half]');
    const tabBtns = root.querySelectorAll('[data-metrics-scenario]');
    const svgRoc = root.querySelector('[data-roc-svg]');
    const kpiAcc = root.querySelector('[data-kpi-acc]');
    const kpiRates = root.querySelector('[data-kpi-rates]');
    const kpiAuc = root.querySelector('[data-kpi-auc]');
    const cmWrap = root.querySelector('[data-cm-wrap]');
    const duelWrap = root.querySelector('[data-duel-wrap]');
    const noteEl = root.querySelector('[data-scenario-note]');

    const getActiveRows = () => {
      const base = DATASETS[scenarioKey].rows;
      const factor = squashed ? 0.5 : 1.0;
      return base.map((r) => ({ ...r, s: r.s * factor }));
    };

    const setScenario = (key) => {
      scenarioKey = key;
      squashed = false;
      if (squashBtn) {
        squashBtn.textContent = 'Squash Scores ÷ 2: OFF';
        squashBtn.classList.remove('btn-primary');
      }
      cutoffInput.value = DATASETS[key].defaultCutoff.toFixed(2);
      tabBtns.forEach((b) => {
        b.setAttribute('aria-selected', b.dataset.metricsScenario === key ? 'true' : 'false');
      });
      render();
    };

    const render = () => {
      const ds = DATASETS[scenarioKey];
      const rows = getActiveRows();
      const t = parseFloat(cutoffInput.value);
      cutoffVal.textContent = t.toFixed(2);

      const { positives, negatives, P, N, pairWins, totalPairs, auc, matrix, rocPoints } =
        computeRocAndPairs(rows);

      // Confusion counts at threshold t (alarm when s >= t; at t=1.00 nobody with s<1 triggers)
      let tp = 0, fn = 0, fp = 0, tn = 0;
      rows.forEach((r) => {
        const pred = r.s >= t - 1e-9 ? 1 : 0;
        if (r.y === 1 && pred === 1) tp += 1;
        else if (r.y === 1 && pred === 0) fn += 1;
        else if (r.y === 0 && pred === 1) fp += 1;
        else tn += 1;
      });

      const acc = (tp + tn) / rows.length;
      const tpr = P > 0 ? tp / P : 0;
      const fpr = N > 0 ? fp / N : 0;

      // KPI cards
      kpiAcc.innerHTML = `
        <div class="stage-step">1. Single-Cutoff Accuracy (at \\(t = ${t.toFixed(2)}\\))</div>
        <div class="stage-main" style="color:${tp === 0 && P > 0 ? 'var(--warn)' : 'var(--accent)'}">
          ${(acc * 100).toFixed(1)}% <span style="font-size:0.82rem;font-weight:500">(${tp + tn}/${rows.length} right)</span>
        </div>
        <div class="stage-sub">${tp === 0 ? 'Warning: 0 real cases caught at this cutoff!' : 'Changes whenever you move cutoff \\(t\\) or rescale scores.'}</div>
      `;

      kpiRates.innerHTML = `
        <div class="stage-step">2. Group Rates at Cutoff \\(t = ${t.toFixed(2)}\\)</div>
        <div class="stage-main" style="font-size:0.96rem">
          Catch ${(tpr * 100).toFixed(0)}% (${tp}/${P}) · False Alarm ${(fpr * 100).toFixed(0)}% (${fp}/${N})
        </div>
        <div class="stage-sub">Orange dot on the ROC plot: (FPR = ${fpr.toFixed(2)}, TPR = ${tpr.toFixed(2)}).</div>
      `;

      kpiAuc.innerHTML = `
        <div class="stage-step">3. ROC-AUC (All Cutoffs / Pairwise Order)</div>
        <div class="stage-main" style="color:${auc <= 0.501 ? 'var(--warn)' : 'var(--ok)'}">
          ${auc.toFixed(3)} <span style="font-size:0.82rem;font-weight:500">(${Number.isInteger(pairWins) ? pairWins : pairWins.toFixed(1)}/${totalPairs} pairs)</span>
        </div>
        <div class="stage-sub">Unchanged by moving \\(t\\) ${squashed ? 'or dividing all scores by 2!' : '— tests pure ranking!'}</div>
      `;

      // Confusion matrix
      cmWrap.innerHTML = `
        <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted)">
          Live 2×2 Confusion Table at Cutoff \\(t = ${t.toFixed(2)}\\)
        </div>
        <div class="cm-grid">
          <div class="cm-cell good">
            <strong>TP = ${tp}</strong>
            Caught ${ds.posLabel} (Alarm ✓)
          </div>
          <div class="cm-cell ${fn > 0 ? 'bad' : ''}">
            <strong>FN = ${fn}</strong>
            Missed ${ds.posLabel} (Silent ✗)
          </div>
          <div class="cm-cell ${fp > 0 ? 'bad' : ''}">
            <strong>FP = ${fp}</strong>
            False Alarm on ${ds.negLabel} (✗)
          </div>
          <div class="cm-cell good">
            <strong>TN = ${tn}</strong>
            Cleared ${ds.negLabel} (Quiet ✓)
          </div>
        </div>
      `;

      if (window.TeachingMath) {
        window.TeachingMath.render(kpiAcc);
        window.TeachingMath.render(kpiRates);
        window.TeachingMath.render(kpiAuc);
        window.TeachingMath.render(cmWrap);
      }

      // Pairwise duel table
      const headCols = negatives
        .map((neg) => `<th>${neg.name}<br><span style="font-weight:400;color:var(--ink-muted)">${neg.s.toFixed(2)}</span></th>`)
        .join('');
      const bodyRows = positives
        .map((pos, pi) => {
          const cells = matrix[pi]
            .map((res) => {
              if (res === 'win') return '<td><span class="pill-win">WIN 1</span></td>';
              if (res === 'tie') return '<td><span class="pill-tie">TIE ½</span></td>';
              return '<td><span class="pill-loss">LOSS 0</span></td>';
            })
            .join('');
          return `<tr><th>${pos.name} (${pos.s.toFixed(2)})</th>${cells}</tr>`;
        })
        .join('');

      duelWrap.innerHTML = `
        <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted)">
          Pairwise Duels: ${ds.posLabel} Row vs. ${ds.negLabel} Column (${Number.isInteger(pairWins) ? pairWins : pairWins.toFixed(1)} / ${totalPairs} = ${auc.toFixed(3)})
        </div>
        <div style="overflow-x:auto">
          <table class="duel-table">
            <thead><tr><th>Real 1 \\ Real 0</th>${headCols}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      `;

      if (noteEl) noteEl.textContent = ds.note;

      // Draw combined ROC plot + bottom score number-line strip in SVG
      const W = 380;
      const H = 355;
      const pad = { l: 48, r: 20, t: 20, b: 108 };
      const plotW = W - pad.l - pad.r;
      const plotH = H - pad.t - pad.b; // 227 px

      const xRoc = (fprVal) => pad.l + fprVal * plotW;
      const yRoc = (tprVal) => pad.t + (1 - tprVal) * plotH;

      // Area polygon path
      const polyPts = [
        `${xRoc(0)},${yRoc(0)}`,
        ...rocPoints.map((pt) => `${xRoc(pt.fpr)},${yRoc(pt.tpr)}`),
        `${xRoc(1)},${yRoc(0)}`
      ].join(' ');

      const linePts = rocPoints.map((pt) => `${xRoc(pt.fpr)},${yRoc(pt.tpr)}`).join(' ');

      // Grid lines
      const ticks = [0, 0.25, 0.5, 0.75, 1];
      const gridSvg = ticks
        .map((tk) => `
          <line x1="${xRoc(tk)}" y1="${pad.t}" x2="${xRoc(tk)}" y2="${pad.t + plotH}" stroke="#ece7dc" stroke-width="1"/>
          <line x1="${pad.l}" y1="${yRoc(tk)}" x2="${pad.l + plotW}" y2="${yRoc(tk)}" stroke="#ece7dc" stroke-width="1"/>
          <text x="${xRoc(tk)}" y="${pad.t + plotH + 15}" font-size="10" text-anchor="middle" fill="#59636e">${tk.toFixed(2)}</text>
          <text x="${pad.l - 7}" y="${yRoc(tk) + 3}" font-size="10" text-anchor="end" fill="#59636e">${tk.toFixed(2)}</text>
        `)
        .join('');

      // Score strip at bottom of SVG (matches our orange circle = Real 0, purple ×-square = Real 1 icons)
      const stripY = H - 30;
      const xScore = (sVal) => pad.l + Math.max(0, Math.min(1, sVal)) * plotW;

      // Stack identical/nearby scores into neat vertical columns above the strip line
      const BINS = 28;
      const cols = Array.from({ length: BINS }, () => ({ zeros: [], ones: [] }));
      rows.forEach((r) => {
        const idx = Math.min(BINS - 1, Math.max(0, Math.floor(r.s * BINS)));
        if (r.y === 0) cols[idx].zeros.push(r);
        else cols[idx].ones.push(r);
      });

      let dotsSvg = '';
      cols.forEach((col, bIdx) => {
        const all = [...col.zeros, ...col.ones];
        if (!all.length) return;
        all.forEach((r, stackIdx) => {
          const row = stackIdx % 3;
          const subCol = Math.floor(stackIdx / 3);
          const baseX = all.length === 1 ? xScore(r.s) : pad.l + (bIdx + 0.5) * (plotW / BINS);
          const cx = baseX + subCol * 9.2;
          const cy = stripY - 6.2 - row * 9.2;
          const rad = 3.9;
          if (r.y === 0) {
            dotsSvg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad}" fill="#f59e0b"/>`;
          } else {
            const d = rad * 0.5;
            dotsSvg += `
              <rect x="${(cx - rad).toFixed(1)}" y="${(cy - rad).toFixed(1)}" width="${(rad * 2).toFixed(1)}" height="${(rad * 2).toFixed(1)}" rx="1.8" fill="#8b3dff"/>
              <line x1="${(cx - d).toFixed(1)}" y1="${(cy - d).toFixed(1)}" x2="${(cx + d).toFixed(1)}" y2="${(cy + d).toFixed(1)}" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
              <line x1="${(cx - d).toFixed(1)}" y1="${(cy + d).toFixed(1)}" x2="${(cx + d).toFixed(1)}" y2="${(cy - d).toFixed(1)}" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
            `;
          }
        });
      });

      svgRoc.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svgRoc.innerHTML = `
        ${gridSvg}
        <polygon points="${polyPts}" fill="rgba(15, 92, 110, 0.14)"/>
        <line x1="${xRoc(0)}" y1="${yRoc(0)}" x2="${xRoc(1)}" y2="${yRoc(1)}"
              stroke="#b33a2b" stroke-width="1.5" stroke-dasharray="5,4"/>
        <polyline points="${linePts}" fill="none" stroke="#0f5c6e" stroke-width="3" stroke-linejoin="round"/>
        ${rocPoints
          .map((pt) => `<circle cx="${xRoc(pt.fpr)}" cy="${yRoc(pt.tpr)}" r="3.5" fill="#0f5c6e"/>`)
          .join('')}
        <circle cx="${xRoc(fpr)}" cy="${yRoc(tpr)}" r="7" fill="#d97706" stroke="#ffffff" stroke-width="2"/>

        <text x="${pad.l + plotW / 2}" y="${pad.t + plotH + 29}" font-size="11" font-weight="600" text-anchor="middle" fill="#1e2328">
          False Alarm Rate (FPR among Real 0s)
        </text>
        <text x="14" y="${pad.t + plotH / 2}" font-size="11" font-weight="600" text-anchor="middle" fill="#1e2328"
              transform="rotate(-90 14 ${pad.t + plotH / 2})">
          Catch Rate (TPR among Real 1s)
        </text>
        <text x="${xRoc(0.68)}" y="${yRoc(0.56)}" font-size="10" fill="#b33a2b">Coin flip (0.50)</text>

        <!-- Bottom Risk Score Strip (Cream backdrop matching Section 1) -->
        <text x="${pad.l}" y="${stripY - 38}" font-size="9.6" font-weight="700" fill="#59636e">Scores s ∈ [0, 1]:</text>
        <circle cx="${pad.l + 96}" cy="${stripY - 41.2}" r="4.1" fill="#f59e0b"/>
        <text x="${pad.l + 104}" y="${stripY - 38}" font-size="9.5" font-weight="600" fill="#59636e">Real 0</text>
        <rect x="${pad.l + 144}" y="${stripY - 45.3}" width="8.2" height="8.2" rx="1.8" fill="#8b3dff"/>
        <line x1="${pad.l + 146.1}" y1="${stripY - 43.2}" x2="${pad.l + 150.1}" y2="${stripY - 39.2}" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
        <line x1="${pad.l + 146.1}" y1="${stripY - 39.2}" x2="${pad.l + 150.1}" y2="${stripY - 43.2}" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
        <text x="${pad.l + 156}" y="${stripY - 38}" font-size="9.5" font-weight="600" fill="#59636e">Real 1</text>
        <rect x="${pad.l}" y="${stripY - 33}" width="${plotW}" height="33" fill="#fcefc7"/>
        <line x1="${pad.l}" y1="${stripY}" x2="${pad.l + plotW}" y2="${stripY}" stroke="#6e7781" stroke-width="1.5"/>
        ${dotsSvg}
        <line x1="${xScore(t)}" y1="${stripY - 35}" x2="${xScore(t)}" y2="${stripY + 6}" stroke="#1e2328" stroke-width="2.2" stroke-dasharray="4,2"/>
        <text x="${xScore(t)}" y="${stripY + 18}" font-size="10" font-weight="700" text-anchor="middle" fill="#1e2328">
          t = ${t.toFixed(2)}
        </text>
      `;
    };

    cutoffInput.addEventListener('input', render);

    if (presetDefaultBtn) {
      presetDefaultBtn.addEventListener('click', () => {
        cutoffInput.value = '0.50';
        render();
      });
    }

    if (squashBtn) {
      squashBtn.addEventListener('click', () => {
        squashed = !squashed;
        squashBtn.textContent = squashed ? 'Squash Scores ÷ 2: ON' : 'Squash Scores ÷ 2: OFF';
        squashBtn.classList.toggle('btn-primary', squashed);
        render();
      });
    }

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => setScenario(btn.dataset.metricsScenario));
    });

    setScenario('clinic');
  };

  const boot = () => {
    document.querySelectorAll('[data-metrics-roc-lab]').forEach(initLab);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
