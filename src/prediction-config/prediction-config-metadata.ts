import {
  PredictionConfigInputMode,
  PredictionConfigItemDto,
  PredictionConfigKind,
  PredictionConfigMetadata,
  UpsertPredictionConfigItemDto,
} from './dto';

export type NonGlobalPredictionConfigKind = Exclude<PredictionConfigKind, 'global'>;

export interface PredictionConfigShortcutPreset {
  kind: NonGlobalPredictionConfigKind;
  shortcutKey: string;
  key: string;
  label: string;
  iconKey: string;
  inputMode: PredictionConfigInputMode;
  defaultAmount?: number;
  defaultUnit?: string;
}

export const PREDICTION_CONFIG_INPUT_MODES: PredictionConfigInputMode[] = ['portion_size', 'ml', 'minutes', 'times', 'none'];
export const PREDICTION_CONFIG_NON_GLOBAL_KINDS: NonGlobalPredictionConfigKind[] = ['meal', 'drink', 'bathroom', 'workout'];

export const PREDICTION_CONFIG_DEFAULT_ICON_KEYS: Record<NonGlobalPredictionConfigKind, string> = {
  meal: 'meal_default',
  drink: 'drink_default',
  bathroom: 'bathroom_default',
  workout: 'workout_default',
};

export const PREDICTION_CONFIG_DEFAULT_INPUT_MODE: Record<NonGlobalPredictionConfigKind, PredictionConfigInputMode> = {
  meal: 'portion_size',
  drink: 'ml',
  bathroom: 'none',
  workout: 'times',
};

const shortcutPresetList: PredictionConfigShortcutPreset[] = [
  { kind: 'meal', shortcutKey: 'salad', key: 'salad', label: 'Salad', iconKey: 'meal_salad', inputMode: 'portion_size' },
  { kind: 'meal', shortcutKey: 'balance', key: 'balance', label: 'Balance', iconKey: 'meal_balance', inputMode: 'portion_size' },
  { kind: 'meal', shortcutKey: 'protein', key: 'protein', label: 'Protein', iconKey: 'meal_protein', inputMode: 'portion_size' },
  { kind: 'meal', shortcutKey: 'meat', key: 'meat', label: 'Meat', iconKey: 'meal_meat', inputMode: 'portion_size' },
  { kind: 'drink', shortcutKey: 'coffee', key: 'coffee', label: 'Coffee', iconKey: 'drink_coffee', inputMode: 'ml', defaultAmount: 500, defaultUnit: 'ml' },
  { kind: 'drink', shortcutKey: 'drink', key: 'drink', label: 'Drink', iconKey: 'drink_default', inputMode: 'ml', defaultAmount: 500, defaultUnit: 'ml' },
  { kind: 'drink', shortcutKey: 'sparkling', key: 'sparkling', label: 'Sparkling', iconKey: 'drink_sparkling', inputMode: 'ml', defaultAmount: 750, defaultUnit: 'ml' },
  { kind: 'bathroom', shortcutKey: 'urine', key: 'urine', label: '소변', iconKey: 'bathroom_urine', inputMode: 'none' },
  { kind: 'bathroom', shortcutKey: 'bowel', key: 'bowel', label: '대변', iconKey: 'bathroom_bowel', inputMode: 'none' },
  { kind: 'workout', shortcutKey: 'walk', key: 'walk', label: '걷기', iconKey: 'workout_walk', inputMode: 'times', defaultUnit: 'times' },
  { kind: 'workout', shortcutKey: 'stairs', key: 'stairs', label: '계단', iconKey: 'workout_stairs', inputMode: 'times', defaultUnit: 'times' },
  { kind: 'workout', shortcutKey: 'squat', key: 'squat', label: '스쿼트', iconKey: 'workout_squat', inputMode: 'times', defaultUnit: 'times' },
  { kind: 'workout', shortcutKey: 'pushup', key: 'pushup', label: '푸시업', iconKey: 'workout_pushup', inputMode: 'times', defaultUnit: 'times' },
  { kind: 'workout', shortcutKey: 'run', key: 'run', label: '뛰기', iconKey: 'workout_run', inputMode: 'minutes', defaultUnit: 'minutes' },
];

export const PREDICTION_CONFIG_SHORTCUT_PRESETS: Record<NonGlobalPredictionConfigKind, PredictionConfigShortcutPreset[]> = {
  meal: shortcutPresetList.filter((preset) => preset.kind === 'meal'),
  drink: shortcutPresetList.filter((preset) => preset.kind === 'drink'),
  bathroom: shortcutPresetList.filter((preset) => preset.kind === 'bathroom'),
  workout: shortcutPresetList.filter((preset) => preset.kind === 'workout'),
};

export function isPredictionConfigKind(value: unknown): value is PredictionConfigKind {
  return value === 'global' || value === 'meal' || value === 'drink' || value === 'bathroom' || value === 'workout';
}

export function isPredictionConfigInputMode(value: unknown): value is PredictionConfigInputMode {
  return typeof value === 'string' && PREDICTION_CONFIG_INPUT_MODES.includes(value as PredictionConfigInputMode);
}

export function normalizePredictionConfigMetadata(kind: PredictionConfigKind, value: unknown): PredictionConfigMetadata {
  const metadata = isPlainObject(value) ? ({ ...(value as Record<string, unknown>) } as PredictionConfigMetadata) : {};

  const description = normalizeString(metadata.description);
  const setupText = normalizeString(metadata.setupText);
  const inputHint = normalizeString(metadata.inputHint);
  const unit = normalizeString(metadata.unit);
  const iconKey = normalizeString(metadata.iconKey);
  const defaultUnit = normalizeString(metadata.defaultUnit);
  const shortcutKey = normalizeString(metadata.shortcutKey);
  const inputMode = isPredictionConfigInputMode(metadata.inputMode) ? metadata.inputMode : undefined;
  const defaultAmount = typeof metadata.defaultAmount === 'number' && Number.isFinite(metadata.defaultAmount) ? metadata.defaultAmount : undefined;
  const requiredInSetup = typeof metadata.requiredInSetup === 'boolean' ? metadata.requiredInSetup : undefined;

  assignKnownValue(metadata, 'description', description);
  assignKnownValue(metadata, 'setupText', setupText);
  assignKnownValue(metadata, 'inputHint', inputHint);
  assignKnownValue(metadata, 'unit', unit);
  assignKnownValue(metadata, 'iconKey', iconKey);
  assignKnownValue(metadata, 'defaultUnit', defaultUnit);
  assignKnownValue(metadata, 'shortcutKey', shortcutKey);
  assignKnownValue(metadata, 'inputMode', inputMode);
  assignKnownValue(metadata, 'defaultAmount', defaultAmount);
  assignKnownValue(metadata, 'requiredInSetup', requiredInSetup);

  if (kind === 'global') {
    return metadata;
  }

  const preset = shortcutKey ? getPredictionConfigShortcutPreset(kind, shortcutKey) : null;
  if (!metadata.iconKey) {
    metadata.iconKey = preset?.iconKey ?? PREDICTION_CONFIG_DEFAULT_ICON_KEYS[kind];
  }
  if (!metadata.inputMode) {
    metadata.inputMode = preset?.inputMode ?? PREDICTION_CONFIG_DEFAULT_INPUT_MODE[kind];
  }
  if (typeof metadata.defaultAmount !== 'number' && typeof preset?.defaultAmount === 'number') {
    metadata.defaultAmount = preset.defaultAmount;
  }
  if (typeof metadata.defaultUnit !== 'string' && typeof preset?.defaultUnit === 'string') {
    metadata.defaultUnit = preset.defaultUnit;
  }
  return metadata;
}

export function normalizePredictionConfigPayload(payload: UpsertPredictionConfigItemDto): UpsertPredictionConfigItemDto {
  return {
    ...payload,
    metadata: normalizePredictionConfigMetadata(payload.kind, payload.metadata),
  };
}

export function hydratePredictionConfigItem(item: PredictionConfigItemDto): PredictionConfigItemDto {
  return {
    ...item,
    metadata: normalizePredictionConfigMetadata(item.kind, item.metadata),
  };
}

export function getPredictionConfigShortcutPreset(
  kind: NonGlobalPredictionConfigKind,
  shortcutKey: string,
): PredictionConfigShortcutPreset | null {
  return PREDICTION_CONFIG_SHORTCUT_PRESETS[kind].find((preset) => preset.shortcutKey === shortcutKey) ?? null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function assignKnownValue(metadata: PredictionConfigMetadata, key: string, value: unknown): void {
  if (typeof value === 'undefined') {
    delete metadata[key];
    return;
  }
  metadata[key] = value;
}
