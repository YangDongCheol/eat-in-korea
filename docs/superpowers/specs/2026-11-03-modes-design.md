# Eat in Korea — 모드 구조, 집밥, 다이어트, 이전 앱 통합 (설계 추가분, 1단계)

작성일: 2026-11-03. 기준 문서: `2026-11-03-eat-in-korea-design.md`(본 설계), `2026-11-03-ko-delivery-design.md`(한국어·배달 추가분). 아래에 적은 항목만 위 문서를 바꾸거나 덧붙인다.

## 1. 목적과 단계

- **목적**: 오늘 뭐 먹지(`what-to-eat`)를 Eat in Korea에 통합하고, 앱을 "모드를 고르는 앱"으로 바꾼다. 나중에 미식가 모드(다녀온 곳 기록)를 넣을 수 있는 구조를 만든다.
- **단계** (각 단계가 끝날 때마다 배포해서 쓸 수 있어야 한다. 단계마다 설계 → 계획 → 구현 → 검토 → 배포를 따로 한다):
  1. **구조 개편 — 이 문서**: 모드 선택 첫 화면, 집밥 방식, 한국어 화면의 네이버 지도, 다이어트 모드(기존 메뉴 79개에 표시), 이전 앱 정리.
  2. 메뉴 33개 추가 (치킨, 피자, 파스타, 마라탕 등 한국 음식 외 메뉴 + 재료 표시와 세 언어 설명).
  3. 디저트 모드와 디저트 메뉴 25~30개 (한국 간식 + 카페 디저트). 디저트 카드는 이 단계에서 첫 화면에 나타난다. 우유·계란·밀은 걸러주지 않고 안내 문구만 강화한다.
- **이번 단계에서 하지 않는 것**: 메뉴 추가, 디저트 모드, 칼로리 숫자 표시, 미식가 모드, 우유·계란·밀 걸러내기, 서버와 로그인, 이전 앱 기록 이전.
- **저장소**: 기록과 설정은 폰의 `localStorage`에만 둔다 (본 설계와 같다). 저장 읽기/쓰기는 지금처럼 `loadJSON`/`saveJSON` 한 곳으로만 거친다 (나중에 바꾸기 쉽게).

## 2. 화면 구조

### 2.1 첫 화면 (`#home`, 새 화면)
- 상단: 언어 버튼 3개 (지금과 같음).
- 모드 카드 2개: **식사**(`modeMeal`, 설명 `modeMealDesc`), **다이어트**(`modeDiet`, 설명 `modeDietDesc`). 카드를 누르면 그 모드의 질문 화면으로 간다. 하단에 "기록 보기" 링크.
- 앱을 열면 항상 첫 화면에서 시작한다 (저장된 모드로 바로 가지 않는다). 모드 이름과 설명은 `STRINGS`에서 온다.

### 2.2 모드와 질문 화면 (`#ask`, 모드별 설정으로 만든다)
`modes.js`에 모드를 설정으로 적는다:
```js
const MODES = {
  meal: { labelKey: "modeMeal", descKey: "modeMealDesc", questions: ["way", "restrictions", "spice", "feel"], pool: (m) => true },
  diet: { labelKey: "modeDiet", descKey: "modeDietDesc", questions: ["way", "restrictions", "spice"],        pool: (m) => m.light === true },
};
```
- 질문 정의(키, 문구 키, 선택지, 복수 선택 여부)는 한 곳(`app.js`의 `QUESTION_DEFS`)에 두고, 모드는 어떤 질문을 어떤 순서로 쓰는지만 적는다. 질문 화면은 하나(`#ask`)이고 선택한 모드의 질문 목록으로 그린다.
- 질문 화면 상단에 **[← 모드 선택]** 버튼(`#ask-back`)이 있고 첫 화면으로 돌아간다.
- **`way` 질문** (본 설계의 "식당/배달" 질문을 확장): `qWay` — 선택지 `wayDine`(식당에서) / `wayDelivery`(배달) / `wayHome`(집밥). 값 `"dine"` / `"delivery"` / `"home"`, 기본 `"dine"`. 나머지 질문(`restrictions`, `spice`, `feel`)은 그대로다.
- 모드는 저장하지 않는다 (`eik:lastAnswers`에는 질문 답만 저장, 모드 선택은 매번 첫 화면에서).

### 2.3 결과 화면 (`#result`)
후보는 모드의 `pool`을 통과하고 `allowed()`를 통과한 메뉴다. 결과 화면의 버튼은 `way`로 정해진다.

| `way` | 버튼 |
|---|---|
| `dine` | [식당에 보여주기] (한국어 화면에서는 숨김), [근처 식당 찾기] |
| `delivery` | [쿠팡이츠], [배민] |
| `home` | [레시피 보기] (`recipe`, id `recipe-btn`) |

- [근처 식당 찾기]는 `mapsUrl(menu, lang)`을 새 탭으로 연다 (한국어 화면은 네이버 지도, 영어·중국어는 구글 지도, 3.3절).
- [레시피 보기]는 `recipeUrl(menu, lang)`을 새 탭(`window.open(url, "_blank", "noopener")`)으로 연다. 누르면 기록을 한 번만 저장한다 (본 설계 §6.2의 "한 추천에 한 번" 규칙, 다른 행동 버튼과 같은 플래그).
- 다이어트 모드의 결과에는 `dietNote`(3.2절)를 `disclaimer` 위에 항상 보여준다.
- [다른 거], [← 다시 고르기](질문 화면으로)는 그대로다. 질문 화면에서 [← 모드 선택]으로 첫 화면에 돌아간다. 한국어 카드(`#staff`)와 기록(`#history`) 화면은 그대로다 (기록의 [돌아가기]는 첫 화면으로 간다).

## 3. 데이터와 로직

### 3.1 메뉴 데이터 (`menus.js`, 기존 79개 전부에 필드 2개를 더한다)
- `ways: string[]` — `"dine"`, `"delivery"`, `"home"` 중 그 메뉴를 먹을 수 있는 방식 (`"dine"`은 항상 포함). 배달은 보통 배달이 되는 메뉴, 집밥은 집에서 흔히 해먹는 메뉴에 붙인다.
- `light: boolean` — "부담 적은 메뉴" 표시. 맑은 국물, 두부, 나물, 잡곡밥 등 기름기와 양이 적은 편으로 알려진 메뉴에 `true`. 칼로리 숫자는 데이터에 넣지 않는다.
- 새 필드에 따른 설명·태그 변경은 없다. 기존 태그(`contains` 등)와 설명은 바꾸지 않는다.

### 3.2 안전 문구
- **`dietNote`**(세 언어): 영어 원문(고정) `"Light" means a dish that is usually less oily or smaller, not that it is low in calories. Every restaurant is different.` 중국어는 같은 뜻으로 `热量低`를 쓰고, 한국어는 같은 뜻으로 `"부담 적은 메뉴"는 보통 기름기나 양이 적은 편이라는 뜻이고, 칼로리가 낮다는 뜻은 아니에요. 식당마다 달라요.`로 쓴다.
- **금지어** (대소문자 무시, 모든 문구와 메뉴 설명; 기존 목록에 더한다): `다이어트에 좋`, `다이어트 식품`, `저칼로리`, `칼로리가 낮은`, `살 안 찌`, `diet food`, `low-calorie`, `low calorie`, `slimming`, `fat-burning`, `低卡`, `减脂`, `瘦身`. `dietNote`는 예외 없이 이 검사를 통과해야 한다 (위 문장은 `칼로리가 낮다는`, `low in calories`, `热量低`로 쓰였고 금지어와 부분 문자열로 겹치지 않는다).
- **모드 이름**: `modeDiet` 영어 `Diet`, 중국어 `轻食`, 한국어 `다이어트`. `modeDietDesc` 영어 `Only lighter dishes`, 중국어와 한국어는 같은 뜻("부담 적은 메뉴만 골라줘요" 계열).

### 3.3 `answers`와 로직 (`logic.js`)
- `answers.mode`(식당/배달)를 **`answers.way`**(`"dine"|"delivery"|"home"`)로 이름을 바꾼다. `DEFAULT_ANSWERS = { restrictions: [], spice: "none", feel: "any", way: "dine" }`.
- `sanitizeAnswers(raw)`: `raw.way`가 허용 값이면 그것, 아니면 **옛 `raw.mode`가 `"dine"`/`"delivery"`면 그 값**, 아니면 `"dine"`. (`mode` 키는 결과에 남지 않는다.) 나머지 동작은 그대로(항상 새 객체).
- `allowed(menu, answers)`: 기존 조건에 `menu.ways.includes(answers.way)`를 더한다 (`ways`가 없는 메뉴는 `"dine"`만 가진 것으로 본다).
- `pick(menus, answers, history, shown, now, rand)`는 그대로다. 호출하는 쪽이 `menus` 자리에 `MENUS.filter(MODES[mode].pool)`을 넘긴다.
- `mapsUrl(menu, lang)`: `lang === "ko"`면 `"https://map.naver.com/p/search/" + encodeURIComponent("근처 " + menu.ko)`, 그 외는 기존 구글 지도 주소 (`"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(menu.ko + " 식당")`). `lang`을 생략하면 기존 동작(구글)이다.
- `recipeUrl(menu, lang)`: `"https://www.youtube.com/results?search_query=" + encodeURIComponent(q)` 이고 `q`는 `ko` → `menu.ko + " 레시피"`, `zh` → `menu.name.zh + " 食谱"`, 그 외 → `menu.name.en + " recipe"`.

### 3.4 화면 문구 키
`STRINGS` 세 언어가 같은 키를 가진다. **이름을 바꾸는 키 3개**(값은 그대로): `qMode` → `qWay`, `modeDine` → `wayDine`, `modeDelivery` → `wayDelivery`. **새 키 9개**: `wayHome`, `modeMeal`, `modeDiet`, `modeMealDesc`, `modeDietDesc`, `pickMode`(첫 화면의 안내 문구), `recipe`(레시피 보기 버튼), `dietNote`, `backToModes`([← 모드 선택]). 키 합계는 현재 46개에 새 키 9개를 더한 **55개**다. 새 키의 값은 구현 계획에서 정확히 고정한다.

## 4. 이전 앱 통합 (`what-to-eat` 저장소, 별도 작업)

- **주소 이동**: `what-to-eat`의 `index.html`을 교체한다. 일반 브라우저(사용자 환경 정보에 안드로이드 WebView 표시 `; wv)`가 **없을 때**)에서는 `https://yangdongcheol.github.io/eat-in-korea/`로 즉시 이동한다 (`location.replace`).
- **안내 화면**: 사용자 환경 정보에 WebView 표시가 있을 때(이전 APK 안)에는 이동하지 않고 안내를 보여준다: "새 앱(Eat in Korea)이 나왔어요. 새 앱을 설치해 주세요" + 새 APK 받는 링크 (영어·중국어·한국어). 이유: 이전 APK의 껍데기는 스크롤되는 화면에서 터치 위치가 어긋나고, 배달 버튼의 앱 열기 주소를 처리하지 못해 앱이 꺼진다.
- **서비스워커 교체**: `what-to-eat`의 `sw.js`를 정리용으로 바꾼다 — 설치 즉시 활성화(`skipWaiting`), 활성화 때 `wte-`로 시작하는 캐시를 모두 지우고 `registration.unregister()`, 열려 있는 탭을 새 앱 주소(또는 안내 화면)로 이동. `eik-` 캐시는 절대 건드리지 않는다.
- 이전 앱의 기록(`history`, `lastAnswers`)은 옮기지 않는다 (사라진다).
- 새 APK는 `eat-in-korea` 저장소의 GitHub 릴리스 파일로 올려서 받게 한다 (올리기 전에 사용자 확인).

## 5. 안드로이드 앱 (Eat in Korea, `C:\eik-android`)
이 단계에서는 코드를 바꾸지 않는다. 배포된 주소를 불러오므로 새 화면이 그대로 뜬다. 네이버 지도와 유튜브 링크는 껍데기의 "다른 앱으로 열기"로 열리는지 폰에서 확인한다.

## 6. 서비스워커와 배포
- 새 파일(`modes.js`)을 `sw.js`의 캐시 목록과 `index.html`에 더하고 `CACHE`를 올린다. 캐시 목록과 `index.html`의 일치는 기존 테스트가 지킨다.
- 순서: ① Eat in Korea 1단계 배포(올리기 전 확인) → ② 폰에서 크롬과 앱 확인 → ③ 이전 앱 저장소에 주소 이동·안내·정리 서비스워커 올리기(올리기 전 확인) → ④ 새 APK 릴리스 방법 정하기.

## 7. 테스트
- **로직**: `sanitizeAnswers`(`way` 허용 값, 옛 `mode` 값 이전, 알 수 없는 값, 옛 저장 형태), `allowed`의 `ways` 조건, `mapsUrl`(ko는 네이버 주소 정확히, en/zh는 구글, 인자 생략), `recipeUrl`(세 언어 정확한 주소, 특수문자 인코딩), 모드 설정(`MODES.meal.pool`은 모든 메뉴, `MODES.diet.pool`은 `light`만, 질문 목록 순서).
- **문구**: 세 언어의 키 집합이 같고 55개, 비어 있지 않고, 금지어(확장된 목록)가 없고, `dietNote`와 새 모드 이름 문구에 단정 표현이 없고, 영어 `dietNote` 원문 고정, 한국어 화면의 `recipe`/`wayHome` 등 한글 포함.
- **메뉴 데이터**: 모든 메뉴가 `ways`(허용 값, `"dine"` 포함)와 `light`(boolean)를 가진다. 방식별 개수 `dine` = 79, `delivery` ≥ 40, `home` ≥ 25. **각 방식에서 제한 하나만 켜도 메뉴가 10개 이상** 남는다 (`delivery`·`home`에서 채식은 5개 이상). 다이어트 후보(`light`) ≥ 15개, 제한 하나만 켜도 5개 이상(채식은 3개 이상). 기존 커버리지 테스트(본 설계 §10)는 그대로 통과한다.
- **화면(수동, 폰 크기 375px와 실제 폰)**: 첫 화면 → 식사 → 질문 → 결과 → 뒤로(질문, 모드 선택)가 되고, 다이어트 모드는 "느낌" 질문이 없고 `dietNote`가 보이고, 세 방식의 결과 버튼이 맞고, 한국어 화면에서 [근처 식당 찾기]가 네이버 지도를 열고, [레시피 보기]가 유튜브 검색을 열고, 기록 1회 저장, 옛 저장값(`mode`만 있는 `lastAnswers`, 깨진 값)에서도 정상 시작, 가로 스크롤 없음.
- **이전 앱 정리 확인(별도 저장소)**: 일반 브라우저에서 이동, WebView 환경 정보를 흉내 낸 요청에서 안내 화면, 서비스워커 교체 후 `wte-` 캐시가 사라지고 `eik-` 캐시가 남는다.

## 8. 아직 정하지 않은 것
- 다이어트 모드의 `light` 대상 메뉴 목록과 `ways` 값은 구현 중에 정하고 검토에서 확인한다 (분류 기준은 3.1절).
- 새 모드 카드의 아이콘과 문구(`modeMeal` 등)의 세 언어 값은 구현 계획에서 고정한다.
- 새 APK를 받는 링크의 정확한 주소는 릴리스를 올릴 때 정한다.
