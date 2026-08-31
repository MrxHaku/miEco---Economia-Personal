// ============================================================
// miEco · Flujo de autenticación (login, registro, recuperar
// contraseña, cierre de sesión, estado de la sesión).
// ============================================================

// Función para procesar la compra
async function purchasePackage(packageType) {
  try {
    const offerings = await purchases.getOfferings();
    
    if (offerings.current !== null && offerings.current[packageType] !== null) {
      const packageToBuy = offerings.current[packageType];
      
      showAppToast("Abriendo pasarela de pago...", "info");
      
      // 1. Ejecutar la compra en RevenueCat
      const { customerInfo } = await purchases.purchasePackage(packageToBuy);

      // 2. Verificar si se activó el plan PRO en RevenueCat
      if (customerInfo.entitlements.active["pro"]) {
        
        // --- AQUÍ ESTÁ EL TRUCO: ACTUALIZAR SUPABASE ---
        const { error } = await supabaseClient
          .from('profiles')
          .update({ plan_type: 'pro' })
          .eq('id', currentUserId); // currentUserId es el id del usuario logueado

        if (error) {
          console.error("Error actualizando Supabase:", error.message);
          showAppToast("Pago exitoso, pero hubo un error sincronizando. Contacta a soporte.", "error");
        } else {
          isUserPro = true;
          updateProUI();
          if($('paywallModal')) $('paywallModal').close();
          showAppToast("¡Felicidades! Ahora eres miEco Pro ✨", "success");
        }
      }
    }
  } catch (e) {
    if (!e.userCancelled) {
      showAppToast("Error en la compra: " + e.message, "error");
    }
  }
}

// Vincular botones del Modal de Pago
if($('subscribeMonthly')) {
    $('subscribeMonthly').onclick = () => purchasePackage('monthly');
}
if($('subscribeAnnual')) {
    $('subscribeAnnual').onclick = () => purchasePackage('annual');
}


async function checkAndSuggestPasskey(user) {
  console.log("Revisando condiciones para Passkey...");

  // 1. Verificamos soporte
  if (!window.PublicKeyCredential) {
    console.warn("Este dispositivo/navegador no soporta Passkeys.");
    return;
  }

  // 2. Revisamos si ya lo sugerimos
  const hasBeenSuggested = localStorage.getItem(`passkey-suggested-${user.id}`);
  if (hasBeenSuggested) {
    console.log("Passkey ya fue sugerido anteriormente.");
    return;
  }

  // 3. Revisamos confirmación de email (Solo para proveedores de email)
  const isEmailProvider = user.app_metadata.provider === 'email';
  const isConfirmed = user.email_confirmed_at;
  
  // FASE 2 FIX: Si es Google/Apple, asumimos confirmado. Si es email, debe estar confirmado.
  if (isEmailProvider && !isConfirmed) {
    console.log("Email no confirmado, no sugerimos Passkey aún.");
    return;
  }

  // 4. Mostrar modal
  console.log("Mostrando sugerencia de Passkey...");
  setTimeout(() => {
    const modal = $('passkeySuggestionModal');
    if (modal) modal.showModal();
  }, 2000); // 2 segundos después de entrar
}


function setAuthFeedback(message, type) {
  if (!authFeedback) return;
  authFeedback.textContent = message;
  authFeedback.className = type ? `auth-feedback ${type}` : 'auth-feedback';
}

function showAuthScreen() {
  authScreen?.classList.remove('hidden');
  appMain?.classList.add('hidden');
}

// Variable global para RevenueCat
let purchases;

async function setupRevenueCat(userId) {
  try {
    // Inicializamos la conexión
    purchases = await Purchases.configure({
      apiKey: "TU_API_KEY_AQUI", // Pega aquí tu código test_...
      appUserId: userId, // VINCULAMOS EL ID DE SUPABASE
    });

    console.log("RevenueCat listo para el usuario:", userId);
    
    // Revisar si ya tiene el plan Pro según RevenueCat
    const customerInfo = await purchases.getCustomerInfo();
    if (customerInfo.entitlements.active["pro"]) {
       isUserPro = true;
       updateProUI();
    }
  } catch (e) {
    console.error("Error al conectar con RevenueCat", e);
  }
}

// Modifica tu función showApp para que lo active
async function showApp(user) {
  currentUserId = user.id;
  authScreen?.classList.add('hidden');
  appMain?.classList.remove('hidden');

  await fetchRealUsdRate();
  await syncFromCloud(user);
  
  // FASE 4: Iniciar RevenueCat con el ID del usuario
  await setupRevenueCat(user.id);
  
  // Luego revisamos el plan en Supabase (como respaldo)
  await checkSubscriptionStatus(); 
  
  render();
}

async function checkAndSuggestPasskey(user) {
  // 1. Verificamos si el navegador soporta Passkeys
  if (!window.PublicKeyCredential) return;

  // 2. Revisamos si ya lo sugerimos antes (para no ser molestos)
  const hasBeenSuggested = localStorage.getItem(`passkey-suggested-${user.id}`);
  if (hasBeenSuggested) return;

  // 3. Revisamos si el correo está confirmado (condición que pediste)
  const isConfirmed = user.email_confirmed_at;
  if (!isConfirmed) return;

  // 4. Si todo lo anterior se cumple, mostramos el modal tras un pequeño delay
  setTimeout(() => {
    $('passkeySuggestionModal').showModal();
  }, 1500);
}

// Inicio de sesión con Google / Apple. Requiere que estos proveedores
// estén habilitados en Supabase → Authentication → Providers, con sus
// credenciales de OAuth configuradas; si no, Supabase devuelve un error
// claro que se muestra en pantalla en vez de fallar en silencio.
function wireSocialButton(id, provider) {
  const btn = $(id);
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault(); // Evita cualquier comportamiento por defecto del formulario
    e.stopPropagation(); // Evita que el clic "suba" a otros elementos

    if (!supabaseClient) {
      setAuthFeedback('No se pudo conectar con el servicio de autenticación.', 'error');
      return;
    }

    // Calculamos la URL actual para que siempre regrese al index
    const returnUrl = window.location.origin + window.location.pathname;

    const { error } = await supabaseClient.auth.signInWithOAuth({ 
      provider,
      options: {
        redirectTo: returnUrl // <--- ESTO ASEGURA QUE VUELVA AQUÍ
      }
    });
    
    if (error) setAuthFeedback(error.message, 'error');
  });
}

wireSocialButton('googleAuthButton', 'google');
wireSocialButton('appleAuthButton', 'apple');
wireSocialButton('googleAuthButtonRegister', 'google');
wireSocialButton('appleAuthButtonRegister', 'apple');

if (tabLoginBtn && tabRegisterBtn && loginForm && registerForm) {
  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    forgotForm?.classList.add('hidden');
    resetPasswordForm?.classList.add('hidden');
    setAuthFeedback('');
  });

  tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    forgotForm?.classList.add('hidden');
    resetPasswordForm?.classList.add('hidden');
    setAuthFeedback('');
  });
}

if ($('forgotPasswordLink')) {
  $('forgotPasswordLink').addEventListener('click', () => {
    loginForm?.classList.add('hidden');
    registerForm?.classList.add('hidden');
    forgotForm?.classList.remove('hidden');
    setAuthFeedback('');
  });
}

if ($('backToLoginLink')) {
  $('backToLoginLink').addEventListener('click', () => tabLoginBtn?.click());
}

if (forgotForm) {
  forgotForm.addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('forgotEmail')?.value.trim() || '';
    if (!email) {
      setAuthFeedback('Escribe tu correo electrónico.', 'error');
      return;
    }
    if (!supabaseClient) {
      setAuthFeedback('No se pudo conectar con el servicio de autenticación.', 'error');
      return;
    }
    setAuthFeedback('Enviando enlace...');
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href.split('#')[0].split('?')[0]
      });
      if (error) {
        setAuthFeedback(error.message, 'error');
        return;
      }
      setAuthFeedback('Listo. Revisa tu correo para continuar con el restablecimiento.', 'success');
      forgotForm.reset();
    } catch (error) {
      setAuthFeedback('No se pudo conectar. Intenta de nuevo.', 'error');
    }
  });
}

if (resetPasswordForm) {
  resetPasswordForm.addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('newPassword')?.value || '';
    if (!password || password.length < 6) {
      setAuthFeedback('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }
    if (!supabaseClient) {
      setAuthFeedback('No se pudo conectar con el servicio de autenticación.', 'error');
      return;
    }
    setAuthFeedback('Guardando nueva contraseña...');
    try {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) {
        setAuthFeedback(error.message, 'error');
        return;
      }
      setAuthFeedback('Contraseña actualizada. Entrando...', 'success');
      resetPasswordForm.reset();
      resetPasswordForm.classList.add('hidden');
      checkUserSession();
    } catch (error) {
      setAuthFeedback('No se pudo conectar. Intenta de nuevo.', 'error');
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('registerEmail')?.value.trim() || '';
    const password = $('registerPassword')?.value || '';
    const name = $('registerName')?.value.trim() || '';

    if (!email || !password || !name) {
      setAuthFeedback('Por favor completa todos los campos.', 'error');
      return;
    }
    setAuthFeedback('Creando cuenta...');
    try {
      const { error } = await supabaseClient.auth.signUp({
        email, password, options: { data: { full_name: name } }
      });
      if (error) {
        setAuthFeedback(error.message, 'error');
        return;
      }
      setAuthFeedback('¡Cuenta creada con éxito! Ya puedes iniciar sesión.', 'success');
      registerForm.reset();
      setTimeout(() => tabLoginBtn?.click(), 1500);
    } catch (error) {
      setAuthFeedback('No se pudo conectar. Intenta de nuevo.', 'error');
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('loginEmail')?.value.trim() || '';
    const password = $('loginPassword')?.value || '';

    if (!email || !password) {
      setAuthFeedback('Ingresa tu correo y contraseña.', 'error');
      return;
    }
    setAuthFeedback('Iniciando sesión...');
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthFeedback('Credenciales incorrectas o correo no confirmado.', 'error');
        return;
      }
      setAuthFeedback('');
      loginForm.reset();
      checkUserSession();
    } catch (error) {
      setAuthFeedback('No se pudo conectar. Intenta de nuevo.', 'error');
    }
  });
}

if ($('logoutButton')) {
  $('logoutButton').addEventListener('click', async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
    currentUserId = null;
    showAuthScreen();
  });
}

// Acción para reenviar el correo de verificación
if ($('resendVerifyEmail')) {
  $('resendVerifyEmail').addEventListener('click', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user?.email) return;

    const { error } = await supabaseClient.auth.resend({
      type: 'signup',
      email: session.user.email
    });

    if (error) {
      showAppToast('Error: ' + error.message, 'error');
    } else {
      showAppToast('¡Correo de verificación enviado! Revisa tu bandeja de entrada.', 'success');
    }
  });
}

async function checkUserSession() {
  if (!supabaseClient) {
    showAuthScreen();
    return;
  }

  const { data: { session }, error } = await supabaseClient.auth.getSession();
  
  if (error) {
    console.error('Error al recuperar sesión:', error.message);
    showAuthScreen();
    return;
  }

  if (session?.user) {
    // --- LÓGICA FASE 2: VERIFICACIÓN DE EMAIL ---
    // Si el usuario entró por Google o Apple, el proveedor NO es 'email' y suelen estar verificados.
    // Si entró por correo/contraseña, revisamos email_confirmed_at.
    const user = session.user;
    const isEmailProvider = user.app_metadata.provider === 'email';
    const isConfirmed = user.email_confirmed_at;

    if (isEmailProvider && !isConfirmed) {
      // Mostrar banner si es cuenta de correo y no está confirmada
      $('emailVerifyBanner').classList.remove('hidden');
    } else {
      // Ocultar banner si ya está confirmado o es redes sociales
      $('emailVerifyBanner').classList.add('hidden');
    }
    // --------------------------------------------

    await showApp(user);
  } else {
    currentUserId = null;
    showAuthScreen();
  }
}

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      loginForm?.classList.add('hidden');
      registerForm?.classList.add('hidden');
      forgotForm?.classList.add('hidden');
      resetPasswordForm?.classList.remove('hidden');
      authScreen?.classList.remove('hidden');
      appMain?.classList.add('hidden');
      setAuthFeedback('Ingresa tu nueva contraseña para continuar.');
      return;
    }
    if (session?.user) {
      showApp(session.user);
    } else {
      currentUserId = null;
      showAuthScreen();
    }
  });
}

// --- FASE 2: LÓGICA DE PASSKEYS ---

// 1. Iniciar sesión con Passkey
if ($('passkeySignInBtn')) {
  $('passkeySignInBtn').addEventListener('click', async () => {
    try {
      setAuthFeedback('Verificando identidad...');
      const { data, error } = await supabaseClient.auth.signInWithPasskey();
      
      if (error) throw error;
      
      showAppToast('¡Bienvenido de nuevo!', 'success');
      // La sesión se actualiza automáticamente por el onAuthStateChange
    } catch (error) {
      setAuthFeedback('No se pudo iniciar sesión con llave de acceso.', 'error');
      console.error('Passkey Signin Error:', error.message);
    }
  });
}

// 2. Registrar (vincular) Passkey desde el perfil
if ($('registerPasskeyBtn')) {
  $('registerPasskeyBtn').addEventListener('click', async () => {
    try {
      // Verificar si el navegador soporta WebAuthn
      if (!window.PublicKeyCredential) {
        showAppToast('Tu navegador no soporta llaves de acceso.', 'error');
        return;
      }

      showAppToast('Sigue las instrucciones de tu dispositivo...', 'info');
      
      const { data, error } = await supabaseClient.auth.linkPasskey();
      
      if (error) throw error;

      showAppToast('¡Llave de acceso configurada con éxito!', 'success');
    } catch (error) {
      showAppToast('Error al configurar: ' + error.message, 'error');
      console.error('Passkey Registration Error:', error.message);
    }
  });
}

if ($('activatePasskeyNow')) {
  $('activatePasskeyNow').addEventListener('click', async () => {
    $('passkeySuggestionModal').close();
    
    // Marcamos que ya se intentó configurar para no volver a preguntar
    localStorage.setItem(`passkey-suggested-${currentUserData.id}`, 'true');

    try {
      showAppToast('Sigue los pasos en tu dispositivo...', 'info');
      const { error } = await supabaseClient.auth.linkPasskey();
      if (error) throw error;
      showAppToast('¡FaceID/Huella activado con éxito!', 'success');
    } catch (err) {
      showAppToast('No se pudo configurar: ' + err.message, 'error');
    }
  });
}

// Si el usuario cierra el modal sin configurar, también marcamos para no molestar
$('passkeySuggestionModal').addEventListener('close', () => {
    if (currentUserData) {
        localStorage.setItem(`passkey-suggested-${currentUserData.id}`, 'true');
    }
});