// ============================================================
// miEco · Manejadores de eventos de la interfaz: formularios,
// botones, modales, calendario, arrastre de tarjetas, OCR,
// exportar CSV y borrar datos del mes.
// ============================================================

$('scanReceiptButton').addEventListener('click', (e) => {
    if (!requirePro('Escaneo de Tiquetes')) {
        e.stopImmediatePropagation();
        return;
    }
    $('receiptInput').click();
});

if ($('currencyButton')) {
  $('currencyButton').addEventListener('click', () => {
    /*
    // --- FASE 4: BLOQUEO PRO ---
    if (!requirePro('Multidivisa')) {
      return; // Detiene el cambio de moneda y abre el modal de pago
    }
    // ---------------------------
    */

    currency = currency === 'COP' ? 'USD' : 'COP';
    if ($('currencyLabel')) {
      $('currencyLabel').textContent = currency === 'COP' ? 'COP $' : 'USD $';
    }
    render();
  });
}

function setupCalendarEvents() {
  const openButtons = ['periodPickerBtn', 'periodPickerBtnExpenses', 'periodPickerBtnSavings', 'periodPickerBtnBudgets'];
  openButtons.forEach(id => {
    const btn = $(id);
    if (btn) {
      btn.onclick = () => {
        calendarYear = parseInt(selectedMonth.split('-')[0], 10) || new Date().getFullYear();
        renderCalendar();
        $('calendarModal')?.showModal();
      };
    }
  });
  if ($('prevYearBtn')) $('prevYearBtn').onclick = () => { calendarYear--; renderCalendar(); };
  if ($('nextYearBtn')) $('nextYearBtn').onclick = () => { calendarYear++; renderCalendar(); };
}

setupCalendarEvents();

function openView(view) {
  document.querySelectorAll('.view').forEach(item => item.classList.toggle('active', item.id === `view-${view}`));
  document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  render();
}

document.querySelectorAll('.money-input').forEach(input => {
  input.addEventListener('input', () => formatMoneyInput(input));
});

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => openView(button.dataset.view));
});

if ($('incomeForm')) {
  $('incomeForm').addEventListener('submit', event => {
    event.preventDefault();
    const amount = parseMoney($('incomeAmount').value);
    const name = $('incomeName').value.trim();
    if (!amount || !name) return alert('Escribe el valor y el origen.');
    addTransaction(selectedMonth, 'incomes', { name, amount, day: new Date().getDate() });
    event.target.reset();
    $('incomeModal').close();
    render();
  });
}

if ($('expenseForm')) {
  $('expenseForm').addEventListener('submit', event => {
    event.preventDefault();
    const amount = parseMoney($('expenseAmount').value);
    const name = $('expenseName').value.trim();
    const type = $('expenseType').value;
    const category = $('expenseCategory').value;
    if (!amount || !name) return alert('Escribe el valor y el nombre.');

    // Si hay una fecha elegida (a mano o autocompletada por el escáner de
    // tiquetes), se usa el día de esa fecha; si no, el día de hoy.
    const dateValue = $('expenseDate')?.value;
    const day = dateValue ? new Date(dateValue + 'T00:00:00').getDate() : new Date().getDate();

    addTransaction(selectedMonth, 'expenses', { name, amount, type, category, day });

    if ($('expenseRecurring') && $('expenseRecurring').checked) {
      const data = getMonthData();
      data.recurring = data.recurring || [];
      data.recurring.push({ id: 'rec-' + Date.now(), name, amount, type, category });
      saveData(data);
    }

    event.target.reset();
    if ($('ocrStatus')) $('ocrStatus').textContent = '';
    render();
  });
}

if ($('savingsForm')) {
  $('savingsForm').addEventListener('submit', event => {
    event.preventDefault();
    const amount = parseMoney($('savingsAmount').value);
    const name = $('savingsName').value.trim();
    if (!amount || !name) return alert('Escribe el valor y el destino.');
    addTransaction(selectedMonth, 'savings', { name, amount, day: new Date().getDate() });
    event.target.reset();
    render();
  });
}

if ($('budgetForm')) {
  $('budgetForm').addEventListener('submit', event => {
    event.preventDefault();
    const category = $('budgetCategory').value;
    const amount = parseMoney($('budgetAmount').value);
    if (!amount) return alert('Escribe un límite mayor a cero.');
    const data = getMonthData();
    data.userSettings.budgets[category] = amount;
    saveData(data);
    event.target.reset();
    render();
  });
}

if ($('profileConfigButton')) $('profileConfigButton').addEventListener('click', () => $('configButton')?.click());

if ($('configButton')) {
  $('configButton').addEventListener('click', () => {
    const data = getMonthData();
    if ($('configUsernameInput')) $('configUsernameInput').value = data.userSettings?.displayName || currentUserData?.user_metadata?.full_name || currentUserData?.email?.split('@')[0] || '';
    if ($('configTitheToggle')) $('configTitheToggle').checked = data.userSettings?.manageTithe !== false;
    if ($('configModal')) $('configModal').showModal();
  });
}

if ($('configForm')) {
  $('configForm').addEventListener('submit', event => {
    event.preventDefault();
    const newName = $('configUsernameInput').value.trim();
    const manageTithe = $('configTitheToggle').checked;
    const data = getMonthData();
    data.userSettings ??= {};
    if (newName) data.userSettings.displayName = newName;
    data.userSettings.manageTithe = manageTithe;
    saveData(data);
    if ($('configModal')) $('configModal').close();
    render();
  });
}

if ($('goalButton')) {
  $('goalButton').addEventListener('click', () => {
    const data = getMonthData();
    if ($('savingsGoalInput')) $('savingsGoalInput').value = data.savingsGoal ? `$ ${data.savingsGoal.toLocaleString('es-CO')}` : '';
    if ($('goalModal')) $('goalModal').showModal();
  });
}

if ($('goalForm')) {
  $('goalForm').addEventListener('submit', event => {
    event.preventDefault();
    const goal = parseMoney($('savingsGoalInput').value);
    const data = getMonthData();
    data.savingsGoal = goal;
    saveData(data);
    if ($('goalModal')) $('goalModal').close();
    render();
  });
}

if ($('incomeAddButton')) $('incomeAddButton').addEventListener('click', () => $('incomeModal')?.showModal());

document.querySelectorAll('[data-close-modal]').forEach(button => {
  button.addEventListener('click', () => {
    const modalId = button.dataset.closeModal;
    if ($(modalId)) $(modalId).close();
  });
});

if ($('cardsStack')) {
  $('cardsStack').addEventListener('click', event => {
    if (suppressCardClick) { suppressCardClick = false; return; }
    const cardEl = event.target.closest('[data-card-key]');
    if (!cardEl) return;
    const cardKey = cardEl.dataset.cardKey;

    if (cardEl.dataset.position && cardEl.dataset.position !== '0') {
      bringCardToFront(cardKey);
      return;
    }

    selectedCardKey = cardKey;
    const allData = getMonthData();
    const card = getAllCards(allData).find(c => c.key === cardKey);
    if (!card) return;
    const isUsdCard = card.currency === 'USD';

    if ($('cardModalKicker')) $('cardModalKicker').textContent = isUsdCard ? `${card.name} · USD` : card.name;
    if ($('cardModalTitle')) $('cardModalTitle').textContent = `Configurar ${card.name}`;
    if ($('cardBalanceInput')) $('cardBalanceInput').placeholder = isUsdCard ? 'US$ 0' : '$ 0';
    if ($('cardExpenseAmount')) $('cardExpenseAmount').placeholder = isUsdCard ? 'US$ 0' : '$ 0';
    if ($('removeCardButton')) $('removeCardButton').classList.toggle('hidden', !cardKey.startsWith('custom-'));

    const initial = Number(allData.cardBalances[cardKey]) || 0;

    if ($('cardBalanceInput')) {
      $('cardBalanceInput').value = initial
        ? (isUsdCard ? `US$ ${Math.round(initial).toLocaleString('en-US')}` : `$ ${Math.round(initial).toLocaleString('es-CO')}`)
        : '';
    }
    if ($('cardExpenseAmount')) $('cardExpenseAmount').value = '';
    if ($('cardExpenseName')) $('cardExpenseName').value = '';

    if ($('cardDebtLine')) {
      const isCredit = card.type === 'credito';
      $('cardDebtLine').classList.toggle('hidden', !isCredit);
      if (isCredit) {
        const spent = cardExpenses(allData, card);
        const available = Math.max(initial - spent, 0);
        const debt = Math.max((Number(card.cupoTotal) || 0) - available, 0);
        if ($('cardDebtValue')) $('cardDebtValue').textContent = moneyForCard(debt, card.currency);
      }
    }

    if ($('cardModal')) $('cardModal').showModal();
  });
}

(() => {
  const stackEl = $('cardsStack');
  if (!stackEl) return;
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

if ($('cardForm')) {
  $('cardForm').addEventListener('submit', event => {
    event.preventDefault();
    const initialBalance = parseMoney($('cardBalanceInput').value);
    const amount = parseMoney($('cardExpenseAmount').value);
    const name = $('cardExpenseName').value.trim();
    const category = $('cardExpenseCategory').value;

    const data = getMonthData();
    data.cardBalances[selectedCardKey] = initialBalance;
    saveData(data);

    if (amount && name) {
      const card = getAllCards(data).find(c => c.key === selectedCardKey);
      addTransaction(selectedMonth, 'expenses', { name, amount, type: card.payment, category, day: new Date().getDate() });
    }

    event.target.reset();
    if ($('cardModal')) $('cardModal').close();
    render();
  });
}

// Delegación global de eventos para elementos dinámicos
document.body.addEventListener('click', event => {
  if (event.target.matches('.remove[data-kind]')) {
    const kind = event.target.dataset.kind;
    const id = event.target.dataset.id;
    const bucket = kind === 'income' ? 'incomes' : kind === 'expense' ? 'expenses' : 'savings';
    removeTransaction(selectedMonth, bucket, id);
    render();
  }
  
  if (event.target.matches('[data-remove-recurring]')) {
    const id = event.target.dataset.removeRecurring;
    const data = getMonthData();
    data.recurring = (data.recurring || []).filter(r => r.id !== id);
    saveData(data);
    render();
  }

  if (event.target.matches('[data-remove-budget]')) {
    const category = event.target.dataset.removeBudget;
    const data = getMonthData();
    if (data.userSettings && data.userSettings.budgets) {
      delete data.userSettings.budgets[category];
    }
    saveData(data);
    render();
  }
});

// Checkboxes globales (Gastos fijos y diezmo)
document.body.addEventListener('change', event => {
  if (event.target.matches('input[data-fixed-key]')) {
    const key = event.target.dataset.fixedKey;
    const data = getMonthData();
    data[selectedMonth].fixedPaid[key] = event.target.checked;
    saveData(data);
    render();
  }
  if (event.target.id === 'tithePaid') {
    const data = getMonthData();
    data[selectedMonth].tithePaid = event.target.checked;
    saveData(data);
    render();
  }
});

// Agregar y eliminar cuentas personalizadas
if ($('addCardButton')) $('addCardButton').addEventListener('click', () => $('addCardModal')?.showModal());

// Muestra los campos de tarjeta de crédito (cupo, corte, interés) solo
// cuando el tipo de cuenta elegido es "credito".
if ($('newCardType')) {
  $('newCardType').addEventListener('change', () => {
    $('creditFields')?.classList.toggle('hidden', $('newCardType').value !== 'credito');
  });
}

if ($('addCardForm')) {
  $('addCardForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const allData = getMonthData();
    const currentCardsCount = (allData.customCards || []).length;

    if (currentCardsCount >= 1 && !isUserPro) {
      $('paywallModal').showModal();
      return;
    }
    const name = $('newCardName').value.trim();
    const brand = $('newCardBrand').value;
    const last4 = $('newCardLast4').value.trim();
    const currency = $('newCardCurrency').value;
    const initialBalance = parseMoney($('newCardInitial').value) || 0;
    const colorIndex = parseInt($('newCardColor').value, 10);
    const type = $('newCardType')?.value || 'debito';

    if (!name) return;

    const data = getMonthData();
    const cardKey = 'custom-' + Date.now();

    const cardRecord = {
      key: cardKey,
      name,
      brand,
      last4,
      currency,
      type,
      payment: '💳 ' + name,
      gradient: cardGradients[colorIndex] || cardGradients[0]
    };

    if (type === 'credito') {
      cardRecord.cupoTotal = parseMoney($('newCardCupo')?.value) || 0;
      cardRecord.fechaCorte = parseInt($('newCardCorte')?.value, 10) || null;
      cardRecord.tasaInteres = parseFloat($('newCardInteres')?.value) || 0;
    }

    data.customCards.push(cardRecord);
    data.cardBalances[cardKey] = initialBalance;

    saveData(data);
    e.target.reset();
    $('creditFields')?.classList.add('hidden');
    $('addCardModal')?.close();
    render();
  });
}

if ($('removeCardButton')) {
  $('removeCardButton').addEventListener('click', () => {
    if (!selectedCardKey.startsWith('custom-')) return;
    const data = getMonthData();
    data.customCards = data.customCards.filter(c => c.key !== selectedCardKey);
    delete data.cardBalances[selectedCardKey];
    saveData(data);
    $('cardModal')?.close();
    render();
  });
}

// Escáner OCR para tiquetes (Client-side)
if ($('scanReceiptButton') && $('receiptInput')) {
  $('scanReceiptButton').addEventListener('click', () => {
    // --- FASE 4: BLOQUEO PRO ---
    if (!requirePro('Escáner de tiquetes')) {
      return; // Abre el modal y detiene la ejecución
    }
    // ---------------------------
    
    $('receiptInput').click();
  });
  $('receiptInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = $('ocrStatus');
    statusEl.textContent = '⏳ Analizando tiquete...';

    try {
      const result = await Tesseract.recognize(file, 'spa', {
        logger: m => {
          if (m.status === 'recognizing text') statusEl.textContent = `⏳ Analizando... ${Math.round(m.progress * 100)}%`;
        }
      });

      const text = result.data.text;

      // Monto: primero busca un número justo después de la palabra "total"
      // (mucho más confiable que tomar el número más grande del tiquete, que
      // fácilmente termina siendo un NIT, un teléfono o un N° de factura).
      // Si no encuentra "total", cae al número más grande como respaldo.
      const numberPattern = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?/;
      const totalMatch = text.match(new RegExp(`total[^\\d]{0,15}(${numberPattern.source})`, 'i'));
      let bestAmount = 0;
      if (totalMatch) {
        bestAmount = parseFloat(totalMatch[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
      } else {
        const amounts = text.match(new RegExp(numberPattern.source, 'g'));
        if (amounts) {
          const parsed = amounts
            .map(a => parseFloat(a.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')))
            .filter(n => !isNaN(n) && n > 0 && n < 50000000);
          if (parsed.length) bestAmount = Math.max(...parsed);
        }
      }
      if (bestAmount > 0) $('expenseAmount').value = `$ ${Math.round(bestAmount).toLocaleString('es-CO')}`;

      // Fecha: busca formatos comunes en tiquetes (DD/MM/AAAA, DD-MM-AA, AAAA-MM-DD).
      const dateMatch = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/)
        || text.match(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/);
      if (dateMatch && $('expenseDate')) {
        let [, a, b, c] = dateMatch;
        let iso = null;
        if (a.length === 4) {
          iso = `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
        } else {
          const year = c.length === 2 ? `20${c}` : c;
          iso = `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        }
        if (!isNaN(new Date(iso).getTime())) $('expenseDate').value = iso;
      }

      // Comercio: usa la primera línea de texto "razonable" (no numérica, no
      // demasiado corta) como nombre sugerido del gasto.
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !l.match(/^\d/));
      if (lines.length > 0) $('expenseName').value = lines[0].substring(0, 30);

      statusEl.textContent = '✅ Datos extraídos — revisa monto, fecha y nombre antes de guardar';
    } catch (err) {
      showAppToast('Mensaje de error', 'error');
      statusEl.textContent = '❌ Error al leer la imagen';
    }
  });
}

// Botón Descargar Registro Completo del Mes (CSV)
if ($('downloadButton')) {
  $('downloadButton').addEventListener('click', () => {
    const allData = getMonthData();
    const data = allData[selectedMonth];
    if (!data) return;

    const income = total(data.incomes || []);
    const manualExpenses = total(data.expenses || []);
    const fixed = getFixedExpenses();
    const fixedTotal = getPaidFixedTotal(fixed, data.fixedPaid || {});
    const expenses = fixedTotal + manualExpenses;
    const savings = total(data.savings || []);
    const debts = getAccumulatedDebts(allData);
    const available = getGeneralBalance(allData);

    let csv = '\uFEFF';
    csv += `RESUMEN GENERAL DEL MES (${getMonthLabel(selectedMonth)})\n`;
    csv += `Ingresos Totales,${income}\n`;
    csv += `Gastos Completo,${expenses}\n`;
    csv += `Ahorros Totales,${savings}\n`;
    csv += `Deudas Acumuladas,${debts}\n`;
    csv += `Disponible General,${available}\n\n`;
    csv += `DETALLE DE MOVIMIENTOS\n`;
    csv += `Tipo,Nombre,Monto,Categoria,Medio,Dia\n`;

    (data.incomes || []).forEach(i => {
      csv += `Ingreso,"${(i.name || '').replace(/"/g, '""')}",${i.amount},"Ingreso","N/A",${i.day || 1}\n`;
    });

    if (data.fixedPaid?.socialSecurity) {
      csv += `Gasto Fijo,"Seguridad Social",${fixed.socialSecurity},"Seguridad Social","Fijo",1\n`;
    }
    if (data.fixedPaid?.laborReserve) {
      csv += `Gasto Fijo,"Reserva Laboral",${fixed.laborReserve},"Reserva Laboral","Fijo",1\n`;
    }

    (data.expenses || []).forEach(e => {
      csv += `Gasto,"${(e.name || '').replace(/"/g, '""')}",${e.amount},"${e.category}","${e.type}",${e.day || 1}\n`;
    });

    (data.savings || []).forEach(s => {
      csv += `Ahorro,"${(s.name || '').replace(/"/g, '""')}",${s.amount},"Ahorro","Voluntario",${s.day || 1}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mieco-registro-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Limpiar datos del mes
if ($('clearButton')) {
  $('clearButton').addEventListener('click', () => {
    if (confirm(`¿Eliminar todos los movimientos de ${getMonthLabel(selectedMonth)}?`)) {
      const data = readData(); 
      if (data[selectedMonth]) {
         data[selectedMonth].incomes = [];
         data[selectedMonth].expenses = [];
         data[selectedMonth].savings = [];
         data[selectedMonth].fixedPaid = {};
         saveData(data);
         clearMonthTransactionsFromCloud(selectedMonth);
         render();
      }
    }
  });
}

// Reportes por rango de meses personalizado, en CSV o JSON (Perfil > Exportar datos)
function populateExportMonths() {
  const fromSel = $('exportFromMonth');
  const toSel = $('exportToMonth');
  if (!fromSel || !toSel) return;
  const data = readData();
  const keys = Object.keys(data).filter(key => /^\d{4}-\d{2}$/.test(key)).sort();
  const monthKeys = keys.length ? keys : [selectedMonth];
  const options = monthKeys.map(key => `<option value="${key}">${getMonthLabel(key)}</option>`).join('');
  const previousFrom = fromSel.value;
  const previousTo = toSel.value;
  fromSel.innerHTML = options;
  toSel.innerHTML = options;
  fromSel.value = monthKeys.includes(previousFrom) ? previousFrom : monthKeys[0];
  toSel.value = monthKeys.includes(previousTo) ? previousTo : selectedMonth;
}

if ($('exportRangeButton')) {
  $('exportRangeButton').addEventListener('click', () => {
    
    // --- FASE 4: VALIDACIÓN PRO ---
    if (!requirePro('Exportación Avanzada')) {
        return; // Detiene la función y abre el modal de pago
    }
    // ------------------------------

    const from = $('exportFromMonth').value;
    const to = $('exportToMonth').value;
    const format = $('exportFormat').value;
    const allData = readData();
    const keys = Object.keys(allData)
      .filter(key => /^\d{4}-\d{2}$/.test(key) && key >= from && key <= to)
      .sort();

    if (!keys.length) return alert('No hay datos guardados en ese rango de meses.');

    if (format === 'json') {
      const payload = {};
      keys.forEach(key => { payload[key] = allData[key]; });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mieco-reporte-${from}_a_${to}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const fixed = getFixedExpenses();
    let csv = '\uFEFF';
    csv += `REPORTE ${getMonthLabel(from)} — ${getMonthLabel(to)}\n\n`;
    csv += `Mes,Tipo,Nombre,Monto,Categoria,Medio,Dia\n`;
    keys.forEach(key => {
      const month = allData[key] || {};
      (month.incomes || []).forEach(item => {
        csv += `${key},Ingreso,"${(item.name || '').replace(/"/g, '""')}",${item.amount},"Ingreso","N/A",${item.day || 1}\n`;
      });
      if (month.fixedPaid?.socialSecurity) csv += `${key},Gasto Fijo,"Seguridad Social",${fixed.socialSecurity},"Seguridad Social","Fijo",1\n`;
      if (month.fixedPaid?.laborReserve) csv += `${key},Gasto Fijo,"Reserva Laboral",${fixed.laborReserve},"Reserva Laboral","Fijo",1\n`;
      (month.expenses || []).forEach(item => {
        csv += `${key},Gasto,"${(item.name || '').replace(/"/g, '""')}",${item.amount},"${item.category}","${item.type}",${item.day || 1}\n`;
      });
      (month.savings || []).forEach(item => {
        csv += `${key},Ahorro,"${(item.name || '').replace(/"/g, '""')}",${item.amount},"Ahorro","Voluntario",${item.day || 1}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mieco-reporte-${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}