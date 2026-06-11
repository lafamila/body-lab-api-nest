---
status: PREPARED
summary: "body-lab native 설정 화면을 위해 prediction config metadata와 날짜별 weight/record API contract를 보강한다"
---

# BODY LAB APP SETTINGS — body-lab-api-nest execution plan

Canonical orchestration plan:

`../.idea/BODY_LAB_APP_SETTINGS_PLAN.md`

## Repo Responsibility
`body-lab-api-nest`는 native 앱과 admin이 공유할 prediction config metadata를 제공하고, native 설정 수정 및 날짜별 기록 관리를 위한 서버 contract를 확정/구현한다. 특히 날짜별 weight는 중복될 수 없고, records 삭제는 서버까지 반영되어야 한다.

## Inputs / Dependencies
- Root canonical plan의 확정 결정:
  - 필수 global key: `fasting_threshold_hours`, `fasting_max_hours`, `fasting_hour_kg`, `steps_10000_kg`, `delta_min_kg`, `delta_max_kg`
  - `meal`, `drink`, `bathroom`, `workout`은 각 kind별 active item 최소 1개 이상
  - 설명 문구는 API metadata가 source of truth
  - 로그인된 body-lab 계정이면 config 수정 허용
  - 날짜별 weight는 하나만 허용
  - weight 외 records 삭제는 서버 delete까지 호출
- `body-lab-app-swift`가 metadata를 디코딩하고 settings/onboarding UI에 표시할 예정.

## Work Items
1. Prediction config schema 보강
   - `prediction_config_items`에 metadata 저장 필드를 추가한다.
   - metadata에는 최소한 설명/입력 도움말/단위/초기 설정 표시용 정보를 담을 수 있어야 한다.
   - DTO, repository, service, controller response에 metadata를 포함한다.

2. Default/seed config metadata 작성
   - 필수 global 6개에 대해 계산에서 어디에 쓰이는지 설명을 채운다.
   - meal/drink/bathroom/workout 기본 항목에도 입력 방법과 계산 의미를 설명한다.
   - 기존 default config 또는 seed 경로가 있다면 metadata를 함께 업데이트한다.

3. Config validation/status API 보강
   - native가 초기 설정 필요 여부를 판단할 수 있도록 `prediction-config` 응답 자체에서 충분한 정보를 제공하거나, 별도 status endpoint를 추가한다.
   - 최소 조건:
     - global 필수 6개 active 존재
     - meal/drink/bathroom/workout 각 active item 1개 이상

4. Native config mutation contract 확인/보강
   - 기존 `/admin/prediction-config/items`가 로그인 세션 기반으로 native에서도 쓰기 적절한지 확인한다.
   - admin 전용 이름/HTML 의존성이 강하면 app-facing endpoint를 추가한다.
   - create/update/deactivate/delete 이후 기존 Redis/SSE config publish가 유지되어야 한다.

5. Admin 페이지 설명 표시/수정
   - admin config table/form에서 metadata 설명을 볼 수 있고 수정할 수 있게 한다.
   - global key별 의미가 admin에서도 드러나야 한다.
   - 모든 API 호출 loading status 기존 UX와 일관되게 유지한다.

6. 날짜별 weight 단일화
   - DB/API 레벨에서 한 계정의 한 날짜에 weight가 하나만 존재하도록 한다.
   - 아직 배포 전이고 로컬 테스트 데이터 초기화가 허용되므로, 필요한 migration에서 테스트 데이터 정리/초기화를 포함해도 된다.
   - 구현 후 동일 날짜 weight 입력은 insert 중복이 아니라 update로 수렴해야 한다.

7. 날짜별 record 삭제 contract 확인/보강
   - meal/drink/manual-workout/bathroom/health 등 records 삭제에 필요한 endpoint가 있는지 확인한다.
   - 없는 리소스는 삭제 endpoint를 추가하거나 native plan에 삭제 불가 리소스로 보고한다.
   - 삭제는 soft delete 기존 정책이 있으면 그 정책을 따른다.

8. Tests
   - prediction config metadata round-trip 테스트.
   - 필수 config validation/status 테스트.
   - 날짜별 weight 단일화 테스트.
   - records delete API 테스트.
   - 기존 export/import/admin 테스트가 깨지지 않게 갱신한다.

## Acceptance Criteria
- `prediction-config` 관련 응답에 metadata가 포함된다.
- admin 페이지에서 config 설명을 확인/수정할 수 있다.
- 로그인 세션으로 config 추가/수정/비활성화가 가능하고 SSE publish가 유지된다.
- 필수 config 조건을 서버 또는 native가 정확히 판정할 수 있는 contract가 있다.
- 날짜별 weight가 서버/DB에서 중복 생성되지 않는다.
- weight 외 records 삭제 API가 native에서 호출 가능한 형태로 제공된다.
- 다음 명령이 통과한다.
  - `npm run build`
  - `npm run lint`
  - `npm test -- --runInBand`
  - `npm run test:e2e`

## Report Back To Orchestrator
- `body-lab-app-swift`가 사용해야 할 최종 metadata JSON shape.
- native가 사용해야 할 config mutation endpoint 경로와 payload.
- records delete endpoint 목록과 삭제 후 응답 contract.
- 날짜별 weight 단일화에 사용한 DB/API 기준.
- 로컬 테스트 데이터 초기화 또는 migration으로 제거된 데이터가 있으면 보고.

## Decision Escalation
사용자가 결정해야 하는 주요 사안은 임의로 판단하지 않는다. 작업을 중단하고 현재 orchestrator 에게 전달해 결정받은 뒤 진행한다. orchestrator 에 보고할 수 없으면 workspace root `.idea/` 에 handoff 문서를 남긴다.
