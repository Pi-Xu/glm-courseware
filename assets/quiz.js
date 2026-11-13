(() => {
  const initQuizzes = () => {
    document.querySelectorAll('[data-quiz]').forEach((quizRoot) => {
      const items = quizRoot.querySelectorAll('.quiz-item');
      const scoreEl = quizRoot.querySelector('[data-quiz-score]');
      const state = new Map();

      const updateScore = () => {
        if (!scoreEl) return;
        let correctCount = 0;
        state.forEach((v) => { if (v) correctCount += 1; });
        scoreEl.textContent = `${correctCount} / ${items.length} answered correctly`;
      };

      items.forEach((item, idx) => {
        const correctIdx = Number(item.dataset.correct);
        const explainOk = item.dataset.explainOk || 'Correct.';
        const explainWarn = item.dataset.explainWarn || 'Look closely at what is being transformed or constrained.';
        const feedback = item.querySelector('.quiz-feedback');
        const buttons = item.querySelectorAll('.quiz-opt');

        buttons.forEach((btn, bIdx) => {
          btn.addEventListener('click', () => {
            buttons.forEach((b) => b.classList.remove('is-correct', 'is-wrong'));
            const isRight = bIdx === correctIdx;
            btn.classList.add(isRight ? 'is-correct' : 'is-wrong');
            state.set(idx, isRight);
            if (feedback) {
              feedback.className = `quiz-feedback visible ${isRight ? 'ok' : 'warn'}`;
              feedback.innerHTML = isRight ? explainOk : (btn.dataset.why || explainWarn);
              if (window.TeachingMath) window.TeachingMath.render(feedback);
            }
            updateScore();
          });
        });
      });

      const resetBtn = quizRoot.querySelector('[data-quiz-reset]');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.clear();
          items.forEach((item) => {
            item.querySelectorAll('.quiz-opt').forEach((b) => b.classList.remove('is-correct', 'is-wrong'));
            const fb = item.querySelector('.quiz-feedback');
            if (fb) fb.className = 'quiz-feedback';
          });
          updateScore();
        });
      }
      updateScore();
    });

    document.querySelectorAll('[data-numeric-check]').forEach((box) => {
      const target = Number(box.dataset.answer);
      const tol = Number(box.dataset.tolerance || '0.02');
      const input = box.querySelector('input');
      const btn = box.querySelector('button');
      const status = box.querySelector('.numeric-status');
      const okMsg = box.dataset.ok || 'Spot on!';
      const hintMsg = box.dataset.hint || 'Check the formula and try again.';

      const verify = () => {
        const val = parseFloat(input.value);
        if (Number.isNaN(val)) {
          status.style.color = 'var(--warn)';
          status.textContent = 'Enter a number first.';
          return;
        }
        if (Math.abs(val - target) <= tol) {
          status.style.color = 'var(--ok)';
          status.innerHTML = `✓ ${okMsg}`;
        } else {
          status.style.color = 'var(--warn)';
          status.innerHTML = `✗ Not quite (${val}). ${hintMsg}`;
        }
        if (window.TeachingMath) window.TeachingMath.render(status);
      };

      if (btn) btn.addEventListener('click', verify);
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') verify();
        });
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuizzes, { once: true });
  } else {
    initQuizzes();
  }
})();
