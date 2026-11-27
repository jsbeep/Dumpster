# Dumpster

옵시디언 메모를 노드·엣지 그래프로 뽑아, 컬렉션별로 이어 읽는 칸 탐색기로 보여주는 아카이브 블로그

```bash
cp .env.example .env   # 기본은 가짜 볼트(fixtures/vault)
pnpm install
pnpm graph             # 볼트 → out/graph.json + 컬렉션별 트리 출력
pnpm dev:web           # 탐색기 (pnpm graph 먼저)
pnpm build:web         # apps/web/dist — 상대경로라 하위 폴더(gh-pages)에 그대로 올리면 됨
pnpm test && pnpm typecheck && pnpm lint
```

## 원본 볼트 공개 규칙

- **기본은 비공개**
- `.env`의 `DUMPSTER_PUBLIC`에 적은 폴더만 컬렉션으로 공개
- (하위 폴더는 따로 기재)
- 태그에 `_draft` 포함: 비공개 처리 (옛 `draft`도 숨기지만 빌드 경고)
- `%%주석%%`은 빠짐
- 비공개 글로 가는 링크: 없는 글 처리

## 옵시디언 프론트매터
[Templater](https://github.com/silentvoid13/Templater) 플러그인 사용
### manifest_template
```yaml
---
oid: <% Math.floor(Date.now() / 1000).toString(16).padStart(8, '0') + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('') %>
# 현재 시간으로 oid 자동생성
type: manifest  # 고정
description:    # 설명
tags:           # 태그
createdAt: <% tp.date.now("YYYY-MM-DDTHH:mm") %>    # 생성일
---
```
### doc_template
```yaml
---
oid: <% Math.floor(Date.now() / 1000).toString(16).padStart(8, '0') + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('') %>
# 현재 시간으로 oid 자동생성
prev:       # 이전 글, 단일
tags:       # 태그
createdAt: <% tp.date.now("YYYY-MM-DDTHH:mm") %>    # 생성일
---
```

| 필요할 때만 | |
|---|---|
| `type: manifest` | 컬렉션 첫 글 (트리 뿌리) |
| `order` | 같은 자리 글끼리 순서 (lexorank: `a` < `am` < `b`) |
| `aliases` | 별칭 |
| `see_also` | 함께 볼 글 링크 |
| 태그 `_branch` | 곁가지 글 — 트리에서 한 칸 들여씀. 갈라질 때 태그 없는 글이 하나면 그게 본줄기로 같은 깊이로 이어짐. **갈래가 시작되는 첫 글에만** 단다 (그 뒤 글까지 달면 한 칸씩 더 밀려 계단이 됨) |
| 태그 `_draft` | 숨김 (비공개와 같음) |

`_`로 시작하는 태그는 빌더 표시라 공개 태그 목록엔 안 나옴.

## 구조

| | |
|---|---|
| `packages/schema` | graph.json 타입·트리 규칙 (모든 곳이 공유) |
| `packages/markdown` | 옵시디언 마크다운 → 블록 |
| `packages/blocks` | 블록 → React |
| `apps/builder` | 볼트 → graph.json |
| `apps/web` | 탐색기 |
| `apps/playground` | 블록 견본·라이브 변환 작업대 (개발용) |
