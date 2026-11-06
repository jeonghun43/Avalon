# 다른 컴퓨터에서 받아서 실행하기

> GitHub에서 받은 저장소를 새 노트북(Windows 또는 macOS)에서 실행하기까지의 순서예요.
> 2026-11-06에 빈 폴더로 새로 받아서 이 순서대로 설치 → 빌드 → 실행이 되는 것을 확인했어요.

## 한눈에 보기

```bash
git clone https://github.com/jeonghun43/Avalon.git
```

```bash
cd Avalon
```

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 http://localhost:5180 을 열면 끝이에요. 아래는 각 단계의 자세한 설명과 막혔을 때 해결법이에요.

> **Windows PowerShell이라면** `npm` 대신 `npm.cmd`를 쓰세요 (예: `npm.cmd install`, `npm.cmd run dev`). 이유는 [문제 해결](#7-문제-해결)에 있어요.

---

## 1. 준비물 설치 (처음 한 번)

| 프로그램 | 필요한 이유 | 권장 버전 |
|---|---|---|
| **Git** | GitHub에서 코드 받기 | 최신 |
| **Node.js** | 서버 실행, 화면 빌드 (npm 포함) | **22 LTS** (22.15에서 확인) |
| 브라우저 | 게임 화면 (3D) | Chrome, Edge, Safari, Firefox 최신 |
| cloudflared | 친구들이 밖에서 접속하게 할 때만 | 최신 (선택) |

### Windows
PowerShell을 열고 하나씩 실행해요.

```bash
winget install --id Git.Git -e
```

```bash
winget install --id OpenJS.NodeJS.LTS -e
```

```bash
winget install --id Cloudflare.cloudflared -e
```

설치한 뒤에는 **PowerShell 창을 닫았다가 새로 열어야** 방금 설치한 명령을 찾을 수 있어요.

### macOS
[Homebrew](https://brew.sh)가 있다면 터미널에서 실행해요.

```bash
brew install git node cloudflared
```

Homebrew가 없으면 Node.js는 [nodejs.org](https://nodejs.org)에서 LTS 설치 파일을 받아도 돼요. Git은 터미널에서 `git`을 처음 입력하면 설치하라는 창이 떠요.

### 설치 확인
세 명령 모두 버전 숫자가 나오면 준비 완료예요. `node -v`가 `v22`로 시작하는지 확인하세요.

```bash
node -v
```

```bash
npm -v
```

```bash
git --version
```

---

## 2. 코드 받기

코드를 둘 폴더로 이동한 뒤 받아요. `Avalon` 폴더가 새로 생겨요.

```bash
git clone https://github.com/jeonghun43/Avalon.git
```

```bash
cd Avalon
```

저장소에 들어 있는 것과 없는 것:

| 들어 있음 | 없음 (자동으로 만들어짐) |
|---|---|
| 모든 코드 (`shared/`, `server/`, `client/`, `tools/`) | `node_modules/` (3단계에서 설치) |
| 3D 캐릭터 모델 (`client/public/models/`, 원본은 `assets-src/`) | `client/dist/` (5단계 빌드에서 생성) |
| 문서 (`specs/`, `docs/`) | |

**비밀 키나 `.env` 파일은 필요 없어요.** 받자마자 그대로 실행돼요.

---

## 3. 의존성 설치

받은 폴더(`Avalon`) 안에서 실행해요. `shared`, `server`, `client` 세 패키지를 한 번에 설치해요(npm workspaces). 약 320개 패키지를 30초 정도 받아요.

```bash
npm install
```

- 경고(`npm warn deprecated …`)는 무시해도 돼요.
- 학교 와이파이처럼 연결이 불안정하면 `ECONNRESET` 오류가 날 수 있어요. 그냥 다시 실행하거나, 재시도 횟수를 늘려서 실행하세요.

```bash
npm ci --fetch-retries=5
```

---

## 4. 개발 모드로 실행 (코드를 고치면서 볼 때)

```bash
npm run dev
```

서버(:3000)와 화면 개발 서버(:5180)가 함께 켜져요. 터미널에 두 줄이 섞여서 나오는 게 정상이에요.

| 주소 | 내용 |
|---|---|
| http://localhost:5180 | 게임 화면 |
| http://localhost:5180/preview.html | 캐릭터 9종 미리보기 |

- 코드를 저장하면 화면은 바로 바뀌고, 서버는 자동으로 다시 켜져요.
- 끌 때는 터미널에서 `Ctrl + C`를 눌러요.

### 혼자 테스트하기 (봇)
방을 만든 뒤, **다른 터미널**을 열어 같은 폴더에서 실행해요. `ABCD` 자리에는 화면에 뜬 방 코드를 넣으세요. 봇 6명이 들어와서 알아서 플레이해요.

```bash
node tools/bots.mjs ABCD 6
```

---

## 5. 친구들과 플레이 (배포 모드)

### ① 화면 빌드 → 서버 켜기
화면 코드를 고친 뒤에는 꼭 빌드를 다시 해야 바뀐 내용이 반영돼요.

```bash
npm run build
```

```bash
npm start
```

이제 서버 하나(:3000)가 화면과 게임을 모두 담당해요. 이 노트북에서는 http://localhost:3000 으로 열 수 있어요.

### ② 외부 주소 만들기
**다른 터미널**을 열고 실행해요. 출력에 나오는 `https://….trycloudflare.com` 주소를 친구들에게 보내면 돼요.

```bash
cloudflared tunnel --url http://localhost:3000
```

- 실행할 때마다 주소가 바뀌어요.
- 두 터미널(서버, 터널) 중 하나라도 닫으면 친구들의 접속이 끊겨요. 서버를 끄면 진행 중인 게임도 사라져요.
- 노트북은 전원을 연결하고 절전 모드를 꺼 두세요.
- 터널이 안 열리거나 친구가 접속을 못 하면, 네트워크가 터널 주소를 막고 있을 수 있어요. 휴대폰 핫스팟으로 바꿔서 다시 시도하세요(README의 "터널이 안 열릴 때" 참고).

---

## 6. 테스트

규칙 엔진 테스트와 서버 통합 테스트(봇 5명이 진짜 서버에서 한 판 + 채팅)를 돌려요. 1분 정도 걸려요.

```bash
npm test
```

타입 검사:

```bash
npm run typecheck
```

---

## 7. 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| Windows에서 `npm : 이 시스템에서 스크립트를 실행할 수 없으므로…` | PowerShell 실행 정책이 `npm.ps1` 스크립트를 막음 | `npm` 대신 **`npm.cmd`** 를 쓰세요 (`npm.cmd install`, `npm.cmd run dev`). 보안 설정을 바꿀 필요가 없어요 |
| `npm install` 중 `ECONNRESET`, `network aborted` | 네트워크가 잠깐 끊김 | 다시 실행하거나 `npm ci --fetch-retries=5` |
| `Port 5180 is in use` 또는 서버가 3000에서 안 켜짐 | 이미 다른 프로그램(또는 이전에 켠 서버)이 그 포트를 사용 중 | 아래 "포트 비우기" 참고 |
| 화면은 뜨는데 "서버에 연결하는 중이에요…"에서 멈춤 | 게임 서버가 안 켜져 있음 | 개발 모드면 `npm run dev`가 서버도 같이 켰는지 터미널 확인. 배포 모드면 `npm start` 실행 |
| 화면이 갑자기 멈추고 콘솔에 `Invalid hook call` | 개발 서버가 라이브러리를 다시 묶으면서 꼬임 | `Ctrl + C`로 끄고 `client/node_modules/.vite` 폴더를 지운 뒤 `npm run dev` |
| 방에 들어갔는데 화면이 까맣고 원탁이 안 보임 | 브라우저의 3D 그래픽(WebGL)이 꺼져 있음 | 다른 브라우저로 열기. Chrome은 설정 → 시스템 → "가능한 경우 그래픽 가속 사용" 켜기 |
| `cloudflared` 명령을 찾을 수 없음 | 설치 직후 열려 있던 터미널은 새 명령을 모름 | 터미널을 새로 열기. Windows는 `& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://localhost:3000` 처럼 전체 경로로 실행해도 됨 |
| 친구 화면에 `ERR_SSL_PROTOCOL_ERROR` | 친구의 네트워크(학교 와이파이 등)가 터널 주소를 막음 | 친구가 휴대폰 핫스팟으로 접속 |

### 포트 비우기
어떤 프로그램이 포트를 쓰고 있는지 찾아서 꺼요. `3000` 자리에는 막힌 포트 번호를 넣으세요.

Windows (PowerShell): 마지막 열의 숫자가 프로그램 번호(PID)예요.
```bash
netstat -ano | findstr :3000
```
```bash
taskkill /PID 1234 /F
```

macOS (터미널):
```bash
lsof -i :3000
```
```bash
kill 1234
```

`1234` 자리에는 위에서 찾은 번호를 넣으세요. 혹시 친구들과 게임 중인 서버라면 끄기 전에 확인하세요.

---

## 8. 최신 코드로 업데이트

다른 컴퓨터에서 고쳐서 GitHub에 올린 코드를 받아올 때예요.

```bash
git pull
```

```bash
npm install
```

`npm install`은 라이브러리 목록(`package-lock.json`)이 바뀌었을 때만 필요하지만, 매번 해도 문제없어요. 서버가 켜져 있었다면 끄고 다시 켜세요. 배포 모드라면 `npm run build`도 다시 해야 해요.

---

## 더 읽을거리
- [README](../README.md): 전체 소개, 터널이 안 열릴 때
- [코드 공부 가이드](STUDY.md): 코드 구조를 위에서부터 이해하기
- [spec](../specs/avalon/spec.md) · [plan](../specs/avalon/plan.md) · [tasks](../specs/avalon/tasks.md): 기획 문서
