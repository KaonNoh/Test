const tbody = document.getElementById('data-rows');
const message = document.getElementById('message');
const initialPairs = [[82, 78], [91, 85], [69, 74]];
let nextRowId = 0;
let chart = null;

const fmt = n => Number.isFinite(n) ? n.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : '—';
const setText = (id, value) => { document.getElementById(id).textContent = value; };

function clearResults() {
  ['mean-first', 'mean-second', 'sd-first', 'sd-second', 'correlation', 'target-result', 'predicted-result', 'slope-result', 'distance-result', 'comparison-predicted', 'comparison-actual', 'comparison-error'].forEach(id => setText(id, '—'));
  setText('interpretation', '데이터를 분석하면 결과가 표시됩니다.');
  setText('result-context', document.getElementById('category').value + ' · 분석 전');
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

function changed() {
  clearResults();
  message.textContent = '';
}

function updateRowLabels() {
  [...tbody.querySelectorAll('.data-row')].forEach((row, index) => {
    const n = index + 1;
    row.querySelector('.row-index').textContent = String(n).padStart(2, '0');
    row.querySelector('.first-label').textContent = '대상자 ' + n + ' 첫 번째 측정값';
    row.querySelector('.second-label').textContent = '대상자 ' + n + ' 두 번째 측정값';
    row.querySelector('.row-first').setAttribute('aria-label', '대상자 ' + n + ' 첫 번째 측정값');
    row.querySelector('.row-second').setAttribute('aria-label', '대상자 ' + n + ' 두 번째 측정값');
    row.querySelector('.row-delete').setAttribute('aria-label', '대상자 ' + n + ' 행 삭제');
  });
  setText('row-count', tbody.children.length + '명');
}

function addRow(first = '', second = '') {
  const fragment = document.getElementById('row-template').content.cloneNode(true);
  const row = fragment.querySelector('tr');
  row.dataset.rowId = String(++nextRowId);
  row.querySelector('.row-first').value = first;
  row.querySelector('.row-second').value = second;
  tbody.appendChild(fragment);
  updateRowLabels();
  changed();
  return row;
}

// 초기 데이터 행 생성
initialPairs.forEach(pair => addRow(...pair));

document.getElementById('add-row').addEventListener('click', () => {
  const row = addRow();
  row.querySelector('.row-first').focus();
});

tbody.addEventListener('click', event => {
  const button = event.target.closest('.row-delete');
  if (!button) return;
  button.closest('tr').remove();
  updateRowLabels();
  changed();
});

tbody.addEventListener('input', changed);
document.getElementById('target-first').addEventListener('input', changed);
document.getElementById('target-actual').addEventListener('input', changed);

document.getElementById('category').addEventListener('change', () => {
  changed();
  const headingIds = {
    '교육': 'summary-heading-education',
    '의료': 'summary-heading-medical',
    '화학': 'summary-heading-chemistry',
    '사회현상': 'summary-heading-social'
  };
  Object.values(headingIds).forEach(id => document.querySelector(`[data-template-id="${id}"]`).classList.add('hidden'));
  document.querySelector(`[data-template-id="${headingIds[document.getElementById('category').value]}"]`).classList.remove('hidden');
});

document.getElementById('analyze').addEventListener('click', () => {
  changed();
  const rows = [...tbody.querySelectorAll('.data-row')];
  if (rows.length < 2) {
    message.textContent = '측정값을 두 쌍 이상 입력해 주세요.';
    return;
  }
  const pairs = [];
  for (const row of rows) {
    const a = row.querySelector('.row-first').value.trim();
    const b = row.querySelector('.row-second').value.trim();
    if (a === '' || b === '' || !Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) {
      message.textContent = '모든 행에 두 시점의 유효한 숫자를 입력해 주세요.';
      return;
    }
    pairs.push({ x: Number(a), y: Number(b) });
  }

  const targetInput = document.getElementById('target-first').value.trim();
  const actualInput = document.getElementById('target-actual').value.trim();
  if (targetInput === '' || !Number.isFinite(Number(targetInput)) || (actualInput !== '' && !Number.isFinite(Number(actualInput)))) {
    message.textContent = '분석 대상자의 측정값을 확인해 주세요.';
    return;
  }

  const n = pairs.length;
  const mx = pairs.reduce((sum, p) => sum + p.x, 0) / n;
  const my = pairs.reduce((sum, p) => sum + p.y, 0) / n;
  const vx = pairs.reduce((sum, p) => sum + (p.x - mx) ** 2, 0) / n;
  const vy = pairs.reduce((sum, p) => sum + (p.y - my) ** 2, 0) / n;
  const cov = pairs.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0) / n;

  if (vx < 1e-16) {
    message.textContent = '첫 번째 측정값이 모두 같아 회귀 직선을 계산할 수 없습니다.';
    return;
  }

  const sx = Math.sqrt(vx);
  const sy = Math.sqrt(vy);
  const slope = cov / vx;
  const correlation = sy < 1e-8 ? null : Math.max(-1, Math.min(1, cov / (sx * sy)));
  const target = Number(targetInput);
  const predicted = my + slope * (target - mx);
  const hasActual = actualInput !== '';
  const actual = hasActual ? Number(actualInput) : null;
  const before = Math.abs(target - mx);
  const after = Math.abs(predicted - my);
  const distanceChange = before - after;

  setText('mean-first', fmt(mx));
  setText('mean-second', fmt(my));
  setText('sd-first', fmt(sx));
  setText('sd-second', fmt(sy));
  setText('correlation', correlation === null ? '정의되지 않음' : correlation.toFixed(3));
  setText('target-result', fmt(target));
  setText('predicted-result', fmt(predicted));
  setText('slope-result', fmt(slope));
  setText('distance-result', (distanceChange >= 0 ? '−' : '+') + fmt(Math.abs(distanceChange)));
  setText('interpretation', distanceChange > 1e-8
    ? '예측값은 두 번째 시점의 집단 평균에 더 가까워집니다. 평균 회귀가 나타납니다.'
    : distanceChange < -1e-8
    ? '예측값은 두 번째 시점의 집단 평균에서 더 멀어집니다. 평균 회귀가 나타나지 않습니다.'
    : '집단 평균과의 거리가 거의 변하지 않습니다.');
  setText('comparison-predicted', fmt(predicted));
  setText('comparison-actual', hasActual ? fmt(actual) : '미입력');
  setText('comparison-error', hasActual ? (actual - predicted >= 0 ? '+' : '−') + fmt(Math.abs(actual - predicted)) : '—');
  setText('result-context', document.getElementById('category').value + ' · ' + n + '명 분석 완료');
  message.style.color = '#2166d1';
  message.textContent = '분석이 완료되었습니다.';

  const xs = pairs.map(p => p.x).concat(target);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const padding = Math.max((maxX - minX) * 0.12, 1);
  const start = minX - padding;
  const end = maxX + padding;
  const line = x => my + slope * (x - mx);

  const datasets = [
    { label: '집단 측정값', type: 'scatter', data: pairs, pointRadius: 5, pointHoverRadius: 7, backgroundColor: '#2166d1', borderColor: '#2166d1' },
    { label: '회귀 직선', type: 'line', data: [{ x: start, y: line(start) }, { x: end, y: line(end) }], borderColor: '#112946', borderWidth: 2.5, pointRadius: 0, fill: false },
    { label: '첫 번째 시점 평균', type: 'line', data: [{ x: mx, y: Math.min(...pairs.map(p => p.y), predicted, hasActual ? actual : predicted) - 10 }, { x: mx, y: Math.max(...pairs.map(p => p.y), predicted, hasActual ? actual : predicted) + 10 }], borderColor: '#6a9fe5', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 },
    { label: '두 번째 시점 평균', type: 'line', data: [{ x: start, y: my }, { x: end, y: my }], borderColor: '#e59b52', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 },
    { label: '대상자 예측값 ◆', type: 'scatter', data: [{ x: target, y: predicted }], pointStyle: 'rectRot', pointRadius: 9, backgroundColor: '#e07936', borderColor: '#fff', borderWidth: 1.5 }
  ];

  if (hasActual) {
    datasets.push({ label: '대상자 실제값 ▲', type: 'scatter', data: [{ x: target, y: actual }], pointStyle: 'triangle', pointRadius: 10, backgroundColor: '#208a78', borderColor: '#fff', borderWidth: 1.5 });
  }

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('analysis-chart'), {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, padding: 16, font: { family: 'DM Sans', size: 11 } } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': (' + fmt(ctx.parsed.x) + ', ' + fmt(ctx.parsed.y) + ')' } }
      },
      scales: {
        x: { type: 'linear', min: start, max: end, title: { display: true, text: '첫 번째 측정값 (X)', color: '#52657c' }, grid: { color: '#edf1f6' }, ticks: { color: '#60738a' } },
        y: { type: 'linear', title: { display: true, text: '두 번째 측정값 (Y)', color: '#52657c' }, grid: { color: '#edf1f6' }, ticks: { color: '#60738a' } }
      }
    }
  });
});
