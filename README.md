# 아발론 원탁

친구들과 웹에서 하는 「레지스탕스: 아발론」. 원형 테이블에 1인칭으로 둘러앉아, 서로의 시선과 테이블 위 토큰·카드를 보며 플레이합니다.

문서: [spec](specs/avalon/spec.md) · [plan](specs/avalon/plan.md) · [tasks](specs/avalon/tasks.md) · **[코드 공부 가이드](docs/STUDY.md)** · [호스팅 방식 비교](docs/HOSTING.md)

## 처음 한 번

```bash
npm install
```

## 개발

```bash
npm run dev
```

- 화면: http://localhost:5180 (서버 :3000으로 소켓 프록시)
- 캐릭터 미리보기: http://localhost:5180/preview.html
- 혼자 테스트: 방을 만든 뒤 `node tools/bots.mjs <방코드> 6` → 봇 6명이 들어와 자동으로 플레이합니다

## 친구들과 플레이 (게이밍 노트북을 서버로)

### Windows (PowerShell)

처음 한 번 cloudflared를 설치합니다 (계정 필요 없음):

```bash
winget install --id Cloudflare.cloudflared -e
```

플레이할 때마다 `avalon` 폴더에서 터미널 두 개를 엽니다.

1번 터미널: 화면을 빌드하고 서버를 켭니다 (코드를 안 바꿨으면 빌드는 생략해도 됩니다)

```bash
npm.cmd run build
```

```bash
npm.cmd start
```

2번 터미널: 외부 접속 주소를 만듭니다

```bash
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://localhost:3000
```

- `npm` 대신 `npm.cmd`를 쓰는 이유: 이 PC의 PowerShell 실행 정책이 `npm.ps1` 스크립트를 막기 때문입니다. `npm.cmd`는 같은 기능이고 정책을 바꿀 필요가 없습니다.
- cloudflared를 전체 경로로 실행하는 이유: 설치 직후 열려 있던 터미널은 PATH가 갱신되지 않습니다. 새 터미널에서는 `cloudflared tunnel --url http://localhost:3000`만 써도 됩니다.

### macOS / Linux

```bash
npm run build && npm start
```

```bash
cloudflared tunnel --url http://localhost:3000
```

### 공통

- 2번 터미널에 출력되는 `https://….trycloudflare.com` 주소를 친구들에게 보내면 됩니다. 실행할 때마다 주소가 바뀝니다.
- 두 터미널 중 하나라도 닫으면 접속이 끊깁니다. 노트북은 전원을 연결하고 절전 모드를 꺼 두세요. 서버가 꺼지면 진행 중인 게임이 사라집니다.
- 새로고침하면 같은 자리로 돌아옵니다. 브라우저를 아예 닫았다면 같은 방 코드와 **같은 닉네임**으로 다시 입장하면 원래 자리와 역할로 돌아옵니다 (게임 중에도 가능).

### 터널이 안 열릴 때

`failed to request quick Tunnel … server gave HTTP response to HTTPS client`가 나오면, 지금 연결된 네트워크(학교·기관 와이파이 등)가 터널 주소를 막고 있는 것입니다. 설정 문제가 아니라서 명령을 바꿔도 해결되지 않습니다.

- **가장 쉬운 방법**: 휴대폰 핫스팟이나 집 와이파이처럼 다른 네트워크에 연결한 뒤 같은 명령을 다시 실행합니다.
- 확인 방법: `curl.exe -s -o NUL -w "%{http_code}" https://api.trycloudflare.com/` 가 `000`이고 오류 코드가 35면 막힌 네트워크입니다.
- 이런 네트워크에서는 Cloudflare 터널(계정이 있어도), ngrok, localhost.run도 함께 막혀 있을 수 있습니다.

## 테스트

```bash
npm test          # 규칙 엔진 20개 + 서버 통합 1개
npm run typecheck
```

## 캐릭터 모델

`assets-src/kaykit/`의 원본(KayKit Adventurers · Skeletons, CC0, Kay Lousberg)을 `npm run models`로 무기와 안 쓰는 애니메이션을 지워 `client/public/models/`에 넣습니다.
