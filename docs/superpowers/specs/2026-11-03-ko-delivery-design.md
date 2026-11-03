# Eat in Korea — 한국어 화면, 배달 바로가기, 카드 제목 수정 (설계 추가분)

작성일: 2026-11-03. 기준 문서: `2026-11-03-eat-in-korea-design.md` (이하 "본 설계"). 아래에 적은 항목만 본 설계를 바꾸거나 덧붙인다. 적지 않은 부분은 본 설계 그대로다.

## 1. 변경 요약

1. 화면 언어에 **한국어(ko)**를 추가한다 (en, zh, ko).
2. 질문 화면에 **"식당에서 먹기 / 배달"** 질문을 추가하고, 배달이면 결과 화면에 **쿠팡이츠**와 **배달의민족** 바로가기 버튼을 보여준다.
3. 질문 카드의 제목이 카드 윗선에 걸쳐 보이는 문제를 고친다.
4. 안드로이드 껍데기(WebView)가 앱 열기 주소(`intent:`)를 처리하도록 고친다 (저장소 밖 작업).

본 설계 §4의 "제외" 중 **배달**과 **혼자/여럿**은 이번에 배달만 되살린다 (혼자/여럿은 그대로 제외). 번체 중국어 등 다른 언어는 계속 제외한다.

## 2. 한국어 화면

- `STRINGS`에 `ko`를 추가한다. 키는 en, zh와 정확히 같아야 한다 (본 설계 §7.5의 키 목록 + `remove`, `spiceLabel` + 이번에 추가하는 키, 아래 §3·§5).
- `detectLang`은 `ko`로 시작하는 언어(대소문자 무시)면 `"ko"`, `zh`로 시작하면 `"zh"`, 그 외와 빈 값은 `"en"`을 반환한다.
- 언어 버튼은 3개다: `English`, `简体中文`, `한국어` (순서 고정, `aria-pressed`). 첫 실행 언어는 `detectLang(navigator.language)`, 저장된 `eik:lang`이 있으면 그것.
- 메뉴 데이터: 각 메뉴에 `desc.ko`를 추가한다 (79개 전부). 한국어 화면의 메뉴 이름은 `menu.ko`다. 한국어 화면에서는 "한국어 이름 · 읽는 법" 줄(`menu-ko`)을 보이지 않는다 (이미 한국어 이름이 제목이므로).
- 한국어 화면에서는 **[식당에 보여주기]** 버튼을 숨긴다 (한국어 카드가 필요 없는 사용자이므로). 한국어 카드 화면 자체와 `staffCard`는 그대로 둔다.
- 안전 문구 원칙(본 설계 §8)은 한국어에도 똑같이 적용한다. 보증하는 표현을 쓰지 않는다. 금지어에 한국어를 더한다: 기존 `할랄`, `안전`에 더해 `알레르기 걱정 없`, `알레르기 없`, `알레르기 안심`, `무알레르기`, `보장`. 한국어 안내 문구(`disclaimer`)는 영어 원문과 같은 뜻이어야 한다: 표시된 재료는 이 음식에 보통 들어가는 재료이고, 식당마다 다르니 직원에게 꼭 확인하며, 이 앱은 알레르기 대비를 대신하지 않는다.

## 3. 배달 모드

### 3.1 상태
- `Answers`에 `mode: "dine" | "delivery"`를 추가한다. 기본값은 `"dine"`. `sanitizeAnswers`는 알 수 없는 값을 `"dine"`으로 바꾼다. `lastAnswers`에 함께 저장한다. 추천 로직(`allowed`, `pick`)은 `mode`를 보지 않는다.

### 3.2 질문
- 질문 화면 맨 위에 질문 하나를 추가한다: 영어 `How are you eating?` 선택지 `Dine out` / `Delivery`, 중국어 `怎么吃？` 선택지 `去店里吃` / `点外卖`, 한국어 `어떻게 드실래요?` 선택지 `식당에서` / `배달`. 하나만 선택, 기본은 식당. 키: `qMode`, `modeDine`, `modeDelivery`.

### 3.3 결과 화면
- `mode`가 `"dine"`이면 지금과 같다 (한국어 화면은 [식당에 보여주기]만 숨김).
- `mode`가 `"delivery"`이면 [식당에 보여주기]와 [근처 식당 찾기] 대신 **[쿠팡이츠]**, **[배민]** 두 버튼을 보여준다. 버튼 이름은 모든 언어에서 `쿠팡이츠`, `배민`이다 (서비스 이름 그대로). 키: `deliveryCoupang`, `deliveryBaemin`.
- 눌렀을 때: ① 기록을 저장한다 (한 추천에서 처음 누른 한 번만, 본 설계 §6.2). ② 메뉴의 **한국어 이름**을 클립보드에 복사한다 (`navigator.clipboard.writeText`, 실패해도 계속 진행). ③ 해당 앱을 연다 (3.4절). ④ 앱에서 돌아왔을 때 보이도록 결과 화면에 안내 문구(`deliveryHint`)를 보여준다: 영어 `Copied "<name>". Paste it into the search bar of the app.` (한국어 이름을 따옴표 안에), 중국어·한국어는 같은 뜻.
- 복사가 실패하거나 클립보드 API가 없으면, 안내 문구 대신 한국어 이름을 선택 가능한 글자로 보여준다 (`deliveryCopyFailed` + 이름).
- 모든 배달 결과 화면에는 기존 `disclaimer`가 그대로 보인다.

### 3.4 앱 열기 (`logic.js`)
- `DELIVERY_APPS = [{ id: "coupangeats", scheme: "coupangeats", pkg: "com.coupang.mobile.eats", web: "https://www.coupangeats.com/" }, { id: "baemin", scheme: "baemin", pkg: "com.sampleapp", web: "https://www.baemin.com/" }]` (폰에서 두 패키지 이름을 확인했다).
- `isAndroid(userAgent)`: 대소문자 구분 없이 `android`가 들어 있으면 `true`.
- `deliveryUrl(app, userAgent)`: 안드로이드면 `intent://#Intent;scheme=<scheme>;package=<pkg>;S.browser_fallback_url=<인코딩한 https://play.google.com/store/apps/details?id=<pkg>>;end`, 그 외에는 `app.web`. 안드로이드 크롬과 안드로이드 껍데기(WebView)는 `window.location.assign(url)`로 이동한다 (`window.open` 안 씀). Device test: the package-only form opened the Play Store in Chrome even with the apps installed; with the app's own BROWSABLE scheme Chrome resolves to the installed app (verified by querying the phone).
- 메뉴를 검색해 주는 앱 내부 주소는 공개된 규격이 없어서 쓰지 않는다 ("바로가기까지만").

## 4. 카드 제목 걸침 수정
- 질문 카드(`fieldset`)의 제목(`legend`)이 카드 윗선 위에 걸치지 않고 카드 안쪽 위 여백 아래에 놓이게 한다. 카드·칩·버튼의 다른 모양은 바꾸지 않는다. 폭 375px에서 확인한다.

## 5. 새 화면 문구 키
`qMode`, `modeDine`, `modeDelivery`, `deliveryCoupang`, `deliveryBaemin`, `deliveryHint`, `deliveryCopyFailed`, `langKo` (`한국어`; 세 언어 모두 `한국어`). 기존 키는 그대로이고 모든 언어가 같은 키 집합을 가진다.

## 6. 서비스워커와 배포
- 바뀌는 파일이 있으므로 `sw.js`의 `CACHE`를 `eik-v3`으로 올린다. 파일 목록은 그대로다 (새 파일 없음).
- GitHub 공개 저장소에 올리기 전에 사용자 확인을 받는다.

## 7. 안드로이드 껍데기 (저장소 밖, `C:\eik-android`)
- `shouldOverrideUrlLoading`에서 `intent:` 주소를 `Intent.parseUri(url, Intent.URI_INTENT_SCHEME)`로 해석한다. **허용 패키지(`com.coupang.mobile.eats`, `com.sampleapp`)가 아니면 무시**하고, 허용되면 `setComponent(null)`, `setSelector(null)`, `CATEGORY_BROWSABLE`을 설정해서 `startActivity` 한다. 앱이 없어서 `ActivityNotFoundException`이면 주소의 `browser_fallback_url`(플레이스토어)을 시스템 브라우저로 연다. 다른 `intent:`는 모두 거부한다.
- 앱 이름, 패키지, 아이콘은 그대로다. `versionCode`를 올린다.

## 8. 테스트와 확인
- 로직: `sanitizeAnswers`의 `mode`, `isAndroid`, `deliveryUrl`(안드로이드 주소 형식과 인코딩, 비안드로이드 웹 주소, 두 앱 모두), `detectLang`의 `ko`.
- 문구: 세 언어의 키 집합이 같은지, 한국어 값에 한글이 있고 비어 있지 않은지, 금지어(영어·중국어·한국어)가 없는지, 영어 `disclaimer` 원문 고정과 한국어 `disclaimer`의 필수 의미, `langKo`.
- 메뉴: 모든 `desc.ko`가 한글을 포함하고 금지어가 없는지, `desc.ko`가 재료 태그와 모순되지 않는지(견과류 단어가 있으면 `nuts` 태그).
- 화면(수동): 375px, 세 언어 전환, 배달 모드 버튼·복사 안내·기록 1회 저장, 한국어 화면에서 [식당에 보여주기] 숨김, 카드 제목이 선 위에 걸치지 않음, 손상된 저장값에서도 정상 시작. 폰에서 쿠팡이츠·배민 버튼이 해당 앱을 여는지 확인한다.
