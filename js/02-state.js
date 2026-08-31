// ============================================================
// miEco · Estado de la app y funciones puras (dinero, fechas,
// tarjetas, cálculos). Sin listeners de eventos aquí.
// ============================================================



// Variable global que controla el acceso
let isUserPro = false; 

// Función de utilidad para botones simples
function requirePro(featureName) {
  if (!isUserPro) {
    if ($('paywallModal')) $('paywallModal').showModal();
    console.warn(`Feature bloqueada: ${featureName}`);
    return false;
  }
  return true;
}

async function checkSubscriptionStatus() {
  if (!currentUserId) return;

  try {
    // FASE 4: Consultamos la tabla 'profiles' para ver el plan real
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('plan_type')
      .eq('id', currentUserId)
      .maybeSingle();

    if (error) throw error;

    // Si el perfil existe, actualizamos la variable global
    if (profile) {
      isUserPro = (profile.plan_type === 'pro');
      console.log("💳 Plan actual:", profile.plan_type);
    } else {
      // Si por alguna razón no hay perfil, asumimos Free
      isUserPro = false;
    }

    // Actualizar UI según el plan (Tu función de diseño)
    updateProUI();

  } catch (err) {
    console.error("Error al verificar suscripción:", err.message);
    // Por seguridad, si hay error de red o base de datos, lo tratamos como Free
    isUserPro = false;
    updateProUI();
  }
}

function updateProUI() {
  // 1. Manejo de las insignias de bloqueo que ya tenías
  const proBadges = document.querySelectorAll('.pro-only-badge');
  proBadges.forEach(el => {
    el.classList.toggle('hidden', isUserPro);
  });

  // 2. NUEVO: Actualizar el estado visual en la sección de Perfil
  const planStatusEl = document.getElementById('profilePlanStatus');
  if (planStatusEl) {
    if (isUserPro) {
      planStatusEl.textContent = "🚀 Plan Pro";
      planStatusEl.className = "plan-badge pro";
    } else {
      planStatusEl.textContent = "🌱 Plan Gratuito";
      planStatusEl.className = "plan-badge free";
    }
  }
}
// Función guardiana para botones
function requirePro(actionName) {
  if (!isUserPro) {
    const modal = $('paywallModal');
    if (modal) modal.showModal();
    console.log(`Acceso denegado a: ${actionName}`);
    return false;
  }
  return true;
}
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

let selectedMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
let calendarYear = new Date(selectedMonth + '-01').getFullYear();

function getMonthLabel(key) {
  const [yearStr, monthStr] = key.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  return `${monthNames[monthIdx]} ${yearStr}`;
}

let currency = 'COP';
let usdRate = 3150; 
const minimumWage = 1750905;
const fixedRates = { socialSecurity: 0.125 + 0.16 + 0.00522, laborReserve: 0.0833 + 0.01 + 0.0833 + 0.0417 };

async function fetchRealUsdRate() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    if (data && data.rates && data.rates.COP) {
      usdRate = data.rates.COP;
    }
  } catch (e) {
    console.warn('No se pudo obtener la tasa de cambio en vivo, usando valor por defecto.');
  }
}

// Tarjetas vacías por defecto
const cards = [];

const cardGradients = [
  'linear-gradient(145deg, #c5a9ff 0%, #7438c8 52%, #26104f 100%)', // 0: Morado Neón
  'linear-gradient(145deg, #75b68d 0%, #0d4c32 52%, #032319 100%)', // 1: Verde Esmeralda
  'linear-gradient(145deg, #ff6b9d 0%, #e31270 42%, #7a0a3a 100%)', // 2: Fucsia Intenso
  'linear-gradient(145deg, #fff28a 0%, #ffbd24 50%, #e56b00 100%)', // 3: Naranja Dorado
  'linear-gradient(145deg, #eafbe2 0%, #39ff6a 42%, #0f8a3a 100%)', // 4: Menta Suave
  'linear-gradient(145deg, #8ad4ff 0%, #2488ff 50%, #0036e5 100%)', // 5: Azul Océano
  'linear-gradient(145deg, #ff8a8a 0%, #ff2424 50%, #b30000 100%)', // 6: Rojo Carmesí
  'linear-gradient(145deg, #5c5c5c 0%, #1f1f1f 50%, #000000 100%)', // 7: Negro Carbón
  'linear-gradient(145deg, #f0f0f0 0%, #b8b8b8 50%, #6e6e6e 100%)', // 8: Gris Plata
  'linear-gradient(145deg, #ffcce6 0%, #ff80bf 50%, #cc0066 100%)'  // 9: Rosa Pastel
];

function getAllCards(allData) {
  return [...cards, ...(Array.isArray(allData.customCards) ? allData.customCards : [])];
}

let selectedCardKey = null;
let cardOrder = [];
let suppressCardClick = false;

const total = items => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
const parseMoney = value => Number(String(value).replace(/[^0-9]/g, '')) || 0;
const dayFor = item => Number(item.day) || new Date().getDate();

const money = value => currency === 'COP'
  ? '$' + Math.round(Number(value) || 0).toLocaleString('es-CO')
  : 'US$ ' + Math.round((Number(value) || 0) / usdRate).toLocaleString('en-US');

const moneyForCard = (value, cardCurrency) => cardCurrency === 'USD'
  ? 'US$ ' + Math.round(Number(value) || 0).toLocaleString('en-US')
  : money(value);

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
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1).replace('.0', '')}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1).replace('.0', '')}k`;
  return `$${amount}`;
}

function getFixedExpenses() {
  return {
    socialSecurity: minimumWage * fixedRates.socialSecurity,
    laborReserve: minimumWage * fixedRates.laborReserve
  };
}

function getPaidFixedTotal(fixed, fixedPaid) {
  return (fixedPaid.socialSecurity ? fixed.socialSecurity : 0) + (fixedPaid.laborReserve ? fixed.laborReserve : 0);
}

function getGeneralBalance(allData) {
  const allKeys = Object.keys(allData).filter(key => /^\d{4}-\d{2}$/.test(key)).sort();
  const selectedIndex = allKeys.indexOf(selectedMonth);
  const targetKeys = selectedIndex >= 0 ? allKeys.slice(0, selectedIndex + 1) : [selectedMonth];
  const manageTithe = allData.userSettings?.manageTithe !== false;
  
  let balance = 0;
  targetKeys.forEach(key => {
    const month = allData[key] || {};
    const fixed = getFixedExpenses();
    const fixedPaid = month.fixedPaid || {};
    const income = total(month.incomes || []);
    const expenses = getPaidFixedTotal(fixed, fixedPaid) + total(month.expenses || []);
    const availableBeforeTithe = Math.max(balance + income - expenses, 0);
    const tithe = (manageTithe && income) ? Math.max(income - expenses, 0) * 0.1 : 0;
    const savings = total(month.savings || []);
    balance = Math.max(availableBeforeTithe - tithe - savings, 0);
  });
  return balance;
}

function getAccumulatedDebts(allData) {
  const allKeys = Object.keys(allData).filter(key => /^\d{4}-\d{2}$/.test(key)).sort();
  const selectedIndex = allKeys.indexOf(selectedMonth);
  const targetKeys = selectedIndex >= 0 ? allKeys.slice(0, selectedIndex + 1) : [selectedMonth];
  const categoryDebts = targetKeys.reduce((sum, key) => sum + total((allData[key]?.expenses || []).filter(item => item.category === '💳 Deudas')), 0);

  // Deuda real de tarjetas de crédito: cupo total menos lo que queda disponible.
  const creditCardDebts = getAllCards(allData)
    .filter(card => card.type === 'credito')
    .reduce((sum, card) => {
      const initial = Number(allData.cardBalances[card.key]) || 0;
      const spent = cardExpenses(allData, card);
      const available = Math.max(initial - spent, 0);
      const cupo = Number(card.cupoTotal) || 0;
      return sum + Math.max(cupo - available, 0);
    }, 0);

  return categoryDebts + creditCardDebts;
}

function cardExpenses(allData, card) {
  const allKeys = Object.keys(allData).filter(key => /^\d{4}-\d{2}$/.test(key));
  return allKeys.reduce((sum, key) => sum + total((allData[key]?.expenses || []).filter(item => item.type === card.payment)), 0);
}

// Proyección simple de flujo de caja: qué tan rápido se agotaría el saldo
// disponible si solo se pagaran los compromisos ya conocidos (gastos fijos +
// recurrentes) y no entrara ningún ingreso nuevo. No proyecta ingresos futuros
// porque el modelo de datos actual no tiene "ingresos recurrentes", solo gastos.
function getCashFlowProjection(allData, monthsAhead = 3) {
  const recurringTotal = total(allData.recurring || []);
  const fixed = getFixedExpenses();
  const monthlyCommitted = recurringTotal + fixed.socialSecurity + fixed.laborReserve;
  const [year, month] = selectedMonth.split('-').map(Number);
  let runningBalance = getGeneralBalance(allData);
  const months = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const date = new Date(year, month - 1 + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    runningBalance = Math.max(runningBalance - monthlyCommitted, 0);
    months.push({ key, label: getMonthLabel(key), committed: monthlyCommitted, projectedBalance: runningBalance });
  }
  return months;
}
