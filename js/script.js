// --- FASE 2: UTILIDADES DE UI ---

function showAppToast(message, type = 'info') {
    const toastContainer = $('appToastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `app-toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'error' ? '⚠️' : '✅'}</span>
        <span class="toast-msg">${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'appToastContainer';
    div.className = 'app-toast-container';
    document.body.appendChild(div);
    return div;
}

const storageKey = 'casa-economia';
const months = {
  '2026-09': 'Septiembre 2026',
  '2026-10': 'Octubre 2026',
  '2026-11': 'Noviembre 2026',
  '2026-12': 'Diciembre 2026'
};

let selectedMonth = '2026-09';
let currency = 'COP';
const usdRate = 3150;
const minimumWage = 1750905;
const fixedRates = { socialSecurity: 0.125 + 0.16 + 0.00522, laborReserve: 0.0833 + 0.01 + 0.0833 + 0.0417 };
const cards = [
  { key: 'nu', name: 'Nu', payment: '💳 Tarjeta debito Nu', gradient: 'linear-gradient(145deg, #c5a9ff 0%, #7438c8 52%, #26104f 100%)' },
  { key: 'falabella', name: 'Falabella', payment: '💳 Tarjeta debito Falabella', gradient: 'linear-gradient(145deg, #75b68d 0%, #0d4c32 52%, #032319 100%)' },
  { key: 'nequi', name: 'Visa Nequi', payment: '📱 Tarjeta debito Nequi', gradient: 'linear-gradient(145deg, #ff4e9a 0%, #e31270 42%, #245be0 100%)' },
  { key: 'bancolombia', name: 'Bancolombia', payment: '🏦 Bancolombia', gradient: 'linear-gradient(145deg, #fff28a 0%, #ffbd24 50%, #e56b00 100%)' },
  { key: 'arq', name: 'ARQ', payment: '💵 Tarjeta ARQ (USD)', gradient: 'linear-gradient(145deg, #eafbe2 0%, #39ff6a 42%, #ccd3ce 100%)', currency: 'USD' }
];
let selectedCardKey = cards[0].key;
let cardOrder = cards.map(card => card.key);
let suppressCardClick = false;

const $ = id => document.getElementById(id);
const total = items => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
const parseMoney = value => Number(String(value).replace(/[^0-9]/g, '')) || 0;
const dayFor = item => Number(item.day) || new Date().getDate();
const money = value => currency === 'COP'
  ? '$' + Math.round(Number(value) || 0).toLocaleString('es-CO')
  : 'US$ ' + Math.round((Number(value) || 0) / usdRate).toLocaleString('en-US');
// Some wallet cards (e.g. ARQ) hold their balance directly in USD, so their
// figures should never run through the COP<->USD toggle conversion.
const moneyForCard = (value, cardCurrency) => cardCurrency === 'USD'
  ? 'US$ ' + Math.round(Number(value) || 0).toLocaleString('en-US')
  : money(value);

function readData() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch (error) {
    return {};
  }
}

function getMonthData() {
  const data = readData();
  data[selectedMonth] ??= { incomes: [], expenses: [], savings: [], savingsGoal: 0, fixedPaid: {}, tithePaid: false };
  data[selectedMonth].incomes ??= [];
  data[selectedMonth].expenses ??= [];
  data[selectedMonth].savings ??= [];
  data[selectedMonth].fixedPaid ??= {};
  data[selectedMonth].fixedPaid.socialSecurity ??= false;
  data[selectedMonth].fixedPaid.laborReserve ??= false;
  data[selectedMonth].savingsGoal ??= 0;
  data.cardBalances ??= {};
  data.savingsGoal ??= Object.values(data).find(month => month && typeof month === 'object' && Number(month.savingsGoal) > 0)?.savingsGoal || 0;
  return data;
}

function saveData(data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = value;
  return node.innerHTML;
}

function formatMoneyInput(input) {
  const amount = parseMoney(input.value);
  input.value = amount ? `$ ${amount.toLocaleString('es-CO')}` : '';
}

function compactMoney(value) {
  const amount = Math.round(Number(value) || 0);
  if (amount >= 1000000) {
    const millions = (amount / 1000000).toFixed(1).replace('.0', '');
    return `$${millions}M`;
  }
  if (amount >= 1000) {
    const thousands = (amount / 1000).toFixed(1).replace('.0', '');
    return `$${thousands}k`;
  }
  return `$${amount}`;
}

function getFixedExpenses() {
  return {
    socialSecurity: minimumWage * fixedRates.socialSecurity,
    laborReserve: minimumWage * fixedRates.laborReserve
  };
}

function getPaidFixedTotal(fixed, fixedPaid) {
  return (fixedPaid.socialSecurity ? fixed.socialSecurity : 0)
    + (fixedPaid.laborReserve ? fixed.laborReserve : 0);
}

function updatePeriodLabels() {
  document.querySelectorAll('.period-copy').forEach(element => {
    element.textContent = months[selectedMonth];
  });
  $('periodLabel').textContent = months[selectedMonth];
  $('flowTitle').textContent = `Resumen de ${months[selectedMonth].split(' ')[0]}`;
}

function getGeneralBalance(allData) {
  const monthKeys = Object.keys(months);
  const selectedIndex = monthKeys.indexOf(selectedMonth);
  let balance = 0;

  monthKeys.slice(0, selectedIndex + 1).forEach(key => {
    const month = allData[key] || {};
    const fixed = getFixedExpenses();
    const fixedPaid = month.fixedPaid || {};
    const income = total(month.incomes || []);
    const expenses = getPaidFixedTotal(fixed, fixedPaid) + total(month.expenses || []);
    const availableBeforeTithe = Math.max(balance + income - expenses, 0);
    const tithe = income ? Math.max(income - expenses, 0) * 0.1 : 0;
    const savings = total(month.savings || []);
    balance = Math.max(availableBeforeTithe - tithe - savings, 0);
  });

  return balance;
}

function render() {
  const allData = getMonthData();
  const data = allData[selectedMonth];
  const generalBalance = getGeneralBalance(allData);
  const income = total(data.incomes);
  const manualExpenses = total(data.expenses);
  const fixed = getFixedExpenses();
  const fixedTotal = getPaidFixedTotal(fixed, data.fixedPaid);
  const expenses = fixedTotal + manualExpenses;
  const availableBeforeTithe = Math.max(income - expenses, 0);
  const tithe = availableBeforeTithe * 0.1;
  const voluntarySavings = total(data.savings);
  const available = generalBalance;
  const used = income ? Math.min((expenses + tithe + voluntarySavings) / income * 100, 100) : 0;

  updatePeriodLabels();
  renderCards(allData);
  $('totalIncome').textContent = money(income);
  $('totalExpenses').textContent = money(expenses);
  $('totalTithe').textContent = money(tithe);
  $('totalAvailable').textContent = money(available);
  $('generalBalance').textContent = money(generalBalance);
  $('incomeCardValue').textContent = money(income);
  renderGoal(allData);
  $('flowTotal').textContent = money(available);
  $('flowSavings').textContent = money(voluntarySavings);
  $('expenseViewTotal').textContent = money(expenses);
  $('expenseCount').textContent = data.expenses.length + 2;
  $('socialSecurityValue').textContent = money(fixed.socialSecurity);
  $('laborReserveValue').textContent = money(fixed.laborReserve);
  $('titheValue').textContent = money(tithe);
  $('tithePaid').checked = Boolean(data.tithePaid);
  document.querySelectorAll('[data-fixed-key]').forEach(input => {
    input.checked = Boolean(data.fixedPaid[input.dataset.fixedKey]);
  });
  $('usageLabel').textContent = `${Math.round(used)}%`;
  $('usageBar').style.width = `${used}%`;
  $('titheNote').textContent = income
    ? 'El diezmo se calcula automáticamente sobre tus ingresos.'
    : 'Registra tus ingresos para calcular el diezmo.';

  renderIncomeList(data.incomes);
  renderExpenseList(data.expenses, fixed, data.fixedPaid);
  renderPie([available, expenses, tithe, voluntarySavings], ['#D6FB3D', '#FFFFFF', '#8C6BFF', '#F20F72'], ['Disponible', 'Gastos', 'Diezmo', 'Ahorro']);
  renderCategories(data.expenses, fixed, data.fixedPaid);
  renderWave(data.incomes, data.expenses);
  renderSavingsList(data.savings);
  renderSavingsSummary();
}   

function renderGoal(allData) {
  const monthKeys = Object.keys(months);
  const elapsed = monthKeys.indexOf(selectedMonth) + 1;
  const saved = monthKeys.slice(0, elapsed)
    .reduce((sum, key) => sum + total((allData[key] || {}).savings || []), 0);
  const goal = Number(allData.savingsGoal) || 0;
  const progress = goal ? Math.min(saved / goal * 100, 100) : 0;
  $('goalValue').textContent = `${compactMoney(saved)}/${compactMoney(goal)}`;
  $('goalProgress').style.width = `${progress}%`;
  $('goalCaption').textContent = goal
    ? `${Math.round(progress)}% de la meta alcanzada`
    : 'Define una meta de ahorro';
}

function cardExpenses(allData, card) {
  return Object.keys(months).reduce((sum, key) => {
    return sum + total((allData[key]?.expenses || []).filter(item => item.type === card.payment));
  }, 0);
}

function renderCards(allData) {
  const stack = $('cardsStack');
  stack.innerHTML = cards.map(card => {
    const initial = Number(allData.cardBalances[card.key]) || 0;
    const spent = cardExpenses(allData, card);
    const balance = Math.max(initial - spent, 0);
    const currencyTag = card.currency ? `<span class="wallet-currency-tag">${card.currency}</span>` : '';
    return `<button class="wallet-card wallet-${card.key}" type="button" data-card-key="${card.key}" style="--card-gradient:${card.gradient}">
      <span class="wallet-top"><span class="wallet-name">${card.name}${currencyTag}</span><span class="wallet-edit">＋</span></span>
      <span class="wallet-bottom"><span class="wallet-balance">${moneyForCard(balance, card.currency)}</span><span class="wallet-spent">Gastado ${moneyForCard(spent, card.currency)}</span></span>
    </button>`;
  }).join('');
  layoutCards();
}

// Positions every card in the stack based on cardOrder: 0 = fully visible in
// front, 1..n cascade back and up behind it (like a catalog/album of cards).
function layoutCards() {
  const stack = $('cardsStack');
  if (!stack) return;
  cardOrder.forEach((key, pos) => {
    const el = stack.querySelector(`[data-card-key="${key}"]`);
    if (!el) return;
    el.style.setProperty('--pos', pos);
    el.dataset.position = String(pos);
    el.style.zIndex = String(cardOrder.length - pos);
  });
}

function bringCardToFront(key) {
  if (cardOrder[0] === key) return;
  cardOrder = [key, ...cardOrder.filter(item => item !== key)];
  layoutCards();
}

function cycleCardsForward() {
  cardOrder.push(cardOrder.shift());
  layoutCards();
}

function cycleCardsBackward() {
  cardOrder.unshift(cardOrder.pop());
  layoutCards();
}

function renderIncomeList(incomes) {
  $('incomeList').innerHTML = incomes.length
    ? incomes.map((item, index) => `
      <div class="entry">
        <span>💵 ${escapeHtml(item.name)}<small>Día ${dayFor(item)}</small></span>
        <strong>${money(item.amount)}</strong>
        <button class="remove" data-kind="income" data-index="${index}" aria-label="Eliminar ingreso">×</button>
      </div>`).join('')
    : '<div class="empty">Aún no hay ingresos registrados.</div>';
}

function renderExpenseList(expenses, fixed, fixedPaid) {
  const fixedRows = `
    <div class="expense-row fixed-row-list"><span>🩺 Seguridad social<small>Gasto fijo · basado en 1 SMMLV</small></span><strong>${money(fixed.socialSecurity)}</strong><label class="fixed-check"><input type="checkbox" data-fixed-key="socialSecurity" ${fixedPaid.socialSecurity ? 'checked' : ''}><span>${fixedPaid.socialSecurity ? 'Pagado' : 'Pendiente'}</span></label></div>
    <div class="expense-row fixed-row-list"><span>🧳 Reserva laboral<small>Cesantías, intereses, prima y vacaciones</small></span><strong>${money(fixed.laborReserve)}</strong><label class="fixed-check"><input type="checkbox" data-fixed-key="laborReserve" ${fixedPaid.laborReserve ? 'checked' : ''}><span>${fixedPaid.laborReserve ? 'Pagado' : 'Pendiente'}</span></label></div>`;
  $('expenseList').innerHTML = fixedRows + (expenses.length
    ? expenses.slice().reverse().map((item, index) => `
      <div class="expense-row">
        <span>${item.type} ${escapeHtml(item.name)}<small>${item.category} · día ${dayFor(item)}</small></span>
        <strong>${money(item.amount)}</strong>
        <button class="remove" data-kind="expense" data-index="${expenses.length - 1 - index}" aria-label="Eliminar gasto">×</button>
      </div>`).join('')
    : '<div class="empty">Aún no hay gastos manuales registrados este mes.</div>');
}

function piePoint(angle, radius) {
  const radians = (angle - 90) * Math.PI / 180;
  return {
    x: 95 + radius * Math.cos(radians),
    y: 95 + radius * Math.sin(radians)
  };
}

function piePath(start, end) {
  const first = piePoint(start, 88);
  const last = piePoint(end, 88);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M 95 95 L ${first.x} ${first.y} A 88 88 0 ${largeArc} 1 ${last.x} ${last.y} Z`;
}

function renderPie(values, colors, labels) {
  const totalValue = values.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = 0;
  $('pieSegments').innerHTML = values.map((value, index) => {
    const end = cursor + value / totalValue * 360;
    const percent = Math.round(value / totalValue * 100);
    const segment = `<path class="pie-segment" fill="${colors[index]}" data-label="${labels[index]}" data-value="${value}" data-percent="${percent}" data-color="${colors[index]}" d="${piePath(cursor, end)}"></path>`;
    cursor = end;
    return segment;
  }).join('');
  attachPieTooltips();
}

function attachPieTooltips() {
  const area = document.querySelector('.pie-area');
  const tooltip = $('pieTooltip');
  document.querySelectorAll('.pie-segment').forEach(segment => {
    segment.addEventListener('mouseenter', () => {
      tooltip.innerHTML = `<strong>${segment.dataset.label}</strong>${money(segment.dataset.value)} · ${segment.dataset.percent}%`;
      tooltip.style.backgroundColor = segment.dataset.color;
      tooltip.style.color = segment.dataset.color === '#FFFFFF' || segment.dataset.color === '#D6FB3D' ? '#161616' : '#FFFFFF';
      tooltip.querySelector('strong').style.color = tooltip.style.color;
      area.classList.add('has-hover');
    });
    segment.addEventListener('mouseleave', () => {
      area.classList.remove('has-hover');
    });
  });
}

function renderCategories(expenses, fixed, fixedPaid) {
  const categories = {};
  if (fixedPaid.socialSecurity) categories['🩺 Seguridad social'] = fixed.socialSecurity;
  if (fixedPaid.laborReserve) categories['🧳 Reserva laboral'] = fixed.laborReserve;
  expenses.forEach(item => {
    categories[item.category] = (categories[item.category] || 0) + Number(item.amount);
  });
  const rows = Object.entries(categories).sort((first, second) => second[1] - first[1]);
  const highest = rows[0]?.[1] || 1;
  $('categoryList').innerHTML = rows.length
    ? rows.map(([category, value]) => `
      <div class="category-row">
        <div><span>${category}</span><strong>${money(value)}</strong></div>
        <div class="category-track"><i style="width:${value / highest * 100}%"></i></div>
      </div>`).join('')
    : '<div class="empty">Las categorías aparecerán al guardar gastos.</div>';
}

function renderSavingsList(savings) {
  $('savingsList').innerHTML = savings.length
    ? savings.slice().reverse().map((item, index) => `
      <div class="expense-row">
        <span>🐷 ${escapeHtml(item.name)}<small>día ${dayFor(item)}</small></span>
        <strong>${money(item.amount)}</strong>
        <button class="remove" data-kind="saving" data-index="${savings.length - 1 - index}" aria-label="Eliminar ahorro">×</button>
      </div>`).join('')
    : '<div class="empty">Aún no has separado ahorro voluntario este mes.</div>';
}

function renderSavingsSummary() {
  const data = readData();
  const fixed = getFixedExpenses();
  const monthKeys = Object.keys(months);
  const rows = monthKeys.map(key => ({
    label: months[key],
    value: fixed.laborReserve + total((data[key] || {}).savings || [])
  }));
  const highest = Math.max(...rows.map(row => row.value), 1);
  $('savingsSummary').innerHTML = rows.map(row => `
    <div class="category-row">
      <div><span>${row.label}</span><strong>${money(row.value)}</strong></div>
      <div class="category-track"><i style="width:${row.value / highest * 100}%"></i></div>
    </div>`).join('');

  const elapsed = monthKeys.indexOf(selectedMonth) + 1;
  const accumulatedReserve = fixed.laborReserve * elapsed;
  const accumulatedVoluntary = monthKeys
    .slice(0, elapsed)
    .reduce((sum, key) => sum + total((data[key] || {}).savings || []), 0);

  $('laborReserveAccumValue').textContent = money(accumulatedReserve);
  $('voluntarySavingsAccumValue').textContent = money(accumulatedVoluntary);
  $('savingsGrandTotal').textContent = money(accumulatedReserve + accumulatedVoluntary);
}

function renderWave(incomes, expenses) {
  const svg = $('waveChart');
  const width = 900;
  const height = 250;
  const padding = 34;
  const days = 31;
  const x = day => padding + (day - 1) * (width - padding * 2) / (days - 1);
  const countByDay = items => Array.from({ length: days }, (_, index) => (
    items.filter(item => dayFor(item) === index + 1).length
  ));
  const incomeCounts = countByDay(incomes);
  const expenseCounts = countByDay(expenses);
  const maximum = Math.max(1, ...incomeCounts, ...expenseCounts);
  const y = count => height - 35 - count * (height - 70) / maximum;
  const points = values => values.map((value, index) => `${x(index + 1)},${y(value)}`).join(' ');
  const incomeOn = $('showIncomeWave').checked;
  const expenseOn = $('showExpenseWave').checked;
  const labels = Array.from({ length: days }, (_, index) => `
    <text x="${x(index + 1)}" y="${height - 12}" text-anchor="middle">${index + 1}</text>`).join('');

  svg.innerHTML = `
    <line x1="${padding}" y1="${height - 35}" x2="${width - padding}" y2="${height - 35}" stroke="#3a3a3f"/>
    ${labels}
    ${incomeOn ? `<polyline class="wave-income" points="${points(incomeCounts)}"/>` : ''}
    ${expenseOn ? `<polyline class="wave-expense" points="${points(expenseCounts)}"/>` : ''}`;
}

function openView(view) {
  document.querySelectorAll('.view').forEach(item => {
    item.classList.toggle('active', item.id === `view-${view}`);
  });
  document.querySelectorAll('[data-view]').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  render();
}

document.querySelectorAll('.money-input').forEach(input => {
  input.addEventListener('input', () => formatMoneyInput(input));
});

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => openView(button.dataset.view));
});

document.querySelectorAll('.month-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    selectedMonth = tab.dataset.month;
    document.querySelectorAll('.month-tab').forEach(item => item.classList.toggle('active', item === tab));
    render();
  });
});

$('incomeForm').addEventListener('submit', event => {
  event.preventDefault();
  const amount = parseMoney($('incomeAmount').value);
  const name = $('incomeName').value.trim();
  if (!amount || !name) {
    alert('Escribe el valor y el origen del ingreso.');
    return;
  }
  const data = getMonthData();
  data[selectedMonth].incomes.push({ name, amount, day: new Date().getDate() });
  saveData(data);
  event.target.reset();
  $('incomeModal').close();
  render();
});

$('expenseForm').addEventListener('submit', event => {
  event.preventDefault();
  const amount = parseMoney($('expenseAmount').value);
  const name = $('expenseName').value.trim();
  if (!amount || !name) {
    alert('Escribe el valor y el nombre del gasto.');
    return;
  }
  const data = getMonthData();
  data[selectedMonth].expenses.push({
    name,
    amount,
    type: $('expenseType').value,
    category: $('expenseCategory').value,
    day: new Date().getDate()
  });
  saveData(data);
  event.target.reset();
  render();
});

$('savingsForm').addEventListener('submit', event => {
  event.preventDefault();
  const amount = parseMoney($('savingsAmount').value);
  const name = $('savingsName').value.trim();
  if (!amount || !name) {
    alert('Escribe el valor y el destino del ahorro.');
    return;
  }
  const data = getMonthData();
  data[selectedMonth].savings.push({ name, amount, day: new Date().getDate() });
  saveData(data);
  event.target.reset();
  render();
});

$('goalButton').addEventListener('click', () => {
  const data = getMonthData();
  const currentGoal = data.savingsGoal || '';
  $('savingsGoalInput').value = currentGoal ? `$ ${Math.round(currentGoal).toLocaleString('es-CO')}` : '';
  $('goalModal').showModal();
  $('savingsGoalInput').focus();
});

$('incomeAddButton').addEventListener('click', () => {
  $('incomeModal').showModal();
  $('incomeAmount').focus();
});

(() => {
  const stackEl = $('cardsStack');
  let drag = null;
  const threshold = 45;

  stackEl.addEventListener('pointerdown', event => {
    const card = event.target.closest('.wallet-card');
    if (!card || card.dataset.position !== '0') return;
    drag = { el: card, startY: event.clientY, pointerId: event.pointerId, moved: false };
    card.classList.add('is-dragging');
    card.setPointerCapture(event.pointerId);
  });

  stackEl.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaY) > 9) drag.moved = true;
    const clamped = Math.max(Math.min(deltaY, 90), -90);
    drag.el.style.transform = `translateY(${clamped}px) scale(1)`;
  });

  const endDrag = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    drag.el.classList.remove('is-dragging');
    drag.el.style.transform = '';
    if (drag.el.hasPointerCapture(event.pointerId)) drag.el.releasePointerCapture(event.pointerId);
    if (drag.moved && Math.abs(deltaY) > threshold) {
      if (deltaY < 0) cycleCardsForward(); else cycleCardsBackward();
    }
    suppressCardClick = drag.moved;
    drag = null;
  };

  stackEl.addEventListener('pointerup', endDrag);
  stackEl.addEventListener('pointercancel', endDrag);
})();

document.addEventListener('click', event => {
  const cardButton = event.target.closest('[data-card-key]');
  if (!cardButton) return;
  if (suppressCardClick) {
    suppressCardClick = false;
    return;
  }
  if (cardButton.dataset.position && cardButton.dataset.position !== '0') {
    bringCardToFront(cardButton.dataset.cardKey);
    return;
  }
  const card = cards.find(item => item.key === cardButton.dataset.cardKey);
  if (!card) return;
  selectedCardKey = card.key;
  const isUsdCard = card.currency === 'USD';
  $('cardModalKicker').textContent = isUsdCard ? `${card.name} · USD` : card.name;
  $('cardModalTitle').textContent = `Configurar ${card.name}`;
  $('cardModalCopy').textContent = isUsdCard
    ? 'Esta tarjeta maneja sus montos en dólares. Actualiza el saldo inicial o registra un gasto en USD.'
    : 'Actualiza el saldo inicial o registra un gasto en esta tarjeta.';
  $('cardBalanceInput').placeholder = isUsdCard ? 'US$ 0' : '$ 0';
  $('cardExpenseAmount').placeholder = isUsdCard ? 'US$ 0' : '$ 0';
  const data = getMonthData();
  const currentBalance = data.cardBalances[card.key] || '';
  $('cardBalanceInput').value = currentBalance
    ? (isUsdCard ? `US$ ${Math.round(currentBalance).toLocaleString('en-US')}` : `$ ${Math.round(currentBalance).toLocaleString('es-CO')}`)
    : '';
  $('cardExpenseAmount').value = '';
  $('cardExpenseName').value = '';
  $('cardModal').showModal();
  $('cardBalanceInput').focus();
});

$('goalForm').addEventListener('submit', event => {
  event.preventDefault();
  const goal = parseMoney($('savingsGoalInput').value);
  if (!goal) return;
  const data = getMonthData();
  data.savingsGoal = goal;
  saveData(data);
  event.target.reset();
  $('goalModal').close();
  render();
});

$('cardForm').addEventListener('submit', event => {
  event.preventDefault();
  const data = getMonthData();
  const card = cards.find(item => item.key === selectedCardKey);
  const balance = parseMoney($('cardBalanceInput').value);
  const expenseAmount = parseMoney($('cardExpenseAmount').value);
  const expenseName = $('cardExpenseName').value.trim();
  if (!balance) {
    alert('Escribe el saldo inicial de la tarjeta.');
    return;
  }
  if (expenseAmount && !expenseName) {
    alert('Escribe qué pagaste con esta tarjeta.');
    return;
  }
  data.cardBalances[selectedCardKey] = balance;
  if (expenseAmount && expenseName) {
    data[selectedMonth].expenses.push({
      name: expenseName,
      amount: expenseAmount,
      type: card.payment,
      category: $('cardExpenseCategory').value,
      day: new Date().getDate()
    });
  }
  saveData(data);
  event.target.reset();
  $('cardModal').close();
  render();
});

document.querySelectorAll('[data-close-modal]').forEach(button => {
  button.addEventListener('click', () => $(button.dataset.closeModal).close());
});

document.addEventListener('click', event => {
  const button = event.target.closest('.remove');
  if (!button) return;
  const data = getMonthData();
  data[selectedMonth][`${button.dataset.kind}s`].splice(Number(button.dataset.index), 1);
  saveData(data);
  render();
});

document.addEventListener('change', event => {
  const input = event.target.closest('[data-fixed-key]');
  if (!input) return;
  const data = getMonthData();
  data[selectedMonth].fixedPaid[input.dataset.fixedKey] = input.checked;
  saveData(data);
  render();
});

$('tithePaid').addEventListener('change', event => {
  const data = getMonthData();
  data[selectedMonth].tithePaid = event.target.checked;
  saveData(data);
});

$('showIncomeWave').addEventListener('change', render);
$('showExpenseWave').addEventListener('change', render);
$('currencyButton').addEventListener('click', () => {
  currency = currency === 'COP' ? 'USD' : 'COP';
  $('currencyLabel').textContent = currency === 'COP' ? 'COP $' : 'USD $';
  render();
});
$('printButton').addEventListener('click', () => window.print());
$('clearButton').addEventListener('click', () => {
  if (!confirm('¿Borrar todos los datos de este mes?')) return;
  const data = readData();
  delete data[selectedMonth];
  saveData(data);
  render();
});
$('downloadButton').addEventListener('click', () => {
  const data = getMonthData()[selectedMonth];
  const income = total(data.incomes);
  const fixed = getFixedExpenses();
  const fixedTotal = getPaidFixedTotal(fixed, data.fixedPaid);
  const expenses = fixedTotal + total(data.expenses);
  const tithe = Math.max(income - expenses, 0) * 0.1;
  const available = Math.max(income - expenses - tithe, 0);
  const report = `MIECO · ${months[selectedMonth]}\n\nIngresos: ${money(income)}\nSeguridad social: ${money(fixed.socialSecurity)}\nReserva laboral: ${money(fixed.laborReserve)}\nGastos: ${money(expenses)}\nDiezmo: ${money(tithe)}\nDisponible: ${money(available)}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
  link.download = `reporte-mieco-${selectedMonth}.txt`;
  link.click();
});

render();

if($('resendVerifyEmail')) {
    $('resendVerifyEmail').onclick = async () => {
        const { error } = await supabaseClient.auth.resend({
            type: 'signup',
            email: currentUserData.email
        });
        if (error) showAppToast(error.message, 'error');
        else showAppToast('Correo de verificación enviado.', 'success');
    };
}

