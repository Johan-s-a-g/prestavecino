(() => {
  'use strict';

  /* ---------- Datos ---------- */
  const TOOLS = [
    { id: 1, name: 'Taladro inalámbrico', cat: 'Construcción', price: 15000, deposit: 50000, icon: '🔧', avail: 'Lun - Mié', desc: 'Taladro en excelente estado, incluye maletín y accesorios.' },
    { id: 2, name: 'Escalera de aluminio', cat: 'Hogar', price: 12000, deposit: 40000, icon: '🪜', avail: 'Mar - Jue', desc: 'Escalera de 6 pasos, liviana y resistente.' },
    { id: 3, name: 'Pulidora', cat: 'Construcción', price: 18000, deposit: 60000, icon: '⚙️', avail: 'Lun - Vie', desc: 'Pulidora orbital con varios discos incluidos.' },
    { id: 4, name: 'Podadora de césped', cat: 'Jardinería', price: 20000, deposit: 80000, icon: '🌿', avail: 'Sáb - Dom', desc: 'Podadora eléctrica, ideal para zonas verdes pequeñas.' },
    { id: 5, name: 'Manguera 20 m', cat: 'Jardinería', price: 8000, deposit: 20000, icon: '🚿', avail: 'Lun - Dom', desc: 'Manguera con pistola de riego ajustable.' },
    { id: 6, name: 'Aspiradora industrial', cat: 'Hogar', price: 10000, deposit: 30000, icon: '🧹', avail: 'Mié - Vie', desc: 'Aspira sólidos y líquidos. Incluye accesorios.' }
  ];

  const OWNERS = { 1: 'Carlos · Apto 302', 2: 'Marta · Apto 105', 3: 'Andrés · Apto 401', 4: 'Laura · Apto 210', 5: 'Jorge · Apto 203', 6: 'Sofía · Apto 504' };
  TOOLS.forEach(t => { t.owner = OWNERS[t.id]; });

  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
  };

  const state = {
    user: store.get('pv_user', null),
    favs: store.get('pv_favs', []),
    loan: store.get('pv_loan', null),
    notifs: store.get('pv_notifs', []),
    cat: 'Todas',
    query: '',
    favsOnly: false,
    current: 'home',
    history: [],
    selected: null,
    days: 1,
    mode: 'login'
  };

  // Herramientas publicadas por los vecinos (guardadas en el navegador)
  store.get('pv_mytools', []).forEach(t => TOOLS.push(t));

  const PROTECTED = ['tools', 'detail', 'confirm', 'notifications', 'loan', 'publish'];
  const TAB_VIEWS = ['tools', 'notifications', 'loan'];

  /* ---------- Utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = n => '$' + n.toLocaleString('es-CO');
  const byId = id => TOOLS.find(t => t.id === id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = iso => {
    const t = new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString(); };

  function ago(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'Ahora';
    if (m < 60) return `Hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Hace ${h} h`;
    return h < 48 ? 'Ayer' : `Hace ${Math.floor(h / 24)} d`;
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2400);
  }

  function addNotif(icon, title, text) {
    state.notifs.unshift({ icon, title, text, ts: Date.now(), read: false });
    store.set('pv_notifs', state.notifs);
    updateBadge();
  }

  function updateBadge() {
    const unread = state.notifs.filter(n => !n.read).length;
    const b = $('#notifBadge');
    b.textContent = unread;
    b.hidden = unread === 0 || !state.user;
  }

  /* ---------- Navegación ---------- */
  function go(view, { push = true } = {}) {
    if (view === 'favorites') { state.favsOnly = true; view = 'tools'; }
    else if (view === 'tools') { state.favsOnly = false; }

    if (PROTECTED.includes(view) && !state.user) {
      toast('Inicia sesión para continuar');
      view = 'login';
    }
    if (push && state.current !== view) state.history.push(state.current);
    state.current = view;

    $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === view));
    $('#menu').classList.remove('is-open');
    $('#btnMenu').setAttribute('aria-expanded', 'false');
    $('#btnBack').hidden = view === 'home';

    if (view === 'tools') renderTools();
    if (view === 'notifications') renderNotifs();
    if (view === 'loan') renderLoan();

    // Barra inferior
    const showTabs = state.user && TAB_VIEWS.includes(view);
    $('#tabbar').hidden = !showTabs;
    const activeTab = view === 'tools' && state.favsOnly ? 'favorites' : view;
    $$('#tabbar button').forEach(b => b.classList.toggle('is-active', b.dataset.tab === activeTab));

    window.scrollTo({ top: 0 });
  }

  function back() {
    const prev = state.history.pop();
    go(prev && prev !== state.current ? prev : 'home', { push: false });
  }

  /* ---------- Sesión ---------- */
  function setMode(mode) {
    state.mode = mode;
    const reg = mode === 'register';
    $('#loginTitle').textContent = reg ? 'Crear cuenta' : 'Iniciar sesión';
    $('#loginSub').textContent = reg ? 'Únete a tu comunidad' : 'Accede a tu cuenta';
    $('#loginSubmit').textContent = reg ? 'Registrarme' : 'Entrar';
    $('#nameField').hidden = !reg;
    $('#switchMode').textContent = reg ? '¿Ya tienes cuenta? Iniciar sesión' : '¿No tienes cuenta? Crear cuenta';
    $('#loginError').hidden = true;
  }

  function login(name, email) {
    state.user = { name: name || email.split('@')[0], email };
    store.set('pv_user', state.user);
    if (!state.notifs.length) addNotif('🛡️', 'Tu cuenta fue aprobada', '¡Bienvenido a PrestaVecino!');
    $('#btnLogout').hidden = false;
    updateBadge();
    state.history = [];
    go('tools', { push: false });
    toast(`¡Hola, ${state.user.name}!`);
  }

  function logout() {
    state.user = null;
    localStorage.removeItem('pv_user');
    $('#btnLogout').hidden = true;
    updateBadge();
    state.history = [];
    go('home', { push: false });
  }

  /* ---------- Herramientas ---------- */
  function renderTools() {
    const q = state.query.trim().toLowerCase();
    const list = TOOLS.filter(t =>
      (state.cat === 'Todas' || t.cat === state.cat) &&
      (!state.favsOnly || state.favs.includes(t.id)) &&
      (!q || t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q))
    );
    $('#toolsTitle').hidden = !state.favsOnly;
    $('#toolsEmpty').hidden = list.length > 0;
    $('#toolsEmpty').textContent = state.favsOnly ? 'Aún no tienes favoritos. Toca el corazón en una herramienta.' : 'No encontramos herramientas con ese filtro.';
    $('#toolList').innerHTML = list.map(t => `
      <div class="tool" data-open="${t.id}">
        <div class="tool__img" aria-hidden="true">${t.icon}</div>
        <div class="tool__info">
          <div class="tool__name">${t.name}</div>
          <div class="tool__price">${money(t.price)} / día</div>
          <div class="tool__dep">🛡️ Depósito: ${money(t.deposit)}</div>
          <div class="tool__owner">👤 ${esc(t.owner)}</div>
        </div>
        <button class="btn btn--primary btn--sm" data-open="${t.id}">Agregar</button>
      </div>`).join('');
  }

  function openDetail(id) {
    state.selected = byId(id);
    state.days = 1;
    renderDetail();
    go('detail');
  }

  function renderDetail() {
    const t = state.selected;
    const fav = state.favs.includes(t.id);
    $('#detailBox').innerHTML = `
      <div class="detail__img" aria-hidden="true">${t.icon}</div>
      <div class="detail__body">
        <div class="row-between">
          <div>
            <h1>${t.name}</h1>
            <h2>${money(t.price)} / día</h2>
          </div>
          <button class="heart" id="btnFav" aria-label="Favorito" aria-pressed="${fav}">${fav ? '♥' : '♡'}</button>
        </div>
        <div class="detail__row">👤 <span>Presta: <b>${esc(t.owner)}</b></span></div>
        <div class="detail__row">🛡️ <span>Depósito de garantía: <b>${money(t.deposit)}</b></span></div>
        <div class="detail__row">📅 <span><b>Disponibilidad</b><br>Esta semana: ${t.avail}</span></div>
        <div class="detail__row"><span><b>Descripción</b><br><span class="muted">${t.desc}</span></span></div>
        <div class="detail__actions">
          <div class="stepper" aria-label="Días de préstamo">
            <button id="dayMinus" aria-label="Menos días">−</button>
            <span id="dayCount">${state.days}</span>
            <button id="dayPlus" aria-label="Más días">+</button>
          </div>
          <button class="btn btn--primary" id="btnRequest">Agregar a la lista</button>
        </div>
        <p class="muted small" id="dayHint">${state.days} día(s) · Total estimado: ${money(t.price * state.days)}</p>
      </div>`;
  }

  function updateDays(delta) {
    state.days = Math.min(7, Math.max(1, state.days + delta));
    $('#dayCount').textContent = state.days;
    $('#dayHint').textContent = `${state.days} día(s) · Total estimado: ${money(state.selected.price * state.days)}`;
  }

  function requestLoan() {
    if (state.selected.ownerEmail && state.selected.ownerEmail === state.user.email) { toast('Esta herramienta es tuya'); return; }
    if (state.loan) { toast('Ya tienes un préstamo activo. Devuélvelo primero.'); return; }
    const start = new Date().toISOString();
    state.loan = { toolId: state.selected.id, days: state.days, start, end: addDays(start, state.days - 1) };
    store.set('pv_loan', state.loan);
    addNotif('📅', 'Solicitud confirmada', `Tu préstamo de ${state.selected.name} ha sido aprobado.`);
    addNotif('ℹ️', 'Recordatorio de devolución', `Recuerda devolver la herramienta el ${fmtDate(state.loan.end)}.`);
    $('#confirmBox').innerHTML = `
      <strong>Detalles de tu solicitud:</strong>
      ${state.selected.icon} ${state.selected.name} · ${state.days} día(s)`;
    go('confirm');
  }

  /* ---------- Notificaciones ---------- */
  function renderNotifs() {
    $('#notifEmpty').hidden = state.notifs.length > 0;
    $('#notifList').innerHTML = state.notifs.map(n => `
      <li class="notif">
        <span class="notif__icon">${n.icon}</span>
        <div class="notif__body">
          <div class="notif__top"><span>${esc(n.title)}</span><span class="notif__time">${ago(n.ts)}</span></div>
          <div class="notif__text">${esc(n.text)}</div>
        </div>
      </li>`).join('');
    state.notifs.forEach(n => (n.read = true));
    store.set('pv_notifs', state.notifs);
    updateBadge();
  }

  /* ---------- Préstamo activo ---------- */
  function renderLoan() {
    const box = $('#loanBox');
    if (!state.loan) {
      box.innerHTML = `
        <div class="card center">
          <p class="muted">No tienes préstamos activos.</p>
          <button class="btn btn--primary" data-nav="tools">Ver herramientas</button>
        </div>`;
      return;
    }
    const t = byId(state.loan.toolId);
    box.innerHTML = `
      <div class="loan">
        <div class="loan__head">
          <div class="tool__img" aria-hidden="true">${t.icon}</div>
          <div>
            <div class="tool__name">${t.name}</div>
            <div class="tool__price">${money(t.price)} / día</div>
            <span class="status">✔ En curso</span>
          </div>
        </div>
        <div class="loan__dates">
          <span>📅 Desde: ${fmtDate(state.loan.start)}</span>
          <span>🗓️ Hasta: ${fmtDate(state.loan.end)}</span>
        </div>
        <button class="btn btn--outline" id="btnReturn">Solicitar devolución</button>
      </div>
      <div class="extend">
        <b>¿Necesitas extender el plazo?</b>
        <span class="muted">Puedes solicitar una extensión desde aquí.</span>
        <button class="link-btn" id="btnExtend" style="text-align:left">Solicitar extensión</button>
      </div>`;
  }

  function returnLoan() {
    const t = byId(state.loan.toolId);
    state.loan = null;
    localStorage.removeItem('pv_loan');
    addNotif('✅', 'Devolución registrada', `Gracias por devolver ${t.name}.`);
    go('returned');
  }

  function extendLoan() {
    if (state.loan.days >= 7) { toast('Alcanzaste el máximo de 7 días'); return; }
    state.loan.days += 1;
    state.loan.end = addDays(state.loan.end, 1);
    store.set('pv_loan', state.loan);
    addNotif('ℹ️', 'Extensión aprobada', `Tu nuevo plazo termina el ${fmtDate(state.loan.end)}.`);
    renderLoan();
    toast('Plazo extendido un día');
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) { e.stopPropagation(); return openDetail(Number(open.dataset.open)); }

    const nav = e.target.closest('[data-nav]');
    if (nav) {
      e.preventDefault();
      if (nav.dataset.mode) setMode(nav.dataset.mode);
      return go(nav.dataset.nav);
    }

    const id = e.target.closest('button, a')?.id;
    switch (id) {
      case 'btnBack': return back();
      case 'btnMenu': {
        const m = $('#menu');
        const o = m.classList.toggle('is-open');
        return $('#btnMenu').setAttribute('aria-expanded', o);
      }
      case 'btnLogout': e.preventDefault(); return logout();
      case 'togglePass': {
        const p = $('#password');
        p.type = p.type === 'password' ? 'text' : 'password';
        return;
      }
      case 'btnGoogle': return login('Vecino', 'vecino@gmail.com');
      case 'forgot': e.preventDefault(); return toast('Te enviaremos un enlace a tu correo (demo)');
      case 'switchMode': e.preventDefault(); return setMode(state.mode === 'login' ? 'register' : 'login');
      case 'dayMinus': return updateDays(-1);
      case 'dayPlus': return updateDays(1);
      case 'btnRequest': return requestLoan();
      case 'btnFav': {
        const i = state.favs.indexOf(state.selected.id);
        i >= 0 ? state.favs.splice(i, 1) : state.favs.push(state.selected.id);
        store.set('pv_favs', state.favs);
        const on = i < 0;
        $('#btnFav').textContent = on ? '♥' : '♡';
        $('#btnFav').setAttribute('aria-pressed', on);
        return toast(on ? 'Agregada a favoritos' : 'Quitada de favoritos');
      }
      case 'clearNotifs':
        state.notifs = [];
        store.set('pv_notifs', state.notifs);
        updateBadge();
        return renderNotifs();
      case 'btnReturn': return returnLoan();
      case 'btnExtend': return extendLoan();
    }

    const chip = e.target.closest('.chip');
    if (chip) {
      state.cat = chip.dataset.cat;
      $$('.chip').forEach(c => c.classList.toggle('is-active', c === chip));
      renderTools();
    }
  });

  $('#search').addEventListener('input', e => { state.query = e.target.value; renderTools(); });

  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const pass = $('#password').value;
    const name = $('#name').value.trim();
    const err = $('#loginError');
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Escribe un correo válido.'; err.hidden = false; return; }
    if (pass.length < 4) { err.textContent = 'La contraseña debe tener al menos 4 caracteres.'; err.hidden = false; return; }
    if (state.mode === 'register' && !name) { err.textContent = 'Escribe tu nombre.'; err.hidden = false; return; }
    err.hidden = true;
    $('#loginForm').reset();
    login(name, email);
  });

  $('#publishForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#pName').value.trim();
    const price = Number($('#pPrice').value);
    const deposit = Number($('#pDeposit').value);
    const err = $('#publishError');
    if (!name) { err.textContent = 'Escribe el nombre de la herramienta.'; err.hidden = false; return; }
    if (!(price > 0)) { err.textContent = 'Indica un precio por día mayor a 0.'; err.hidden = false; return; }
    if (!(deposit >= 0) || $('#pDeposit').value === '') { err.textContent = 'Indica el valor del depósito de garantía.'; err.hidden = false; return; }
    err.hidden = true;

    const tool = {
      id: Date.now(),
      name,
      cat: $('#pCat').value,
      price,
      deposit,
      icon: $('#pIcon').value,
      avail: $('#pAvail').value.trim() || 'Consultar con el vecino',
      desc: $('#pDesc').value.trim() || 'Sin descripción.',
      owner: state.user.name,
      ownerEmail: state.user.email
    };
    TOOLS.push(tool);
    store.set('pv_mytools', TOOLS.filter(t => t.ownerEmail));
    $('#publishForm').reset();

    state.cat = 'Todas';
    state.query = '';
    $('#search').value = '';
    $$('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.cat === 'Todas'));
    state.history = [];
    go('tools', { push: false });
    toast('¡Herramienta publicada!');
  });

  /* ---------- Inicio ---------- */
  $('#btnLogout').hidden = !state.user;
  updateBadge();
  go(state.user ? 'tools' : 'home', { push: false });
})();
