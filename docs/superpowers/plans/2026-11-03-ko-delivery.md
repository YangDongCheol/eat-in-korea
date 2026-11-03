# 한국어 화면 + 배달 바로가기 + 카드 제목 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eat in Korea에 한국어 화면, "식당/배달" 질문과 쿠팡이츠·배민 바로가기, 카드 제목 걸침 수정을 넣고, 안드로이드 껍데기가 앱 열기 주소를 처리하게 한다.

**Architecture:** 기존 구조 그대로다 (일반 `<script>` 전역, 빌드 없음). 순수 로직은 `logic.js`, 문구는 `strings.js`, 메뉴 데이터는 `menus.js`, 화면은 `app.js`/`index.html`/`style.css`. 안드로이드 껍데기(`C:\eik-android`)는 저장소 밖이고 Task 5에서 고친다.

**Tech Stack:** HTML, CSS, 바닐라 JS, localStorage, Service Worker, Java WebView(Gradle 8.14.3 + AGP 8.13.0, JDK 21: `C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot`). 테스트 `node run-tests.js` (현재 PASS 53/53). 저장소 `C:\Users\syhaw\source\repos\eat-in-korea`, 줄바꿈은 LF (`.gitattributes`가 있다).

**Spec:** `docs/superpowers/specs/2026-11-03-ko-delivery-design.md` (본 설계 `docs/superpowers/specs/2026-11-03-eat-in-korea-design.md`에 덧붙이는 문서)

## Global Constraints

- 새 외부 라이브러리·빌드 도구·서버 없음. 일반 전역 스크립트 순서 `strings.js`, `menus.js`, `logic.js`, `app.js` 유지.
- 허용 값: `mode` `"dine"`/`"delivery"`; 언어 `"en"`/`"zh"`/`"ko"`; 나머지(restrictions, spice, feel, contains)는 기존과 같다.
- 보증하는 표현 금지. 금지어(대소문자 무시, 부분 문자열): `halal`, `할랄`, `清真`, `safe`, `안전`, `安全`, `guarantee`, `保证`, `allergen-free`, `no allergens`, `无过敏原`, `过敏原`, 그리고 이번에 추가: `알레르기 걱정 없`, `알레르기 없`, `알레르기 안심`, `무알레르기`, `보장`. 이 목록은 `tests.js`의 하나뿐인 상수 `FORBIDDEN`에만 둔다. 모든 사용자 문구와 메뉴 설명(en, zh, ko)에 적용된다.
- 영어 `disclaimer` 원문(변경 금지): `Ingredients shown are what this dish usually contains. Every restaurant is different, so always check with the staff. This app is not a substitute for allergy care.` 한국어 `disclaimer` 원문(정확히): `표시된 재료는 이 음식에 보통 들어가는 재료예요. 식당마다 다르니 꼭 직원에게 확인하세요. 이 앱은 알레르기 대비를 대신하지 않아요.`
- 배달 앱 목록(정확히): 쿠팡이츠 `{ id: "coupangeats", pkg: "com.coupang.mobile.eats", web: "https://www.coupangeats.com/" }`, 배민 `{ id: "baemin", pkg: "com.sampleapp", web: "https://www.baemin.com/" }`.
- 안드로이드 주소 형식(정확히): `intent://#Intent;package=<pkg>;S.browser_fallback_url=<encodeURIComponent("https://play.google.com/store/apps/details?id=<pkg>")>;end`.
- localStorage 키: `eik:history`, `eik:lastAnswers`, `eik:lang` (접두어 유지). 서비스워커 `CACHE`는 `eik-v3` (Task 4에서 올린다).
- 모든 사용자 문구는 `STRINGS[lang]`에서 온다 (HTML/JS에 영어·중국어·한국어 문구를 직접 쓰지 않는다. 한국어 메뉴 이름과 `staffCard` 문장은 데이터/함수에서 온다).
- 모바일 우선 375px, 가로 스크롤 없음, 터치 대상 44px 이상. 커밋 메시지 끝에는 시스템이 지정한 Co-Authored-By 줄을 붙인다.

## Review Focus

1. **옛 저장값에 `mode`가 없거나 깨져 있음** (이미 쓰던 사용자의 `eik:lastAnswers`): 기본값 `"dine"`으로 시작해야 한다 → Task 1 `sanitizeAnswers` 테스트.
2. **한국어 문구에 보증하는 표현이 섞임** (예: "알레르기 걱정 없어요", "안전한"): → Task 2·3의 금지어 테스트 + 한국어 `disclaimer` 원문 고정.
3. **배달 버튼을 연달아 누름 / 클립보드 실패**: 기록은 한 추천에 한 번만 저장되고, 복사에 실패해도 앱 열기는 진행되며 이름이 글자로 보인다 → Task 4 수동 확인.
4. **언어를 한국어로 바꾸거나 되돌림** (결과 화면에서): 같은 메뉴가 다시 그려지고, [식당에 보여주기]와 읽는 법 줄이 숨겨졌다 돌아오며, 배달 안내 문구가 새 언어로 바뀐다 → Task 4 수동 확인.
5. **`intent:` 주소를 악용한 임의 앱 실행** (껍데기가 받는 `intent:` 주소): 허용 패키지 두 개만 실행하고 나머지는 거부 → Task 5.

---

### Task 1: 배달 모드와 앱 열기 주소 (logic.js)

**Files:**
- Modify: `logic.js`, `tests.js`

**Interfaces:**
- Consumes: `Answers`, `DEFAULT_ANSWERS`, `sanitizeAnswers` (본 설계 Task 2)
- Produces:
  - `Answers`에 `mode: "dine"|"delivery"` 추가. `DEFAULT_ANSWERS`는 `{ restrictions: [], spice: "none", feel: "any", mode: "dine" }`.
  - `sanitizeAnswers(raw) -> Answers`: `mode`가 `"dine"`/`"delivery"`가 아니면 `"dine"`. 나머지 동작은 그대로 (항상 새 객체).
  - `DELIVERY_APPS` (Global Constraints의 두 항목, 이 순서), `isAndroid(userAgent: string|undefined|null) -> boolean`, `deliveryUrl(app, userAgent) -> string`.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests.js`)
  - 기존 `sanitizeAnswers`·`DEFAULT_ANSWERS` 기대값에 `mode: "dine"`을 더한다 (테스트를 새 동작에 맞게 고친다).
  - `sanitizeAnswers mode`: `{mode:"delivery"}` → `"delivery"` 유지; `{mode:"fly"}`, 문자열, 없음 → `"dine"`.
  - `sanitizeAnswers old stored value`: 이전 형식 `{restrictions:["nuts"],spice:"hot",feel:"light"}` → `{restrictions:["nuts"],spice:"hot",feel:"light",mode:"dine"}`.
  - `DELIVERY_APPS`: 길이 2, id 순서 `["coupangeats","baemin"]`, pkg와 web이 Global Constraints와 정확히 같다.
  - `isAndroid`: `"Mozilla/5.0 (Linux; Android 14; SM-S936N) AppleWebKit/537.36"` → true, 소문자 `android`도 true; iPhone UA `"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"`, 데스크톱 UA, `""`, `undefined`, `null` → false.
  - `deliveryUrl android`: Android UA로 `deliveryUrl(DELIVERY_APPS[0], ua)`가 정확히 `intent://#Intent;package=com.coupang.mobile.eats;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.coupang.mobile.eats;end`, 배민도 같은 형식(`com.sampleapp`).
  - `deliveryUrl non-android`: iPhone UA와 `undefined`로 각각 두 앱의 `web` 주소.
- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: 새·바뀐 테스트가 FAIL (`mode` 없음, `DELIVERY_APPS is not defined`), 종료 코드 1.
- [ ] **Step 3: 구현** — `logic.js`에 위 시그니처 그대로. `DEFAULT_ANSWERS`와 `sanitizeAnswers`를 수정하고 나머지는 추가.
- [ ] **Step 4: 통과 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`.
- [ ] **Step 5: Commit** — `git add logic.js tests.js && git commit -m "feat: add delivery mode and app-open urls"`

---

### Task 2: 한국어 화면 문구 (strings.js)

**Files:**
- Modify: `strings.js`, `tests.js`

**Interfaces:**
- Consumes: `STRINGS`, `detectLang` (본 설계 Task 3)
- Produces:
  - `STRINGS.ko`: en과 zh의 **모든 키**(현재 38개)에 대한 한국어 문구 + 새 키 8개. 세 언어의 키 집합이 정확히 같다.
  - 새 키 8개와 값: `qMode` en `How are you eating?` / zh `怎么吃？` / ko `어떻게 드실래요?`; `modeDine` `Dine out` / `去店里吃` / `식당에서`; `modeDelivery` `Delivery` / `点外卖` / `배달`; `deliveryCoupang` 세 언어 모두 `쿠팡이츠`; `deliveryBaemin` 세 언어 모두 `배민`; `deliveryHint` en `Copied "{name}". Paste it into the search bar of the app.` / zh `已复制“{name}”。请粘贴到应用的搜索栏。` / ko `"{name}" 복사했어요. 앱 검색창에 붙여넣기 하세요.` (`{name}`은 화면에서 한국어 메뉴 이름으로 바꿀 자리표시); `deliveryCopyFailed` en `Couldn't copy. Search for this name in the app:` / zh `无法复制。请在应用中搜索这个名称：` / ko `복사하지 못했어요. 앱에서 이 이름으로 검색하세요:`; `langKo` 세 언어 모두 `한국어`.
  - 한국어 `disclaimer`는 Global Constraints의 원문 그대로. 한국어 `noMatch`/`noMatchHint`는 영어와 같은 뜻 (`noMatch` ko 예: `조건에 맞는 메뉴가 없어요`, `noMatchHint` 예: `제한을 조금 줄여 보세요.`).
  - `detectLang(navigatorLanguage) -> "ko"|"zh"|"en"`: `ko`로 시작(대소문자 무시) → `"ko"`, `zh`로 시작 → `"zh"`, 그 외·빈 값·null·undefined → `"en"`.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests.js`)
  - 키 집합 테스트(`STRING_KEYS`)를 46개(기존 + 새 8개)로 고치고 en, zh, ko 세 언어를 모두 비교한다.
  - `strings not empty`가 `ko`도 검사한다. `strings ko has hangul`: `ko`의 모든 값 중 `title`, `langEn`, `langZh`, `deliveryCoupang`, `deliveryBaemin`을 뺀 값에 한글(`/[가-힣]/`)이 있다 (`title`은 `Eat in Korea` 그대로 둔다).
  - 금지어 상수 `FORBIDDEN`에 Global Constraints의 새 단어를 더하고 세 언어의 모든 값을 검사한다 (기존 테스트가 이 상수를 쓰므로 새 단어가 자동 적용되는지 확인).
  - `strings ko disclaimer exact`: 한국어 원문과 정확히 같다. `strings en disclaimer exact`는 그대로.
  - `detectLang`: `"ko-KR"`, `"KO"`, `"ko"` → `ko` (기존의 `ko-KR → en` 기대값을 바꾼다); `"zh-CN"`, `"zh-TW"`, `"ZH"` → `zh`; `"en-US"`, `""`, `undefined`, `null`, `"ja-JP"` → `en`.
  - `strings placeholders`: 세 언어의 `deliveryHint`에 자리표시 `{name}`이 정확히 한 번 있다.
- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: 새 테스트들이 FAIL (`STRINGS.ko` 없음 등).
- [ ] **Step 3: 구현** — `strings.js`에 `ko`와 새 키를 추가하고 `detectLang`을 고친다. 한국어는 자연스러운 존댓말(`~해요`체)로, 칩에 들어갈 만큼 짧게 쓴다. 재료 표시 문구(`tagNone`)는 "해당 재료가 없다"는 단정이 되지 않게 쓴다 (예: 영어 `No pork, meat, seafood or nuts listed`와 같은 뜻으로 "표시된 재료 없음" 계열이 아니라 `돼지고기, 고기, 해산물, 견과류는 표시되지 않았어요`처럼).
- [ ] **Step 4: 통과 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`.
- [ ] **Step 5: Commit** — `git add strings.js tests.js && git commit -m "feat: add Korean strings, delivery strings and ko detection"`

---

### Task 3: 메뉴 한국어 설명 (menus.js)

**Files:**
- Modify: `menus.js`, `tests.js`

**Interfaces:**
- Consumes: `MENUS` (79개, 각 `desc: { en, zh }`), 금지어 상수 `FORBIDDEN`
- Produces: 모든 메뉴에 `desc.ko` (한국어 설명, 한두 문장). 다른 필드와 태그는 바꾸지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests.js`)
  - `MENUS ko desc`: 모든 `desc.ko`가 공백이 아닌 문자열이고 한글을 포함한다.
  - `MENUS no guarantee claims`가 `desc.ko`도 검사한다 (기존 테스트에 `desc.ko`와 `name.ko`를 더한다. `name.ko` 필드는 없으니 메뉴의 `ko` 필드를 검사 대상에 넣는다).
  - `MENUS ko nut keywords imply nuts tag`: `desc.ko`에 `견과`, `땅콩`, `호두`, `잣`, `아몬드` 중 하나가 들어 있으면 그 메뉴에 `nuts` 태그가 있다 (힌트 문장 "견과류 확인" 같은 주의 문구도 포함하는 단순 규칙이다. 현재 데이터에 위반이 있으면 태그가 아니라 설명 문구가 잘못된 것인지 판단해서 고친다).
- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: `MENUS ko desc`가 FAIL (`desc.ko` 없음).
- [ ] **Step 3: 데이터 작성** — 79개 메뉴 전부에 `desc.ko`를 쓴다. 영어 설명과 같은 뜻과 같은 경고/확인 문구(예: "멸치 육수나 고기 육수를 쓰는지 직원에게 확인하세요")를 담는다. 한국어를 쓰는 사람이 이미 아는 음식이므로 짧고 자연스럽게, 보증 표현 없이. 태그와 설명이 모순되지 않는지 모든 항목을 다시 읽고 확인한다 (설명에 재료가 나오는데 태그에 없는 경우를 만들지 않는다).
- [ ] **Step 4: 통과 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`, 기존 커버리지 테스트(메뉴 수 60~80, 제한별 남는 개수 등)도 그대로 통과.
- [ ] **Step 5: Commit** — `git add menus.js tests.js && git commit -m "feat: add Korean menu descriptions"`

---

### Task 4: 화면 변경 + 제목 걸침 수정 (index.html, app.js, style.css, sw.js)

**Files:**
- Modify: `index.html`, `app.js`, `style.css`, `sw.js` (`CACHE`를 `eik-v3`으로, 서비스워커 테스트는 그대로 통과)

**Interfaces:**
- Consumes: `STRINGS` (ko 포함, 새 키), `MENUS`, `sanitizeAnswers`(mode 포함), `DELIVERY_APPS`, `deliveryUrl`, `isAndroid`, `staffCard`, `mapsUrl`, `loadJSON`/`saveJSON`, `pick` (Task 1~3)
- Produces: 화면 동작(스펙 §2~§4). `app.js`에 `navigate(url)` 전역 함수 하나(`window.location.assign(url)`)를 둔다 — 수동 확인에서 덮어써서 이동을 가로챌 수 있게.

- [ ] **Step 1: 언어 3개** — `index.html`의 `.langs`에 세 번째 버튼(`data-lang="ko"`, 문구 키 `langKo`)을 더하고 `app.js`가 `["en","zh","ko"]`를 모두 허용한다 (`lang` 로드 시 허용 목록, `detectLang` 결과 사용, `lang` 속성 갱신).
- [ ] **Step 2: 모드 질문** — 질문 목록 맨 앞에 `mode` 질문(`qMode`, 선택지 `modeDine`/`modeDelivery`, 값 `"dine"`/`"delivery"`)을 더한다. 하나만 선택, 기본은 저장된 값 또는 `"dine"`, `lastAnswers`에 함께 저장된다. 칩에 이모지를 붙이는 기존 방식을 따른다 (`dine` 🍴, `delivery` 🛵).
- [ ] **Step 3: 결과 화면** — `answers.mode === "delivery"`면 [식당에 보여주기]·[근처 식당 찾기]를 숨기고 [쿠팡이츠]·[배민] 버튼(`id="delivery-coupang"`, `id="delivery-baemin"`, 문구 키 `deliveryCoupang`/`deliveryBaemin`)을 보여준다. `mode`가 `"dine"`이면 반대. `lang === "ko"`이면 [식당에 보여주기]를 숨기고 한국어 이름 아래의 `menu-ko`(한국어 이름·읽는 법) 줄도 숨긴다. 배달 버튼 동작: ① `record()`(이미 있는 "한 추천에 한 번" 로직 재사용) ② `navigator.clipboard.writeText(current.ko)` (try/catch, 실패해도 계속) ③ 안내 영역(`id="delivery-hint"`, `aria-live="polite"`)에 성공이면 `deliveryHint`(`{name}`을 `current.ko`로 바꿈), 실패/없음이면 `deliveryCopyFailed`와 한국어 이름을 선택 가능한 글자(`user-select: all`)로 ④ `navigate(deliveryUrl(app, navigator.userAgent))`. 새 추천을 뽑거나 질문 화면으로 돌아가면 안내를 지운다. 결과 화면에서 언어를 바꾸면 안내 문구와 버튼 문구도 새 언어로 다시 그린다 (다시 뽑지 않는다). 안내 영역이 없는 모드에서는 비어 있다.
- [ ] **Step 4: 제목 걸침 수정** — `style.css`에서 질문 카드(`fieldset`)의 `legend`가 윗선에 걸치지 않고 카드 안쪽 위 여백 아래에 놓이게 한다 (예: `legend`를 `float: left; width: 100%`로 하고 다음 요소를 `clear: both`, 또는 같은 효과의 다른 방법). 카드·칩·버튼의 다른 모양은 바꾸지 않는다. 불필요해진 `legend` 관련 규칙은 지운다.
- [ ] **Step 5: 서비스워커** — `sw.js`의 `CACHE`를 `eik-v3`으로 올린다 (파일 목록은 그대로).
- [ ] **Step 6: 수동 확인** (브라우저 375×812; 정적 서버는 `python -m http.server <새 포트>`를 저장소 폴더에서 Bash `run_in_background`로 띄운다. 다른 앱이 쓰던 포트(8000, 8010)는 피하고, 끝나면 서버를 멈춘다. `localStorage`를 비우고 시작.)
  - 언어 3개 버튼이 보이고 전환된다. 한국어 화면에서 모든 문구가 한국어, `menu-ko` 줄과 [식당에 보여주기]가 없다. 영어/중국어에서는 다시 나타난다 (결과 화면에서 바꿔도 같은 메뉴).
  - `navigator.language`가 `ko-KR`인 첫 실행은 한국어로 시작한다 (`localStorage` 비운 뒤 `Object.defineProperty(navigator, "language", {value:"ko-KR"})`를 쓰기 어려우면 저장된 `eik:lang` 없이 `detectLang("ko-KR")` 결과만 확인).
  - 모드 질문이 맨 위에 있고 기본은 식당. 배달을 고르고 [골라줘] → [쿠팡이츠]/[배민] 두 버튼만 보이고 [근처 식당 찾기]·[식당에 보여주기]는 없다. `navigate`를 덮어써서 호출된 주소를 기록하고: 안드로이드 UA(`navigator.userAgent`를 덮어쓰기 어려우면 `deliveryUrl`을 직접 호출해 형식만 확인)와 그 외의 주소 형식, 버튼을 연달아 두 번 눌러도 `eik:history`에 1개, 안내 문구에 한국어 이름이 들어가는지, `clipboard.writeText`가 거부되는 경우(예: `navigator.clipboard.writeText`를 거부하도록 덮어쓰기)에도 `navigate`가 호출되고 이름이 글자로 보이는지.
  - 옛 형식의 `eik:lastAnswers`(`mode` 없음)와 깨진 저장값에서도 정상 시작하고 모드는 식당.
  - 질문 카드 제목이 카드 윗선에 걸치지 않는다 (375px 스크린샷으로 확인). 가로 스크롤 없음, 콘솔 오류 없음. `node run-tests.js`가 여전히 통과.
- [ ] **Step 7: Commit** — `git add index.html app.js style.css sw.js && git commit -m "feat: Korean UI, delivery shortcuts, card title fix"`

---

### Task 5: 안드로이드 껍데기 (저장소 밖, `C:\eik-android`)

저장소 밖 작업이라 이 브랜치의 커밋에는 들어가지 않는다. 컨트롤러가 직접 하고 폰에서 확인한다.

**Files:**
- Modify: `C:\eik-android\app\src\main\java\com\yangdongcheol\eatinkorea\MainActivity.java`, `C:\eik-android\app\build.gradle.kts` (`versionCode` 1 → 2, `versionName` `"1.1"`)

- [ ] **Step 1:** `shouldOverrideUrlLoading`에서 `intent:`로 시작하는 주소를 따로 처리한다: `Intent.parseUri(url, Intent.URI_INTENT_SCHEME)`로 해석하고, **`getPackage()`가 `com.coupang.mobile.eats` 또는 `com.sampleapp`이 아니면 아무것도 하지 않고 `true`를 반환**(거부). 허용되면 `setComponent(null)`, `setSelector(null)`, `addCategory(Intent.CATEGORY_BROWSABLE)` 후 `startActivity`. `ActivityNotFoundException`이면 `S.browser_fallback_url` 값(`intent.getStringExtra("browser_fallback_url")`, 있으면 https일 때만)을 `ACTION_VIEW`로 연다. `URISyntaxException`도 거부로 처리. 다른 외부 주소의 기존 `ACTION_VIEW` 처리는 그대로.
- [ ] **Step 2:** `JAVA_HOME`을 위 JDK 21로 하고 `.\gradlew.bat assembleRelease`, `apksigner verify`, `app-release.apk`를 `eat-in-korea.apk`로 복사한다.
- [ ] **Step 3:** 폰(`adb devices`로 `device`, 화면 켜짐·잠금 해제)에 `adb install -r`로 설치하고 웹 변경이 배포된 뒤 실제로 눌러서 확인한다: 배달 모드 → [쿠팡이츠]/[배민]이 각 앱을 여는지, 앱이 없을 때(확인 못 하면 그 사실을 적는다) 플레이스토어로 가는지, 이름이 복사됐는지(앱 검색창에 붙여넣기는 사용자의 계정 화면이라 직접 눌러 확인하도록 안내), 한국어 화면과 카드 제목 모양, 뒤로가기. 화면 캡처는 확인 뒤 지운다. 다른 앱이 앞에 떠 있을 때는 누르지 않는다.
