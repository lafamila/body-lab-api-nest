import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res, Sse, UseGuards } from '@nestjs/common';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { AuthAccountParam } from '../auth/auth-account.decorator';
import { AuthAccount } from '../auth/auth.types';
import { BodyLabSessionGuard } from '../auth/body-lab-session.guard';
import { ExportImportService } from '../export-import/export-import.service';
import { PredictionConfigServerSentMessage, SyncService } from '../sync/sync.service';
import {
  CreatePredictionCalibrationDto,
  PredictionConfigKind,
  PredictionConfigItemDto,
  PredictionConfigMetadata,
  UpsertPredictionConfigItemDto,
} from './dto';
import { PredictionCalibrationService } from './prediction-calibration.service';
import {
  PREDICTION_CONFIG_DEFAULT_ICON_KEYS,
  PREDICTION_CONFIG_DEFAULT_INPUT_MODE,
  PREDICTION_CONFIG_INPUT_MODES,
  PREDICTION_CONFIG_SHORTCUT_PRESETS,
  isPredictionConfigKind,
  normalizePredictionConfigMetadata,
} from './prediction-config-metadata';
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
    private readonly calibrationService?: PredictionCalibrationService,
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

  @UseGuards(BodyLabSessionGuard)
  @Post('prediction-config/calibrations')
  calibratePrediction(@AuthAccountParam() account: AuthAccount, @Body() body: CreatePredictionCalibrationDto) {
    if (!this.calibrationService) {
      throw new BadRequestException('Prediction calibration service is unavailable');
    }
    return this.calibrationService.calibrate(account.accountId, body);
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
      if (!isPredictionConfigKind(record.kind)) {
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
        metadata: this.normalizeMetadata(record.kind, record.metadata),
      };
    });
  }

  private normalizeMetadata(kind: PredictionConfigKind, value: unknown): PredictionConfigMetadata {
    if (typeof value === 'undefined' || value === null) {
      return normalizePredictionConfigMetadata(kind, {});
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('prediction config metadata must be an object');
    }
    return normalizePredictionConfigMetadata(kind, value);
  }
}

const shortcutPresetsJson = JSON.stringify(PREDICTION_CONFIG_SHORTCUT_PRESETS);
const defaultIconKeysJson = JSON.stringify(PREDICTION_CONFIG_DEFAULT_ICON_KEYS);
const defaultInputModesJson = JSON.stringify(PREDICTION_CONFIG_DEFAULT_INPUT_MODE);
const inputModesJson = JSON.stringify(PREDICTION_CONFIG_INPUT_MODES);

const baseStyle = `
  :root {
    color-scheme: dark;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --bg: #071018;
    --panel: #0d1722;
    --panel-alt: #111d2b;
    --border: #243244;
    --text: #f8fafc;
    --muted: #94a3b8;
    --accent: #7dd3fc;
    --accent-soft: rgba(125, 211, 252, 0.16);
    --success: #4ade80;
    --danger: #f87171;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: linear-gradient(180deg, #04070d 0%, var(--bg) 100%); color: var(--text); }
  main { max-width: 1240px; margin: 0 auto; padding: 28px 20px 40px; }
  h1 { margin: 0; font-size: 24px; }
  h2 { margin: 0; font-size: 16px; color: var(--text); }
  p { margin: 0; }
  section { border: 1px solid var(--border); border-radius: 16px; padding: 18px; margin: 16px 0; background: var(--panel); box-shadow: inset 0 1px 0 rgba(255,255,255,0.02); }
  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .section-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
  .section-head p { color: var(--muted); font-size: 13px; line-height: 1.45; max-width: 760px; }
  input, select, button, textarea {
    width: 100%;
    min-height: 40px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel-alt);
    color: var(--text);
    padding: 10px 12px;
    font-size: 13px;
  }
  textarea { min-height: 88px; resize: none; }
  button {
    width: auto;
    min-width: 108px;
    cursor: pointer;
    font-weight: 600;
    background: rgba(125, 211, 252, 0.14);
    border-color: rgba(125, 211, 252, 0.32);
  }
  button.secondary { background: transparent; border-color: var(--border); }
  button.danger { background: rgba(248, 113, 113, 0.14); border-color: rgba(248, 113, 113, 0.4); }
  button:disabled { cursor: default; opacity: .55; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1080px; }
  th, td { border-bottom: 1px solid rgba(148, 163, 184, 0.16); padding: 10px 8px; text-align: left; vertical-align: top; }
  th { color: var(--muted); font-weight: 600; }
  .table-wrap { overflow: auto; }
  .toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
  .status-bar { min-height: 18px; margin: 10px 0 0; color: var(--muted); font-size: 12px; }
  .status { color: var(--muted); font-size: 12px; line-height: 1.5; }
  .error { color: var(--danger); }
  .success { color: var(--success); }
  .loading::before { content: ""; display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 999px; border: 2px solid rgba(148, 163, 184, 0.45); border-top-color: var(--text); animation: spin .8s linear infinite; vertical-align: -2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .kind-tabs, .shortcut-strip { display: flex; flex-wrap: wrap; gap: 10px; }
  .kind-tab.active, .shortcut-button { background: var(--accent-soft); border-color: rgba(125, 211, 252, 0.34); }
  .kind-tab.active { color: var(--text); }
  .shortcut-button { min-width: 0; }
  .shortcut-button .muted { display: block; color: var(--muted); font-size: 11px; font-weight: 500; margin-top: 2px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(148, 163, 184, 0.12); color: var(--muted); font-size: 12px; }
  .notice { padding: 12px 14px; border: 1px solid rgba(125, 211, 252, 0.26); background: rgba(125, 211, 252, 0.08); border-radius: 12px; color: #d9f4ff; font-size: 12px; line-height: 1.5; }
  .notice.hidden { display: none; }
  .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
  .field { display: grid; gap: 6px; }
  .field span { color: var(--muted); font-size: 12px; }
  .field[data-hidden="true"] { display: none; }
  .field-wide { grid-column: span 2; }
  .actions { margin-top: 16px; }
  .details { margin-top: 14px; border-top: 1px solid rgba(148, 163, 184, 0.12); padding-top: 14px; }
  details summary { cursor: pointer; color: var(--muted); font-size: 12px; }
  .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 8px; background: rgba(148, 163, 184, 0.14); color: var(--text); font-size: 11px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .metadata-text { max-width: 260px; color: #d4dbe6; font-size: 12px; line-height: 1.45; }
  .modal-backdrop { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.72); padding: 24px; }
  .modal-backdrop.open { display: flex; }
  .modal { width: min(560px, 100%); border: 1px solid var(--border); border-radius: 16px; background: var(--panel); padding: 18px; }
  .dropzone { border: 1px dashed rgba(148, 163, 184, 0.38); border-radius: 12px; padding: 24px; text-align: center; color: var(--muted); }
  .dropzone.dragging { border-color: var(--accent); color: var(--text); }
  @media (max-width: 980px) {
    .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    main { padding: 20px 14px 32px; }
    .toolbar, .section-head { align-items: stretch; flex-direction: column; }
    .form-grid { grid-template-columns: 1fr; }
    .field-wide { grid-column: auto; }
    button { width: 100%; }
  }
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
    <h2>로그인</h2>
    <div class="row">
      <button id="loginButton" type="button">로그인</button>
    </div>
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
document.getElementById('loginButton').addEventListener('click', async () => {
  setStatus('');
  try {
    const result = await api('/session/oidc/start', {
      method: 'POST',
      body: JSON.stringify({
        clientKind: 'mac',
        clientInstanceId: 'admin-console',
        deviceName: 'admin',
        returnUri: window.location.origin + '/admin'
      })
    });
    window.location.href = result.authorizeUrl;
  } catch (error) {
    setStatus('로그인 실패', 'error');
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
    <div class="section-head">
      <div>
        <h2>Backup</h2>
        <p>config와 로그인 계정의 개인 기록 데이터를 한 번에 내보내고 다시 불러옵니다.</p>
      </div>
      <div class="row">
        <button onclick="exportBackup()">Export JSON</button>
        <button class="secondary" onclick="openImportModal()">Import JSON</button>
      </div>
    </div>
  </section>

  <section>
    <div class="section-head">
      <div>
        <h2>Prediction config</h2>
        <p>global config는 직접 새로 만들 수 없습니다. meal, drink, bathroom, workout은 kind별 form과 shortcut으로 빠르게 채운 뒤 저장하세요.</p>
      </div>
      <div class="row">
        <span class="pill">global create disabled</span>
        <button class="secondary" onclick="load()">Refresh</button>
      </div>
    </div>

    <div id="kindTabs" class="kind-tabs">
      <button id="kindTab-meal" class="kind-tab" type="button" onclick="resetForm('meal')">meal</button>
      <button id="kindTab-drink" class="kind-tab" type="button" onclick="resetForm('drink')">drink</button>
      <button id="kindTab-bathroom" class="kind-tab" type="button" onclick="resetForm('bathroom')">bathroom</button>
      <button id="kindTab-workout" class="kind-tab" type="button" onclick="resetForm('workout')">workout</button>
    </div>

    <div id="editingNotice" class="notice hidden"></div>
    <div id="shortcutStrip" class="shortcut-strip" style="margin-top: 14px;"></div>

    <div class="form-grid">
      <label class="field">
        <span>Kind</span>
        <input id="kindDisplay" class="mono" disabled>
      </label>
      <label class="field">
        <span>Key</span>
        <input id="key" class="mono" placeholder="key">
      </label>
      <label class="field">
        <span>Label</span>
        <input id="label" placeholder="label">
      </label>
      <label class="field">
        <span>Sort order</span>
        <input id="sortOrder" type="number" step="1" placeholder="0">
      </label>
      <label class="field" data-field="massKg">
        <span id="massKgLabel">Mass kg</span>
        <input id="massKg" type="number" step="0.0001" placeholder="0.0000">
      </label>
      <label class="field" data-field="stoolRatio">
        <span>Stool ratio</span>
        <input id="stoolRatio" type="number" step="0.0001" placeholder="0.0000">
      </label>
      <label class="field" data-field="minuteFactor">
        <span id="minuteFactorLabel">Minute factor</span>
        <input id="minuteFactor" type="number" step="0.00001" placeholder="0.00000">
      </label>
      <label class="field" data-field="isActive">
        <span>Active</span>
        <select id="isActive">
          <option value="true">active</option>
          <option value="false">inactive</option>
        </select>
      </label>
    </div>

    <div class="form-grid">
      <label class="field" data-field="iconKey">
        <span>Icon token</span>
        <input id="metadataIconKey" class="mono" placeholder="meal_default">
      </label>
      <label class="field" data-field="inputMode">
        <span>Input mode</span>
        <select id="metadataInputMode"></select>
      </label>
      <label class="field" data-field="defaultAmount">
        <span>Default amount</span>
        <input id="metadataDefaultAmount" type="number" step="0.01" placeholder="500">
      </label>
      <label class="field" data-field="defaultUnit">
        <span>Default unit</span>
        <input id="metadataDefaultUnit" class="mono" placeholder="ml">
      </label>
      <label class="field" data-field="shortcutKey">
        <span>Shortcut key</span>
        <input id="metadataShortcutKey" class="mono" placeholder="coffee">
      </label>
    </div>

    <div class="details">
      <details>
        <summary>Advanced metadata</summary>
        <div class="form-grid">
          <label class="field field-wide">
            <span>Description</span>
            <textarea id="metadataDescription" placeholder="What this value means in prediction"></textarea>
          </label>
          <label class="field field-wide">
            <span>Setup text</span>
            <textarea id="metadataSetupText" placeholder="Text shown during setup"></textarea>
          </label>
          <label class="field field-wide">
            <span>Input hint</span>
            <textarea id="metadataInputHint" placeholder="How the user should enter this value"></textarea>
          </label>
          <label class="field">
            <span>Prediction unit</span>
            <input id="metadataUnit" class="mono" placeholder="kg, hours, kg/hour">
          </label>
          <label class="field">
            <span>Required in setup</span>
            <select id="metadataRequiredInSetup">
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
        </div>
      </details>
    </div>

    <div class="row actions">
      <button onclick="save()">Save</button>
      <button class="secondary" onclick="resetForm(activeKind)">New</button>
    </div>
    <p id="formHelp" class="status" style="margin-top: 12px;"></p>
  </section>

  <section>
    <div class="section-head">
      <div>
        <h2>Current items</h2>
        <p>shortcut metadata와 fallback 결과를 함께 보여줍니다. global row는 Edit만 가능하고 Delete는 숨깁니다.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>kind</th>
            <th>label</th>
            <th>key</th>
            <th>icon</th>
            <th>input mode</th>
            <th>default</th>
            <th>mass</th>
            <th>stool</th>
            <th>minute</th>
            <th>order</th>
            <th>active</th>
            <th>description</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="items"></tbody>
      </table>
    </div>
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
const SHORTCUT_PRESETS = ${shortcutPresetsJson};
const DEFAULT_ICON_KEYS = ${defaultIconKeysJson};
const DEFAULT_INPUT_MODES = ${defaultInputModesJson};
const INPUT_MODE_OPTIONS = ${inputModesJson};
const ICON_LABELS = {
  meal_default: 'Meal',
  meal_salad: 'Salad',
  meal_balance: 'Balance',
  meal_protein: 'Protein',
  meal_meat: 'Meat',
  drink_default: 'Drink',
  drink_coffee: 'Coffee',
  drink_sparkling: 'Sparkling',
  bathroom_default: 'Bathroom',
  bathroom_urine: 'Urine',
  bathroom_bowel: 'Bowel',
  workout_default: 'Workout',
  workout_walk: 'Walk',
  workout_stairs: 'Stairs',
  workout_squat: 'Squat',
  workout_pushup: 'Pushup',
  workout_run: 'Run'
};
const FIELD_VISIBILITY = {
  global: ['massKg'],
  meal: ['massKg', 'stoolRatio', 'isActive', 'iconKey', 'inputMode', 'shortcutKey'],
  drink: ['massKg', 'isActive', 'iconKey', 'inputMode', 'defaultAmount', 'defaultUnit', 'shortcutKey'],
  bathroom: ['massKg', 'isActive', 'iconKey', 'inputMode', 'shortcutKey'],
  workout: ['minuteFactor', 'isActive', 'iconKey', 'inputMode', 'defaultAmount', 'defaultUnit', 'shortcutKey']
};
const KIND_INPUT_MODE_OPTIONS = {
  meal: ['portion_size'],
  drink: ['ml'],
  bathroom: ['none'],
  workout: ['times', 'minutes']
};
const FORM_HELP = {
  global: 'global value는 table에서 선택해 수정만 가능합니다. 새 global key 생성은 계속 막혀 있습니다.',
  meal: 'meal.massKg는 기본 1회 섭취 무게, stoolRatio는 배출 비율입니다. shortcut은 소/중/대 입력 흐름을 전제로 metadata.inputMode=portion_size를 채웁니다.',
  drink: 'drink.massKg는 기본 입력량(defaultAmount/defaultUnit) 기준 무게입니다. coffee, drink, sparkling shortcut은 기본 ml를 미리 채웁니다.',
  bathroom: 'bathroom.massKg는 이벤트 1회 기준 변화량입니다. 소변/대변 shortcut은 입력 없이 저장 가능한 metadata.inputMode=none을 채웁니다.',
  workout: 'workout.minuteFactor는 예측에서 쓰는 감소 계수입니다. walk/stairs/squat/pushup은 times, run은 minutes shortcut을 사용합니다.'
};
let editingId = null;
let editingMetadata = {};
let selectedImportFile = null;
let loadingCount = 0;
let configEvents = null;
let activeKind = 'meal';
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
    '<td><span class="badge mono">' + escapeHtml(row.kind) + '</span></td>' +
    '<td>' + escapeHtml(row.label) + '</td>' +
    '<td class="mono">' + escapeHtml(row.key) + '</td>' +
    '<td>' + renderIconBadge(row) + '</td>' +
    '<td>' + escapeHtml(((row.metadata && row.metadata.inputMode) || '')) + '</td>' +
    '<td>' + escapeHtml(renderDefaultAmount(row.metadata || {})) + '</td>' +
    '<td>' + escapeHtml(row.massKg ?? '') + '</td><td>' + escapeHtml(row.stoolRatio ?? '') + '</td><td>' + escapeHtml(row.minuteFactor ?? '') + '</td><td>' + escapeHtml(row.sortOrder) + '</td><td>' + escapeHtml(row.isActive) + '</td>' +
    '<td class="metadata-text">' + escapeHtml((row.metadata && row.metadata.description) || '') + '</td>' +
    '<td><button onclick="edit(' + escapeAttribute(JSON.stringify(row)) + ')">Edit</button> ' +
    (row.kind === 'global' ? '' : '<button class="danger" onclick="removeItem(\\'' + row.id + '\\')">Delete</button>') +
    '</td></tr>'
  ).join('');
  setStatus('Loaded', 'success');
}
function subscribeConfigEvents() {
  if (configEvents) return;
  configEvents = new EventSource('/prediction-config/events');
  const reloadFromEvent = () => {
    load().catch((error) => setStatus(error.message || 'Sync failed', 'error'));
  };
  configEvents.onmessage = reloadFromEvent;
  configEvents.addEventListener('prediction-config', reloadFromEvent);
  configEvents.onerror = () => {
    setStatus('Realtime sync disconnected', 'error');
  };
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function escapeAttribute(value) {
  return "'" + escapeHtml(value) + "'";
}
function renderIconBadge(row) {
  const metadata = row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const iconKey = metadata.iconKey || '';
  if (!iconKey) return '';
  const label = ICON_LABELS[iconKey] || iconKey;
  return '<span class="badge mono">' + escapeHtml(label) + '</span>';
}
function renderDefaultAmount(metadata) {
  const amount = metadata && typeof metadata.defaultAmount === 'number' ? String(metadata.defaultAmount) : '';
  const unit = metadata && typeof metadata.defaultUnit === 'string' ? metadata.defaultUnit : '';
  return [amount, unit].filter(Boolean).join(' ');
}
function edit(row) {
  if (typeof row === 'string') row = JSON.parse(row);
  editingId = row.id;
  editingMetadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const isGlobal = row.kind === 'global';
  activeKind = row.kind;
  syncKindTabs();
  renderInputModeOptions(row.kind, editingMetadata.inputMode || (DEFAULT_INPUT_MODES[row.kind] || ''));
  renderShortcutStrip();
  updateFieldVisibility();
  updateEditingNotice(isGlobal ? 'global row를 수정 중입니다. key/active는 고정되고 저장 시 update만 수행합니다.' : '기존 item을 수정 중입니다. 필요하면 shortcut을 다시 눌러 metadata를 덮어쓴 뒤 저장하세요.');
  document.getElementById('kindDisplay').value = row.kind;
  document.getElementById('key').disabled = isGlobal;
  document.getElementById('isActive').disabled = isGlobal;
  for (const key of ['key','label','massKg','stoolRatio','minuteFactor','sortOrder']) document.getElementById(key).value = row[key] ?? '';
  document.getElementById('isActive').value = row.isActive ? 'true' : 'false';
  document.getElementById('metadataIconKey').value = editingMetadata.iconKey || '';
  document.getElementById('metadataDefaultAmount').value = editingMetadata.defaultAmount ?? '';
  document.getElementById('metadataDefaultUnit').value = editingMetadata.defaultUnit || '';
  document.getElementById('metadataShortcutKey').value = editingMetadata.shortcutKey || '';
  document.getElementById('metadataDescription').value = editingMetadata.description || '';
  document.getElementById('metadataSetupText').value = editingMetadata.setupText || '';
  document.getElementById('metadataInputHint').value = editingMetadata.inputHint || '';
  document.getElementById('metadataUnit').value = editingMetadata.unit || '';
  document.getElementById('metadataRequiredInSetup').value = editingMetadata.requiredInSetup ? 'true' : 'false';
  updateFormLabels();
  updateFormHelp();
}
function resetForm(nextKind) {
  activeKind = nextKind || activeKind || 'meal';
  editingId = null;
  editingMetadata = {};
  syncKindTabs();
  document.getElementById('kindDisplay').value = activeKind;
  document.getElementById('key').disabled = false;
  document.getElementById('isActive').disabled = false;
  for (const key of ['key','label','massKg','stoolRatio','minuteFactor','sortOrder','metadataDescription','metadataSetupText','metadataInputHint','metadataUnit']) document.getElementById(key).value = '';
  document.getElementById('isActive').value = 'true';
  document.getElementById('metadataRequiredInSetup').value = 'false';
  document.getElementById('metadataShortcutKey').value = '';
  document.getElementById('metadataDefaultAmount').value = '';
  document.getElementById('metadataDefaultUnit').value = activeKind === 'drink' ? 'ml' : (activeKind === 'workout' ? DEFAULT_INPUT_MODES[activeKind] : '');
  document.getElementById('metadataIconKey').value = activeKind === 'global' ? '' : DEFAULT_ICON_KEYS[activeKind];
  renderInputModeOptions(activeKind, activeKind === 'global' ? '' : DEFAULT_INPUT_MODES[activeKind]);
  renderShortcutStrip();
  updateFieldVisibility();
  updateFormLabels();
  updateEditingNotice('');
  updateFormHelp();
}
function syncKindTabs() {
  for (const kind of ['meal', 'drink', 'bathroom', 'workout']) {
    document.getElementById('kindTab-' + kind).classList.toggle('active', activeKind === kind);
  }
}
function renderShortcutStrip() {
  const container = document.getElementById('shortcutStrip');
  if (activeKind === 'global') {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  const presets = SHORTCUT_PRESETS[activeKind] || [];
  container.innerHTML = presets.map((preset) =>
    '<button class="shortcut-button" type="button" onclick="applyShortcut(' + escapeAttribute(JSON.stringify(preset)) + ')">' +
      escapeHtml(preset.label) +
      '<span class="muted">' + escapeHtml(preset.key) + '</span>' +
    '</button>'
  ).join('');
}
function updateEditingNotice(message) {
  const notice = document.getElementById('editingNotice');
  notice.textContent = message || '';
  notice.classList.toggle('hidden', !message);
}
function updateFieldVisibility() {
  const visibleFields = FIELD_VISIBILITY[activeKind] || [];
  for (const field of document.querySelectorAll('[data-field]')) {
    field.dataset.hidden = visibleFields.includes(field.dataset.field) ? 'false' : 'true';
  }
}
function updateFormLabels() {
  document.getElementById('massKgLabel').textContent =
    activeKind === 'meal' ? 'Mass kg per portion' :
    activeKind === 'drink' ? 'Mass kg per default amount' :
    activeKind === 'bathroom' ? 'Mass kg per event' :
    activeKind === 'global' ? 'Value' :
    'Mass kg';
  document.getElementById('minuteFactorLabel').textContent =
    activeKind === 'workout' ? 'Minute factor' : 'Minute factor';
}
function updateFormHelp() {
  document.getElementById('formHelp').textContent = FORM_HELP[activeKind] || '';
}
function renderInputModeOptions(kind, selectedValue) {
  const select = document.getElementById('metadataInputMode');
  const options = kind === 'global' ? [] : (KIND_INPUT_MODE_OPTIONS[kind] || INPUT_MODE_OPTIONS);
  if (!options.length) {
    select.innerHTML = '<option value="">n/a</option>';
    select.value = '';
    return;
  }
  const current = options.includes(selectedValue) ? selectedValue : options[0];
  select.innerHTML = options.map((mode) => '<option value="' + escapeHtml(mode) + '">' + escapeHtml(mode) + '</option>').join('');
  select.value = current;
}
function applyShortcut(preset) {
  if (typeof preset === 'string') preset = JSON.parse(preset);
  if (!preset || preset.kind !== activeKind) return;
  document.getElementById('key').value = preset.key;
  document.getElementById('label').value = preset.label;
  document.getElementById('metadataIconKey').value = preset.iconKey;
  document.getElementById('metadataShortcutKey').value = preset.shortcutKey;
  document.getElementById('metadataDefaultAmount').value = typeof preset.defaultAmount === 'number' ? String(preset.defaultAmount) : '';
  document.getElementById('metadataDefaultUnit').value = preset.defaultUnit || '';
  renderInputModeOptions(activeKind, preset.inputMode);
  document.getElementById('isActive').value = 'true';
  updateEditingNotice('shortcut이 form 값만 채웠습니다. 저장 전 key, label, icon, input mode, default amount를 수정할 수 있습니다.');
}
function stringOrUndefined(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
function numberOrUndefined(id) {
  const value = document.getElementById(id).value.trim();
  return value === '' ? undefined : Number(value);
}
function assignKnownValue(target, key, value) {
  if (typeof value === 'undefined') {
    delete target[key];
    return;
  }
  target[key] = value;
}
function collectMetadata() {
  const metadata = { ...editingMetadata };
  assignKnownValue(metadata, 'description', stringOrUndefined(document.getElementById('metadataDescription').value));
  assignKnownValue(metadata, 'setupText', stringOrUndefined(document.getElementById('metadataSetupText').value));
  assignKnownValue(metadata, 'inputHint', stringOrUndefined(document.getElementById('metadataInputHint').value));
  assignKnownValue(metadata, 'unit', stringOrUndefined(document.getElementById('metadataUnit').value));
  assignKnownValue(metadata, 'requiredInSetup', document.getElementById('metadataRequiredInSetup').value === 'true');
  if (activeKind === 'global') {
    delete metadata.iconKey;
    delete metadata.inputMode;
    delete metadata.defaultAmount;
    delete metadata.defaultUnit;
    delete metadata.shortcutKey;
    return metadata;
  }
  assignKnownValue(metadata, 'iconKey', stringOrUndefined(document.getElementById('metadataIconKey').value) || DEFAULT_ICON_KEYS[activeKind]);
  assignKnownValue(metadata, 'inputMode', document.getElementById('metadataInputMode').value || DEFAULT_INPUT_MODES[activeKind]);
  assignKnownValue(metadata, 'defaultAmount', numberOrUndefined('metadataDefaultAmount'));
  assignKnownValue(metadata, 'defaultUnit', stringOrUndefined(document.getElementById('metadataDefaultUnit').value));
  assignKnownValue(metadata, 'shortcutKey', stringOrUndefined(document.getElementById('metadataShortcutKey').value));
  return metadata;
}
async function save() {
  const metadata = collectMetadata();
  const payload = {
    kind: activeKind,
    key: document.getElementById('key').value.trim(),
    label: document.getElementById('label').value.trim(),
    massKg: nullableNumber('massKg'),
    stoolRatio: nullableNumber('stoolRatio'),
    minuteFactor: nullableNumber('minuteFactor'),
    sortOrder: Number(document.getElementById('sortOrder').value || 0),
    isActive: document.getElementById('isActive').value === 'true',
    metadata
  };
  await api(editingId ? '/admin/prediction-config/items/' + editingId : '/admin/prediction-config/items', {
    method: editingId ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
    loadingText: 'Saving config...'
  });
  resetForm(activeKind === 'global' ? 'meal' : activeKind);
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

resetForm('meal');
assertLoggedIn().then(() => {
  subscribeConfigEvents();
  return load();
}).catch(() => {
  window.location.href = '/admin/login';
});
</script>
</body>
</html>`;
