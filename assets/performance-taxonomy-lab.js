(() => {
  const Y_TRUE = [0, 0, 0, 1, 0, 1, 1, 1];

  const ARCHETYPES = {
    ideal: {
      title: '1. Sharp & Honest GLM (Ideal)',
      scores: [0.15, 0.20, 0.28, 0.37, 0.63, 0.72, 0.80, 0.85],
      singleBucket: false,
      summary: 'Strong Discrimination (AUC = 0.938) + Perfect Bucket Calibration (Low bucket predicts 25% & sees 1/4 = 25%; High bucket predicts 75% & sees 3/4 = 75%). Result: Best Overall Log-Loss (0.427) and Brier Score (0.134)!'
    },
    squashed: {
      title: '2. Squashed ÷ 5 (Rank OK, Bad Scale)',
      scores: [0.03, 0.04, 0.056, 0.074, 0.126, 0.144, 0.16, 0.17],
      singleBucket: false,
      summary: 'Every score was divided by 5. Category 1 (ROC-AUC = 0.938) does NOT notice at all because rank order stayed identical! Yet Category 2 (Calibration) fails badly—predicting 15% when 75% are sick—and Category 3 (Log-Loss = 1.051) & Category 4 (Accuracy @ 0.50 = 50%) expose the damage.'
    },
    climatology: {
      title: '3. Constant 0.50 (Calibrated, No Rank)',
      scores: [0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
      singleBucket: true,
      summary: 'Predicts 0.50 for everyone. Category 2 (Calibration Error = 0.000) is 100% honest because 4/8 = 50% truly are sick! Yet Category 1 (ROC-AUC = 0.500) exposes zero ability to separate sick from healthy, leaving Overall Brier stuck at the 0.250 coin-flip baseline.'
    },
    overconfident: {
      title: '4. Overconfident (0.01 / 0.99 Trap)',
      scores: [0.005, 0.01, 0.015, 0.02, 0.98, 0.985, 0.99, 0.995],
      singleBucket: false,
      summary: 'Pushes scores to extreme 1% and 99%. Both ROC-AUC (0.938) and Accuracy @ 0.50 (75%) look great—yet telling a sick patient "2% risk" and a healthy patient "98% risk" causes Category 3 Log-Loss (0.986) to blow up worse than a blind coin flip (0.693)!'
    }
  };

  const aucTier = (auc) => {
    if (auc >= 0.90) return { label: 'Outstanding (≥0.90)', color: 'var(--ok)' };
    if (auc >= 0.80) return { label: 'Strong (0.80–0.89)', color: 'var(--ok)' };
    if (auc >= 0.70) return { label: 'Acceptable (0.70–0.79)', color: 'var(--accent)' };
    if (auc > 0.501) return { label: 'Weak (0.51–0.69)', color: '#9a6700' };
    return { label: 'No Separation (0.50)', color: 'var(--warn)' };
  };

  const computeAll = (scores, singleBucket, cutoff) => {
    const pos = [];
    const neg = [];
    scores.forEach((s, i) => {
      if (Y_TRUE[i] === 1) pos.push(s);
      else neg.push(s);
    });

    let wins = 0;
    pos.forEach((p) => {
      neg.forEach((n) => {
        if (p > n + 1e-12) wins += 1;
        else if (Math.abs(p - n) <= 1e-12) wins += 0.5;
      });
    });
    const auc = wins / (pos.length * neg.length);

    // Empirical ROC
    const distinct = Array.from(new Set(scores.map((v) => Number(v.toFixed(6))))).sort((a, b) => b - a);
    const rocPts = [{ fpr: 0, tpr: 0 }];
    distinct.forEach((sc) => {
      const tp = pos.filter((v) => v >= sc - 1e-9).length;
      const fp = neg.filter((v) => v >= sc - 1e-9).length;
      rocPts.push({ fpr: fp / neg.length, tpr: tp / pos.length });
    });
    if (rocPts[rocPts.length - 1].fpr < 1 || rocPts[rocPts.length - 1].tpr < 1) {
      rocPts.push({ fpr: 1, tpr: 1 });
    }

    // Calibration buckets
    let buckets = [];
    if (singleBucket) {
      const predAvg = scores.reduce((a, b) => a + b, 0) / 8;
      const obsAvg = Y_TRUE.reduce((a, b) => a + b, 0) / 8;
      buckets = [{ name: 'All 8 pts', pred: predAvg, obs: obsAvg, n: 8 }];
    } else {
      const p1 = scores.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
      const o1 = Y_TRUE.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
      const p2 = scores.slice(4, 8).reduce((a, b) => a + b, 0) / 4;
      const o2 = Y_TRUE.slice(4, 8).reduce((a, b) => a + b, 0) / 4;
      buckets = [
        { name: 'Low Bucket (4)', pred: p1, obs: o1, n: 4 },
        { name: 'High Bucket (4)', pred: p2, obs: o2, n: 4 }
      ];
    }
    const ece = buckets.reduce((acc, b) => acc + (b.n / 8) * Math.abs(b.pred - b.obs), 0);

    // Overall probabilistic scores
    let brierSum = 0;
    let logLossSum = 0;
    scores.forEach((s, i) => {
      const y = Y_TRUE[i];
      const sc = Math.min(1 - 1e-12, Math.max(1e-12, s));
      brierSum += (y - sc) ** 2;
      logLossSum += -(y * Math.log(sc) + (1 - y) * Math.log(1 - sc));
    });
    const brier = brierSum / 8;
    const logLoss = logLossSum / 8;

    // Category 4 at cutoff t
    let tp = 0, fn = 0, fp = 0, tn = 0;
    scores.forEach((s, i) => {
      const pred = s >= cutoff - 1e-9 ? 1 : 0;
      if (Y_TRUE[i] === 1 && pred === 1) tp += 1;
      else if (Y_TRUE[i] === 1 && pred === 0) fn += 1;
      else if (Y_TRUE[i] === 0 && pred === 1) fp += 1;
      else tn += 1;
    });
    const acc = (tp + tn) / 8;
    const tpr = tp / 4;
    const fpr = fp / 4;
    const prec = tp + fp > 0 ? tp / (tp + fp) : null;

    return { auc, wins, rocPts, buckets, ece, brier, logLoss, tp, fn, fp, tn, acc, tpr, fpr, prec };
  };

  const initTaxonomyLab = (root) => {
    let key = 'ideal';
    const tabBtns = root.querySelectorAll('[data-archetype]');
    const cutoffInput = root.querySelector('[data-tax-cutoff]');
    const cutoffVal = root.querySelector('[data-tax-cutoff-val]');
    const card1 = root.querySelector('[data-cat-1]');
    const card2 = root.querySelector('[data-cat-2]');
    const card3 = root.querySelector('[data-cat-3]');
    const card4 = root.querySelector('[data-cat-4]');
    const rocSvg = root.querySelector('[data-tax-roc-svg]');
    const calSvg = root.querySelector('[data-tax-cal-svg]');
    const stripSvg = root.querySelector('[data-tax-strip-svg]');
    const rowTable = root.querySelector('[data-tax-rows]');
    const noteEl = root.querySelector('[data-tax-note]');

    const render = () => {
      const arch = ARCHETYPES[key];
      const t = parseFloat(cutoffInput.value);
      cutoffVal.textContent = t.toFixed(2);

      const m = computeAll(arch.scores, arch.singleBucket, t);
      const tier = aucTier(m.auc);

      card1.innerHTML = `
        <div class="stage-step">Category 1 · Discrimination (Rank)</div>
        <div class="stage-main" style="color:${tier.color}">ROC-AUC = ${m.auc.toFixed(3)}</div>
        <div class="stage-sub"><strong>${tier.label}</strong> (${m.wins}/16 pairs). Cutoff-free &amp; scale-free.</div>
      `;

      const calColor = m.ece < 0.05 ? 'var(--ok)' : 'var(--warn)';
      const calLabel = m.ece < 0.05 ? 'Well-Calibrated (Honest)' : `Miscalibrated (Off by ${(m.ece * 100).toFixed(0)}%)`;
      card2.innerHTML = `
        <div class="stage-step">Category 2 · Calibration (Honesty)</div>
        <div class="stage-main" style="color:${calColor}">ECE = ${m.ece.toFixed(3)}</div>
        <div class="stage-sub"><strong>${calLabel}</strong>. Checks if predicted % matches reality.</div>
      `;

      const overallGood = m.logLoss < 0.55 && m.brier < 0.18;
      const overallBad = m.logLoss > 0.70 || m.brier > 0.26;
      const ovColor = overallGood ? 'var(--ok)' : (overallBad ? 'var(--warn)' : '#9a6700');
      card3.innerHTML = `
        <div class="stage-step">Category 3 · Overall Probabilistic</div>
        <div class="stage-main" style="color:${ovColor};font-size:0.96rem">
          Log-Loss ${m.logLoss.toFixed(3)} · Brier ${m.brier.toFixed(3)}
        </div>
        <div class="stage-sub">Lower is better (coin flip: 0.693 / 0.250). Needs <strong>both</strong> Cat 1 &amp; Cat 2!</div>
      `;

      card4.innerHTML = `
        <div class="stage-step">Category 4 · Hard Action @ \\(t = ${t.toFixed(2)}\\)</div>
        <div class="stage-main" style="font-size:0.96rem;color:${m.tp === 0 ? 'var(--warn)' : 'var(--accent)'}">
          Acc ${(m.acc * 100).toFixed(0)}% · Recall ${(m.tpr * 100).toFixed(0)}% · Prec ${m.prec === null ? '—' : `${(m.prec * 100).toFixed(0)}%`}
        </div>
        <div class="stage-sub"><strong>Only</strong> card that moves when you drag cutoff slider \\(t\\)!</div>
      `;

      // Draw Left SVG: ROC
      const W = 320, H = 265;
      const pad = { l: 44, r: 16, t: 24, b: 38 };
      const pW = W - pad.l - pad.r;
      const pH = H - pad.t - pad.b;
      const xR = (v) => pad.l + v * pW;
      const yR = (v) => pad.t + (1 - v) * pH;

      const poly = [`${xR(0)},${yR(0)}`, ...m.rocPts.map((p) => `${xR(p.fpr)},${yR(p.tpr)}`), `${xR(1)},${yR(0)}`].join(' ');
      const line = m.rocPts.map((p) => `${xR(p.fpr)},${yR(p.tpr)}`).join(' ');
      const ticks = [0, 0.25, 0.5, 0.75, 1];

      rocSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      rocSvg.innerHTML = `
        <text x="${W / 2}" y="15" font-size="11" font-weight="700" text-anchor="middle" fill="#1e2328">
          Cat 1: ROC Curve (AUC = ${m.auc.toFixed(3)})
        </text>
        ${ticks.map((tk) => `
          <line x1="${xR(tk)}" y1="${pad.t}" x2="${xR(tk)}" y2="${pad.t + pH}" stroke="#ece7dc"/>
          <line x1="${pad.l}" y1="${yR(tk)}" x2="${pad.l + pW}" y2="${yR(tk)}" stroke="#ece7dc"/>
          <text x="${xR(tk)}" y="${pad.t + pH + 14}" font-size="9.5" text-anchor="middle" fill="#59636e">${tk.toFixed(2)}</text>
          <text x="${pad.l - 6}" y="${yR(tk) + 3}" font-size="9.5" text-anchor="end" fill="#59636e">${tk.toFixed(2)}</text>
        `).join('')}
        <polygon points="${poly}" fill="rgba(15, 92, 110, 0.14)"/>
        <line x1="${xR(0)}" y1="${yR(0)}" x2="${xR(1)}" y2="${yR(1)}" stroke="#b33a2b" stroke-dasharray="4,4"/>
        <polyline points="${line}" fill="none" stroke="#0f5c6e" stroke-width="2.8"/>
        <circle cx="${xR(m.fpr)}" cy="${yR(m.tpr)}" r="6" fill="#d97706" stroke="#fff" stroke-width="2"/>
        <text x="${pad.l + pW / 2}" y="${H - 6}" font-size="10" font-weight="600" text-anchor="middle" fill="#1e2328">False Alarm Rate (FPR)</text>
        <text x="12" y="${pad.t + pH / 2}" font-size="10" font-weight="600" text-anchor="middle" fill="#1e2328" transform="rotate(-90 12 ${pad.t + pH / 2})">Catch Rate (TPR)</text>
      `;

      // Draw Right SVG: Calibration Curve
      calSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const calLine = m.buckets.length > 1
        ? `<polyline points="${m.buckets.map((b) => `${xR(b.pred)},${yR(b.obs)}`).join(' ')}" fill="none" stroke="${m.ece < 0.05 ? '#1d6f42' : '#b33a2b'}" stroke-width="2.4"/>`
        : '';
      const errBars = m.buckets.map((b) => {
        const gap = Math.abs(b.pred - b.obs);
        if (gap < 0.01) return '';
        return `<line x1="${xR(b.pred)}" y1="${yR(b.pred)}" x2="${xR(b.pred)}" y2="${yR(b.obs)}" stroke="#b33a2b" stroke-width="2" stroke-dasharray="3,2"/>`;
      }).join('');

      calSvg.innerHTML = `
        <text x="${W / 2}" y="15" font-size="11" font-weight="700" text-anchor="middle" fill="#1e2328">
          Cat 2: Calibration Plot (ECE = ${m.ece.toFixed(3)})
        </text>
        ${ticks.map((tk) => `
          <line x1="${xR(tk)}" y1="${pad.t}" x2="${xR(tk)}" y2="${pad.t + pH}" stroke="#ece7dc"/>
          <line x1="${pad.l}" y1="${yR(tk)}" x2="${pad.l + pW}" y2="${yR(tk)}" stroke="#ece7dc"/>
          <text x="${xR(tk)}" y="${pad.t + pH + 14}" font-size="9.5" text-anchor="middle" fill="#59636e">${tk.toFixed(2)}</text>
          <text x="${pad.l - 6}" y="${yR(tk) + 3}" font-size="9.5" text-anchor="end" fill="#59636e">${tk.toFixed(2)}</text>
        `).join('')}
        <line x1="${xR(0)}" y1="${yR(0)}" x2="${xR(1)}" y2="${yR(1)}" stroke="#1d6f42" stroke-width="1.6" stroke-dasharray="5,4"/>
        <text x="${xR(0.60)}" y="${yR(0.50)}" font-size="9.5" fill="#1d6f42">45° Perfect Honesty</text>
        ${errBars}
        ${calLine}
        ${m.buckets.map((b) => `
          <circle cx="${xR(b.pred)}" cy="${yR(b.obs)}" r="6" fill="${m.ece < 0.05 ? '#1d6f42' : '#b33a2b'}" stroke="#fff" stroke-width="2"/>
          <text x="${Math.min(W - 38, Math.max(pad.l + 28, xR(b.pred)))}" y="${yR(b.obs) - 10}" font-size="9.5" font-weight="600" text-anchor="middle" fill="#1e2328">
            (${(b.pred * 100).toFixed(0)}% → ${(b.obs * 100).toFixed(0)}%)
          </text>
        `).join('')}
        <text x="${pad.l + pW / 2}" y="${H - 6}" font-size="10" font-weight="600" text-anchor="middle" fill="#1e2328">Bucket Avg Predicted Risk</text>
        <text x="12" y="${pad.t + pH / 2}" font-size="10" font-weight="600" text-anchor="middle" fill="#1e2328" transform="rotate(-90 12 ${pad.t + pH / 2})">Actual Sick Fraction</text>
      `;

      // Draw [0.0, 1.0] 8-patient dot-plot strip (bridges directly to Lesson 0002's capability plot!)
      if (stripSvg) {
        const SW = 680, SH = 122;
        const sL = 22, sR = 22, sW = SW - sL - sR;
        const boxTop = 24, axisY = 94, boxH = axisY - boxTop;
        const B = 34;
        const cols = Array.from({ length: B }, () => ({ zeros: [], ones: [] }));
        arch.scores.forEach((sc, idx) => {
          const bIdx = Math.min(B - 1, Math.max(0, Math.floor(sc * B)));
          if (Y_TRUE[idx] === 0) cols[bIdx].zeros.push(sc);
          else cols[bIdx].ones.push(sc);
        });
        const xS = (v) => sL + Math.max(0, Math.min(1, v)) * sW;

        let dots = '';
        cols.forEach((col, bIdx) => {
          const all = [
            ...col.zeros.map((sc) => ({ y: 0, sc })),
            ...col.ones.map((sc) => ({ y: 1, sc }))
          ];
          all.forEach((pt, kIdx) => {
            const row = kIdx % 4;
            const sub = Math.floor(kIdx / 4);
            const base = all.length === 1 ? xS(pt.sc) : sL + (bIdx + 0.5) * (sW / B);
            const cx = base + (all.length > 4 ? (sub === 0 ? -7.5 : 7.5) : 0);
            const cy = axisY - 9.5 - row * 16.2;
            const rad = 6.8;
            if (pt.y === 0) {
              dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad}" fill="#f59e0b"/>`;
            } else {
              const d = rad * 0.48;
              dots += `
                <rect x="${(cx - rad).toFixed(1)}" y="${(cy - rad).toFixed(1)}" width="${(rad * 2).toFixed(1)}" height="${(rad * 2).toFixed(1)}" rx="2.8" fill="#8b3dff"/>
                <line x1="${(cx - d).toFixed(1)}" y1="${(cy - d).toFixed(1)}" x2="${(cx + d).toFixed(1)}" y2="${(cy + d).toFixed(1)}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                <line x1="${(cx - d).toFixed(1)}" y1="${(cy + d).toFixed(1)}" x2="${(cx + d).toFixed(1)}" y2="${(cy - d).toFixed(1)}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
              `;
            }
          });
        });

        let sTicks = '';
        for (let i = 0; i <= 10; i += 1) {
          const v = i / 10;
          const tx = xS(v);
          sTicks += `
            <line x1="${tx.toFixed(1)}" y1="${axisY}" x2="${tx.toFixed(1)}" y2="${axisY + 5}" stroke="#6e7781" stroke-width="1.3"/>
            <text x="${tx.toFixed(1)}" y="${axisY + 17}" font-size="10.2" text-anchor="middle" fill="#59636e">${v.toFixed(1)}</text>
          `;
        }

        const cutX = xS(t);
        stripSvg.setAttribute('viewBox', `0 0 ${SW} ${SH}`);
        stripSvg.innerHTML = `
          <text x="${sL}" y="15" font-size="10.5" font-weight="700" fill="#1e2328">Where the 8 Patients Land on [0.0, 1.0]:</text>
          <circle cx="${sL + 224}" cy="11.5" r="5" fill="#f59e0b"/>
          <text x="${sL + 233}" y="15" font-size="10.2" font-weight="600" fill="#1e2328">Healthy (0)</text>
          <rect x="${sL + 303}" y="6.5" width="10" height="10" rx="2.2" fill="#8b3dff"/>
          <line x1="${sL + 305.5}" y1="9" x2="${sL + 310.5}" y2="14" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
          <line x1="${sL + 305.5}" y1="14" x2="${sL + 310.5}" y2="9" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
          <text x="${sL + 317}" y="15" font-size="10.2" font-weight="600" fill="#1e2328">Sick (1)</text>
          <text x="${SW - sR}" y="15" font-size="10" font-weight="600" text-anchor="end" fill="#59636e">
            Cutoff Knife t = ${t.toFixed(2)}
          </text>
          <rect x="${sL}" y="${boxTop}" width="${sW}" height="${boxH}" fill="#fcefc7"/>
          ${dots}
          <line x1="${cutX.toFixed(1)}" y1="${boxTop - 2}" x2="${cutX.toFixed(1)}" y2="${axisY + 4}" stroke="#1e2328" stroke-width="2.2" stroke-dasharray="4,3"/>
          <line x1="${sL}" y1="${axisY}" x2="${sL + sW}" y2="${axisY}" stroke="#6e7781" stroke-width="1.4"/>
          ${sTicks}
        `;
      }

      // Compact 8-patient strip table
      rowTable.innerHTML = `
        <thead>
          <tr>
            <th>Patient</th>
            ${Y_TRUE.map((_, i) => `<th class="num">P${i + 1}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>True Outcome <span class="cls-badge cls-0"></span>/<span class="cls-badge cls-1">×</span> (\\(y_i\\))</strong></td>
            ${Y_TRUE.map((y) => `<td class="num"><strong>${y}</strong></td>`).join('')}
          </tr>
          <tr>
            <td><strong>Predicted Risk (\\(s_i\\))</strong></td>
            ${arch.scores.map((s) => `<td class="num">${s < 0.01 ? s.toFixed(3) : s.toFixed(2)}</td>`).join('')}
          </tr>
          <tr>
            <td><strong>Action @ \\(t = ${t.toFixed(2)}\\)</strong></td>
            ${arch.scores.map((s, i) => {
              const pred = s >= t - 1e-9 ? 1 : 0;
              const ok = pred === Y_TRUE[i];
              return `<td class="num ${ok ? 'good-val' : 'bad-val'}">${pred} ${ok ? '✓' : '✗'}</td>`;
            }).join('')}
          </tr>
        </tbody>
      `;

      if (window.TeachingMath) {
        window.TeachingMath.render(card4);
        window.TeachingMath.render(rowTable);
      }

      if (noteEl) noteEl.textContent = arch.summary;
    };

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        key = btn.dataset.archetype;
        tabBtns.forEach((b) => b.setAttribute('aria-selected', b.dataset.archetype === key ? 'true' : 'false'));
        render();
      });
    });

    cutoffInput.addEventListener('input', render);
    render();
  };

  const boot = () => {
    document.querySelectorAll('[data-taxonomy-lab]').forEach(initTaxonomyLab);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
