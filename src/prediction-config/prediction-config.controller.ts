import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, Sse, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { AuthAccountParam } from '../auth/auth-account.decorator';
import { AuthAccount } from '../auth/auth.types';
import { BodyLabSessionGuard } from '../auth/body-lab-session.guard';
import { PredictionConfigServerSentMessage, SyncService } from '../sync/sync.service';
import { UpsertPredictionConfigItemDto } from './dto';
import { PredictionConfigService } from './prediction-config.service';

@Controller()
export class PredictionConfigController {
  constructor(
    private readonly service: PredictionConfigService,
    private readonly sync: SyncService,
  ) {}

  @UseGuards(BodyLabSessionGuard)
  @Get('prediction-config')
  listForClient(@AuthAccountParam() _account: AuthAccount) {
    return this.service.list(false);
  }

  @Get('admin')
  admin(@Res() response: Response) {
    response.type('html').send(adminHtml);
  }

  @UseGuards(BodyLabSessionGuard)
  @Sse('prediction-config/events')
  events(@AuthAccountParam() _account: AuthAccount): Observable<PredictionConfigServerSentMessage> {
    return this.sync.streamPredictionConfig();
  }

  @UseGuards(BodyLabSessionGuard)
  @Get('admin/prediction-config/items')
  list(@Query('includeInactive') includeInactive?: string) {
    return this.service.list(includeInactive === 'true');
  }

  @UseGuards(BodyLabSessionGuard)
  @Post('admin/prediction-config/items')
  create(@Body() body: UpsertPredictionConfigItemDto) {
    return this.service.upsert(body);
  }

  @UseGuards(BodyLabSessionGuard)
  @Put('admin/prediction-config/items/:id')
  update(@Param('id') id: string, @Body() body: UpsertPredictionConfigItemDto) {
    return this.service.update(id, body);
  }

  @UseGuards(BodyLabSessionGuard)
  @Delete('admin/prediction-config/items/:id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}

const adminHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>body-lab admin</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #050505; color: #f4f4f5; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 18px; font-size: 22px; }
    section { border: 1px solid #27272a; border-radius: 8px; padding: 14px; margin: 14px 0; background: #0a0a0a; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    input, select, button { border: 1px solid #3f3f46; border-radius: 6px; background: #111113; color: #f4f4f5; padding: 7px 8px; font-size: 13px; }
    button { cursor: pointer; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #27272a; padding: 8px; text-align: left; }
    th { color: #a1a1aa; font-weight: 500; }
    .number { width: 88px; }
    .key { width: 130px; }
    .label { width: 140px; }
    .status { color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
<main>
  <h1>body-lab admin</h1>
  <section id="login">
    <div class="row">
      <input id="loginId" placeholder="ID" autocomplete="username">
      <input id="password" placeholder="Password" type="password" autocomplete="current-password">
      <button onclick="login()">Login</button>
      <span class="status" id="loginStatus"></span>
    </div>
  </section>
  <section>
    <div class="row">
      <select id="kind">
        <option value="meal">meal</option>
        <option value="drink">drink</option>
        <option value="bathroom">bathroom</option>
        <option value="workout">workout</option>
        <option value="global">global</option>
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
    <p class="status">meal.massKg는 1인분 입력시 더해질 무게, meal.stoolRatio는 전날 식사가 대변 무게로 전환되는 비율입니다. drink.massKg는 기록 amount 1당 더해질 무게, bathroom.urine massKg는 음수, workout.minuteFactor는 분당 감소 계수입니다. global.massKg는 fasting/steps/clamp 계수입니다.</p>
  </section>
  <section>
    <table>
      <thead><tr><th>kind</th><th>key</th><th>label</th><th>mass</th><th>stool</th><th>minute</th><th>order</th><th>active</th><th></th></tr></thead>
      <tbody id="items"></tbody>
    </table>
  </section>
</main>
<script>
let editingId = null;
function nullableNumber(id) {
  const value = document.getElementById(id).value.trim();
  return value === '' ? null : Number(value);
}
async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
async function login() {
  const loginId = document.getElementById('loginId').value;
  const password = document.getElementById('password').value;
  await api('/session/login', { method: 'POST', body: JSON.stringify({ loginId, password, clientKind: 'mac', clientInstanceId: 'admin-console', deviceName: 'admin' }) });
  document.getElementById('password').value = '';
  document.getElementById('loginStatus').textContent = 'Logged in';
  await load();
}
async function load() {
  const rows = await api('/admin/prediction-config/items?includeInactive=true');
  document.getElementById('items').innerHTML = rows.map(row => '<tr>' +
    '<td>' + row.kind + '</td><td>' + row.key + '</td><td>' + row.label + '</td><td>' + (row.massKg ?? '') + '</td><td>' + (row.stoolRatio ?? '') + '</td><td>' + (row.minuteFactor ?? '') + '</td><td>' + row.sortOrder + '</td><td>' + row.isActive + '</td>' +
    '<td><button onclick="edit(' + JSON.stringify(row).replaceAll('"', '&quot;') + ')">Edit</button> <button onclick="removeItem(\\'' + row.id + '\\')">Delete</button></td></tr>'
  ).join('');
}
function edit(row) {
  editingId = row.id;
  for (const key of ['kind','key','label','massKg','stoolRatio','minuteFactor','sortOrder']) document.getElementById(key).value = row[key] ?? '';
  document.getElementById('isActive').checked = row.isActive;
}
function resetForm() {
  editingId = null;
  for (const key of ['key','label','massKg','stoolRatio','minuteFactor','sortOrder']) document.getElementById(key).value = '';
  document.getElementById('isActive').checked = true;
}
async function save() {
  const payload = {
    kind: document.getElementById('kind').value,
    key: document.getElementById('key').value.trim(),
    label: document.getElementById('label').value.trim(),
    massKg: nullableNumber('massKg'),
    stoolRatio: nullableNumber('stoolRatio'),
    minuteFactor: nullableNumber('minuteFactor'),
    sortOrder: Number(document.getElementById('sortOrder').value || 0),
    isActive: document.getElementById('isActive').checked
  };
  await api(editingId ? '/admin/prediction-config/items/' + editingId : '/admin/prediction-config/items', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
  resetForm();
  await load();
}
async function removeItem(id) {
  await api('/admin/prediction-config/items/' + id, { method: 'DELETE' });
  await load();
}
load().catch(() => {});
</script>
</body>
</html>`;
