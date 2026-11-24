# Dumpster 설계

옵시디언에 쓴 **쌩메모**를 그대로 블로그로 내놓는 아카이브. 정리는 재미없으니까 안 한다.
정제본은 노션 → 외부 블로그에서 하고 여기선 다루지 않는다.

```
옵시디언 볼트 (~/obsidian, private git)
   │  공개 폴더만 읽음 (.env DUMPSTER_PUBLIC)
   ▼
apps/builder ── frontmatter·git 날짜·링크 해석 ──▶ graph.json (노드 = 문서, 엣지 = prev/see_also/link)
                                                    │
                          ┌─────────────────────────┴──────────────┐
                          ▼                                        ▼
                    apps/web (탐색기, 배포)               apps/playground (개발 전용)
```

개발 기본 데이터는 **짜가 볼트** `fixtures/vault/` — 읽을 건 `홈서버 구축기/OT.홈서버 구축기.md` 한 장
(기대 트리 + 케이스 17개 + 탐색 시나리오).

---

## 1. 결정 기록

| 날짜 | 결정 |
|---|---|
| 11-24 | 공개 범위: 기본 비공개. 공개 폴더 목록은 `.env`에만 (레포에 안 남음) |
| 11-24 | 볼트 레포는 private → 1단계는 Pi 로컬 빌드. CI로 옮기면 읽기 전용 PAT 필요 |
| 11-24 | 문서 ID = 이름 + createdAt (`도커-설치-2611041940`) |
| 11-24 | 정제본은 범위 밖. Dumpster = 쌩메모만 |
| 11-24 | 탐색: 컬렉션 = 트리 한 컬럼(git graph식), **본류 없음**, 링크만 push |
| 11-24 | 첫 화면 = 최근 업데이트(루트 MOC) + 컬렉션/태그 스위처 |
| 11-24 | 블록 매핑·디자인용 플레이그라운드를 만든다 (블록 레지스트리 전제) |
| 11-24 | 레거시 두 레포 → 모노레포 하나, 타입은 `packages/schema` 한 곳에만 |

---

## 2. 속성(frontmatter) → 노드

| 키 | 규칙 |
|---|---|
| `prev` | `"[[제목]]"` 하나. → `prev` 엣지. **다음 글은 역참조로만** (이전 글을 고치지 않는다) |
| `type` | `manifest` / `moc` / 없으면 `doc`. 모르는 값은 doc + 경고 |
| `order` | lexorank (`a` < `am` < `b`). 형제 정렬에만 씀 |
| `createdAt` | `2026-11-11-14:01` · `2026-07-10T22:45:00` · `2026-07-07` · 오프셋 있는 ISO → 전부 `+09:00` ISO. 없으면 git 첫 커밋 → 파일 mtime |
| `updatedAt` | (속성 아님) git 마지막 커밋 → mtime |
| `tags` | `null`→`[]`, `#` 제거, 중복 제거 |
| `aliases` | 링크 해석에 씀 (파일 이름이 우선) |
| `see_also` / `branch` | 문자열·리스트 둘 다 → 엣지. 트리에는 안 씀 |
| `description` | 매니페스트 → 컬렉션 설명 |

- **컬렉션** = 공개 목록에 적은 폴더 하나. 그 폴더 바로 아래 `.md`만 멤버. **하위 폴더는 따로 적어야** 공개된다.
- **건너뛰기**: 0바이트 파일(make-md 폴더 노트 등), `.`으로 시작하는 폴더.
- **링크 해석**: 옵시디언처럼 이름으로 — 파일 이름 > 별칭, 같은 폴더 > 짧은 경로. 대소문자 무시.
- **비공개**: 비공개 파일은 내용을 읽지 않는다. 비공개 문서로 가는 링크는 없는 문서와 똑같이 `target: null` (존재 여부도 안 샌다). 어느 쪽인지는 콘솔 리포트에만.
- **ID**: `slugify(이름)-yyMMddHHmm(KST)`. 이름을 바꾸면 ID도 바뀌므로 탐색기는 URL을 스탬프(`stampOf`)로 한 번 더 찾는다. 충돌하면 `-2`.

계약: [packages/schema/src/graph.ts](../packages/schema/src/graph.ts)

---

## 3. 트리와 탐색

### 트리 규칙 ([packages/schema/src/tree.ts](../packages/schema/src/tree.ts))

1. 자식 1개 → 같은 깊이로 이어 그림
2. 자식 2개 이상 → **갈래 전부** 한 칸 들여쓰기 (본류 없음)
3. 형제 정렬: `order` → `createdAt` → 이름
4. 루트 = 매니페스트. 매니페스트가 있으면 prev 없는 일반 글은 '연결 안 됨'. 없으면 prev 없는 글들이 각각 루트
5. prev가 다른 컬렉션이면 이 컬렉션 안에선 루트 + `continuesFrom`
6. 연결 안 됨: `prev 없음` / `prev 대상 없음` / `prev 순환` / `순환에 매달린 글` — 덩어리째(아래 글 포함) 시작 글 기준 정렬

prev는 문서당 하나라 **문서 ID 하나로 루트까지 경로가 유일** → URL `/d/{id}`만으로 컬럼 복원 (`ancestors`).

### 컬럼

```ts
type Column = { id: number } & (                 // id: push마다 고유 (mongolive comp.id)
  | { kind: 'root'; mode: 'recent' | 'collections' | 'tags' }
  | { kind: 'tree'; collectionId: string; selected: DocId | null; collapsed: DocId[] }
  | { kind: 'doc';  docId: DocId; via: 'tree' | 'link' }
)
```

| 동작 | 결과 |
|---|---|
| 트리 행 클릭, `j`/`k` | 문서 컬럼 **교체** |
| 문서 하단 이전/다음 글 (갈래 여럿이면 다 나열) | 교체 + 트리 선택 따라감. 다른 컬렉션이면 📍처럼 리셋 |
| 본문 `[[링크]]`, `see_also`, 백링크 | 오른쪽에 **push**. 이미 경로에 있으면 거기까지 pop |
| 📍 원래 자리 / 루트 '최근'에서 클릭 | 루트 → 그 컬렉션 트리 → 문서로 리셋 |
| URL 진입 | 조상 분기 펼친 트리 + 문서 |
| 분기점 | 접기 토글. 기본 펼침, 선택 문서의 조상은 항상 펼침 |
| 폰 | 슬라이딩 윈도우 1칸 + 브레드크럼 |

트리 이동은 교체, 링크만 push → 컬럼은 링크를 탄 횟수만큼만 늘어난다.

**mongolive에서**: 그대로 — `ColumnItem` `PageRail` `PageEdge` `TooltipLayer` `useHover` `cn` `motionPresets` `useMillerKeyboard`(쿼리 패널 의존 제거) `QuickJump` 퍼지 순위, `tailwind.config.cjs`+`index.css` 테마.
패턴만 — `MillerColumns`(슬롯 비율·popLayout), `Breadcrumbs`, `ReferencesPanel`, `findOpenColumnForRef`, `openLocation`.
버림 — `useExplorerState`(Mongo 전용 1.7k줄), 편집기, 쿼리·집계, 서버.
**blog-explorer에서**: `useGraphExplorer`(activePaths·popToIndex·순환 pop), `FloatingEdgePanel`.

---

## 4. 마크다운 → 블록 (P2)

`remark-parse` + `remark-gfm`으로 문법 트리를 만들고 Block[]으로 바꾸는 switch 하나. 옵시디언 문법(`[[ ]]`, 콜아웃, `%% %%`)은 트리 후처리.
파서는 **순수 함수**(파일·git 접근 금지) — 플레이그라운드가 브라우저에서 바로 돌린다. 계약: [packages/schema/src/blocks.ts](../packages/schema/src/blocks.ts)

| 옵시디언 문법 | 실제 볼트 사용량 | → Block |
|---|---|---|
| `#`~`####` | 122 | `heading{level, anchor}` |
| 문단 (줄바꿈 1번 = 줄바꿈) | 다수 | `paragraph` |
| `-` / `1.` 리스트 (최대 4단) | 607줄 / 71 | `list{ordered, start, items[{inlines, children}]}` |
| `>` 인용 | 114줄 | `blockquote{children}` (안에 코드·리스트) |
| `> [!kind]±` 콜아웃 | 4 | `callout{kind, title, fold, children}` |
| ` ``` ` | 12 | `code{language, text}` |
| ` ```cardlink ` (플러그인) | 0 | `bookmark` |
| 표 | 248행 | `table{align, header, rows}`, 셀 `<br>` → 줄바꿈 |
| `---` | 15 | `hr` |
| `![[x.png\|447]]` | 12 | `image{src(해시 복사본), width}` |
| `**` `*` `` ` `` `~~` `==` | 121/4/160/18/0 | 인라인 플래그 |
| `[[문서]]` | 3 | `link{kind:'doc', docId}` + `link` 엣지 |
| `![[문서]]` | 0 | `embed` |
| 생 HTML | 3 | `<br>`만 줄바꿈, 나머지는 글자로 (렌더 금지) |
| `%%주석%%` | 0 | **삭제** (공개 금지) |
| 수식·각주·`^id` | 0 | `unsupported` + 경고 |

함정: ① 콜아웃 안 코드펜스에 `>` 빠진 줄 (`블로그 문서 메타데이터 구조 고민.md`) — 옵시디언 렌더와 대조 ② 표 안 `[[a|b]]`의 `|` ③ 붙여넣은 `<div class="...">` — Tailwind 클래스가 실제로 먹음 ④ 이미지는 파일 이름만으로 볼트 전체에서 찾음.

---

## 5. 블록 디자인 (P3)

blog-explorer `BlockRenderer`에서 출발, 색·테마는 mongolive(Tailwind v3, CSS 변수 팔레트, 다크 = 옵시디언 다크).

- heading: `<p>` → 진짜 `<h1~6>` + 앵커
- 본문: 읽기 컬럼은 15~16px (노션 16px)
- 링크: indigo → mongolive 강조색. 내부 링크는 컬럼 push, 없는 문서는 회색 글자
- **code**: mongolive 다크는 slate 단계를 뒤집는다(950 → `#f5f5f5`) → `bg-slate-950`을 쓰면 다크에서 하얘짐. 전용 `--code-bg` 변수
- callout: 종류별 색·lucide 아이콘, 접히면 `<details>` (blog-explorer toggle 애니메이션 재사용)
- image: alt가 `Pasted image …`라 캡션 숨김

---

## 6. 구조

```
packages/
  schema/      ✅ 계약 — Graph·Doc·Edge·Block 타입, ID, 트리 인덱스
  blocks/      ⏳ 블록 레지스트리 — <type>/{parse.ts, View.tsx, style.json, samples.md}
  markdown/    ⏳ 순수 파서 (Node·브라우저 공용)
apps/
  builder/     ✅ 파일·git·env → graph.json (Node 전용)
  web/         ⏳ 탐색기 (배포)
  playground/  ⏳ 개발 전용 — 블록 갤러리 / 라이브 md→블록 / 스타일·펜스 매핑 편집 / 파일에 저장
fixtures/vault/  짜가 볼트 (기본 데이터)
```

**플레이그라운드**: 플러그인 대부분이 ` ```언어 ` 펜스로 문법을 더하므로 "펜스 언어 → 블록, YAML 키 → 속성" 선언형 매핑으로 대부분 처리 — 이건 데이터라 화면에서 바로 저장. 새 인라인 문법·새 View는 코드라 뼈대만 생성. Storybook 안 씀(Pi에서 무거움). 블록 갤러리 = 검수용 시각 회귀 화면.

---

## 7. 단계

| # | 단계 | 완료 기준 | 상태 |
|---|---|---|---|
| P0 | 계약·골격·짜가 볼트 | 타입체크 통과 | ✅ 11-24 |
| P1 | 속성·엣지 빌더 | 짜가 볼트 트리 = 매니페스트 기대값, 비공개 유출 0, 실제 볼트 2개 컬렉션 정상 | ✅ 11-24 (테스트 43) |
| P2 | 마크다운 파서 + 블록 레지스트리 | fixture별 정답 JSON, 미지원 문법 리포트 | |
| P3 | 렌더러 + 테마 | 모든 블록 라이트/다크 스크린샷 | |
| P3.5 | 플레이그라운드 | 갤러리 + 라이브 미리보기 + 스타일 저장 | |
| P4 | 탐색기 | 매니페스트의 탐색 시나리오 표를 e2e로 | |
| P5 | 배포 (gh-pages) | 실제 URL, 비공개 문서·`%%` 0건 | |

### 부하 (Pi 5 · 4코어 · RAM 8G · NVMe)

| 작업 | 실측/추정 | 빈도 | 종합 |
|---|---|---|---|
| `pnpm graph` 짜가 볼트 (24문서) | **81ms**, 15KB | 빌드마다 | 하 |
| `pnpm graph` 실제 볼트 (19문서, git 커밋 220개) | **239ms**, 12.6KB | 빌드마다 | 하 |
| `pnpm install` (P1 기준) | 42개, 75MB, 1초 미만 (pnpm 캐시) | 의존성 바뀔 때 | 하 |
| `pnpm test` | 43개, 약 0.7초 | 수시 | 하 |
| remark 파싱 (P2, 1.8k줄) | <1초 추정 | 빌드마다 | 하 |
| vite dev / build (P3~) | 200~300MB / 피크 0.5~1GB, 30~60초 | 개발 중 / 배포 | 중 / 잠깐 상 |
| e2e (헤드리스 Firefox) | 0.5~1GB | 단계 끝 | 상 — 단계당 1번 |
| mermaid 빌드 렌더 | 헤드리스 Chromium 필요 | — | 상 → 브라우저 지연 로드로 |

### 에이전트 부서 (나눌 때)

부서마다 이 문서 + "읽을 파일 목록"만 브리프로 준다 (mongolive 전체 탐색 금지). 동시에 2부서까지 (가용 RAM 약 3.9G).
추천: **파서(P2) ∥ 렌더(P3)** — 둘 다 `packages/schema/src/blocks.ts`만 공유. 탐색(P4)은 렌더 뒤, 검수는 단계마다 직렬.

---

## 명령

```bash
pnpm graph       # .env의 볼트 → out/graph.json + 컬렉션별 트리·리포트 출력
pnpm test
pnpm typecheck
```

실제 볼트로: `.env`에서 `DUMPSTER_VAULT=/home/<you>/obsidian`, `DUMPSTER_PUBLIC=MongoDB Explorer/병 합,개발일지 플랫폼 기행문`
