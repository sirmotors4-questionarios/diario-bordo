const config = window.DIARIO_CONFIG || {};
const form = document.querySelector('#diarioForm');
const submitButton = document.querySelector('#submitButton');
const syncStatus = document.querySelector('#syncStatus');
const successPanel = document.querySelector('#successPanel');

const normalise = value => String(value ?? '').trim();
const isActive = item => !item.estado || ['activo','activa','operacional','disponível','disponivel'].includes(normalise(item.estado).toLowerCase());

function setToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  form.elements.data.value = local.toISOString().slice(0, 10);
  document.querySelector('#todayLabel').textContent = new Intl.DateTimeFormat('pt-MZ', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(now);
}

async function loadMasterData() {
  try {
    const url = config.masterDataUrl || 'data/master-data.json';
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível consultar as listas.');
    const data = await response.json();
    fillSelect('viaturas', data.viaturas, item => `${item.matricula}${item.modelo ? ` · ${item.modelo}` : ''}`, item => item.matricula);
    fillSelect('motoristas', data.motoristas, item => item.nome, item => item.nome);
    fillSelect('assistentes', data.assistentes, item => item.nome, item => item.nome, true);
    fillSelect('rotas', data.rotas, item => item.nome, item => item.nome);
    fillSelect('tiposDeslocacao', data.tiposDeslocacao, item => item.nome || item, item => item.nome || item);
    const updated = data.actualizadoEm ? new Date(data.actualizadoEm) : new Date();
    document.querySelector('#dataTimestamp').textContent = `Listas actualizadas: ${new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'short', timeStyle: 'short' }).format(updated)}`;
    syncStatus.className = 'sync online';
    syncStatus.innerHTML = '<span></span>Dados actualizados';
  } catch (error) {
    syncStatus.className = 'sync error';
    syncStatus.innerHTML = '<span></span>Falha na actualização';
    document.querySelectorAll('select[data-list]').forEach(select => select.innerHTML = '<option value="">Lista indisponível</option>');
  }
}

function fillSelect(key, items = [], label, value, optional = false) {
  const select = document.querySelector(`[data-list="${key}"]`);
  const active = items.filter(item => typeof item === 'string' || isActive(item));
  select.innerHTML = `<option value="">${optional ? 'Sem assistente / Seleccionar' : 'Seleccionar'}</option>` + active.map(item => `<option value="${escapeHtml(value(item))}">${escapeHtml(label(item))}</option>`).join('');
}

function escapeHtml(value) {
  return normalise(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
}

function updateProgress() {
  const required = [...form.querySelectorAll('[required]')];
  const complete = required.filter(field => field.value.trim()).length;
  const pct = Math.round((complete / required.length) * 100);
  document.querySelector('#progressText').textContent = `${pct}%`;
  document.querySelector('#progressBar').style.width = `${pct}%`;
}

form.addEventListener('input', event => {
  event.target.classList.remove('invalid');
  updateProgress();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const invalid = [...form.querySelectorAll('[required]')].filter(field => !field.value.trim());
  if (invalid.length) {
    invalid.forEach(field => field.classList.add('invalid'));
    invalid[0].focus();
    document.querySelector('#formHint').textContent = 'Preencha todos os campos obrigatórios.';
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.registadoEm = new Date().toISOString();
  payload.origem = 'web-diario-bordo';

  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'A enviar...';
  try {
    if (config.submissionUrl && !config.demoMode) {
      const response = await fetch(config.submissionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('Submissão recusada.');
    } else {
      const entries = JSON.parse(localStorage.getItem('sirDiarioBordoDemo') || '[]');
      entries.push(payload);
      localStorage.setItem('sirDiarioBordoDemo', JSON.stringify(entries));
    }
    form.hidden = true;
    successPanel.hidden = false;
    document.querySelector('#successMessage').textContent = config.demoMode ? 'Modo de demonstração: o registo ficou guardado neste dispositivo.' : 'Os dados foram enviados para o sistema com sucesso.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    document.querySelector('#formHint').textContent = 'Não foi possível enviar. Confirme a ligação e tente novamente.';
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Enviar registo';
  }
});

document.querySelector('#newEntry').addEventListener('click', () => {
  form.reset();
  setToday();
  form.hidden = false;
  successPanel.hidden = true;
  document.querySelector('#formHint').textContent = 'Confirme os dados antes de enviar.';
  updateProgress();
});

setToday();
loadMasterData();
updateProgress();
