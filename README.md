# Dumpster

옵시디언 쌩메모를 노드·엣지 그래프로 뽑아 밀러 컬럼 탐색기로 보여주는 아카이브 블로그.

```bash
cp .env.example .env   # 기본은 짜가 볼트(fixtures/vault)
pnpm install
pnpm graph             # → out/graph.json + 트리 출력
pnpm test
```

설계·결정·진행 상황: [docs/design.md](docs/design.md)
