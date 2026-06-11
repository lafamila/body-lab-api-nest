import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res, Sse, UseGuards } from '@nestjs/common';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { AuthAccountParam } from '../auth/auth-account.decorator';
import { AuthAccount } from '../auth/auth.types';
import { BodyLabSessionGuard } from '../auth/body-lab-session.guard';
import { ExportImportService } from '../export-import/export-import.service';
import { PredictionConfigServerSentMessage, SyncService } from '../sync/sync.service';
import { PredictionConfigKind, PredictionConfigItemDto, UpsertPredictionConfigItemDto } from './dto';
import { PredictionConfigService } from './prediction-config.service';

class ImportBodyLabAdminBackupDto {
  @IsInt()
  @Min(1)
  schemaVersion!: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

@Controller()
export class PredictionConfigController {
  constructor(
    private readonly service: PredictionConfigService,
    private readonly exportImportService: ExportImportService,
    private readonly sync: SyncService,
  ) {}

  @UseGuards(BodyLabSessionGuard)
  @Get('prediction-config')
  listForClient(@AuthAccountParam() account: AuthAccount) {
    return this.service.list(account.accountId, false);
  }

  @UseGuards(BodyLabSessionGuard)
  @Get('prediction-config/status')
  status(@AuthAccountParam() account: AuthAccount) {
    return this.service.status(account.accountId);
  }

  @UseGuards(BodyLabSessionGuard)
  @Get('prediction-config/items')
  listForSettings(@AuthAccountParam() account: AuthAccount, @Query('includeInactive') includeInactive?: string) {
    return this.service.list(account.accountId, includeInactive === 'true');
  }

  @UseGuards(BodyLabSessionGuard)
  @Post('prediction-config/items')
  createForSettings(@AuthAccountParam() account: AuthAccount, @Body() body: UpsertPredictionConfigItemDto) {
    return this.service.upsert(account.accountId, body);
  }

  @UseGuards(BodyLabSessionGuard)
  @Put('prediction-config/items/:id')
  updateForSettings(
    @AuthAccountParam() account: AuthAccount,
    @Param('id') id: string,
    @Body() body: UpsertPredictionConfigItemDto,
  ) {
    return this.service.update(account.accountId, id, body);
  }

  @UseGuards(BodyLabSessionGuard)
  @Delete('prediction-config/items/:id')
  deleteForSettings(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.service.delete(account.accountId, id);
  }

  @Get('admin/login')
  adminLogin(@Res() response: Response) {
    response.type('html').send(loginHtml);
  }

  @Get('admin')
  admin(@Res() response: Response) {
    response.type('html').send(adminHtml);
  }

  @UseGuards(BodyLabSessionGuard)
  @Sse('prediction-config/events')
  events(@AuthAccountParam() account: AuthAccount): Observable<PredictionConfigServerSentMessage> {
    return this.sync.streamPredictionConfig(account.accountId);
  }

  @UseGuards(BodyLabSessionGuard)
  @Get('admin/export')
  async exportAdminBackup(@AuthAccountParam() account: AuthAccount) {
    const [personalData, predictionConfig] = await Promise.all([
      this.exportImportService.export(account.accountId),
      this.service.list(account.accountId, true),
    ]);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      config: {
        predictionConfig,
      },
      data: personalData.data,
    };
  }

  @UseGuards(BodyLabSessionGuard)
  @Post('admin/import')
  async importAdminBackup(@AuthAccountParam() account: AuthAccount, @Body() body: ImportBodyLabAdminBackupDto) {
    if (!body.config && !body.data) {
      throw new BadRequestException('Import payload must include config or data');
    }

    const result: Record<string, unknown> = {};
    if (body.config) {
      const predictionConfig = this.normalizePredictionConfig(body.config.predictionConfig);
      result.predictionConfig = (await this.service.replaceAll(account.accountId, predictionConfig)).length;
    }
    if (body.data) {
      result.personalData = await this.exportImportService.import(account.accountId, {
        schemaVersion: body.schemaVersion,
        data: body.data,
      });
    }

    return {
      schemaVersion: 1,
      importedAt: new Date().toISOString(),
      imported: result,
    };
  }

  @UseGuards(BodyLabSessionGuard)
  @Get('admin/prediction-config/items')
  list(@AuthAccountParam() account: AuthAccount, @Query('includeInactive') includeInactive?: string) {
    return this.service.list(account.accountId, includeInactive === 'true');
  }

  @UseGuards(BodyLabSessionGuard)
  @Post('admin/prediction-config/items')
  create(@AuthAccountParam() account: AuthAccount, @Body() body: UpsertPredictionConfigItemDto) {
    return this.service.upsert(account.accountId, body);
  }

  @UseGuards(BodyLabSessionGuard)
  @Put('admin/prediction-config/items/:id')
  update(@AuthAccountParam() account: AuthAccount, @Param('id') id: string, @Body() body: UpsertPredictionConfigItemDto) {
    return this.service.update(account.accountId, id, body);
  }

  @UseGuards(BodyLabSessionGuard)
  @Delete('admin/prediction-config/items/:id')
  delete(@AuthAccountParam() account: AuthAccount, @Param('id') id: string) {
    return this.service.delete(account.accountId, id);
  }

  private normalizePredictionConfig(value: unknown): UpsertPredictionConfigItemDto[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('config.predictionConfig must be an array');
    }

    return value.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException(`config.predictionConfig[${index}] must be an object`);
      }
      const record = item as Partial<PredictionConfigItemDto>;
      if (!this.isPredictionConfigKind(record.kind)) {
        throw new BadRequestException(`config.predictionConfig[${index}].kind is invalid`);
      }
      if (!record.key || !/^[a-z][a-z0-9_]*$/.test(record.key)) {
        throw new BadRequestException(`config.predictionConfig[${index}].key is invalid`);
      }
      if (!record.label) {
        throw new BadRequestException(`config.predictionConfig[${index}].label is required`);
      }
      return {
        kind: record.kind,
        key: record.key,
        label: record.label,
        massKg: record.massKg ?? null,
        stoolRatio: record.stoolRatio ?? null,
        minuteFactor: record.minuteFactor ?? null,
        sortOrder: record.sortOrder ?? 0,
        isActive: record.isActive ?? true,
        metadata: this.normalizeMetadata(record.metadata),
      };
    });
  }

  private normalizeMetadata(value: unknown): Record<string, unknown> {
    if (typeof value === 'undefined' || value === null) {
      return {};
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('prediction config metadata must be an object');
    }
    return value as Record<string, unknown>;
  }

  private isPredictionConfigKind(value: unknown): value is PredictionConfigKind {
    return value === 'global' || value === 'meal' || value === 'drink' || value === 'bathroom' || value === 'workout';
  }
}

const baseStyle = `
  :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  body { margin: 0; background: #050505; color: #f4f4f5; }
  main { max-width: 1120px; margin: 0 auto; padding: 24px; }
  h1 { margin: 0 0 18px; font-size: 22px; }
  h2 { margin: 0 0 10px; font-size: 15px; color: #e4e4e7; }
  section { border: 1px solid #27272a; border-radius: 8px; padding: 14px; margin: 14px 0; background: #0a0a0a; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  input, select, button, textarea { border: 1px solid #3f3f46; border-radius: 6px; background: #111113; color: #f4f4f5; padding: 7px 8px; font-size: 13px; }
  textarea { width: 100%; min-height: 58px; resize: vertical; box-sizing: border-box; }
  button { cursor: pointer; }
  button:disabled { cursor: default; opacity: .55; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #27272a; padding: 8px; text-align: left; }
  th { color: #a1a1aa; font-weight: 500; }
  .number { width: 88px; }
  .key { width: 130px; }
  .label { width: 140px; }
  .unit { width: 90px; }
  .metadata-grid { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 8px; margin-top: 10px; }
  .metadata-grid label { display: grid; gap: 4px; color: #a1a1aa; font-size: 12px; }
  .metadata-text { max-width: 280px; color: #d4d4d8; font-size: 12px; line-height: 1.35; }
  .status { color: #a1a1aa; font-size: 12px; }
  .error { color: #f87171; }
  .success { color: #4ade80; }
  .toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
  .status-bar { min-height: 18px; margin: 8px 0 0; color: #a1a1aa; font-size: 12px; }
  .loading::before { content: ""; display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 50%; border: 2px solid #52525b; border-top-color: #f4f4f5; animation: spin .8s linear infinite; vertical-align: -2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .modal-backdrop { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.7); padding: 24px; }
  .modal-backdrop.open { display: flex; }
  .modal { width: min(560px, 100%); border: 1px solid #3f3f46; border-radius: 8px; background: #09090b; padding: 16px; }
  .dropzone { border: 1px dashed #52525b; border-radius: 8px; padding: 24px; text-align: center; color: #a1a1aa; }
  .dropzone.dragging { border-color: #f4f4f5; color: #f4f4f5; }
`;

const loginHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>body-lab admin login</title>
  <style>${baseStyle}</style>
</head>
<body>
<main>
  <h1>body-lab admin</h1>
  <section>
    <h2>Login</h2>
    <form id="loginForm" class="row">
      <input id="loginId" placeholder="ID" autocomplete="username">
      <input id="password" placeholder="Password" type="password" autocomplete="current-password">
      <button id="loginButton" type="submit">Login</button>
    </form>
    <div id="statusBar" class="status-bar"></div>
  </section>
</main>
<script>
const statusBar = document.getElementById('statusBar');
let loadingCount = 0;
function setStatus(message, className) {
  statusBar.textContent = message || '';
  statusBar.className = 'status-bar ' + (className || '');
}
function beginLoading(message) {
  loadingCount += 1;
  setStatus(message, 'loading');
  document.getElementById('loginButton').disabled = true;
}
function endLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) document.getElementById('loginButton').disabled = false;
}
async function api(path, options = {}) {
  beginLoading('Loading...');
  try {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  } finally {
    endLoading();
  }
}
document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('');
  try {
    const loginId = document.getElementById('loginId').value;
    const password = document.getElementById('password').value;
    await api('/session/login', { method: 'POST', body: JSON.stringify({ loginId, password, clientKind: 'mac', clientInstanceId: 'admin-console', deviceName: 'admin' }) });
    window.location.href = '/admin';
  } catch (error) {
    setStatus('Login failed', 'error');
  }
});
fetch('/session/me').then((response) => {
  if (response.ok) window.location.href = '/admin';
}).catch(() => {});
</script>
</body>
</html>`;

const adminHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>body-lab admin</title>
  <style>${baseStyle}</style>
</head>
<body>
<main>
  <div class="toolbar">
    <h1>body-lab admin</h1>
    <button onclick="logout()">Logout</button>
  </div>
  <div id="statusBar" class="status-bar"></div>

  <section>
    <h2>Backup</h2>
    <div class="row">
      <button onclick="exportBackup()">Export JSON</button>
      <button onclick="openImportModal()">Import JSON</button>
    </div>
    <p class="status">config와 로그인 계정의 개인 기록 데이터를 함께 내보내고 불러옵니다.</p>
  </section>

  <section>
    <h2>Prediction config</h2>
    <div class="row">
      <select id="kind">
        <option value="meal">meal</option>
        <option value="drink">drink</option>
        <option value="bathroom">bathroom</option>
        <option value="workout">workout</option>
        <option value="global" disabled>global</option>
      </select>
      <input id="key" class="key" placeholder="key">
      <input id="label" class="label" placeholder="label">
      <input id="massKg" class="number" placeholder="mass kg" type="number" step="0.0001">
      <input id="stoolRatio" class="number" placeholder="stool" type="number" step="0.0001">
      <input id="minuteFactor" class="number" placeholder="min factor" type="number" step="0.00001">
      <input id="sortOrder" class="number" placeholder="order" type="number" step="1">
      <label><input id="isActive" type="checkbox" checked> active</label>
      <button onclick="save()">Save</button>
      <button onclick="resetForm()">New</button>
      <button onclick="load()">Refresh</button>
    </div>
    <div class="metadata-grid">
      <label>Description<textarea id="metadataDescription" placeholder="What this value means in prediction"></textarea></label>
      <label>Setup text<textarea id="metadataSetupText" placeholder="Text shown during initial setup"></textarea></label>
      <label>Input hint<textarea id="metadataInputHint" placeholder="How to choose or enter this value"></textarea></label>
      <label>Unit<input id="metadataUnit" class="unit" placeholder="kg, hours, kg/hour"></label>
      <label><span>Required in setup</span><input id="metadataRequiredInSetup" type="checkbox"></label>
    </div>
    <p class="status">meal.massKg는 1인분 입력시 더해질 무게, meal.stoolRatio는 대변 배출 비율입니다. drink.massKg는 amount 1당 더해질 무게, bathroom.urine massKg는 음수, workout.minuteFactor는 분당 감소 계수입니다.</p>
  </section>

  <section>
    <table>
      <thead><tr><th>kind</th><th>key</th><th>label</th><th>description</th><th>unit</th><th>mass</th><th>stool</th><th>minute</th><th>order</th><th>active</th><th></th></tr></thead>
      <tbody id="items"></tbody>
    </table>
  </section>
</main>

<div id="importModal" class="modal-backdrop" role="dialog" aria-modal="true">
  <div class="modal">
    <div class="toolbar">
      <h2>Import JSON</h2>
      <button onclick="closeImportModal()">Close</button>
    </div>
    <div id="dropzone" class="dropzone">
      <p>JSON 파일을 선택하거나 여기로 드래그하세요.</p>
      <input id="importFile" type="file" accept="application/json,.json">
    </div>
    <div class="row" style="margin-top: 12px;">
      <button id="importButton" onclick="importBackup()" disabled>Import</button>
      <span id="importFileName" class="status"></span>
    </div>
  </div>
</div>

<script>
let editingId = null;
let editingMetadata = {};
let selectedImportFile = null;
let loadingCount = 0;
const statusBar = document.getElementById('statusBar');

function setStatus(message, className) {
  statusBar.textContent = message || '';
  statusBar.className = 'status-bar ' + (className || '');
}
function beginLoading(message) {
  loadingCount += 1;
  setStatus(message || 'Loading...', 'loading');
  document.querySelectorAll('button').forEach((button) => button.disabled = true);
}
function endLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) {
    document.querySelectorAll('button').forEach((button) => button.disabled = false);
    document.getElementById('importButton').disabled = !selectedImportFile;
  }
}
function nullableNumber(id) {
  const value = document.getElementById(id).value.trim();
  return value === '' ? null : Number(value);
}
async function api(path, options = {}) {
  beginLoading(options.loadingText || 'Loading...');
  try {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    if (response.status === 401) {
      window.location.href = '/admin/login';
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  } finally {
    endLoading();
  }
}
async function assertLoggedIn() {
  const response = await fetch('/session/me');
  if (!response.ok) window.location.href = '/admin/login';
}
async function logout() {
  await api('/session/logout', { method: 'POST', body: JSON.stringify({}), loadingText: 'Logging out...' });
  window.location.href = '/admin/login';
}
async function load() {
  const rows = await api('/admin/prediction-config/items?includeInactive=true', { loadingText: 'Loading config...' });
  document.getElementById('items').innerHTML = rows.map(row => '<tr>' +
    '<td>' + escapeHtml(row.kind) + '</td><td>' + escapeHtml(row.key) + '</td><td>' + escapeHtml(row.label) + '</td>' +
    '<td class="metadata-text">' + escapeHtml((row.metadata && row.metadata.description) || '') + '</td><td>' + escapeHtml((row.metadata && row.metadata.unit) || '') + '</td>' +
    '<td>' + (row.massKg ?? '') + '</td><td>' + (row.stoolRatio ?? '') + '</td><td>' + (row.minuteFactor ?? '') + '</td><td>' + row.sortOrder + '</td><td>' + row.isActive + '</td>' +
    '<td><button onclick="edit(' + escapeAttribute(JSON.stringify(row)) + ')">Edit</button> ' +
    (row.kind === 'global' ? '' : '<button onclick="removeItem(\\'' + row.id + '\\')">Delete</button>') +
    '</td></tr>'
  ).join('');
  setStatus('Loaded', 'success');
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function escapeAttribute(value) {
  return "'" + escapeHtml(value) + "'";
}
function edit(row) {
  if (typeof row === 'string') row = JSON.parse(row);
  editingId = row.id;
  editingMetadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const isGlobal = row.kind === 'global';
  document.getElementById('kind').disabled = isGlobal;
  document.getElementById('key').disabled = isGlobal;
  document.getElementById('isActive').disabled = isGlobal;
  for (const key of ['kind','key','label','massKg','stoolRatio','minuteFactor','sortOrder']) document.getElementById(key).value = row[key] ?? '';
  document.getElementById('isActive').checked = row.isActive;
  document.getElementById('metadataDescription').value = editingMetadata.description || '';
  document.getElementById('metadataSetupText').value = editingMetadata.setupText || '';
  document.getElementById('metadataInputHint').value = editingMetadata.inputHint || '';
  document.getElementById('metadataUnit').value = editingMetadata.unit || '';
  document.getElementById('metadataRequiredInSetup').checked = Boolean(editingMetadata.requiredInSetup);
}
function resetForm() {
  editingId = null;
  editingMetadata = {};
  document.getElementById('kind').disabled = false;
  document.getElementById('kind').value = 'meal';
  document.getElementById('key').disabled = false;
  document.getElementById('isActive').disabled = false;
  for (const key of ['key','label','massKg','stoolRatio','minuteFactor','sortOrder']) document.getElementById(key).value = '';
  for (const key of ['metadataDescription','metadataSetupText','metadataInputHint','metadataUnit']) document.getElementById(key).value = '';
  document.getElementById('isActive').checked = true;
  document.getElementById('metadataRequiredInSetup').checked = false;
}
async function save() {
  const metadata = {
    ...editingMetadata,
    description: document.getElementById('metadataDescription').value.trim(),
    setupText: document.getElementById('metadataSetupText').value.trim(),
    inputHint: document.getElementById('metadataInputHint').value.trim(),
    unit: document.getElementById('metadataUnit').value.trim(),
    requiredInSetup: document.getElementById('metadataRequiredInSetup').checked
  };
  const payload = {
    kind: document.getElementById('kind').value,
    key: document.getElementById('key').value.trim(),
    label: document.getElementById('label').value.trim(),
    massKg: nullableNumber('massKg'),
    stoolRatio: nullableNumber('stoolRatio'),
    minuteFactor: nullableNumber('minuteFactor'),
    sortOrder: Number(document.getElementById('sortOrder').value || 0),
    isActive: document.getElementById('isActive').checked,
    metadata
  };
  await api(editingId ? '/admin/prediction-config/items/' + editingId : '/admin/prediction-config/items', {
    method: editingId ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
    loadingText: 'Saving config...'
  });
  resetForm();
  await load();
}
async function removeItem(id) {
  await api('/admin/prediction-config/items/' + id, { method: 'DELETE', loadingText: 'Deleting config...' });
  await load();
}
async function exportBackup() {
  const backup = await api('/admin/export', { loadingText: 'Exporting JSON...' });
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'body-lab-export-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  setStatus('Exported', 'success');
}
function openImportModal() {
  document.getElementById('importModal').classList.add('open');
}
function closeImportModal() {
  document.getElementById('importModal').classList.remove('open');
}
function setImportFile(file) {
  selectedImportFile = file;
  document.getElementById('importButton').disabled = !file;
  document.getElementById('importFileName').textContent = file ? file.name : '';
}
async function importBackup() {
  if (!selectedImportFile) return;
  const text = await selectedImportFile.text();
  const payload = JSON.parse(text);
  await api('/admin/import', { method: 'POST', body: JSON.stringify(payload), loadingText: 'Importing JSON...' });
  closeImportModal();
  setImportFile(null);
  await load();
  setStatus('Imported', 'success');
}
document.getElementById('importFile').addEventListener('change', (event) => {
  setImportFile(event.target.files && event.target.files[0] ? event.target.files[0] : null);
});
const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  setImportFile(event.dataTransfer.files && event.dataTransfer.files[0] ? event.dataTransfer.files[0] : null);
});

assertLoggedIn().then(load).catch(() => {
  window.location.href = '/admin/login';
});
</script>
</body>
</html>`;
