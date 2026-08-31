// ============================================================
// miEco · Cliente de Supabase + identidad del usuario actual
// (antes vivía todo mezclado al inicio de script.js)
// ============================================================
// Configuración de Supabase
const SUPABASE_URL = 'https://bysiqeokegfemrqkbeqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1Ehn3XkJu98x_X_hgxDZOw_pACLgX9a';

let supabaseClient = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error('No se pudo cargar el SDK de Supabase (window.supabase no está definido).');
}

const $ = id => document.getElementById(id);

// Elementos DOM Autenticación
const authScreen = $('authScreen');
const appMain = $('appMain');
const tabLoginBtn = $('tabLoginBtn');
const tabRegisterBtn = $('tabRegisterBtn');
const loginForm = $('loginForm');
const registerForm = $('registerForm');
const forgotForm = $('forgotForm');
const resetPasswordForm = $('resetPasswordForm');
const authFeedback = $('authFeedback');

let currentUserId = null;
let currentUserData = null;
