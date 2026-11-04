# 메뉴 확장 (2단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메뉴를 79개에서 125개로 늘린다: 이전 앱(what-to-eat)에서 32개를 옮기고(겹치는 `순대국`은 제외), 배달·집밥 다이어트 후보가 모자란 부분을 채울 가벼운 메뉴 14개를 새로 쓴다.

**Architecture:** 코드 변경 없음. `menus.js`에 메뉴 객체를 더하고, 메뉴 개수에 묶여 있는 테스트 기준을 새 기준으로 바꾸고, 서비스워커 캐시 버전을 올린다.

**Tech Stack:** 바닐라 JS 데이터 파일, `node run-tests.js`(현재 PASS 79/79).

**Spec:** `docs/superpowers/specs/2026-11-03-modes-design.md`(1단계 설계, 메뉴 필드 `ways`·`light`·태그 규칙), 본 설계 `2026-11-03-eat-in-korea-design.md`(태그와 안전 문구 원칙).

## Global Constraints

- 메뉴 객체 모양은 기존과 정확히 같다: `{ id, ko, emoji, rom, name: { en, zh }, desc: { en, zh, ko }, spice: 0|1|2|3, feel: "hearty"|"light", contains: string[], ways: string[], light: boolean }`. `id`는 영문 소문자 kebab-case로 유일하고, `ko` 이름도 유일하다. 기존 79개는 한 글자도 바꾸지 않는다.
- `contains`는 `pork`, `meat`, `seafood`, `nuts`만 쓰고 보수적으로 단다: 국물·소스·육수까지 보통 들어가는 재료를 모두 단다(돼지고기가 들어가면 `pork`와 `meat` 둘 다, 멸치·새우젓·생선 소스·조개 육수가 흔하면 `seafood`, 땅콩·호두·잣·참깨 소스 등 견과류가 흔하면 `nuts`). 확신이 없으면 태그를 더 단다(덜 달지 않는다).
- `desc`는 세 언어 모두 한 문장 안팎의 쉬운 설명이다. `desc.ko`는 한글이 있어야 하고 `desc.zh`는 중국어 글자가 있어야 한다. 설명은 건강·다이어트·칼로리를 주장하지 않는다(**금지어**는 `tests.js`의 `FORBIDDEN` 상수 하나만 쓰고, 설명이 그 검사를 통과해야 한다). "소화가 잘돼요"류의 건강 표현도 쓰지 않는다. 설명에 견과류가 나오면 `nuts`, 돼지고기·햄·베이컨·소시지·스팸·만두가 나오면 `pork`를 단다(기존 테스트가 검사한다).
- `ways`는 `"dine"`을 항상 포함하고 `["dine","delivery","home"]`의 부분집합이며 중복이 없다. 배달이 흔한 메뉴만 `delivery`, 집에서 흔히 해먹는 메뉴만 `home`. `light: true`는 맑은 국물, 두부·나물·채소·곡물 중심, 기름기와 양이 적은 편으로 알려진 메뉴에만 달고, 확신이 없으면 `false`로 둔다. `feel`은 `light: true`이면 대체로 `"light"`이다.
- 줄바꿈은 LF(`.gitattributes`가 있다; 파일을 쓴 뒤 `file <이름>`이 CRLF를 말하면 안 된다). 커밋 메시지 끝에는 시스템이 지정한 Co-Authored-By 줄을 붙인다. 브랜치 `feat/menus-stage2`, GitHub에 올리지 않는다.
- `emoji`는 이모지 한 개(기존 형식), `rom`은 로마자 표기(기존 형식, 외래어는 일반 표기, 예: `Pizza`).

## Review Focus

1. **태그 누락(안전)**: 외국 음식에서 돼지고기·해산물·견과류 누락(피자 페퍼로니·베이컨, 햄버거 패티, 파스타 소스·베이컨, 부리또·타코 고기, 팟타이 땅콩·새우·피시소스, 똠얌꿍 새우·피시소스, 샐러드 드레싱 견과류, 포케 해산물, 샌드위치 햄) → Task 1 테스트와 리뷰어의 항목별 확인.
2. **설명에 건강 주장**: "건강한", "다이어트", "저칼로리", "소화가 잘" 등 → 기존 `FORBIDDEN` 검사 + 리뷰어 확인.
3. **다이어트 모드 후보 부족**: 배달·집밥에서 제한을 하나만 켜도 가벼운 메뉴가 충분해야 한다(Task 2 테스트 기준).
4. **중복 메뉴·이름 충돌**: `ko`/`id` 중복(순대국≈순대국밥 등) → 기존 유일성 테스트.
5. **서비스워커가 옛 `menus.js`를 계속 보여줌**: `eik-v7`로 올리지 않으면 폰이 옛 메뉴를 쓴다 → Task 2 마지막 단계의 sw 테스트.

---

### Task 1: 이전 앱 메뉴 32개 옮기기 (menus.js, tests.js)

**Files:**
- Modify: `menus.js`(끝부분에 새 구역 주석 `// --- from the old app: other cuisines and extras ---` 아래로 더한다), `tests.js`

**Interfaces:**
- Consumes: 기존 `MENUS` 모양, `allowed`, `MODES`, `FORBIDDEN`
- Produces: `MENUS.length === 111`(79 + 32)

옮길 32개(`ko` 이름, 이모지는 이전 앱 값을 쓰되 어색하면 비슷한 이모지로): 돼지국밥, 냉면, 계란말이 정식, 쌈밥, 곱창, 라볶이, 치킨, 볶음밥, 마라탕, 마라샹궈, 양꼬치, 마파두부, 초밥, 라멘, 돈부리, 소바, 카레라이스, 오코노미야키, 피자, 햄버거, 파스타, 스테이크, 샐러드, 포케, 샌드위치, 쌀국수, 팟타이, 똠얌꿍, 타코, 토스트, 월남쌈, 부리또. 이전 앱 값이 `/c/Users/syhaw/source/repos/what-to-eat/menus.js`에 있다(읽기만 한다). 단, 기존 79개와 겹치는 이름이면 추가하지 않고 보고한다. 같은 요리가 이미 다른 이름으로 있는지(`냉면`은 `물냉면`·`비빔냉면`, `치킨`은 `후라이드치킨`·`양념치킨`, `곱창`은 `곱창` 등) 먼저 대조하고, 겹치면 추가하지 않고 보고한다(개수는 그만큼 줄어든다 — 테스트 기준은 `MENUS.length`에 맞춰 쓴다).

- [ ] **Step 1: 테스트 기준 바꾸기 (먼저, 실패 확인)** (`tests.js`)
  - `MENUS size`(현재 60~80): 상한을 150으로, 하한 60 유지.
  - `MENUS way counts`: `delivery ≥ 70`, `home ≥ 55`(계획 끝에서 실제 개수로 맞추되 기준은 낮추지 않는다). 다른 개수 테스트는 그대로 둔다.
  - 새 테스트 `MENUS stage2 foreign dishes tagged`: id가 `pizza`, `hamburger`, `pasta`, `burrito`, `taco`, `sandwich`, `toast`, `pad-thai`, `tom-yum-goong`, `poke`, `salad`, `sushi`, `ramen` 등 실제로 추가한 외국 음식 중 설명에 `ham|bacon|pepperoni|sausage|pork`가 나오는 것은 `pork` 태그를 가진다(기존 설명 검사와 겹치지만 id로 한 번 더 고정), 그리고 `poke`, `sushi`, `pad-thai`, `tom-yum-goong`은 `seafood`를 가진다. 이 테스트의 id 목록은 구현이 정한 id에 맞춘다.
- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: 아직 메뉴가 없으므로 새 테스트가 FAIL.
- [ ] **Step 3: 메뉴 추가** — 위 32개를 같은 모양으로 추가한다. 영어·중국어 이름은 한국에서 흔히 쓰는 표기(예: `Pizza`/`披萨`). 외국 음식의 `contains`는 Review Focus 1대로 보수적으로.
- [ ] **Step 4: 통과 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`.
- [ ] **Step 5: Commit** — `git add menus.js tests.js && git commit -m "feat: add 32 menus from the old app"`

---

### Task 2: 가벼운 메뉴 14개 더하기와 캐시 버전 (menus.js, tests.js, sw.js)

**Files:**
- Modify: `menus.js`, `tests.js`, `sw.js`

**Interfaces:**
- Consumes: Task 1의 `MENUS`
- Produces: `MENUS.length === 125`(Task 1에서 겹침으로 줄었으면 그만큼 적음); `light: true` 메뉴 ≥ 30; 캐시 `eik-v7`

새 메뉴 14개(id/ko, 모두 한국에서 흔한 메뉴이며 `light`는 아래 지정대로): 샤브샤브(`shabu-shabu`, 배달·집밥 포함, light), 북엇국(`bugeo-guk`, light), 계란찜(`gyeran-jjim`, light), 두부조림(`dubu-jorim`, light), 콩나물밥(`kongnamul-bap`, light), 곤드레밥(`gondre-bap`, light), 버섯전골(`beoseot-jeongol`, light), 닭가슴살 샐러드(`dak-salad`, light), 두부 샐러드(`dubu-salad`, light), 닭죽(`dak-juk`, light), 곤약 비빔국수(`konjac-bibim-guksu`, light), 콩비지찌개(`kongbiji-jjigae`, light), 청국장(`cheonggukjang`, 집밥·식당, `light: false`), 닭개장(`dak-gaejang`, `light: false`, 얼큰). 앞의 12개는 `light: true`, 마지막 두 개는 `false`(맛 다양성). `ways`는 샤브샤브·샐러드류·죽·밥류는 `delivery`와 `home`을 포함하고, 전골·찌개류는 `delivery`는 선택, `home`은 포함한다.

- [ ] **Step 1: 테스트 기준 바꾸기 (먼저, 실패 확인)** (`tests.js`)
  - `diet pool size`: `MENUS.filter(MODES.diet.pool).length ≥ 28`.
  - `diet pool per way`: 방식 `dine`/`delivery`/`home` 각각에서 `spice "hot"`, `feel "any"`, 제한 없음일 때 `light` 메뉴(`allowed` 통과) ≥ 10(dine), ≥ 10(delivery), ≥ 10(home); 제한 하나(`pork`/`seafood`/`nuts`)만 켜면 각 방식에서 ≥ 6, `vegetarian`이면 각 방식에서 ≥ 4.
  - `MENUS way counts`의 `delivery`/`home` 기준을 실제 개수에 맞춰 올리되 낮추지 않는다.
  - `sw cache version`을 검사하는 기존 테스트가 있으면 그대로 두고, `CACHE`가 `eik-v7`이어야 함을 확인하는 항목을 더한다(기존 sw 테스트가 `FILES`만 검사하면 `sw.js` 소스에서 `const CACHE = "eik-v7"`을 정규식으로 확인하는 테스트 하나를 더한다).
- [ ] **Step 2: 실패 확인** — Run: `node run-tests.js` / Expected: 새 테스트가 FAIL.
- [ ] **Step 3: 메뉴 14개 추가, `sw.js`의 `CACHE`를 `eik-v7`로** — 위 지정대로. `contains`는 Review Focus 1대로(북엇국 참기름·계란, 곤드레·콩나물밥의 멸치 육수/양념 간장, 두부조림 멸치, 샤브샤브 소고기 육수와 참깨 소스 → `nuts` 포함 여부는 보수적으로 판단해 달고, 이유를 보고서에 적는다).
- [ ] **Step 4: 통과 확인** — Run: `node run-tests.js` / Expected: FAIL 없이 `PASS n/n`. 정적 서버(새 포트, 8000·8010·8321·8777·8899·9123·8456·8537·8613 제외)에서 브라우저 패널로: 다이어트 모드 + 배달/집밥에서 [다른 메뉴]를 20번 눌러 서로 다른 메뉴가 10개 이상 나오는지, 콘솔 오류 없음. 끝나면 서버를 멈춘다.
- [ ] **Step 5: Commit** — `git add menus.js tests.js sw.js && git commit -m "feat: add 14 light menus and bump cache to eik-v7"`
