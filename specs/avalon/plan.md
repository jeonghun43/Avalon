# Plan — 웹 아발론 구현 계획

> 상태: Draft v1 · 작성일 2026-10-27 · 근거: [spec.md](spec.md)

## 1. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript (전 영역) | 서버와 클라이언트가 타입과 규칙 엔진을 공유한다 |
| 저장소 | npm workspaces 모노레포 | `shared`, `server`, `client` 세 패키지 |
| 서버 | Node 22 + Express(정적 파일) + Socket.io 4 | 실시간 양방향 통신, 자동 재연결, 방 단위 브로드캐스트 |
| 클라이언트 | Vite + React 18 | 빠른 개발 서버, UI 오버레이 |
| 3D | three.js + @react-three/fiber + @react-three/drei | 선언형 씬 구성, glTF 로딩, 애니메이션 도우미 |
| 클라이언트 상태 | zustand | 서버 상태 스냅샷과 로컬 UI 상태를 가볍게 관리 |
| 테스트 | vitest | 규칙 엔진 단위 테스트, 서버 통합 테스트 |
| 에셋 | KayKit Adventurers + 다른 무료 KayKit 캐릭터 팩(예: Skeletons) + Dungeon Remastered (모두 CC0, glTF) | gltf-transform으로 압축 (meshopt + 텍스처 리사이즈) |
| 배포 | 노트북에서 `node` 실행 + `cloudflared` 터널 | 0원, HTTPS 자동, 포트포워딩 불필요 |

## 2. 아키텍처

```
 브라우저 (플레이어 N명)                        게이밍 노트북
┌─────────────────────────┐            ┌──────────────────────────────────┐
│ React UI 오버레이        │            │ Express: client/dist 정적 서빙    │
│ R3F 3D 씬 (테이블/캐릭터)│  WebSocket │ Socket.io                         │
│ zustand store ◀─────────┼────────────┼─ RoomManager (Map<code, Room>)    │
│   PlayerView 스냅샷      │  (터널 경유) │    └ Room                         │
│   gaze 맵 (휘발성)       │            │        ├ GameState (전체, 비공개)  │
└─────────────────────────┘            │        ├ engine.apply(action)     │
                                       │        └ engine.project(playerId) │
                                       └──────────────────────────────────┘
          cloudflared tunnel ── https://xxxx.trycloudflare.com ──▶ localhost:3000
```

### 핵심 원칙
1. **서버가 판정한다.** 클라이언트는 `action`만 보내고, 서버가 검증·적용한 뒤 결과를 돌려준다.
2. **사람마다 다른 화면(projection).** 서버는 액션이 적용될 때마다 플레이어별로 `project(state, playerId)`를 계산해 각자 소켓에 보낸다. 역할, 원정 카드를 낸 사람, 공개 전 투표값은 여기서 걸러진다.
3. **규칙 엔진은 순수 함수다.** `shared/engine`은 I/O 없이 `(state, action, rng) → state | error`이므로 테스트하기 쉽고, 나중에 Cloudflare Durable Objects로 옮길 때도 그대로 쓸 수 있다.
4. **시선은 별도 채널.** 시선 데이터는 게임 상태에 넣지 않고, `volatile` 이벤트로 중계만 한다.

## 3. 데이터 모델 (shared/types.ts 초안)

```ts
type Phase =
  | 'LOBBY' | 'ROLE_REVEAL' | 'TEAM_BUILDING' | 'TEAM_VOTE' | 'VOTE_REVEAL'
  | 'QUEST' | 'QUEST_REVEAL' | 'LADY_OF_THE_LAKE' | 'ASSASSINATION' | 'GAME_OVER';

type Role = 'MERLIN' | 'PERCIVAL' | 'LOYAL_SERVANT'
          | 'ASSASSIN' | 'MORGANA' | 'MORDRED' | 'MINION';
type Team = 'GOOD' | 'EVIL';

interface Player {
  id: string;            // 서버가 발급, 세션 토큰과 연결
  nickname: string;
  seat: number;          // 0..n-1, 시계 방향
  model: CharacterModel; // 'knight' | 'barbarian' | 'mage' | 'rogue' | 'rogue_hooded' ...
  color: string;         // 자리별 고유 색
  connected: boolean;
  isHost: boolean;
}

interface RoomOptions { percivalMorgana: boolean; mordred: boolean; ladyOfTheLake: boolean; }

interface RoundRecord {
  round: number; attempt: number;          // attempt = 같은 라운드 안에서 몇 번째 구성인지
  leaderId: string; team: string[];
  votes: Record<string, boolean>;          // 공개 후에만 채워짐
  approved: boolean;
  quest?: { successes: number; fails: number; result: 'SUCCESS' | 'FAIL' };
}

interface GameState {                      // 서버 전용, 전체 정보
  phase: Phase;
  players: Player[];
  options: RoomOptions;
  roles: Record<string, Role>;
  leaderSeat: number;
  round: number;                           // 1..5
  rejectCount: number;                     // 0..5
  proposedTeam: string[];
  pendingVotes: Record<string, boolean>;   // 비공개
  pendingQuestCards: Record<string, boolean>; // 비공개
  questResults: ('SUCCESS' | 'FAIL')[];
  lady?: { holderId: string; usedBy: string[] };
  history: RoundRecord[];
  winner?: { team: Team; reason: 'QUESTS' | 'REJECTS' | 'ASSASSIN_HIT' | 'ASSASSIN_MISS' };
}

interface PlayerView {                     // 각 플레이어가 받는 것
  me: { id: string; role?: Role; team?: Team; knowledge: Knowledge[] };
  phase: Phase; players: Player[]; options: RoomOptions;
  leaderSeat: number; round: number; rejectCount: number;
  proposedTeam: string[];
  votedIds: string[];                      // 누가 냈는지만
  revealedVotes?: Record<string, boolean>; // VOTE_REVEAL 이후
  questCardCount: number;                  // 낸 장수만
  questReveal?: boolean[];                 // 섞인 결과
  questResults: ('SUCCESS' | 'FAIL')[];
  lady?: { holderId: string; usedBy: string[] };
  history: RoundRecord[];
  revealedRoles?: Record<string, Role>;    // 암살 단계(악 진영) 또는 GAME_OVER(전원)
  winner?: GameState['winner'];
}

type Knowledge =
  | { kind: 'EVIL_SEEN_BY_MERLIN'; ids: string[] }
  | { kind: 'MERLIN_CANDIDATES'; ids: string[] }
  | { kind: 'FELLOW_EVIL'; ids: string[] }
  | { kind: 'LADY_RESULT'; targetId: string; team: Team };
```

## 4. 통신 프로토콜 (Socket.io 이벤트)

### 클라이언트 → 서버
| 이벤트 | 내용 | 응답(ack) |
|---|---|---|
| `room:create` | `{ nickname }` | `{ code, sessionToken }` |
| `room:join` | `{ code, nickname }` | `{ sessionToken }` 또는 오류 |
| `room:resume` | `{ code, sessionToken }` | 성공 여부 |
| `room:options` | `RoomOptions` (방장만) | — |
| `room:kick` | `{ playerId }` (방장, 로비에서만) | — |
| `game:action` | `GameAction` (아래) | `{ ok } \| { error }` |
| `gaze` | `{ yaw, pitch }` volatile, 최대 10Hz | — |

```ts
type GameAction =
  | { type: 'START' }                         // 방장
  | { type: 'ACK_ROLE' }
  | { type: 'TOGGLE_TEAM_MEMBER'; playerId: string } // 원정대장
  | { type: 'CONFIRM_TEAM' }                  // 원정대장
  | { type: 'VOTE'; approve: boolean }
  | { type: 'QUEST_CARD'; success: boolean }  // 원정대원
  | { type: 'LADY_TARGET'; playerId: string } // 호수의 여인 소유자
  | { type: 'ASSASSINATE'; playerId: string } // 암살자
  | { type: 'REMATCH' };                      // 방장
```

### 서버 → 클라이언트
| 이벤트 | 내용 |
|---|---|
| `state` | `PlayerView` 전체 스냅샷 (매 변경마다, 크기 수 KB) |
| `gaze` | `{ playerId, yaw, pitch }` volatile |
| `event` | 연출용 일회성 이벤트 (`VOTES_FLIPPED`, `QUEST_CARD_FLIPPED` 등) |

- 스냅샷 방식을 쓰는 이유: 상태가 작아서 diff를 계산할 필요가 없고, 재접속하면 받은 스냅샷 하나로 곧바로 복구된다.
- 타이밍 연출(카드 뒤집기 3초 등)은 서버가 `VOTE_REVEAL`·`QUEST_REVEAL` 페이즈에 머무는 시간으로 관리한다. 클라이언트는 페이즈를 보고 애니메이션만 재생한다.

## 5. 3D 씬 설계

- **좌표계**: 테이블 중심이 원점이고 반지름은 R. 자리 i의 각도는 `θ_i = 2π·(i − mySeat)/n − π/2`로 둔다. 그러면 **내 자리가 항상 카메라 쪽(아래)**에 온다.
- **카메라**: 내 의자 위치의 눈높이에서 테이블 중심을 기본으로 바라본다. 드래그하면 yaw와 pitch가 바뀐다 (OrbitControls 대신 직접 구현한 회전, 위치는 고정).
- **캐릭터**: KayKit glTF를 앉은 자세로 놓는다. 시선이 오면 머리 뼈(Head bone)의 yaw/pitch를 바꾸고, 회전은 slerp로 부드럽게 보간한다. 대기 동작은 KayKit Idle 애니메이션을 쓴다.
- **시선 판정 (눈 아이콘)**: 상대의 yaw가 나를 향하는 각도와 ±12° 이내면 "나를 보는 중"으로 본다.
- **테이블 위 오브젝트**: 라운드 보드(5칸), 거부 트랙(5칸), 원정대장 왕관, 원정대 토큰, 투표 카드, 원정 카드, 호수의 여인 토큰. 위치는 각 자리 앞 `R × 0.7` 지점과 테이블 중앙을 쓴다.
- **클릭**: R3F 포인터 이벤트로 캐릭터 메시와 닉네임 표를 클릭 대상으로 만든다. 드래그 중에는 클릭을 무시한다 (이동량 5px 기준).
- **조명과 재질**: 횃불 포인트 라이트 2~3개와 약한 환경광을 쓴다. 그림자는 테이블 하나에만 둔다. 재질은 KayKit 텍스처 아틀라스를 그대로 쓴다.
- **2D 오버레이**: 상태 바, 역할 패널, 손패, 기록, 토스트. 디자인 규칙(그라디언트·순백 배경·글로우·중첩 카드 금지)을 지킨다.

## 6. 디렉터리 구조

```
avalon/
├─ package.json            # workspaces: shared, server, client
├─ shared/
│  └─ src/
│     ├─ types.ts
│     ├─ constants.ts      # 인원별 진영·원정 인원표
│     ├─ engine/
│     │  ├─ setup.ts       # 역할 배정
│     │  ├─ apply.ts       # 액션 적용 (페이즈별)
│     │  ├─ project.ts     # PlayerView 생성
│     │  └─ knowledge.ts   # 역할별 아는 정보
│     └─ engine.test.ts
├─ server/
│  └─ src/
│     ├─ index.ts          # Express + Socket.io 부트스트랩
│     ├─ RoomManager.ts
│     ├─ Room.ts           # 상태 보관, 타이머, 브로드캐스트
│     └─ session.ts
├─ client/
│  ├─ public/models/       # 압축된 KayKit glb
│  └─ src/
│     ├─ main.tsx
│     ├─ net/socket.ts
│     ├─ store.ts
│     ├─ screens/Entry.tsx
│     ├─ scene/            # Table.tsx, Seat.tsx, Character.tsx, Tokens.tsx, CameraRig.tsx
│     └─ ui/               # StatusBar, RolePanel, RoleRevealCard, Hand, History, Toast
└─ specs/ → ../specs/avalon (문서)
```

> 코드는 저장소 루트(`avalon/`)에 만들고, 문서는 `specs/avalon/`에 둔다.

## 7. 실행과 배포

```bash
npm install
npm run dev          # server(tsx watch :3000) + client(vite :5173, /socket.io 프록시)
npm test             # vitest
npm run build && npm start   # client 빌드 후 server가 :3000에서 함께 서빙
cloudflared tunnel --url http://localhost:3000   # 외부 접속 URL 발급
```

- 빠른 터널(quick tunnel)은 실행할 때마다 URL이 바뀐다. 고정 주소가 필요하면 Cloudflare 계정에 무료 도메인 터널을 설정한다 (선택).
- 노트북은 절전 모드를 끄고 전원을 연결해 둔다.

## 8. 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| KayKit 무료팩 모델이 10종보다 적음 | 캐릭터 중복 | 다른 무료 KayKit 캐릭터 팩을 섞어 풀을 넓힘. 팩마다 리그(뼈대)가 다르면 머리 뼈 이름을 모델별로 매핑. 그래도 겹치면 고유 색으로 구분 |
| 저사양 기기 성능 | 프레임 저하 | 그림자 1개, DPR 상한 1.5, 모델 압축, 화면 밖 애니메이션 정지 |
| 노트북 절전·재부팅 | 진행 중 게임 소실 | v1은 범위 밖. 시작 전 체크리스트로 안내. 나중에 상태를 JSON으로 스냅샷 저장 |
| 동시 클릭 경쟁 | 상태 꼬임 | 서버의 방 단위 순차 처리 (Node 단일 스레드 + 액션 검증) |
| 정보 누출 | 게임 붕괴 | `project()` 단위 테스트로 역할별 노출 범위 검증 |
| 터널 URL 변경 | 매번 공유 필요 | 서버 시작 시 콘솔에 URL 출력. 고정 도메인은 선택 |

## 9. 마일스톤

| M | 내용 | 완료 기준 |
|---|---|---|
| M0 | 디자인 시안·플로우 확정 | 사용자 승인 |
| M1 | 규칙 엔진 (shared) | 모든 페이즈 단위 테스트 통과, 5~10인 시뮬레이션 완주 |
| M2 | 서버·방·재접속 | 여러 탭에서 방을 만들고 입장, 새로고침 후 복귀 |
| M3 | 3D 테이블·캐릭터·시선 | 인원에 따라 좌석 배치, 다른 탭의 고개가 돌아감 |
| M4 | 게임 UI 전체 흐름 | 5명(탭 5개)으로 한 판 완주 |
| M5 | 연출·마감 | 카드 뒤집기 애니메이션, 사운드(선택), 기록 패널 |
| M6 | 배포 리허설 | 터널로 외부 친구와 실제 플레이 |
