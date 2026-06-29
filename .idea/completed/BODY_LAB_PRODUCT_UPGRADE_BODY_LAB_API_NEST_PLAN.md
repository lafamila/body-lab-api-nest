---
status: COMPLETED
completed_at: 2026-06-29
completion_reason: "Implemented metadata/admin contract and verified build/lint/tests."
summary: "body-lab API의 prediction config metadata 계약과 내장 /admin enum 관리 UX를 제품화한다."
---

# BODY_LAB_PRODUCT_UPGRADE — body-lab-api-nest execution plan

Canonical orchestration plan:

`../../.idea/BODY_LAB_PRODUCT_UPGRADE_PLAN.md`

## Repo Responsibility
`body-lab-api-nest`는 prediction config의 서버 계약과 내장 `/admin` 페이지를 책임진다.

이번 작업에서 이 repo는 다음을 제공해야 한다.

- `metadata.iconKey`, `metadata.inputMode`, `metadata.defaultAmount`, `metadata.defaultUnit`, `metadata.shortcutKey` 계약
- meal/drink/bathroom/workout shortcut preset과 kind별 기본 icon fallback
- 기존 global config를 직접 생성 대상이 아닌 기본/고정 config로 유지
- 내장 `/admin` HTML/JS의 kind별 add form, shortcut fill, metadata edit, import/export 호환

## Inputs / Dependencies
- root canonical plan: `../../.idea/BODY_LAB_PRODUCT_UPGRADE_PLAN.md`
- Swift client repo plan: `../../body-lab-app-swift/.idea/BODY_LAB_PRODUCT_UPGRADE_BODY_LAB_APP_SWIFT_PLAN.md`
- 현재 prediction config DTO: `src/prediction-config/dto.ts`
- 현재 내장 admin HTML/JS: `src/prediction-config/prediction-config.controller.ts`
- 현재 global creation guard: `src/prediction-config/prediction-config.service.ts`

## Work Items
1. Prediction config metadata 계약을 명시한다.
   - `PredictionConfigInputMode = 'portion_size' | 'ml' | 'minutes' | 'times' | 'none'` 타입을 둔다.
   - `PredictionConfigMetadata`를 단순 `Record<string, unknown>`에서 알려진 optional key를 가진 타입으로 확장하되, 기존 unknown metadata key가 import/export에서 손실되지 않게 한다.
   - `iconKey`, `inputMode`, `defaultAmount`, `defaultUnit`, `shortcutKey`를 validator/normalizer에서 다룬다.

2. Shortcut preset과 fallback 규칙을 서버 코드로 분리한다.
   - meal: `salad`, `balance`, `protein`, `meat`
   - drink: `coffee` 500ml, `drink` 500ml, `sparkling` 750ml
   - bathroom: `urine`, `bowel`
   - workout: `walk`, `stairs`, `squat`, `pushup`은 `times`, `run`은 `minutes`
   - 알 수 없는/custom enum은 kind별 기본 icon token으로 fallback한다.

3. 기존 데이터 호환을 보장한다.
   - 기존 item에 metadata가 없거나 새 key가 없어도 list/status/import/export가 실패하지 않게 한다.
   - 기존 workout item에 `inputMode`가 없으면 `times`로 취급한다.
   - 기존 global config는 계속 생성 불가이며, admin UI에서도 새 global 생성 흐름을 제공하지 않는다.

4. 내장 `/admin`을 kind별 form 구조로 바꾼다.
   - 공통 kind selector 하나로 모든 item을 만드는 구조를 제거하거나 보조 edit 흐름으로만 축소한다.
   - `meal`, `drink`, `bathroom`, `workout`별 add/edit form을 둔다.
   - 각 form은 해당 kind에 필요한 필드만 기본 노출한다.
   - shortcut 버튼은 즉시 저장하지 않고 form 값을 미리 채우며, 사용자가 수정 후 저장한다.

5. `/admin`에 최소 디자인 시스템을 적용한다.
   - 버튼 크기, input, select, textarea, badge, table, modal/section spacing을 한 곳의 CSS token/class로 통일한다.
   - 현재 `DESIGN.md`, `DESIGN_ADD.md`는 사용하지 않는다.
   - textarea resize는 막고, 페이지별로 서로 다른 버튼 크기가 생기지 않게 한다.

6. `/admin` list/import/export를 metadata 확장과 맞춘다.
   - list table에 kind, label, key, icon, input mode, default amount/unit, active 여부를 확인할 수 있게 한다.
   - import/export는 기존 backup JSON과 새 metadata를 모두 round-trip한다.
   - metadata가 object가 아니면 기존처럼 reject한다.

7. 테스트를 보강한다.
   - metadata round-trip test에 새 key를 추가한다.
   - import/export backup test에 icon/inputMode/defaultAmount/defaultUnit/shortcutKey를 포함한다.
   - global creation reject test는 유지한다.

## Acceptance Criteria
- `/admin`에서 meal/drink/bathroom/workout별 add form으로 item을 생성/수정할 수 있다.
- `/admin` shortcut 버튼은 form만 채우고 저장은 사용자가 명시적으로 실행한다.
- shortcut item은 저장 시 `iconKey`, `inputMode`, `shortcutKey` 및 필요한 default amount/unit을 metadata에 가진다.
- 기존 metadata가 없는 item도 list/status/import/export에서 정상 동작한다.
- global item 신규 생성은 계속 막힌다.
- `npm run build`가 통과한다.
- prediction config 관련 unit test와 admin import/export test가 통과한다.

## Report Back To Orchestrator
- Swift에서 반드시 맞춰야 하는 metadata key 또는 fallback이 변경되면 보고한다.
- DB migration이 필요하다고 판단되면 임의로 만들기 전에 이유와 영향을 보고한다.
- 내장 `/admin` 구조상 별도 파일 분리가 필요하다고 판단되면 범위와 이유를 보고한다.
- 테스트를 실행하지 못한 경우, 명령어와 실패 이유를 보고한다.

## Decision Escalation
사용자가 결정해야 하는 주요 사안은 임의로 판단하지 않는다. 작업을 중단하고 현재 orchestrator 에게 전달해 결정받은 뒤 진행한다. orchestrator 에 보고할 수 없으면 workspace root `.idea/` 에 handoff 문서를 남긴다.
