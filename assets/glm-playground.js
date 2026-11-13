(() => {
  const SCENARIOS = {
    binary: {
      name: 'Binary Pass/Fail (Bernoulli + Logit Link)',
      xLabel: 'Study hours (x)',
      yLabel: 'Pass outcome y / Mean probability μ',
      xMin: -0.5,
      xMax: 9.0,
      yMin: -0.35,
      yMax: 1.40,
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 5, y: 1 },
        { x: 8, y: 1 }
      ],
      olsB0: -3 / 34,
      olsB1: 5 / 34,
      olsVar: 9 / 68,
      b0Default: -3.6,
      b1Default: 0.90,
      b0Range: [-5.0, 1.0, 0.1],
      b1Range: [0.1, 1.8, 0.05],
      probeDefault: 0.0,
      probeRange: [0, 8.5, 0.5],
      invLink: (eta) => 1 / (1 + Math.exp(-eta)),
      variance: (mu) => mu * (1 - mu),
      linkFormula: 'g(μ) = log(μ / (1 − μ)) = η',
      invFormula: '\\(\\mu = \\frac{1}{1 + e^{-\\eta}}\\)',
      varFormula: '\\(\\operatorname{Var}(Y \\mid x) = \\mu(1 - \\mu)\\)',
      isOlsInvalid: (yHat) => yHat < 0 || yHat > 1,
      invalidReason: (yHat) => yHat < 0
        ? `OLS predicts probability ${yHat.toFixed(2)} < 0 (impossible!)`
        : `OLS predicts probability ${yHat.toFixed(2)} > 1 (impossible!)`
    },
    poisson: {
      name: 'Rainy-Day Walk-Ins (Poisson + Log Link)',
      xLabel: 'Rain intensity index (x)',
      yLabel: 'Walk-in customers y / Mean count μ',
      xMin: -0.3,
      xMax: 6.0,
      yMin: -1.8,
      yMax: 8.5,
      points: [
        { x: 0, y: 6 },
        { x: 1, y: 3 },
        { x: 3, y: 1 },
        { x: 5, y: 0 }
      ],
      olsB0: 296 / 59,
      olsB1: -66 / 59,
      olsVar: 1.271,
      b0Default: 1.80,
      b1Default: -0.65,
      b0Range: [0.5, 2.3, 0.05],
      b1Range: [-1.2, -0.1, 0.05],
      probeDefault: 5.0,
      probeRange: [0, 5.5, 0.5],
      invLink: (eta) => Math.exp(eta),
      variance: (mu) => mu,
      linkFormula: 'g(μ) = log(μ) = η',
      invFormula: '\\(\\mu = e^{\\eta}\\)',
      varFormula: '\\(\\operatorname{Var}(Y \\mid x) = \\mu\\)',
      isOlsInvalid: (yHat) => yHat <= 0,
      invalidReason: (yHat) => `OLS predicts ${yHat.toFixed(2)} customers ≤ 0 (impossible count!)`
    }
  };

  const initPlayground = (root) => {
    let mode = 'binary';
    const b0Input = root.querySelector('[data-b0]');
    const b1Input = root.querySelector('[data-b1]');
    const probeInput = root.querySelector('[data-probe]');
    const b0Val = root.querySelector('[data-b0-val]');
    const b1Val = root.querySelector('[data-b1-val]');
    const probeVal = root.querySelector('[data-probe-val]');
    const svg = root.querySelector('svg');
    const stage1 = root.querySelector('[data-stage-1]');
    const stage2 = root.querySelector('[data-stage-2]');
    const stage3 = root.querySelector('[data-stage-3]');
    const tabBtns = root.querySelectorAll('[data-scenario]');
    const resetBtn = root.querySelector('[data-reset-params]');

    const applyScenarioDefaults = (newMode) => {
      mode = newMode;
      const sc = SCENARIOS[mode];
      b0Input.min = sc.b0Range[0];
      b0Input.max = sc.b0Range[1];
      b0Input.step = sc.b0Range[2];
      b0Input.value = sc.b0Default;

      b1Input.min = sc.b1Range[0];
      b1Input.max = sc.b1Range[1];
      b1Input.step = sc.b1Range[2];
      b1Input.value = sc.b1Default;

      probeInput.min = sc.probeRange[0];
      probeInput.max = sc.probeRange[1];
      probeInput.step = sc.probeRange[2];
      probeInput.value = sc.probeDefault;

      tabBtns.forEach((btn) => {
        btn.setAttribute('aria-selected', btn.dataset.scenario === mode ? 'true' : 'false');
      });
      draw();
    };

    const draw = () => {
      const sc = SCENARIOS[mode];
      const b0 = parseFloat(b0Input.value);
      const b1 = parseFloat(b1Input.value);
      const xProbe = parseFloat(probeInput.value);

      b0Val.textContent = b0.toFixed(2);
      b1Val.textContent = b1.toFixed(2);
      probeVal.textContent = xProbe.toFixed(1);

      const W = 680;
      const H = 320;
      const pad = { l: 54, r: 24, t: 22, b: 42 };
      const pw = W - pad.l - pad.r;
      const ph = H - pad.t - pad.b;

      const sx = (x) => pad.l + ((x - sc.xMin) / (sc.xMax - sc.xMin)) * pw;
      const sy = (y) => pad.t + (1 - (y - sc.yMin) / (sc.yMax - sc.yMin)) * ph;

      let out = '';

      // Forbidden regions
      const yZero = sy(0);
      out += `<rect x="${pad.l}" y="${yZero}" width="${pw}" height="${Math.max(0, pad.t + ph - yZero)}" fill="#fbeae7" opacity="0.65"/>`;
      out += `<text x="${pad.l + 8}" y="${H - pad.b - 6}" font-size="11" fill="#b33a2b" font-family="sans-serif">Forbidden region (mean &lt; 0)</text>`;

      if (mode === 'binary') {
        const yOne = sy(1);
        out += `<rect x="${pad.l}" y="${pad.t}" width="${pw}" height="${Math.max(0, yOne - pad.t)}" fill="#fbeae7" opacity="0.65"/>`;
        out += `<text x="${pad.l + 8}" y="${pad.t + 14}" font-size="11" fill="#b33a2b" font-family="sans-serif">Forbidden region (probability &gt; 1)</text>`;
        out += `<line x1="${pad.l}" y1="${yOne}" x2="${W - pad.r}" y2="${yOne}" stroke="#b33a2b" stroke-dasharray="3,3" stroke-width="1"/>`;
      }

      // Zero baseline & axes
      out += `<line x1="${pad.l}" y1="${yZero}" x2="${W - pad.r}" y2="${yZero}" stroke="#9aa3ad" stroke-width="1"/>`;
      out += `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}" stroke="#59636e" stroke-width="1.2"/>`;
      out += `<line x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}" stroke="#59636e" stroke-width="1.2"/>`;

      // Ticks
      const xTicks = mode === 'binary' ? [0, 2, 4, 6, 8] : [0, 1, 2, 3, 4, 5];
      xTicks.forEach((tx) => {
        const px = sx(tx);
        out += `<line x1="${px}" y1="${H - pad.b}" x2="${px}" y2="${H - pad.b + 5}" stroke="#59636e"/>`;
        out += `<text x="${px}" y="${H - pad.b + 18}" text-anchor="middle" font-size="11" fill="#59636e" font-family="sans-serif">${tx}</text>`;
      });

      const yTicks = mode === 'binary' ? [0, 0.5, 1.0] : [0, 2, 4, 6, 8];
      yTicks.forEach((ty) => {
        const py = sy(ty);
        out += `<line x1="${pad.l - 5}" y1="${py}" x2="${pad.l}" y2="${py}" stroke="#59636e"/>`;
        out += `<text x="${pad.l - 9}" y="${py + 4}" text-anchor="end" font-size="11" fill="#59636e" font-family="sans-serif">${ty}</text>`;
      });

      // Axis titles
      out += `<text x="${pad.l + pw / 2}" y="${H - 6}" text-anchor="middle" font-size="12" font-weight="600" fill="#1e2328" font-family="sans-serif">${sc.xLabel}</text>`;
      out += `<text x="15" y="${pad.t + ph / 2}" text-anchor="middle" font-size="12" font-weight="600" fill="#1e2328" font-family="sans-serif" transform="rotate(-90 15 ${pad.t + ph / 2})">${sc.yLabel}</text>`;

      // GLM Curve + ±1 SD band
      const steps = 80;
      const upperPts = [];
      const lowerPts = [];
      const meanPts = [];
      for (let i = 0; i <= steps; i += 1) {
        const x = sc.xMin + ((sc.xMax - sc.xMin) * i) / steps;
        const eta = b0 + b1 * x;
        const mu = sc.invLink(eta);
        const sd = Math.sqrt(Math.max(0, sc.variance(mu)));
        const yU = Math.min(sc.yMax, Math.max(sc.yMin, mu + sd));
        const yL = Math.min(sc.yMax, Math.max(sc.yMin, mu - sd));
        const yM = Math.min(sc.yMax, Math.max(sc.yMin, mu));
        upperPts.push(`${sx(x).toFixed(1)},${sy(yU).toFixed(1)}`);
        lowerPts.unshift(`${sx(x).toFixed(1)},${sy(yL).toFixed(1)}`);
        meanPts.push(`${sx(x).toFixed(1)},${sy(yM).toFixed(1)}`);
      }
      out += `<polygon points="${upperPts.concat(lowerPts).join(' ')}" fill="#0f5c6e" opacity="0.13"/>`;

      // OLS Straight Line
      const olsY1 = sc.olsB0 + sc.olsB1 * sc.xMin;
      const olsY2 = sc.olsB0 + sc.olsB1 * sc.xMax;
      out += `<line x1="${sx(sc.xMin)}" y1="${sy(olsY1)}" x2="${sx(sc.xMax)}" y2="${sy(olsY2)}" stroke="#b33a2b" stroke-width="2" stroke-dasharray="6,4"/>`;

      // GLM Mean Curve
      out += `<polyline fill="none" stroke="#0f5c6e" stroke-width="2.8" points="${meanPts.join(' ')}"/>`;

      // Probe vertical line & markers
      const etaP = b0 + b1 * xProbe;
      const muP = sc.invLink(etaP);
      const varP = sc.variance(muP);
      const sdP = Math.sqrt(varP);
      const olsP = sc.olsB0 + sc.olsB1 * xProbe;

      out += `<line x1="${sx(xProbe)}" y1="${pad.t}" x2="${sx(xProbe)}" y2="${H - pad.b}" stroke="#0f5c6e" stroke-dasharray="2,3" stroke-width="1.4"/>`;
      out += `<circle cx="${sx(xProbe)}" cy="${sy(olsP)}" r="5" fill="#b33a2b"/>`;
      out += `<circle cx="${sx(xProbe)}" cy="${sy(Math.min(sc.yMax, muP))}" r="5.5" fill="#0f5c6e" stroke="#fff" stroke-width="1.5"/>`;

      // Data points
      sc.points.forEach((pt) => {
        out += `<circle cx="${sx(pt.x)}" cy="${sy(pt.y)}" r="5.5" fill="#1e2328" stroke="#fff" stroke-width="1.5"/>`;
      });

      // Legend
      out += `<g transform="translate(${W - pad.r - 235}, ${pad.t + 10})" font-family="sans-serif" font-size="11">
        <rect x="0" y="0" width="228" height="62" rx="6" fill="#ffffff" stroke="#dfd9cc" opacity="0.94"/>
        <line x1="10" y1="16" x2="32" y2="16" stroke="#0f5c6e" stroke-width="2.8"/>
        <text x="38" y="20" fill="#1e2328">GLM mean μ(x) ± 1 SD band</text>
        <line x1="10" y1="34" x2="32" y2="34" stroke="#b33a2b" stroke-width="2" stroke-dasharray="5,3"/>
        <text x="38" y="38" fill="#1e2328">OLS straight line (constant SD)</text>
        <circle cx="21" cy="50" r="4.5" fill="#1e2328"/>
        <text x="38" y="54" fill="#1e2328">Observed data points (xᵢ, yᵢ)</text>
      </g>`;

      svg.innerHTML = out;

      // Update 3-stage pipeline cards
      stage1.innerHTML = `
        <div class="stage-step">1. Systematic (Linear Predictor)</div>
        <div class="stage-main">\\(\\eta = ${etaP.toFixed(2)}\\)</div>
        <div class="stage-sub">\\(${b0.toFixed(2)} + (${b1.toFixed(2)})(${xProbe.toFixed(1)})\\) on \\((-\\infty, +\\infty)\\)</div>
      `;

      const invalidOls = sc.isOlsInvalid(olsP);
      stage2.innerHTML = `
        <div class="stage-step">2. Inverse Link → Mean \\(\\mu\\)</div>
        <div class="stage-main">\\(\\mu = ${muP.toFixed(3)}\\)</div>
        <div class="stage-sub">${sc.invFormula}.<br><span class="${invalidOls ? 'bad-val' : ''}">OLS line gives ${olsP.toFixed(2)}${invalidOls ? ' (invalid!)' : ''}</span></div>
      `;

      stage3.innerHTML = `
        <div class="stage-step">3. Random Component → Spread</div>
        <div class="stage-main">\\(\\operatorname{Var}(Y\\mid x) = ${varP.toFixed(3)}\\) (SD ${sdP.toFixed(2)})</div>
        <div class="stage-sub">${sc.varFormula}.<br>OLS assumes constant \\(\\operatorname{Var} = ${sc.olsVar.toFixed(2)}\\) everywhere.</div>
      `;

      if (window.TeachingMath) {
        window.TeachingMath.render(stage1);
        window.TeachingMath.render(stage2);
        window.TeachingMath.render(stage3);
      }
    };

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => applyScenarioDefaults(btn.dataset.scenario));
    });
    [b0Input, b1Input, probeInput].forEach((inp) => inp.addEventListener('input', draw));
    if (resetBtn) {
      resetBtn.addEventListener('click', () => applyScenarioDefaults(mode));
    }

    applyScenarioDefaults('binary');
  };

  const boot = () => {
    document.querySelectorAll('[data-glm-playground]').forEach(initPlayground);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
