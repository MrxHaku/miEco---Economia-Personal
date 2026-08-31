// ============================================================
// miEco · Sincronización con la nube (Supabase) y persistencia local
//
// Fase 1: los movimientos (incomes/expenses/savings) ahora viven en
// la tabla relacional mieco_transactions, una fila por movimiento.
// mieco_data solo guarda configuración (tarjetas, presupuestos,
// recurrentes, metas) — eso sigue siendo un JSON pequeño que cabe
// completo en cada guardado, porque ya no crece con cada gasto.
// ============================================================

// Variable de almacenamiento local (se vuelve específica por usuario
// en cuanto inicia sesión, ver syncFromCloud más abajo).
let storageKey = 'casa-economia';

// Traduce entre el nombre del arreglo en memoria y el valor guardado
// en la columna "type" de mieco_transactions, y viceversa.
const TX_BUCKET_TO_TYPE = { incomes: 'income', expenses: 'expense', savings: 'saving' };
const TX_TYPE_TO_BUCKET = { income: 'incomes', expense: 'expenses', saving: 'savings' };

async function syncFromCloud(user) {
  currentUserId = user.id;
  currentUserData = user;
  storageKey = `mieco-${user.id}`;

  if (!supabaseClient) return;

  try {
    const { data: row, error } = await supabaseClient
      .from('mieco_data')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      showAppToast('Mensaje de error', 'error') 
      return;
    }

    let baseData;
    if (row?.data) {
      baseData = row.data;
    } else {
      // Primer inicio de sesión de este usuario en la nube: si el navegador
      // tenía datos guardados de antes (con la llave antigua sin usuario),
      // los adoptamos como punto de partida en vez de perderlos.
      const legacy = localStorage.getItem('casa-economia');
      baseData = legacy ? JSON.parse(legacy) : {};
    }

    // Migración de una sola vez: si hay ingresos/gastos/ahorros todavía
    // embebidos en el JSON (formato anterior a la Fase 1), los pasamos a
    // mieco_transactions y los quitamos del JSON.
    if (!baseData.migratedToTransactions) {
      await migrateEmbeddedTransactions(user.id, baseData);
      baseData.migratedToTransactions = true;
    }

    // Trae TODAS las transacciones de este usuario y las vuelve a acomodar
    // en la forma anidada por mes que el resto de la app ya espera.
    const { data: transactions, error: txError } = await supabaseClient
      .from('mieco_transactions')
      .select('*')
      .eq('user_id', user.id);

    if (txError) showAppToast('Mensaje de error', 'error');

    (transactions || []).forEach(tx => {
      const bucket = TX_TYPE_TO_BUCKET[tx.type];
      if (!bucket) return;
      baseData[tx.month] ??= {};
      baseData[tx.month][bucket] ??= [];
      baseData[tx.month][bucket].push({
        id: tx.id,
        name: tx.name,
        amount: Number(tx.amount),
        category: tx.category || undefined,
        type: tx.payment_type || undefined,
        day: tx.day || 1,
        recurringId: tx.recurring_id || undefined
      });
    });

    localStorage.setItem(storageKey, JSON.stringify(baseData));
    await saveMetaToCloud(baseData);
  } catch (error) {
    showAppToast('Mensaje de error', 'error');
  }
}

// Migra los ingresos/gastos/ahorros que aún vivan embebidos en el JSON
// (formato de antes de la Fase 1) hacia mieco_transactions, y los borra
// del objeto en memoria para que no se vuelvan a subir dentro del JSON.
async function migrateEmbeddedTransactions(userId, baseData) {
  const rows = [];
  Object.keys(baseData).forEach(key => {
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    const month = baseData[key];
    ['incomes', 'expenses', 'savings'].forEach(bucket => {
      (month[bucket] || []).forEach(item => {
        rows.push({
          user_id: userId,
          month: key,
          type: TX_BUCKET_TO_TYPE[bucket],
          name: item.name,
          amount: item.amount,
          category: item.category || null,
          payment_type: item.type || null,
          day: item.day || null,
          recurring_id: item.recurringId || null
        });
      });
    });
    delete month.incomes;
    delete month.expenses;
    delete month.savings;
  });

  if (!rows.length) return;

  const { error } = await supabaseClient.from('mieco_transactions').insert(rows);
  if (error) showAppToast('Mensaje de error', 'error');
}

// Sube solo la configuración (sin incomes/expenses/savings) a mieco_data.
async function saveMetaToCloud(data) {
  if (!currentUserId || !supabaseClient) return;
  const meta = stripTransactions(data);
  const payloadStr = JSON.stringify(meta);
  if (payloadStr.length > 2000000) {
    showAppToast('El tamaño de la configuración excede el límite recomendado. Abortando escritura.', 'error');
    alert('Tu configuración ya es muy grande para sincronizarse en la nube. Este último cambio se guardó solo en este dispositivo.');
    return;
  }
  const { error } = await supabaseClient.from('mieco_data').upsert({ user_id: currentUserId, data: meta });
  if (error) showAppToast('Mensaje de error', 'error');
}

// Copia de "data" sin los arreglos de movimientos: esos ya no se guardan
// en mieco_data, viven en mieco_transactions.
function stripTransactions(data) {
  const clone = JSON.parse(JSON.stringify(data));
  Object.keys(clone).forEach(key => {
    if (/^\d{4}-\d{2}$/.test(key)) {
      delete clone[key].incomes;
      delete clone[key].expenses;
      delete clone[key].savings;
    }
  });
  return clone;
}

function readData() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch (error) {
    return {};
  }
}

function getMonthData() {
  const data = readData();
  data.savingsGoals ??= []; // Arreglo de objetos {id, name, target, saved, color}
  data[selectedMonth] ??= { incomes: [], expenses: [], savings: [], savingsGoal: 0, fixedPaid: {}, tithePaid: false };
  data[selectedMonth].incomes ??= [];
  data[selectedMonth].expenses ??= [];
  data[selectedMonth].savings ??= [];
  data[selectedMonth].fixedPaid ??= {};
  data[selectedMonth].fixedPaid.socialSecurity ??= false;
  data[selectedMonth].fixedPaid.laborReserve ??= false;
  data[selectedMonth].savingsGoal ??= 0;
  data.cardBalances ??= {};
  data.customCards ??= [];
  data.userSettings ??= {};
  data.userSettings.manageTithe ??= true;
  data.userSettings.budgets ??= {};
  data.recurring ??= [];
  data.recurringAppliedMonths ??= [];
  data.savingsGoal ??= Object.values(data).find(month => month && typeof month === 'object' && Number(month.savingsGoal) > 0)?.savingsGoal || 0;

  // Materializa los gastos recurrentes una sola vez por mes (la primera vez
  // que se abre ese mes). Cada uno se inserta como su propia transacción
  // real, igual que si el usuario lo hubiera escrito a mano.
  if (data.recurring.length && !data.recurringAppliedMonths.includes(selectedMonth)) {
    data.recurring.forEach(template => {
      addTransaction(selectedMonth, 'expenses', {
        name: template.name,
        amount: template.amount,
        type: template.type,
        category: template.category,
        day: 1,
        recurringId: template.id
      }, data);
    });
    data.recurringAppliedMonths.push(selectedMonth);
    localStorage.setItem(storageKey, JSON.stringify(data));
    saveMetaToCloud(data);
  }

  return data;
}

// Guarda configuración (tarjetas, presupuestos, recurrentes, metas, saldos
// de tarjetas) — NUNCA movimientos. Para movimientos usar addTransaction /
// removeTransaction más abajo.
function saveData(data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
  saveMetaToCloud(data);
}

// Agrega un movimiento (ingreso/gasto/ahorro): lo refleja de inmediato en
// pantalla (optimista) y lo guarda como su propia fila en mieco_transactions.
// Si se pasa "existingData" se reutiliza en vez de releer localStorage (lo
// usa getMonthData al materializar recurrentes, para no pisar cambios que
// ya trae en memoria).
async function addTransaction(monthKey, bucket, item, existingData) {
  const data = existingData || readData();
  data[monthKey] ??= { incomes: [], expenses: [], savings: [] };
  data[monthKey][bucket] ??= [];

  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const localItem = { ...item, id: localId };
  data[monthKey][bucket].push(localItem);
  localStorage.setItem(storageKey, JSON.stringify(data));

  // FASE 2: Si no hay internet, avisamos
  if (!navigator.onLine) {
    showAppToast('Guardado localmente. Se sincronizará al volver a conectar.', 'info');
    return localItem;
  }

  if (currentUserId && supabaseClient) {
    try {
      const { data: row, error } = await supabaseClient.from('mieco_transactions').insert({
        user_id: currentUserId,
        month: monthKey,
        type: TX_BUCKET_TO_TYPE[bucket],
        name: item.name,
        amount: item.amount,
        category: item.category || null,
        payment_type: item.type || null,
        day: item.day || null,
        recurring_id: item.recurringId || null
      }).select().single();

      if (error) throw error;

      const fresh = readData();
      const list = fresh[monthKey]?.[bucket] || [];
      const match = list.find(entry => entry.id === localId);
      if (match) match.id = row.id;
      localStorage.setItem(storageKey, JSON.stringify(fresh));
      
    } catch (err) {
      showAppToast('Error al sincronizar con la nube. El dato queda en este equipo.', 'error');
    }
  }
  return localItem;
}

// Elimina un movimiento por su id. Si todavía no alcanzó a recibir un id
// real de la nube (usuario borró casi al instante de crearlo), se borra
// solo localmente.
function removeTransaction(monthKey, bucket, id) {
  const data = readData();
  if (data[monthKey]?.[bucket]) {
    data[monthKey][bucket] = data[monthKey][bucket].filter(item => String(item.id) !== String(id));
  }
  localStorage.setItem(storageKey, JSON.stringify(data));

  if (currentUserId && supabaseClient && id && !String(id).startsWith('local-')) {
    supabaseClient.from('mieco_transactions').delete().eq('id', id).then(({ error }) => {
      if (error) showAppToast('Mensaje de error', 'error');
    });
  }
}

// Borra en la nube todos los movimientos de un mes de un solo golpe (lo usa
// el botón "Eliminar datos del mes").
function clearMonthTransactionsFromCloud(monthKey) {
  if (!currentUserId || !supabaseClient) return;
  supabaseClient.from('mieco_transactions')
    .delete()
    .eq('user_id', currentUserId)
    .eq('month', monthKey)
    .then(({ error }) => {
      if (error) showAppToast('Mensaje de error', 'error');
    });
}

function updateSyncStatus() {
  const badge = $('syncIndicator');
  const text = $('syncText');
  
  if (!badge || !text) return;

  // Verificación real de navegación
  if (navigator.onLine) {
    // Si hay internet, verificamos que Supabase esté inicializado
    if (supabaseClient) {
      badge.className = 'sync-badge online';
      text.textContent = 'En línea';
      badge.title = 'Sincronizado con la nube';
    }
  } else {
    // ESTADO OFFLINE REAL
    badge.className = 'sync-badge offline';
    text.textContent = 'Modo Local';
    badge.title = 'Sin conexión. Los datos se guardan en este dispositivo.';
    
    // Opcional: Mostrar un aviso pequeño al usuario
    console.warn("Se perdió la conexión. miEco funcionando en modo local.");
  }
}

// Escuchar eventos de conexión
window.addEventListener('online', () => {
  updateSyncStatus();
  // Al volver a estar online, forzamos una lectura de la nube para sincronizar
  if (currentUserData) syncFromCloud(currentUserData);
});

window.addEventListener('offline', updateSyncStatus);


// Detectar cuando el internet se va
window.addEventListener('offline', () => {
  updateSyncStatus();
  showAppToast('Conexión perdida. Los cambios se guardarán localmente.', 'info');
});

// Detectar cuando el internet vuelve
window.addEventListener('online', async () => {
  updateSyncStatus();
  showAppToast('Conexión restaurada. Sincronizando...', 'success');
  
  // Si tenemos sesión, forzamos sincronización al volver el internet
  if (currentUserData) {
    await syncFromCloud(currentUserData);
    render(); // Refrescamos la pantalla por si hubo cambios en la nube
  }
});

// Ejecutar al cargar la app por primera vez
updateSyncStatus();