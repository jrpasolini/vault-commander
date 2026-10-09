const MONTHS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

let screen = 'years';
let years = [], months = [], entries = [];
let selected = 0, year = null, month = null, viewer = null, status = null;
let modal = null;

const app = document.querySelector('#app');

const prefs = {
  compact: localStorage.getItem('vc.compact') === '1',
  highlightLinks: localStorage.getItem('vc.highlightLinks') !== '0',
  showSystem: localStorage.getItem('vc.showSystem') !== '0',
  blinkCursor: localStorage.getItem('vc.blinkCursor') !== '0'
};

async function api(url) {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function currentItems() {
  if (screen === 'years') return years;
  if (screen === 'months') return months;
  if (screen === 'entries') return entries;
  return [];
}

function currentPath() {
  if (screen === 'years') return 'C:\\DIARIUM';
  if (screen === 'months') return `C:\\DIARIUM\\${year}`;
  if (screen === 'entries') return `C:\\DIARIUM\\${year}\\${String(month).padStart(2,'0')}`;
  return `VIEW:${viewer?.title || ''}`;
}

function currentTitle() {
  if (screen === 'years') return 'Arquivo canônico';
  if (screen === 'months') return `Ano ${year}`;
  if (screen === 'entries') return `${MONTHS[month - 1]} ${year}`;
  return viewer?.title || 'Visualizador';
}

function detailFor(item) {
  if (screen === 'years' || screen === 'months') return '<DIR>';
  return item.date;
}

function labelFor(item) {
  if (screen === 'years') return String(item);
  if (screen === 'months') return `${String(item).padStart(2,'0')}  ${MONTHS[item - 1]}`;
  return item.title;
}

function listHtml() {
  const items = currentItems();
  if (!items.length) return '<p class="empty">Nenhum registro encontrado.</p>';

  return items.map((item, i) => `
    <button class="row ${i === selected ? 'active' : ''}" data-i="${i}" type="button">
      <span class="row-marker">${i === selected ? '►' : ' '}</span>
      <span class="row-label">${esc(labelFor(item))}</span>
      <span class="row-detail">${esc(detailFor(item))}</span>
    </button>`).join('');
}

function toggleHtml(id, label, checked) {
  return `
    <label class="toggle-line" for="${id}">
      <span class="switch ${checked ? 'on' : ''}" aria-hidden="true"><span></span></span>
      <input id="${id}" type="checkbox" ${checked ? 'checked' : ''}>
      <span>${esc(label)}</span>
    </label>`;
}

function modalHtml() {
  if (!modal) return '';

  if (modal === 'settings') {
    return `
      <div class="modal-layer" role="presentation">
        <section class="retro-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="dialog-title" id="settings-title">Gerenciar configurações</div>
          <div class="dialog-copy">
            Estas opções afetam apenas a interface local do Vault Commander. O acervo continua em modo somente leitura e nenhuma preferência altera arquivos do Vault.
          </div>
          <div class="settings-grid">
            ${toggleHtml('cfg-system', 'Painel de sistema', prefs.showSystem)}
            ${toggleHtml('cfg-links', 'Destacar wikilinks', prefs.highlightLinks)}
            ${toggleHtml('cfg-compact', 'Modo compacto', prefs.compact)}
            ${toggleHtml('cfg-blink', 'Cursor piscando', prefs.blinkCursor)}
          </div>
          <div class="dialog-actions">
            <button class="retro-button primary" data-action="save-settings">Aceitar selecionados</button>
            <button class="retro-button" data-action="close-modal">Cancelar</button>
          </div>
        </section>
      </div>`;
  }

  if (modal === 'help') {
    return `
      <div class="modal-layer" role="presentation">
        <section class="retro-dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div class="dialog-title" id="help-title">Ajuda do Vault Commander</div>
          <div class="help-table">
            <span>↑ / ↓</span><b>Selecionar item</b>
            <span>Enter / F3</span><b>Abrir seleção</b>
            <span>Esc</span><b>Voltar / fechar janela</b>
            <span>F2</span><b>Retornar ao índice canônico</b>
            <span>F9</span><b>Configurações</b>
            <span>Mouse</span><b>Também suportado</b>
          </div>
          <div class="dialog-actions"><button class="retro-button primary" data-action="close-modal">OK</button></div>
        </section>
      </div>`;
  }

  if (modal === 'search') {
    return `
      <div class="modal-layer" role="presentation">
        <section class="retro-dialog search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
          <div class="dialog-title" id="search-title">Buscar no acervo</div>
          <div class="dialog-copy">A busca global entra na próxima etapa. A janela já está definida na linguagem visual da aplicação.</div>
          <label class="field-line">Texto <input class="retro-input" type="text" value="" autofocus></label>
          <div class="settings-grid mini">
            ${toggleHtml('search-canonical', 'Canônico', true)}
            ${toggleHtml('search-wiki', 'Wiki', false)}
          </div>
          <div class="dialog-actions">
            <button class="retro-button primary" data-action="search-not-yet">Buscar</button>
            <button class="retro-button" data-action="close-modal">Cancelar</button>
          </div>
        </section>
      </div>`;
  }

  return '';
}

function render() {
  const items = currentItems();
  const count = screen === 'viewer' ? 1 : items.length;
  const mainContent = screen === 'viewer'
    ? `<article class="viewer ${prefs.highlightLinks ? '' : 'plain-links'}">${viewer.html}</article>`
    : `<div class="file-list" role="listbox" aria-label="${esc(currentTitle())}">${listHtml()}</div>`;

  app.innerHTML = `
    <main class="dos-screen ${prefs.compact ? 'is-compact' : ''}">
      <div class="bootline"><span>C:\\&gt;</span> VAULTCMD.EXE <span class="cursor ${prefs.blinkCursor ? 'blink' : ''}">_</span></div>

      <section class="retro-window" aria-label="Vault Commander">
        <div class="window-title">Vault Commander 0.3</div>

        <div class="intro-copy">
          Navegador local para o acervo canônico em Markdown. Use teclado ou mouse para navegar. O Vault é acessado exclusivamente em modo de leitura.
        </div>

        <div class="menu-line" aria-label="Menu principal">
          <button data-action="canonical"><u>A</u>rquivo</button>
          <button data-action="open"><u>N</u>avegar</button>
          <button data-action="open"><u>E</u>xibir</button>
          <button data-action="wiki"><u>W</u>iki</button>
          <button data-action="settings"><u>O</u>pções</button>
          <button data-action="help">A<u>j</u>uda</button>
        </div>

        <div class="path-line"><span>${esc(currentPath())}</span><span>${status?.demo ? 'DEMO' : 'VAULT'} · R/O</span></div>

        <section class="content-grid ${prefs.showSystem ? '' : 'no-system'}">
          ${prefs.showSystem ? `
            <aside class="retro-group system-group">
              <div class="group-title">Sistema</div>
              <div class="system-lines">
                <p><b>FONTE</b><span>${status?.demo ? 'BASE DE TESTE' : 'VAULT LOCAL'}</span></p>
                <p><b>MODO</b><span>READ ONLY</span></p>
                <p><b>REGISTROS</b><span>${status?.entries ?? 0}</span></p>
                <p><b>ÁREA</b><span>CANÔNICO</span></p>
              </div>
            </aside>` : ''}

          <section class="retro-group archive-group">
            <div class="group-title">${esc(currentTitle())}</div>
            ${mainContent}
          </section>
        </section>

        <div class="info-line">
          <span>${count} item(ns)</span>
          <span>↑↓ selecionar · Enter abrir · Esc voltar</span>
        </div>

        <div class="action-row">
          <button class="retro-button primary" data-action="open">Abrir</button>
          <button class="retro-button" data-action="settings">Configurações</button>
        </div>

        <div class="function-strip" aria-label="Teclas de função">
          <button data-action="help"><span>F1</span>Ajuda</button>
          <button data-action="canonical"><span>F2</span>Canônico</button>
          <button data-action="open" class="active"><span>F3</span>Ver</button>
          <button data-action="wiki"><span>F4</span>Wiki</button>
          <button data-action="search"><span>F7</span>Buscar</button>
          <button data-action="settings"><span>F9</span>Opções</button>
          <button data-action="exit"><span>F10</span>Sair</button>
        </div>
      </section>

      <div class="copyright">Vault Commander · Personal Archive Navigator · 2026</div>
      ${modalHtml()}
    </main>`;

  bindUI();
}

function bindUI() {
  document.querySelectorAll('.row').forEach(b => b.addEventListener('click', async () => {
    selected = +b.dataset.i;
    await openSelected();
  }));

  document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', async () => {
    const action = b.dataset.action;
    if (action === 'open') await openSelected();
    if (action === 'canonical') goCanonical();
    if (action === 'settings') { modal = 'settings'; render(); }
    if (action === 'help') { modal = 'help'; render(); }
    if (action === 'search') { modal = 'search'; render(); }
    if (action === 'close-modal') { modal = null; render(); }
    if (action === 'wiki') showNotice('Wiki curada entra em uma próxima etapa.');
    if (action === 'search-not-yet') showNotice('Motor de busca ainda não implementado.');
    if (action === 'exit') showNotice('Para encerrar o servidor local, use Ctrl+C no terminal.');
    if (action === 'save-settings') saveSettings();
  }));
}

function showNotice(message) {
  const old = modal;
  modal = 'help';
  render();
  const dialog = document.querySelector('.retro-dialog');
  if (dialog) {
    dialog.querySelector('.dialog-title').textContent = 'Informação';
    dialog.querySelector('.help-table').innerHTML = `<p class="notice-copy">${esc(message)}</p>`;
  }
  setTimeout(() => { if (modal === 'help' && old !== 'help') {} }, 0);
}

function saveSettings() {
  prefs.showSystem = document.querySelector('#cfg-system')?.checked ?? prefs.showSystem;
  prefs.highlightLinks = document.querySelector('#cfg-links')?.checked ?? prefs.highlightLinks;
  prefs.compact = document.querySelector('#cfg-compact')?.checked ?? prefs.compact;
  prefs.blinkCursor = document.querySelector('#cfg-blink')?.checked ?? prefs.blinkCursor;

  localStorage.setItem('vc.showSystem', prefs.showSystem ? '1' : '0');
  localStorage.setItem('vc.highlightLinks', prefs.highlightLinks ? '1' : '0');
  localStorage.setItem('vc.compact', prefs.compact ? '1' : '0');
  localStorage.setItem('vc.blinkCursor', prefs.blinkCursor ? '1' : '0');
  modal = null;
  render();
}

async function openSelected() {
  if (modal) return;
  const items = currentItems();
  if (screen !== 'viewer' && !items.length) return;

  if (screen === 'years') {
    year = years[selected];
    months = await api(`/api/months/${year}`);
    screen = 'months'; selected = 0;
  } else if (screen === 'months') {
    month = months[selected];
    entries = await api(`/api/entries/${year}/${month}`);
    screen = 'entries'; selected = 0;
  } else if (screen === 'entries') {
    viewer = await api(`/api/entry/${entries[selected].id}`);
    screen = 'viewer';
  }
  render();
}

function back() {
  if (modal) { modal = null; render(); return; }
  if (screen === 'viewer') screen = 'entries';
  else if (screen === 'entries') screen = 'months';
  else if (screen === 'months') screen = 'years';
  selected = 0;
  render();
}

function goCanonical() {
  modal = null;
  screen = 'years';
  year = null; month = null; viewer = null; selected = 0;
  render();
}

addEventListener('keydown', async e => {
  if (modal) {
    if (e.key === 'Escape') { e.preventDefault(); modal = null; render(); }
    return;
  }

  const arr = currentItems();
  if (e.key === 'ArrowDown' && arr.length) { e.preventDefault(); selected = (selected + 1) % arr.length; render(); }
  if (e.key === 'ArrowUp' && arr.length) { e.preventDefault(); selected = (selected - 1 + arr.length) % arr.length; render(); }
  if ((e.key === 'Enter' || e.key === 'F3') && arr.length) { e.preventDefault(); await openSelected(); }
  if (e.key === 'Escape') { e.preventDefault(); back(); }
  if (e.key === 'F1') { e.preventDefault(); modal = 'help'; render(); }
  if (e.key === 'F2') { e.preventDefault(); goCanonical(); }
  if (e.key === 'F7') { e.preventDefault(); modal = 'search'; render(); }
  if (e.key === 'F9') { e.preventDefault(); modal = 'settings'; render(); }
  if (e.key === 'F10') { e.preventDefault(); showNotice('Para encerrar o servidor local, use Ctrl+C no terminal.'); }
});

(async () => {
  try {
    status = await api('/api/status');
    years = await api('/api/years');
    render();
  } catch (e) {
    app.innerHTML = `<main class="dos-screen"><pre class="boot error">VAULT COMMANDER 0.3\n\nERRO: ${esc(e.message)}\n\nPressione Ctrl+C no terminal para encerrar.</pre></main>`;
  }
})();
