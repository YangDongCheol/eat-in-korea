# 외국인용 오늘 뭐 먹지 (eat-in-korea) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 못 먹는 재료와 매운 정도를 고르면 메뉴 하나를 골라주고, 식당에 보여줄 한국어 카드와 구글 지도 검색까지 이어주는 영어/간체 중국어 PWA와, 그것을 감싼 안드로이드 APK.

**Architecture:** 빌드 도구 없는 정적 파일. 순수 로직(추천, 한국어 카드 문장, 링크, 저장 헬퍼, 값 정리)은 `logic.js`, 데이터는 `menus.js`와 `strings.js`, 화면은 `app.js`. 모든 스크립트는 일반 `<script>` 태그로 불러오고 전역으로 노출한다. 먼저 만든 `what-to-eat` 앱의 구조와 스타일을 복사해서 시작한다.

**Tech Stack:** HTML, CSS, 바닐라 JS, localStorage, Web App Manifest, Service Worker. 로컬 서버 `python -m http.server 8000`, 테스트 `node run-tests.js`. 안드로이드는 Java WebView + Gradle 8.14.3 + AGP 8.13.0 (JDK 21: `C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot`, JDK 25는 쓰지 않는다).

**Spec:** `docs/superpowers/specs/2026-11-03-eat-in-korea-design.md`

**Reuse source:** `what-to-eat` 저장소(`https://github.com/YangDongCheol/what-to-eat`, 커밋 `1f800ee`)의 `style.css`, `sw.js`, `test.html`, `run-tests.js`, `tests.js`(러너 부분)를 복사해서 고친다. 로컬 사본: `C:\Users\syhaw\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\scratch-workspaces\41afa34e-3bea-4d91-b617-7b2ac811b4e7\e26a9db3-84cd-44de-b50a-db5e3aa23586\scratch-2026-11-02-56a285`. 안드로이드 껍데기는 `C:\wte-android`.

## Global Constraints

- 외부 라이브러리·빌드 도구·서버·로그인 없음.
- 허용 값: `restrictions` 항목 `"pork"`, `"vegetarian"`, `"seafood"`, `"nuts"` / `spice` `"none"`, `"mild"`, `"hot"` / `feel` `"hearty"`, `"light"`, `"any"` / 메뉴 `feel` `"hearty"`, `"light"` / `contains` 항목 `"pork"`, `"meat"`, `"seafood"`, `"nuts"` / 메뉴 `spice` 0~3 정수 / 언어 `"en"`, `"zh"`.
- 최근 제외: 72시간 (`now - at < 72*3600*1000`). 기록 최대 100개. localStorage 키: `history`, `lastAnswers`, `lang`.
- 한국어 카드: `order`는 `이거 1인분 주세요.` 문장 (정확히 이대로):
  - pork: `저는 돼지고기를 먹을 수 없어요. 돼지고기나 돼지고기 육수가 들어가나요?`
  - vegetarian: `저는 채식을 해요. 고기, 생선, 고기 육수, 젓갈이 들어가나요?`
  - seafood: `저는 해산물을 먹을 수 없어요. 생선, 새우, 조개, 젓갈이 들어가나요?`
  - nuts: `저는 견과류와 땅콩을 먹을 수 없어요. 들어가나요?`
  - 순서: 돼지고기 → 채식 → 해산물 → 견과류.
- 지도: `"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(menu.ko + " 식당")`.
- **보증하는 표현 금지**: 화면 문구와 메뉴 설명 어디에도 "halal", "할랄", "清真", "safe", "안전", "安全", "guarantee", "保证"를 쓰지 않는다. 결과 화면에는 재료 확인 안내와 "알레르기 대비를 대신하지 않는다"는 안내가 항상 보인다.
- 모바일 우선, 375px 폭에서 가로 스크롤이 없어야 한다. 앱 이름은 가칭 `Eat in Korea` (바꾸기 쉽게 `manifest.json`, `index.html` `<title>`, `strings.js`의 `title`에만 둔다).
- 커밋 메시지 끝에는 시스템이 지정한 Co-Authored-By 줄을 붙인다.

## Review Focus

1. **저장된 값이 깨졌거나 낡았을 때** (알 수 없는 제한 값, 삭제된 메뉴 id, `NaN` 시각, 배열이 아닌 `history`): 앱은 기본값으로 시작해야 한다 → Task 2 `sanitizeAnswers`/`sanitizeHistory` 테스트.
2. **제한을 네 개 모두 고르고 안 매운 것만 선택**: 추천이 비어도 앱이 멈추지 않고 "조건에 맞는 메뉴가 없어요, 제한을 줄여 보세요"가 나와야 한다 → Task 1 `pick` 테스트(`null`), Task 4 데이터 테스트(네 제한 동시에도 3개 이상 남음), Task 5 수동 확인.
3. **보증 표현이 문구나 설명에 섞여 들어감** → Task 3·4의 금지어 검사 테스트.
4. **배포 후 예전 캐시가 계속 보임** → Task 6 서비스워커 테스트와 캐시 이름.
5. **[식당에 보여주기]/[근처 식당 찾기]를 연달아 두 번 누름, 결과 화면에서 언어를 바꿈**: 기록은 한 번만 저장되고, 언어를 바꿔도 같은 메뉴가 새 언어로 다시 그려져야 한다 → Task 5 수동 확인.

---

### Task 1: 프로젝트 틀, 테스트 러너, `pick`

**Files:**
- Create: `logic.js`, `tests.js`, `run-tests.js`, `test.html`, `.gitignore`(비워 두거나 생략)
- 복사해서 고침: `run-tests.js`, `test.html`, `tests.js`의 러너(`test`, `eq`, `report`, 비동기 지원)는 Reuse source에서 가져온다. `run-tests.js`는 `logic.js`, `strings.js`, `menus.js`, `tests.js` 순서로 불러오고(없는 파일은 건너뜀), `test.html`도 같은 순서다.

**Interfaces:**
- Produces (전역):
  - `type Menu = { id, ko, emoji, rom, name:{en,zh}, desc:{en,zh}, spice:number, feel:"hearty"|"light", contains:string[] }`
  - `type Answers = { restrictions: string[], spice: "none"|"mild"|"hot", feel: "hearty"|"light"|"any" }`
  - `type Entry = { id: string, at: number }`
  - `RECENT_MS = 72 * 3600 * 1000`
  - `allowed(menu: Menu, answers: Answers) -> boolean` (제한·매운 정도·맛 조건만 따진다. 기록과 `shown`은 보지 않는다)
  - `pick(menus: Menu[], answers: Answers, history: Entry[], shown: string[], now: number, rand = Math.random) -> { menu: Menu|null, cycled: boolean }` (`shown`은 메뉴 id 배열)

- [ ] **Step 1: 실패하는 테스트 작성** (`tests.js`)

고정 데이터 `M`(6개), `T = 1_000_000_000_000`, `H = 3600*1000`, `A = (restrictions, spice, feel) => ({restrictions, spice, feel})`, `RANDS = [()=>0, ()=>0.5, ()=>0.99]`, `ids = (args) => [...new Set(RANDS.map(r => pick(...args, r).menu.id))].sort()`.

| id | spice | feel | contains |
|---|---|---|---|
| kimchi | 2 | hearty | pork, meat, seafood |
| veg | 1 | light | (없음) |
| galbitang | 0 | hearty | meat |
| shrimp | 0 | light | seafood |
| noodle | 0 | light | nuts |
| tteok | 3 | light | seafood |

테스트 (이름: 기대 결과, 모두 `pick(M, ..., [], [], T)` 기준, 별말 없으면 `spice "hot"`, `feel "any"`):
- `no restrictions hot any returns all`: 세 `rand`로 얻은 id를 합치면 6개 모두 나올 수 있다 (`rand=()=>k/6`으로 6번 호출해 모두 포함).
- `pork excludes pork`: `["pork"]` → `kimchi`가 절대 나오지 않는다.
- `vegetarian excludes meat and seafood`: `["vegetarian"]` → 결과 id는 `["noodle","veg"]`의 부분집합.
- `seafood excludes seafood`: `["seafood"]` → `kimchi`, `shrimp`, `tteok` 제외.
- `nuts excludes nuts`: `["nuts"]` → `noodle` 제외.
- `combined restrictions`: `["pork","nuts"]` → `kimchi`, `noodle` 제외.
- `spice none`: `"none"` → spice 0인 `galbitang`, `shrimp`, `noodle`만.
- `spice mild`: `"mild"` → spice ≤ 1: `veg`, `galbitang`, `shrimp`, `noodle`만.
- `feel hearty`: `feel "hearty"` → `kimchi`, `galbitang`만.
- `excludes eaten within 72h`: history `[{id:"galbitang", at:T-71*H}]`, `A([], "none", "any")` → `galbitang` 제외.
- `allows after 72h`: `A([], "none", "any")`, `at: T-72*H` → `rand=()=>0`이면 필터 순서상 첫 메뉴(`galbitang`)가 나온다.
- `all recent → oldest eaten`: `A([], "none", "any")`, history `galbitang` T-10H, `shrimp` T-20H, `noodle` T-30H → `noodle`.
- `skips shown`: `A([], "none", "any")`, `shown ["galbitang","shrimp"]` → `noodle`.
- `cycles when all shown`: `A([], "none", "any")`, 세 메뉴(`galbitang`, `shrimp`, `noodle`) 모두 `shown` → 메뉴가 있고 `cycled === true`.
- `no match → null`: `A(["vegetarian","nuts"], "none", "hearty")` → `{ menu: null, cycled: false }`.

- [ ] **Step 2: 실패 확인**
Run: `node run-tests.js`
Expected: 모든 테스트가 `pick is not defined`로 FAIL, 종료 코드 1.

- [ ] **Step 3: `logic.js`에 `pick` 구현**
스펙 7.2절의 1~6단계를 그대로 따른다. 거르기 규칙을 작은 내부 함수(`allowed(menu, answers)`)로 둔다. `what-to-eat/logic.js`의 `pick`에서 `matches` 부분만 바꿔도 된다.

- [ ] **Step 4: 통과 확인**
Run: `node run-tests.js`
Expected: FAIL 없이 `PASS n/n`.

- [ ] **Step 5: Commit** — `git add . && git commit -m "feat: add pick logic with tests"`

---

### Task 2: 한국어 카드, 링크, 저장·값 정리

**Files:**
- Modify: `logic.js`, `tests.js`

**Interfaces:**
- Consumes: `Menu`, `Answers`, `Entry` (Task 1)
- Produces:
  - `DEFAULT_ANSWERS = { restrictions: [], spice: "none", feel: "any" }`
  - `staffCard(menu: Menu, restrictions: string[]) -> { dish: string, order: string, notes: string[] }`
  - `mapsUrl(menu: Menu) -> string`
  - `loadJSON(storage, key: string, fallback) -> any`, `saveJSON(storage, key: string, value) -> void` (what-to-eat와 같은 동작: 값이 없거나 깨졌거나 `getItem`이 예외를 던지면 `fallback`, `saveJSON`은 예외를 삼킨다)
  - `addEntry(history: Entry[], id: string, now: number) -> Entry[]` (새 배열, 최신이 맨 앞, 최대 100개)
  - `sanitizeAnswers(raw: any) -> Answers` (알 수 없는 값은 `DEFAULT_ANSWERS`의 값으로 대체, `restrictions`는 허용 값만 남기고 중복 제거, 항상 새 객체)
  - `sanitizeHistory(raw: any, validIds: string[]) -> Entry[]` (배열이 아니면 `[]`, `id`가 `validIds`에 있고 `at`이 유한한 숫자인 항목만, 최대 100개)

- [ ] **Step 1: 실패하는 테스트 작성**
- `staffCard no restrictions`: `staffCard(M[0], [])` → `{ dish: "김치찌개", order: "이거 1인분 주세요.", notes: [] }`.
- `staffCard each sentence`: 제한 하나씩 Global Constraints의 문장과 `notes`가 정확히 같다 (4개 테스트 또는 반복).
- `staffCard order`: `["nuts","pork","seafood","vegetarian"]`(뒤섞인 입력)를 넣어도 `notes`는 돼지고기 → 채식 → 해산물 → 견과류 순서.
- `mapsUrl encodes`: `mapsUrl({ko:"떡볶이 & 튀김"})`가 `"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("떡볶이 & 튀김 식당")`과 같다.
- `loadJSON missing/broken/throws`, `saveJSON swallows`, `round trip` (what-to-eat의 같은 이름 테스트를 가져온다).
- `addEntry caps at 100`: 100개에 추가하면 길이 100, 맨 앞이 `{id, at}`, 가장 오래된 것이 빠지고 원본은 그대로.
- `sanitizeAnswers null/string/number`: `null`, `"x"`, `42` → `DEFAULT_ANSWERS`와 같은 값.
- `sanitizeAnswers unknown values`: `{restrictions:["pork","moon","pork"], spice:"lava", feel:"x"}` → `{restrictions:["pork"], spice:"none", feel:"any"}`.
- `sanitizeAnswers keeps valid`: `{restrictions:["nuts"], spice:"hot", feel:"light"}` → 같은 값.
- `sanitizeHistory non-array`: `{}`, `null`, `"x"` → `[]`.
- `sanitizeHistory filters`: 알 수 없는 id, `at: NaN`, `at: "5"`, `null` 항목, 정상 항목이 섞인 배열 → 정상 항목만.
- `sanitizeHistory caps at 100`.

- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: 새 테스트들이 FAIL(함수 없음).
- [ ] **Step 3: 구현** — 위 시그니처 그대로 `logic.js`에 추가. `loadJSON`, `saveJSON`은 what-to-eat에서 가져온다.
- [ ] **Step 4: 통과 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`.
- [ ] **Step 5: Commit** — `git commit -am "feat: add staff card, links, storage and sanitizers"`

---

### Task 3: 화면 문구 (`strings.js`)

**Files:**
- Create: `strings.js`
- Modify: `tests.js`, `test.html`(불러오기 순서는 이미 `strings.js`를 포함)

**Interfaces:**
- Produces:
  - `STRINGS: { en: Record<string,string>, zh: Record<string,string> }`. 두 언어에 있어야 하는 키(정확히 이 목록): `title`, `subtitle`, `langEn`, `langZh`, `qRestrict`, `optPork`, `optVeg`, `optSeafood`, `optNuts`, `qSpice`, `spiceNone`, `spiceMild`, `spiceHot`, `qFeel`, `feelHearty`, `feelLight`, `feelAny`, `go`, `historyLink`, `historyTitle`, `noHistory`, `back`, `another`, `showStaff`, `findNearby`, `pickedTag`, `contains`, `tagPork`, `tagMeat`, `tagSeafood`, `tagNuts`, `tagNone`, `disclaimer`, `noMatch`, `noMatchHint`, `staffBack`.
  - `detectLang(navigatorLanguage: string|undefined|null) -> "zh"|"en"` (`zh`로 시작하면(대소문자 무시) `"zh"`, 그 외와 빈 값은 `"en"`).
  - `disclaimer` 영어 원문(정확히): `Ingredients shown are what this dish usually contains. Every restaurant is different, so always check with the staff. This app is not a substitute for allergy care.` 중국어는 같은 의미로 쓴다.
  - `noMatch` 영어: `No dish matches your choices`, `noMatchHint` 영어: `Try removing some restrictions.` 중국어는 같은 의미.

- [ ] **Step 1: 실패하는 테스트 작성**
- `strings keys match`: `Object.keys(STRINGS.en).sort()`와 `zh`가 같고, 위 키 목록과도 같다.
- `strings not empty`: 모든 값이 공백이 아닌 문자열.
- `strings en disclaimer exact`: `STRINGS.en.disclaimer`가 위 원문과 정확히 같다.
- `strings zh has chinese`: `zh`의 모든 값 중 `title`, `langEn`, `langZh`를 뺀 값에 한자(`/[\u4e00-\u9fff]/`)가 들어 있다.
- `strings no guarantee claims`: 두 언어의 모든 값에 금지어(Global Constraints, 대소문자 무시)가 하나도 없다. 단, `disclaimer`의 `not a substitute` 같은 부정 표현은 금지어에 걸리지 않는다.
- `detectLang`: `"zh-CN"`, `"zh-TW"`, `"ZH"` → `zh`; `"en-US"`, `"ko-KR"`, `""`, `undefined`, `null` → `en`.

- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: `STRINGS is not defined`로 FAIL.
- [ ] **Step 3: `strings.js` 작성** — 위 키 목록과 `detectLang`. 영어와 간체 중국어 문구를 직접 쓴다. 앱 이름(`title`)은 `Eat in Korea` (중국어도 `Eat in Korea`).
- [ ] **Step 4: 통과 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`.
- [ ] **Step 5: Commit** — `git add strings.js tests.js test.html && git commit -m "feat: add en/zh strings and detectLang"`

---

### Task 4: 메뉴 데이터

**Files:**
- Create: `menus.js`
- Modify: `tests.js`

**Interfaces:**
- Consumes: `pick`, `Menu` (Task 1), 허용 값 (Global Constraints)
- Produces: 전역 `MENUS: Menu[]` (60~80개). `id`는 영문 소문자와 하이픈, 서로 겹치지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**
- `MENUS size`: 60 이상 80 이하.
- `MENUS valid`: 모든 메뉴에서 `id`가 `/^[a-z0-9-]+$/`, `ko`, `emoji`, `rom`, `name.en`, `name.zh`, `desc.en`, `desc.zh`가 공백이 아닌 문자열, `spice`가 0~3 정수, `feel`이 허용 값, `contains`가 허용 값만(중복 없음)이고, `pork`가 있으면 `meat`도 있다. `id`와 `ko`는 서로 겹치지 않는다.
- `MENUS zh has chinese`: 모든 메뉴의 `name.zh`와 `desc.zh`에 한자가 있다.
- `MENUS no guarantee claims`: 모든 `desc`(en, zh)에 금지어가 없다.
- `single restriction leaves enough`: `MENUS.filter(m => allowed(m, answers))`의 개수가 `pork` 단독, `seafood` 단독, `nuts` 단독 제한(`spice "hot"`, `feel "any"`)에서 각각 20 이상이고, `vegetarian` 단독은 8 이상.
- `all four restrictions still has menus`: 네 제한 모두 + `spice "none"` + `feel "any"`에서 `allowed`를 통과하는 메뉴가 3개 이상.
- `every spice level has menus`: `spice` 0, 1, 2, 3 각각 5개 이상.

- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: `MENUS is not defined`로 FAIL.
- [ ] **Step 3: `menus.js` 작성** — 한식 중심으로 분식, 중식, 일식 느낌의 한국 식당 메뉴를 섞어 60~80개. 스펙 7.1절 태깅 원칙(보수적)을 따른다. 채식 가능한 메뉴(산채비빔밥, 야채김밥, 두부 요리, 잡곡밥 정식 등)를 충분히 넣는다. 영어는 한국 음식을 모르는 사람이 이해할 설명, 중국어는 같은 의미의 간체로 쓴다.
- [ ] **Step 4: 통과 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`. 모자라는 조건이 있으면 데이터를 고쳐서 맞춘다 (테스트 기준을 낮추지 않는다).
- [ ] **Step 5: Commit** — `git add menus.js tests.js && git commit -m "feat: add menu data"`

---

### Task 5: 화면 4개

**Files:**
- Create: `index.html`, `app.js`, `style.css` (what-to-eat의 `style.css`를 복사해서 칩 여러 개 선택, 한국어 카드, 언어 전환에 필요한 스타일을 더한다), `.claude/launch.json` (`python -m http.server 8000`, port 8000)

**Interfaces:**
- Consumes: `MENUS`, `STRINGS`, `detectLang`, `pick`, `staffCard`, `mapsUrl`, `loadJSON`, `saveJSON`, `addEntry`, `sanitizeAnswers`, `sanitizeHistory`, `DEFAULT_ANSWERS` (Task 1~4)
- Produces: `index.html`에 `<section id="ask">`, `#result`, `#staff`, `#history`가 있고 한 번에 하나만 보인다. 각 화면의 돌아가기 버튼 id는 `#back`(결과), `#staff-back`(한국어 카드), `#history-back`(기록). 스크립트 순서는 `strings.js`, `menus.js`, `logic.js`, `app.js`.

- [ ] **Step 1: 질문 화면** (스펙 6.1) — 상단 언어 전환 버튼 두 개(English / 简体中文, `aria-pressed`). 질문 세 개. 제한은 여러 개 선택 가능한 칩(누르면 토글), 매운 정도와 맛은 하나 선택. 시작할 때 `sanitizeAnswers(loadJSON(store,"lastAnswers",null))`로 미리 선택하고, 언어는 `loadJSON(store,"lang",null)`이 `"en"`/`"zh"`면 그것, 아니면 `detectLang(navigator.language)`. 모든 문구는 `STRINGS[lang]`에서 가져온다. **[골라줘]**는 답을 저장하고 `shown=[]`으로 초기화한 뒤 결과 화면으로 간다. `store`는 `window.localStorage`를 try로 감싸 접근한다. 언어를 바꾸면 `lang`을 저장하고 현재 화면을 다시 그린다.
- [ ] **Step 2: 결과 화면** (스펙 6.2) — `pick(MENUS, answers, history, shown, Date.now())`. 카드에 이모지, 선택 언어의 이름(크게), 한국어 이름과 `rom`, 🌶️ 개수, "보통 들어가는 재료" 태그(`contains`의 `pork`→`tagPork`, `meat`→`tagMeat`, `seafood`→`tagSeafood`, `nuts`→`tagNuts`, 하나도 없으면 `tagNone`), 설명, 항상 보이는 `disclaimer`. `menu`가 `null`이면 `noMatch`와 `noMatchHint`와 [다시 고르기]만. `cycled`면 `shown=[menu.id]`, 아니면 `shown.push(menu.id)`. 언어를 바꾸면 같은 메뉴를 새 언어로 다시 그린다(다시 뽑지 않는다).
  - **[식당에 보여주기]**: 기록 저장(아래) 후 `#staff` 화면.
  - **[근처 식당 찾기]**: 기록 저장 후 `window.open(mapsUrl(menu), "_blank", "noopener")`.
  - **기록 저장**: 현재 추천에서 처음 누를 때만 `addEntry` + `saveJSON`. 같은 추천에서 다시 눌러도 저장하지 않는다. [다른 거]로 새로 뽑으면 다시 저장 가능.
  - **[다른 거]**, **[← 다시 고르기]**.
- [ ] **Step 3: 한국어 카드 화면** (스펙 6.3) — 하얀 배경 전체 화면, 아주 큰 글씨. `staffCard(menu, answers.restrictions)`의 `dish`, `order`, `notes`를 줄마다 보여준다. 이 화면의 문장은 항상 한국어이고 언어 전환의 영향을 받지 않는다. [← 돌아가기](`staffBack`)로 결과 화면에 돌아간다.
- [ ] **Step 4: 기록 화면** (스펙 6.4) — `sanitizeHistory(loadJSON(store,"history",[]), MENUS.map(m=>m.id))`로 읽은 기록을 최신순으로. 메뉴 이름은 선택 언어로, 날짜는 `toLocaleString`. 항목별 삭제 버튼(`aria-label` 포함). 없으면 `noHistory`.
- [ ] **Step 5: 접근성·포커스** — 화면 전환 시 새 화면의 제목(`tabindex="-1"`)으로 포커스를 옮기고, 칩은 한 번 만들고 `aria-pressed`만 바꿔서 포커스를 유지한다 (what-to-eat 방식). 칩에 이모지를 붙이고 `aria-label`은 이모지 없는 문구로 둔다.
- [ ] **Step 6: 수동 확인** (브라우저 375×812, `http://localhost:8000/`)
  - 기본 상태에서 [골라줘]만 눌러도 메뉴가 나온다 (10초 기준).
  - 돼지고기·해산물·견과류·채식 제한을 각각 켜고 여러 번 [다른 거]를 눌러도 해당 재료의 메뉴가 나오지 않는다 (카드의 재료 태그로 확인).
  - 네 제한을 모두 켜고 안 매운 것 + 든든한 거를 고르면 `noMatch`와 `noMatchHint`가 나오고 앱이 멈추지 않는다.
  - 결과 화면에서 언어를 바꿔도 같은 메뉴가 새 언어로 보인다. 언어는 새로고침해도 유지된다.
  - [식당에 보여주기]를 연달아 눌러도 기록은 1개. 한국어 카드에 선택한 제한의 문장이 정확히 보인다. [근처 식당 찾기]가 구글 지도 주소로 새 탭을 연다.
  - DevTools에서 `localStorage.history="{oops"`, `localStorage.lastAnswers='{"restrictions":["moon"],"spice":"lava"}'`로 망가뜨리고 새로고침해도 정상 동작한다.
  - 가로 스크롤이 없고 콘솔 오류가 없다. `node run-tests.js`가 여전히 통과한다.
- [ ] **Step 7: Commit** — `git add index.html app.js style.css .claude/launch.json && git commit -m "feat: add ask/result/staff/history screens"`

---

### Task 6: PWA (설치 + 오프라인)

**Files:**
- Create: `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`
- Modify: `index.html` (manifest 링크, `theme-color`, `apple-touch-icon`), `app.js` (서비스워커 등록 `navigator.serviceWorker.register("sw.js")`에 `.catch(() => {})`), `run-tests.js`, `tests.js`

**Interfaces:**
- Consumes: Task 5의 파일 목록 (캐시 대상: `./`, `index.html`, `style.css`, `app.js`, `logic.js`, `menus.js`, `strings.js`, `manifest.json`, 아이콘 2개)

- [ ] **Step 1: 실패하는 테스트 작성** (`run-tests.js`, what-to-eat의 같은 테스트와 같은 방식): `sw install fetches with cache: reload` — `sw.js`를 가짜 `self`/`caches`/`Request`로 실행해 `install`에서 캐시에 들어가는 요청이 모두 `cache: "reload"`로 만들어졌는지 확인. `sw cache name versioned`: `sw.js`의 `CACHE` 값이 `eik-v` + 숫자 형식.
- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: 두 테스트 FAIL.
- [ ] **Step 3: `sw.js` 작성** — what-to-eat의 `sw.js`를 복사해서 `CACHE = "eik-v1"`, 파일 목록은 위와 같게 바꾼다 (`strings.js` 포함, 버전을 올리라는 주석 유지).
- [ ] **Step 4: `manifest.json`과 아이콘** — `name: "Eat in Korea"`, `short_name: "EatKR"`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `background_color`와 `theme_color` `#fff6ec`, 아이콘 192(`any`), 512(`any`), 512(`maskable`) 세 항목. 아이콘은 브라우저 캔버스로 주황 그라디언트 배경에 크림색 원과 🍜 이모지를 그려 PNG로 저장한다 (what-to-eat 때처럼 `receiver.js`로 받아 저장, 원은 반지름 `size*0.36`).
- [ ] **Step 5: 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`. 브라우저(`http://localhost:8000/`)에서 서비스워커가 activated, 캐시 `eik-v1`에 파일 9개, 매니페스트 아이콘 3개가 디코드됨. 개발 서버를 끄고 새로고침해도 앱이 열리고 추천이 된다.
- [ ] **Step 6: Commit** — `git add . && git commit -m "feat: make installable offline PWA"`

---

### Task 7: GitHub 배포 (사용자 승인 필요)

**공개 저장소를 만들고 파일을 올리는 작업이라, 시작 전에 사용자에게 저장소 이름과 공개 여부를 확인받는다.** 이전 앱의 승인은 이 작업에 이어지지 않는다.

- [ ] **Step 1:** 앱 이름(가칭 `Eat in Korea`)과 저장소 이름을 사용자와 확정한다. 이름이 바뀌면 `manifest.json`, `index.html` `<title>`, `strings.js`의 `title`만 고친다.
- [ ] **Step 2:** 커밋 작성자가 `YangDongCheol <203932127+YangDongCheol@users.noreply.github.com>`인지 확인한다 (`git log --format='%an <%ae>'`). `"C:\Program Files\GitHub CLI\gh.exe" repo create <이름> --public --source . --remote origin --push` 로 올리고, `gh api -X POST repos/YangDongCheol/<이름>/pages -f "source[branch]=main" -f "source[path]=/"`로 Pages를 켠다.
- [ ] **Step 3:** 빌드가 끝나면(`pages/builds/latest` `status`가 `built`) `https://yangdongcheol.github.io/<이름>/`을 열어 추천, 언어 전환, 서비스워커 activated, 콘솔 오류 없음을 확인한다.

---

### Task 8: 안드로이드 APK

**Files:** (새 폴더 `C:\eik-android`, `C:\wte-android`를 복사해서 시작)
- Modify: `app/build.gradle.kts` (`namespace`와 `applicationId`를 `com.yangdongcheol.eatinkorea`, `versionCode 1`, `versionName "1.0"`), `app/src/main/AndroidManifest.xml` (`android:label`을 앱 이름으로), `MainActivity.java`(패키지 이동과 `HOME`, `HOST` 상수를 Task 7의 주소로, 배경색 `0xFFFFF6EC`), 아이콘 PNG(Task 6의 아이콘으로 `ic_launcher.png`, 적응형 아이콘용 전경/배경 이미지)

- [ ] **Step 1:** `C:\wte-android`에서 `build`, `.gradle`, `shots`, `*.apk`를 빼고 `C:\eik-android`로 복사하고 위 항목을 고친다. 자바 패키지 폴더도 새 패키지에 맞게 옮긴다.
- [ ] **Step 2:** `JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot`로 `.\gradlew.bat assembleRelease`. Expected: `BUILD SUCCESSFUL`, `app\build\outputs\apk\release\app-release.apk` 생성. `apksigner verify`로 서명 확인.
- [ ] **Step 3:** 폰(`adb devices`로 `device` 상태 확인, 화면이 켜져 있고 잠금이 풀려 있어야 함)에 `adb install -r`로 설치하고 실행해서 화면 캡처로 확인한다. 뒤로가기 동작(결과/기록/한국어 카드 화면에서 뒤로가기 → 이전 화면, 질문 화면에서 → 앱 종료)은 `MainActivity`에서 보이는 화면의 `#back`/`#history-back`/`#staff-back` 버튼을 눌러주도록 확장한다 (`what-to-eat`의 `onBackPressed` 방식, `#staff-back`은 Task 5에서 한국어 카드의 돌아가기 버튼 id로 쓴다).
- [ ] **Step 4:** `app-release.apk`를 `what-to-eat.apk`처럼 알아보기 쉬운 이름(`eat-in-korea.apk`)으로 복사하고 사용자에게 보낸다. 화면이 잠겨 있어서 폰 확인을 못 하면 그 사실을 그대로 알린다.
