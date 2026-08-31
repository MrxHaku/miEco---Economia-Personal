// ============================================================
// miEco · Renderizado: todo lo que pinta datos en pantalla
// (dashboard, tarjetas, gráficas, listas, calendario).
// ============================================================

function updateGreeting(allData) {
  const el = $('userNameGreeting');
  if (!el) return;
  const userName = allData?.userSettings?.displayName
    || currentUserData?.user_metadata?.full_name
    || currentUserData?.email?.split('@')[0]
    || 'usuario';
  el.textContent = `@${userName}`;
}

function updateProfile(allData) {
  const displayName = allData?.userSettings?.displayName
    || currentUserData?.user_metadata?.full_name
    || currentUserData?.email?.split('@')[0]
    || 'usuario';
  if ($('profileDisplayName')) $('profileDisplayName').textContent = displayName;
  if ($('profileEmail')) $('profileEmail').textContent = currentUserData?.email || '—';
  if ($('profileCreatedAt')) {
    const created = currentUserData?.created_at;
    $('profileCreatedAt').textContent = created
      ? new Date(created).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';
  }
}

function applyPlanRestrictions() {
    // 1. Control de Multidivisa (Switch COP/USD)
    const currencyBtn = $('currencyButton');
    if (!isUserPro) {
        /*currencyBtn.style.opacity = "0.5";*/
        currencyBtn.title = "Multidivisa es una función Pro";
    } else {
        currencyBtn.style.opacity = "1";
    }

    // 2. Control visual de la Proyección de Flujo
    const projectionSection = $('projectionSection');
    if (projectionSection) {
        if (!isUserPro) {
            $('projectionListContainer').classList.add('pro-locked-blur');
            if (!projectionSection.querySelector('.pro-lock-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'pro-lock-overlay';
                overlay.innerHTML = '<span>Desbloquear Proyecciones ✨</span>';
                overlay.onclick = () => $('paywallModal').showModal();
                projectionSection.appendChild(overlay);
            }
        } else {
            $('projectionListContainer').classList.remove('pro-locked-blur');
            const overlay = projectionSection.querySelector('.pro-lock-overlay');
            if (overlay) overlay.remove();
        }
    }
}


function renderNetWorth(allData) {
    const balance = getGeneralBalance(allData);
    const savings = total(getMonthData()[selectedMonth].savings);
    const debts = getAccumulatedDebts(allData);
    
    const netWorth = (balance + savings) - debts;
    
    const el = $('netWorthValue'); // Añadir en el HTML
    if (el) {
        el.textContent = money(netWorth);
        el.style.color = netWorth >= 0 ? 'var(--lime)' : 'var(--fuchsia)';
    }
}

function renderBudgets(allData, expenses, fixed, fixedPaid) {
  const list = $('budgetList');
  if (!list) return;
  const budgets = allData.userSettings?.budgets || {};
  const spentByCategory = {};
  if (fixedPaid.socialSecurity) spentByCategory['🩺 Seguridad social'] = fixed.socialSecurity;
  if (fixedPaid.laborReserve) spentByCategory['🧳 Reserva laboral'] = fixed.laborReserve;
  expenses.forEach(item => {
    spentByCategory[item.category] = (spentByCategory[item.category] || 0) + Number(item.amount);
  });

  const entries = Object.entries(budgets);
  list.innerHTML = entries.length ? entries.map(([category, limit]) => {
    const spent = spentByCategory[category] || 0;
    const pct = limit ? Math.min(spent / limit * 100, 100) : 0;
    const cls = pct >= 100 ? 'budget-danger' : pct > 80 ? 'budget-warn' : 'budget-ok';
    return `<div class="category-row">
      <div><span>${category}</span><strong>${money(spent)} / ${money(limit)}</strong></div>
      <div class="category-track"><i class="${cls}" style="width:${pct}%"></i></div>
      <div class="budget-row-meta"><span>${Math.round(pct)}% usado</span><button type="button" class="remove-budget" data-remove-budget="${category}">Eliminar</button></div>
    </div>`;
  }).join('') : '<div class="empty">Aún no has definido presupuestos por categoría.</div>';
}

function renderRecurring(allData) {
  const list = $('recurringList');
  if (!list) return;
  const recurring = allData.recurring || [];
  list.innerHTML = recurring.length ? recurring.map(item => `
    <div class="expense-row">
      <span>🔁 ${escapeHtml(item.name)}<small>${item.category}</small></span>
      <strong>${money(item.amount)}</strong>
      <button class="remove" type="button" data-remove-recurring="${item.id}">×</button>
    </div>`).join('') : '<div class="empty">No tienes gastos recurrentes configurados.</div>';
}

// Muestra la proyección de flujo de caja calculada en getCashFlowProjection.
function renderProjection(allData) {
  const list = $('projectionList');
  if (!list) return;
  const months = getCashFlowProjection(allData, 3);
  if (months.every(m => m.committed <= 0)) {
    list.innerHTML = '<div class="empty">Sin gastos fijos ni recurrentes activos: no hay nada que proyectar todavía.</div>';
    return;
  }
  list.innerHTML = months.map(m => `
    <div class="category-row">
      <div><span>${m.label}</span><strong>-${money(m.committed)}</strong></div>
      <div class="budget-row-meta"><span>Saldo proyectado (sin nuevos ingresos)</span><strong>${money(m.projectedBalance)}</strong></div>
    </div>`).join('');
}

function syncExpenseTypeOptions(allData) {
  const select = $('expenseType');
  if (!select) return;
  const existingValues = new Set(Array.from(select.options).map(opt => opt.value));
  (allData.customCards || []).forEach(card => {
    if (existingValues.has(card.payment)) return;
    const opt = document.createElement('option');
    opt.value = card.payment;
    opt.textContent = card.payment;
    select.appendChild(opt);
  });
}

function updatePeriodLabels() {
  const currentLabel = getMonthLabel(selectedMonth);
  document.querySelectorAll('.period-copy').forEach(element => element.textContent = currentLabel);
  const now = new Date();
  if ($('todayBadge')) $('todayBadge').textContent = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function renderCalendar() {
  if (!$('calendarYearDisplay') || !$('calendarMonthsGrid')) return;
  $('calendarYearDisplay').textContent = calendarYear;

  const currentYearSelectedMonth = selectedMonth;
  $('calendarMonthsGrid').innerHTML = monthNames.map((name, index) => {
    const monthNum = String(index + 1).padStart(2, '0');
    const key = `${calendarYear}-${monthNum}`;
    const isActive = key === currentYearSelectedMonth;
    return `<button class="calendar-month-btn ${isActive ? 'active' : ''}" data-month-key="${key}" type="button">${name}</button>`;
  }).join('');

  document.querySelectorAll('.calendar-month-btn').forEach(btn => {
    btn.onclick = () => {
      selectedMonth = btn.dataset.monthKey;
      $('calendarModal')?.close();
      render();
    };
  });
}

function render() {
  if (appMain && appMain.classList.contains('hidden')) return;

  const allData = getMonthData();
  const data = allData[selectedMonth];
  const generalBalance = getGeneralBalance(allData);
  const income = total(data.incomes);
  const manualExpenses = total(data.expenses);
  const fixed = getFixedExpenses();
  const fixedTotal = getPaidFixedTotal(fixed, data.fixedPaid);
  const expenses = fixedTotal + manualExpenses;
  const manageTithe = allData.userSettings?.manageTithe !== false;

  const titheOrDebtValue = manageTithe ? Math.max(income - expenses, 0) * 0.1 : getAccumulatedDebts(allData);
  const voluntarySavings = total(data.savings);
  const available = generalBalance;
  const titheValueForCalc = manageTithe ? titheOrDebtValue : 0;
  const used = income ? Math.min((expenses + titheValueForCalc + voluntarySavings) / income * 100, 100) : 0;

  updatePeriodLabels();
  updateGreeting(allData);
  updateProfile(allData);
  syncExpenseTypeOptions(allData);
  renderCards(allData);

  if ($('titheStatLabel')) $('titheStatLabel').textContent = manageTithe ? '🙏 Diezmo' : '💳 Deudas';
  if ($('legendTitheLabel')) $('legendTitheLabel').textContent = manageTithe ? 'Diezmo' : 'Deudas';
  if ($('legendTitheItem')) $('legendTitheItem').style.display = manageTithe ? 'flex' : 'none';

  if ($('totalIncome')) $('totalIncome').textContent = money(income);
  if ($('totalExpenses')) $('totalExpenses').textContent = money(expenses);
  if ($('totalTithe')) $('totalTithe').textContent = money(titheOrDebtValue);
  if ($('totalAvailable')) $('totalAvailable').textContent = money(voluntarySavings);
  if ($('generalBalance')) $('generalBalance').textContent = money(generalBalance);
  if ($('incomeCardValue')) $('incomeCardValue').textContent = money(income);

  renderGoal(allData);
  if ($('flowTotal')) $('flowTotal').textContent = money(available);
  if ($('expenseViewTotal')) $('expenseViewTotal').textContent = money(expenses);

  if ($('titheViewTitle')) $('titheViewTitle').textContent = manageTithe ? 'Solo diezmo' : 'Control de Deudas';
  if ($('titheViewLead')) $('titheViewLead').textContent = manageTithe 
    ? 'Una vista tranquila para separar con claridad el diezmo de los ingresos del hogar.'
    : 'Monitoreo y seguimiento de deudas acumuladas.';
  if ($('titheVerse')) $('titheVerse').style.display = manageTithe ? 'block' : 'none';
  if ($('churchGivingBox')) $('churchGivingBox').style.display = manageTithe ? 'flex' : 'none';
  if ($('titheBigLabel')) $('titheBigLabel').textContent = manageTithe ? '🙏 10% de los ingresos' : '💳 Total acumulado de deudas';
  if ($('tithePaidLabel')) $('tithePaidLabel').textContent = manageTithe ? 'Ya lo entregué' : 'Marcar al día';
  if ($('titheValue')) $('titheValue').textContent = money(titheOrDebtValue);
  if ($('tithePaid')) $('tithePaid').checked = Boolean(data.tithePaid);
  if ($('titheNote')) $('titheNote').textContent = manageTithe 
    ? 'Registra tus ingresos para calcular el diezmo.'
    : 'Suma de gastos asignados a la categoría Deudas.';

  if ($('usageLabel')) $('usageLabel').textContent = `${Math.round(used)}%`;
  if ($('usageBar')) $('usageBar').style.width = `${used}%`;

  renderIncomeList(data.incomes);
  renderExpenseList(data.expenses, fixed, data.fixedPaid);

  const pieValues = [available, expenses, manageTithe ? titheOrDebtValue : 0, voluntarySavings];
  const pieColors = ['#D6FB3D', '#FFFFFF', '#8C6BFF', '#F20F72'];
  const pieLabels = ['Disponible', 'Gastos', manageTithe ? 'Diezmo' : 'Deudas', 'Ahorro'];
  renderPie(pieValues, pieColors, pieLabels);

  renderCategories(data.expenses, fixed, data.fixedPaid);
  renderBudgets(allData, data.expenses, fixed, data.fixedPaid);
  renderRecurring(allData);
  renderProjection(allData);
  populateExportMonths();
  renderWave(data.incomes, data.expenses);
  renderSavingsList(data.savings);
  renderSavingsSummary();
}

function renderGoal(allData) {
  const allKeys = Object.keys(allData).filter(key => /^\d{4}-\d{2}$/.test(key)).sort();
  const elapsed = allKeys.indexOf(selectedMonth) + 1;
  const targetKeys = elapsed > 0 ? allKeys.slice(0, elapsed) : [selectedMonth];
  
  const saved = targetKeys.reduce((sum, key) => sum + total((allData[key] || {}).savings || []), 0);
  const goal = Number(allData.savingsGoal) || 0;
  const progress = goal ? Math.min(saved / goal * 100, 100) : 0;
  if ($('goalValue')) $('goalValue').textContent = `${compactMoney(saved)}/${compactMoney(goal)}`;
  if ($('goalProgress')) $('goalProgress').style.width = `${progress}%`;
  if ($('goalCaption')) $('goalCaption').textContent = goal ? `${Math.round(progress)}% de la meta alcanzada` : 'Define una meta de ahorro';
}

function renderCards(allData) {
  const stack = $('cardsStack');
  if (!stack) return;
  const allCards = getAllCards(allData);
  
  if (allCards.length === 0) {
    stack.innerHTML = '<div class="empty" style="text-align:center; padding: 40px 20px; color: var(--sub);">Aún no tienes cuentas añadidas.<br>Agrega una tarjeta a tu billetera.</div>';
    return;
  }

  cardOrder = cardOrder.filter(key => allCards.some(card => card.key === key));
  allCards.forEach(card => { if (!cardOrder.includes(card.key)) cardOrder.push(card.key); });

  stack.innerHTML = allCards.map(card => {
    const initial = Number(allData.cardBalances[card.key]) || 0;
    const spent = cardExpenses(allData, card);
    const balance = Math.max(initial - spent, 0);
    const currencyTag = card.currency ? `<span class="wallet-currency-tag">${card.currency}</span>` : '';
    const last4Label = card.last4 ? `<span class="wallet-last4">•••• ${card.last4}</span>` : '';
    const networkBadge = cardNetworkBadge(card.brand);
    const debtLine = card.type === 'credito'
      ? `<span class="wallet-debt">Deuda: ${moneyForCard(Math.max((Number(card.cupoTotal) || 0) - balance, 0), card.currency)}</span>`
      : '';

    return `<button class="wallet-card wallet-${card.key}" type="button" data-card-key="${card.key}" style="--card-gradient:${card.gradient}">
      <span class="wallet-top">
        <span class="wallet-name">${card.name}${currencyTag}</span>
        <span class="wallet-edit">＋</span>
      </span>
      <span class="wallet-bottom">
        <span class="wallet-balance-col">
          <span class="wallet-balance">${moneyForCard(balance, card.currency)}</span>
          <span class="wallet-spent">Gastado ${moneyForCard(spent, card.currency)}</span>
          ${debtLine}
        </span>
        ${last4Label}
      </span>
      ${networkBadge}
    </button>`;
  }).join('');
  layoutCards();
}

// Insignia de marca de la tarjeta, ubicada en la esquina inferior derecha:
// Mastercard son dos círculos superpuestos (azul y rojo); Visa es el texto
// "VISA" en negrita. Sin marca seleccionada, no se dibuja nada.
function cardNetworkBadge(brand) {
  const normalized = (brand || '').toLowerCase();
  if (normalized === 'mastercard') {
    return `<svg class="wallet-network" viewBox="0 0 32 20" aria-label="Mastercard">
      <circle cx="12" cy="10" r="9" fill="#2b6bff"></circle>
      <circle cx="20" cy="10" r="9" fill="#ff3b30" fill-opacity=".85"></circle>
    </svg>`;
  }
  if (normalized === 'visa') {
    return `<svg class="wallet-network" viewBox="0 0 46 20" aria-label="Visa">
      <text x="0" y="16" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-style="italic" font-size="17" fill="#fff">VISA</text>
    </svg>`;
  }
  return '';
}

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
  if (cardOrder.length <= 1) return;
  cardOrder.push(cardOrder.shift());
  layoutCards();
}

function cycleCardsBackward() {
  if (cardOrder.length <= 1) return;
  cardOrder.unshift(cardOrder.pop());
  layoutCards();
}

function renderIncomeList(incomes) {
  if (!$('incomeList')) return;
  $('incomeList').innerHTML = incomes.length
    ? incomes.map(item => `
      <div class="entry">
        <span>💵 ${escapeHtml(item.name)}<small>Día ${dayFor(item)}</small></span>
        <strong>${money(item.amount)}</strong>
        <button class="remove" data-kind="income" data-id="${item.id}">×</button>
      </div>`).join('')
    : '<div class="empty">Aún no hay ingresos registrados.</div>';
}

function renderExpenseList(expenses, fixed, fixedPaid) {
  if (!$('expenseList')) return;
  const fixedRows = `
    <div class="expense-row fixed-row-list"><span>🩺 Seguridad social<small>Gasto fijo · basado en 1 SMMLV</small></span><strong>${money(fixed.socialSecurity)}</strong><label class="fixed-check"><input type="checkbox" data-fixed-key="socialSecurity" ${fixedPaid.socialSecurity ? 'checked' : ''}><span>${fixedPaid.socialSecurity ? 'Pagado' : 'Pendiente'}</span></label></div>
    <div class="expense-row fixed-row-list"><span>🧳 Reserva laboral<small>Cesantías, intereses, prima y vacaciones</small></span><strong>${money(fixed.laborReserve)}</strong><label class="fixed-check"><input type="checkbox" data-fixed-key="laborReserve" ${fixedPaid.laborReserve ? 'checked' : ''}><span>${fixedPaid.laborReserve ? 'Pagado' : 'Pendiente'}</span></label></div>`;
  $('expenseList').innerHTML = fixedRows + (expenses.length
    ? expenses.slice().reverse().map(item => `
      <div class="expense-row">
        <span>${item.type} ${escapeHtml(item.name)}<small>${item.category} · día ${dayFor(item)}</small></span>
        <strong>${money(item.amount)}</strong>
        <button class="remove" data-kind="expense" data-id="${item.id}">×</button>
      </div>`).join('')
    : '<div class="empty">Aún no hay gastos manuales registrados este mes.</div>');
}

function piePoint(angle, radius) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: 100 + radius * Math.cos(radians), y: 100 + radius * Math.sin(radians) };
}

// Radio y grosor del anillo (en vez de cuñas apuntando al centro). El radio
// interior queda alineado con el agujero negro (.pie-center-hole) del CSS.
const PIE_RADIUS = 68;
const PIE_STROKE = 40;

function piePath(start, end) {
  const first = piePoint(start, PIE_RADIUS);
  const last = piePoint(end, PIE_RADIUS);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${first.x} ${first.y} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${last.x} ${last.y}`;
}

function renderPie(values, colors, labels) {
  if (!$('pieSegments')) return;
  const totalValue = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0) || 0;
  if (totalValue <= 0) {
    $('pieSegments').innerHTML = '';
    return;
  }
  let cursor = 0;
  const visibleCount = values.filter(value => value > 0).length;
  // Un pequeño espacio entre segmentos para que las puntas redondeadas se
  // vean como un corte limpio, en vez de un empalme entre colores.
  const gapDegrees = visibleCount > 1 ? 3 : 0;
  $('pieSegments').innerHTML = values.map((value, index) => {
    if (value <= 0) return '';
    const sliceAngle = (value / totalValue) * 360;
    const end = cursor + sliceAngle;
    const percent = Math.round((value / totalValue) * 100);

    let segment = '';
    if (sliceAngle >= 359.99) {
      segment = `<circle class="pie-segment" cx="100" cy="100" r="${PIE_RADIUS}" fill="none" stroke="${colors[index]}" stroke-width="${PIE_STROKE}" data-label="${labels[index]}" data-value="${value}" data-percent="${percent}" data-color="${colors[index]}"></circle>`;
    } else {
      const gapStart = cursor + gapDegrees / 2;
      const gapEnd = end - gapDegrees / 2;
      segment = `<path class="pie-segment" fill="none" stroke="${colors[index]}" stroke-width="${PIE_STROKE}" stroke-linecap="round" data-label="${labels[index]}" data-value="${value}" data-percent="${percent}" data-color="${colors[index]}" d="${piePath(gapStart, gapEnd)}"></path>`;
    }
    cursor = end;
    return segment;
  }).join('');
  attachPieTooltips();
}

function attachPieTooltips() {
  const area = document.querySelector('.pie-area');
  const tooltip = $('pieTooltip');
  if (!area || !tooltip) return;
  document.querySelectorAll('.pie-segment').forEach(segment => {
    segment.addEventListener('mouseenter', () => {
      tooltip.innerHTML = `<strong>${segment.dataset.label}</strong>${money(segment.dataset.value)} · ${segment.dataset.percent}%`;
      tooltip.style.backgroundColor = segment.dataset.color;
      tooltip.style.color = (segment.dataset.color === '#FFFFFF' || segment.dataset.color === '#D6FB3D') ? '#161616' : '#FFFFFF';
      tooltip.querySelector('strong').style.color = tooltip.style.color;
      area.classList.add('has-hover');
    });
    segment.addEventListener('mouseleave', () => area.classList.remove('has-hover'));
  });
}

function renderCategories(expenses, fixed, fixedPaid) {
  if (!$('categoryList')) return;
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
  if (!$('savingsList')) return;
  $('savingsList').innerHTML = savings.length
    ? savings.slice().reverse().map(item => `
      <div class="expense-row">
        <span>🐷 ${escapeHtml(item.name)}<small>día ${dayFor(item)}</small></span>
        <strong>${money(item.amount)}</strong>
        <button class="remove" data-kind="saving" data-id="${item.id}">×</button>
      </div>`).join('')
    : '<div class="empty">Aún no has separado ahorro voluntario este mes.</div>';
}

function renderSavingsSummary() {
  if (!$('savingsSummary')) return;
  const data = readData();
  const fixed = getFixedExpenses();
  const allKeys = Object.keys(data).filter(key => /^\d{4}-\d{2}$/.test(key)).sort();
  const monthIndex = allKeys.indexOf(selectedMonth);
  const targetKeys = monthIndex >= 0 ? allKeys.slice(0, monthIndex + 1) : [selectedMonth];

  const totalAccumulatedReserve = targetKeys.reduce((sum, key) => {
    const isPaid = Boolean(data[key]?.fixedPaid?.laborReserve);
    return isPaid ? sum + fixed.laborReserve : sum;
  }, 0);

  const relevantKeysFromCurrent = monthIndex >= 0 ? allKeys.slice(monthIndex) : [selectedMonth];
  const rows = relevantKeysFromCurrent.map(key => {
    const reserveVal = Boolean(data[key]?.fixedPaid?.laborReserve) ? fixed.laborReserve : 0;
    return { label: getMonthLabel(key), value: reserveVal + total((data[key] || {}).savings || []) };
  });

  const highest = Math.max(...rows.map(row => row.value), 1);
  $('savingsSummary').innerHTML = rows.map(row => `
    <div class="category-row">
      <div><span>${row.label}</span><strong>${money(row.value)}</strong></div>
      <div class="category-track"><i style="width:${row.value / highest * 100}%"></i></div>
    </div>`).join('');

  const accumulatedVoluntary = targetKeys.reduce((sum, key) => sum + total((data[key] || {}).savings || []), 0);
  if ($('laborReserveAccumValue')) $('laborReserveAccumValue').textContent = money(totalAccumulatedReserve);
  if ($('savingsGrandTotal')) $('savingsGrandTotal').textContent = money(totalAccumulatedReserve + accumulatedVoluntary);
}

function getSmoothPath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function renderWave(incomes, expenses) {
  const svg = $('waveChart');
  if (!svg) return;
  const width = 950;
  const height = 250;
  const paddingLeft = 85; 
  const paddingRight = 30;
  const paddingTop = 35;
  const paddingBottom = 40;
  const days = 31;

  const amountByDay = items => Array.from({ length: days }, (_, index) => total(items.filter(item => dayFor(item) === index + 1)));
  const incomeAmounts = amountByDay(incomes);
  const expenseAmounts = amountByDay(expenses);
  const maxAmount = Math.max(1, ...incomeAmounts, ...expenseAmounts);

  const x = day => paddingLeft + (day - 1) * (width - paddingLeft - paddingRight) / (days - 1);
  const y = amount => height - paddingBottom - (amount * (height - paddingTop - paddingBottom) / maxAmount);

  const incomePoints = incomeAmounts.map((val, idx) => ({ x: x(idx + 1), y: y(val) }));
  const expensePoints = expenseAmounts.map((val, idx) => ({ x: x(idx + 1), y: y(val) }));

  const incomeOn = $('showIncomeWave') ? $('showIncomeWave').checked : true;
  const expenseOn = $('showExpenseWave') ? $('showExpenseWave').checked : true;

  const xLabels = Array.from({ length: days }, (_, index) => `
    <text x="${x(index + 1)}" y="${height - 12}" text-anchor="middle" class="wave-label">${index + 1}</text>`).join('');

  const ySteps = 4;
  let yAxisElements = '';
  for (let i = 0; i <= ySteps; i++) {
    const stepValue = (maxAmount / ySteps) * i;
    const yPos = y(stepValue);
    yAxisElements += `<line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" class="wave-grid-line" />`;
    yAxisElements += `<text x="${paddingLeft - 10}" y="${yPos + 4}" text-anchor="end" class="wave-label">${money(stepValue)}</text>`;
  }

  svg.innerHTML = `
    <line x1="${paddingLeft}" y1="${paddingTop - 10}" x2="${paddingLeft}" y2="${height - paddingBottom}" class="wave-axis-line"/>
    <text x="${paddingLeft - 10}" y="${paddingTop - 15}" text-anchor="end" class="wave-axis-title">Monto ($)</text>
    ${yAxisElements}
    <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" class="wave-axis-line"/>
    ${xLabels}
    ${incomeOn ? `<path class="wave-income" d="${getSmoothPath(incomePoints)}"/>` : ''}
    ${expenseOn ? `<path class="wave-expense" d="${getSmoothPath(expensePoints)}"/>` : ''}
  `;
}



function renderDebtCalculator(allData) {
    const creditCards = getAllCards(allData).filter(c => c.type === 'credito' && c.tasaInteres > 0);
    const container = $('debtCalculatorContainer'); // Añadir este ID en el HTML de Presupuestos
    if (!container) return;

    if (creditCards.length === 0) {
        container.innerHTML = '<div class="empty">No tienes tarjetas de crédito con tasa de interés configurada.</div>';
        return;
    }

    container.innerHTML = creditCards.map(card => {
        const initial = Number(allData.cardBalances[card.key]) || 0;
        const spent = cardExpenses(allData, card);
        const debt = Math.max((Number(card.cupoTotal) || 0) - (initial - spent), 0);
        
        // Interés mensual estimado (Tasa anual / 12)
        const monthlyRate = (card.tasaInteres / 100) / 12;
        const monthlyInterest = debt * monthlyRate;

        return `
            <div class="category-row">
                <div><span>${card.name} (${card.tasaInteres}%)</span><strong>Deuda: ${money(debt)}</strong></div>
                <div class="budget-row-meta" style="color: var(--fuchsia)">
                    <span>⚠️ Estás pagando aprox. <b>${money(monthlyInterest)}</b> de interés este mes.</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderAgenda(allData) {
    const agendaList = $('agendaList');
    if (!agendaList) return;

    const items = [];
    // 1. Agregar Recurrentes
    (allData.recurring || []).forEach(rec => {
        items.push({ day: 1, name: rec.name, amount: rec.amount, icon: '🔁' });
    });

    // 2. Agregar Cortes de Tarjeta
    getAllCards(allData).filter(c => c.fechaCorte).forEach(card => {
        items.push({ day: card.fechaCorte, name: `Corte ${card.name}`, amount: 0, icon: '💳', isInfo: true });
    });

    // Ordenar por día
    items.sort((a, b) => a.day - b.day);

    agendaList.innerHTML = items.map(item => `
        <div class="expense-row" style="${item.isInfo ? 'border-left: 3px solid var(--purple)' : ''}">
            <span>${item.icon} ${item.name}<small>Día ${item.day}</small></span>
            <strong>${item.amount > 0 ? money(item.amount) : 'Info'}</strong>
        </div>
    `).join('') || '<div class="empty">No hay eventos programados.</div>';
}