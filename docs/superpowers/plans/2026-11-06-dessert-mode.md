# 디저트 모드 (3단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면에 세 번째 모드 "디저트"를 더한다. 디저트 메뉴 32개를 새로 쓰고 기존 간식·디저트 메뉴 6개를 디저트로 표시한다. 디저트는 식사 모드에 나오지 않는다.

**Architecture:** 메뉴에 `dessert: true`를 더하고, `MODES`에 `dessert` 모드를 더한다. 식사 모드 후보에서는 디저트를 뺀다. 화면 코드는 `MODES`를 도는 기존 반복문이 그대로 처리하므로 거의 바꾸지 않는다.

**Tech Stack:** 바닐라 JS, `node run-tests.js`(현재 PASS 88/88).

**Spec:** `docs/superpowers/specs/2026-11-03-modes-design.md`(모드 구조와 `ways`·`light`), 본 설계 `2026-11-03-eat-in-korea-design.md`(태그와 안전 문구). 단계 3 범위는 모드 설계 문서의 "후속 단계" 항목이다.

## Global Constraints

- 메뉴 객체 모양은 기존과 같다: `{ id, ko, emoji, rom, name: { en, zh }, desc: { en, zh, ko }, spice, feel, contains, ways, light }`에 `dessert: true`를 더한다(`dessert`가 없거나 false면 디저트가 아니다. 기존 217개는 `dessert`를 달지 않고 그대로 둔다). 기존 6개(`patbingsu`, `hotteok`, `bungeoppang`, `gyeranppang`, `goguma`, `tteok-kkochi`)는 `dessert: true` 한 줄만 더하고 다른 필드는 한 글자도 바꾸지 않는다.
- 새 디저트 32개는 `spice: 0`, `feel: "light"`, `light: false`(다이어트 후보에 넣지 않는다; 군고구마만 기존처럼 `light: true` 유지), `dessert: true`이다. `contains`는 `pork`, `meat`, `seafood`, `nuts`만 쓰고 보수적으로 단다: 호두·아몬드·땅콩·피스타치오·잣·밤·헤이즐넛·캐슈가 들어가거나 토핑·필링으로 흔하면 `nuts`(깨는 기존 관례대로 달지 않는다). 소시지·햄·베이컨이 들어가면 `pork`+`meat`. 디저트에 `seafood`는 거의 없다. 확신이 없으면 태그를 더 단다. **테스트 기준을 맞추려고 태그를 빼는 것은 금지.**
- `ways`는 `"dine"`을 항상 포함하고 `["dine","delivery","home"]`의 부분집합이다: 카페·디저트 가게에서 파는 것은 `dine`, 배달·포장이 흔하면 `delivery`, 집에서 흔히 만들거나 먹으면 `home`.
- `desc`는 세 언어 모두 한두 문장의 쉬운 설명이다(한글·중국어 글자 필수). 건강·다이어트·칼로리·당 효능 주장과 단정 표현 금지(**금지어**는 `tests.js`의 `FORBIDDEN` 상수 하나만 쓴다). 우유·달걀·밀가루 등 흔한 알레르기 재료는 설명에서 숨기지 않는다. 채식 필터는 "고기·생선 제외"이므로 달걀·유제품이 들어가도 `meat`/`seafood`를 달지 않지만, 젤라틴·라드 등 동물성 재료가 흔한 경우 설명에 밝힌다.
- 모드 설정(`modes.js`, 정확히): 기존 `meal`, `diet` 뒤에 `dessert: { labelKey: "modeDessert", descKey: "modeDessertDesc", questions: ["way", "restrictions"], pool: (m) => m.dessert === true }`; `meal.pool`은 `(m) => m.dessert !== true`; `diet.pool`은 `(m) => m.light === true`(변경 없음). 홈 카드 순서는 `Object.keys(MODES)` 그대로 `meal`, `diet`, `dessert`.
- `modeAnswers(mode, a)`(`logic.js`): 모드의 `questions`에 `feel`이 없으면 `feel`을 `"any"`로, `spice`가 없으면 `spice`를 `"hot"`(제한 없음)으로 바꿔서 돌려준다. 입력 객체는 바꾸지 않는다. 저장되는 `eik:lastAnswers`는 그대로 원래 `answers`이다.
- 새 문구 2개(이름·값 정확히): `modeDessert`: en `Dessert` / zh `甜点` / ko `디저트`; `modeDessertDesc`: en `Something sweet` / zh `来点甜的` / ko `달콤한 걸 골라줘요`. `STRING_KEYS`는 57개가 된다.
- 줄바꿈은 LF. 커밋 메시지 끝에 Co-Authored-By 줄. 브랜치 `feat/dessert-mode`, GitHub에 올리지 않는다. 서비스워커 `CACHE`는 `eik-v10`으로 올린다(Task 2).
- 개수 기준(테스트): 디저트 후보 ≥ 38(기존 6 + 새 32), 방식별(`dine`/`delivery`/`home`) 디저트 후보 ≥ 10, 방식별에서 제한 하나(`vegetarian`/`nuts`)를 켜도 ≥ 5(`nuts`는 ≥ 5), 식사 모드 후보(`meal.pool`)에서 `dessert: true`는 0개. 기존 모든 테스트 기준은 낮추지 않는다.

## Review Focus

1. **디저트가 식사·다이어트에 섞임**: 식사 모드에 호떡·빙수가 나오거나, 디저트 모드에 밥·국이 나오는 경우 → Task 1·2 테스트.
2. **숨겨진 질문이 걸러냄**: 디저트 모드에서 매운 정도 저장값이 `none`일 때 `spice 1`인 떡꼬치가 사라지는 경우 → `modeAnswers` 테스트.
3. **견과류 태그 누락**: 마카롱(아몬드), 호두과자, 브라우니, 쿠키, 젤라또(피스타치오), 밤·밤 디저트, 강정·정과류의 잣·땅콩 → 항목별 확인.
4. **건강·당 효능 주장** → 기존 `FORBIDDEN` 검사와 리뷰어 확인.
5. **옛 서비스워커가 옛 `modes.js`/`menus.js`를 보여줌** → `eik-v10` 테스트.

---

### Task 1: 디저트 모드 설정과 문구 (modes.js, logic.js, strings.js, 테스트)

**Files:** Modify `modes.js`, `logic.js`, `strings.js`, `tests.js`

**Interfaces:**
- Consumes: `MODES`, `modeAnswers`, `STRINGS`
- Produces: `MODES.dessert`, 바뀐 `MODES.meal.pool`, 바뀐 `modeAnswers`, 문구 키 `modeDessert`·`modeDessertDesc`

- [ ] **Step 1: 테스트 먼저(실패 확인)** (`tests.js`)
  - `MODES config`를 새 설정에 맞게 고친다: `Object.keys(MODES)`가 `["meal","diet","dessert"]`; `MODES.dessert.questions`가 `["way","restrictions"]`; 라벨·설명 키가 `modeDessert`/`modeDessertDesc`; `MODES.meal.pool({dessert:true})`는 false, `pool({})`·`pool({dessert:false})`는 true; `MODES.dessert.pool({dessert:true})` true, `{}`·`{dessert:false}` false.
  - `modeAnswers`: `modeAnswers(MODES.dessert, {restrictions:[], spice:"none", feel:"hearty", way:"dine"})`가 `spice "hot"`, `feel "any"`이고 입력 객체는 `feel "hearty"`, `spice "none"` 그대로; `modeAnswers(MODES.meal, a)`는 `a` 그대로(둘 다 보존); `modeAnswers(MODES.diet, a)`는 `feel "any"`이고 `spice`는 `a.spice` 그대로.
  - 문구: `STRING_KEYS`에 두 키를 더해 57개로(en/zh/ko 모두), 새 문구 값 정확히 일치(위 표).
  - `diet mode ignores hidden feel answer` 등 기존 테스트는 그대로 통과해야 한다.
  - 실행해서 FAIL을 확인한다.
- [ ] **Step 2: 구현** — `modes.js`, `logic.js`의 `modeAnswers`, `strings.js`(세 언어)를 Global Constraints 그대로. `app.js`·`index.html`·`style.css`는 바꾸지 않는다(반복문이 처리한다). 홈 카드 3개가 어긋나면 그 점만 보고한다.
- [ ] **Step 3: 통과 확인** — `node run-tests.js`가 FAIL 없이 통과. 브라우저 패널(375×812, 새 포트, localStorage 비움, 서비스워커 오류 무시)에서 홈에 카드 3개(식사, 다이어트, 디저트)가 세 언어로 맞게 보이고, 디저트를 누르면 질문이 2개(방식, 못 먹는 음식)이며 [골라줘요]가 동작해 결과가 나오는지(메뉴 데이터는 Task 2 전이라 기존 6개만) 확인한다. 끝나면 서버를 멈추고 뷰포트를 복원한다.
- [ ] **Step 4: Commit** — `git add modes.js logic.js strings.js tests.js && git commit -m "feat: add dessert mode config and strings"`

---

### Task 2: 디저트 메뉴 데이터와 캐시 버전 (menus.js, tests.js, sw.js, run-tests.js)

**Files:** Modify `menus.js`, `tests.js`, `sw.js`, `run-tests.js`

**Interfaces:**
- Consumes: Task 1의 `MODES.dessert`
- Produces: 디저트 후보 38개, `MENUS.length === 255`, 캐시 `eik-v10`

기존 6개에 `dessert: true`를 더한다. 새 디저트 32개(ko / 제안 id; 이름이 기존 메뉴와 같으면 추가하지 않고 보고한다. 그만큼 개수는 줄고 기준도 실제 개수에 맞추되 낮추지 않는다): 약과 yakgwa, 유과 yugwa, 강정 gangjeong, 인절미 injeolmi, 꿀떡 kkul-tteok, 찹쌀떡 chapssal-tteok, 단팥죽 danpat-juk, 송편 songpyeon, 군밤 gunbam, 호두과자 hodu-gwaja, 꽈배기 kkwabaegi, 소보로빵 soboro-ppang, 인절미 빙수 injeolmi-bingsu, 과일 빙수 gwail-bingsu, 망고 빙수 mango-bingsu, 탕후루 tanghulu, 츄러스 churros, 와플 waffle, 크로플 croffle, 크레페 crepe, 팬케이크 pancake, 도넛 donut, 마카롱 macaron, 생크림 케이크 cream-cake, 치즈케이크 cheesecake, 티라미수 tiramisu, 푸딩 pudding, 아이스크림 ice-cream, 젤라또 gelato, 브라우니 brownie, 쿠키 cookie, 과일 접시 fruit-plate, 요거트 볼 yogurt-bowl.

- [ ] **Step 1: 테스트 먼저(실패 확인)** (`tests.js`, `run-tests.js`)
  - `dessert pool size`: `MENUS.filter(MODES.dessert.pool).length ≥ 38`.
  - `dessert pool per way`: 방식 `dine`/`delivery`/`home` 각각에서 제한 없음·`spice "hot"`·`feel "any"` 후보(`allowed`)가 ≥ 10; 제한 `vegetarian` 하나만 켜도 ≥ 10; `nuts` 하나만 켜도 ≥ 5.
  - `desserts only in dessert mode`: `MENUS.filter(MODES.meal.pool)`에 `dessert === true`가 0개; `MENUS.filter(MODES.dessert.pool)`에 `dessert`가 아닌 것은 0개; 새 디저트는 모두 `spice 0`, `contains`에 `pork`/`meat`가 없거나(와플·팬케이크의 소시지 변형 등은 설명에 있을 때만) 있으면 `pork`와 `meat`를 같이 가진다(기존 규칙).
  - 새 디저트 안전 태그 테스트 `MENUS dessert safety tags`: id가 `macaron`, `hodu-gwaja`, `brownie`, `cookie`, `gunbam`, `gelato`, `gangjeong`, `songpyeon`(깨·밤·잣 속)은 `nuts`; 실제로 쓴 id에 맞춘다(없는 id는 목록에서 뺀다). 마카롱은 아몬드로 `nuts`를 가져야 한다.
  - 기존 `MODES`·메뉴 개수·`diet pool`·`way counts` 기준은 그대로 통과해야 하고, `MENUS size` 상한 300 안에 있어야 한다.
  - `run-tests.js`: `sw cache is eik-v9` 테스트를 `eik-v10` 테스트로 바꾼다.
  - 실행해서 FAIL을 확인한다.
- [ ] **Step 2: 구현** — 기존 6개에 `dessert: true`, 새 디저트를 `menus.js` 끝(`// --- desserts ---` 구역 주석 아래)에 추가, `sw.js`의 `CACHE`를 `eik-v10`으로.
- [ ] **Step 3: 통과 확인과 화면 점검** — `node run-tests.js`가 FAIL 없이 통과. 브라우저 패널(375×812, 새 포트)에서 디저트 모드의 방식 3개 × 제한(없음/채식/견과류 제외)에서 [다른 메뉴]를 20번씩 눌러 서로 다른 메뉴 수와 콘솔 오류를 보고하고, 식사 모드를 30번 눌러도 디저트가 한 번도 안 나오는지 확인한다(결과 메뉴 id를 `MENUS`에서 찾아 `dessert`를 검사하는 루프로). 방식 × 제한 × 모드 후보 개수 표도 보고서에 낸다. 서버를 멈추고 뷰포트를 복원한다.
- [ ] **Step 4: Commit** — `git add menus.js tests.js sw.js run-tests.js && git commit -m "feat: add dessert menus and bump cache to eik-v10"`
