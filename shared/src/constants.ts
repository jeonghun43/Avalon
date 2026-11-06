import type { Role, Team } from './types';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

/** 인원별 [선, 악] */
export const TEAM_COUNTS: Record<number, [number, number]> = {
  5: [3, 2], 6: [4, 2], 7: [4, 3], 8: [5, 3], 9: [6, 3], 10: [6, 4],
};

/** 인원별 라운드 원정대 인원 */
export const QUEST_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

/** 7인 이상에서 4라운드(인덱스 3)는 실패 2장이 필요 */
export const doubleFailRound = (n: number) => (n >= 7 ? 3 : null);
export const failsNeeded = (n: number, round: number) => (doubleFailRound(n) === round ? 2 : 1);

export const ROLE_TEAM: Record<Role, Team> = {
  MERLIN: 'GOOD', PERCIVAL: 'GOOD', LOYAL_SERVANT: 'GOOD',
  ASSASSIN: 'EVIL', MORGANA: 'EVIL', MORDRED: 'EVIL', MINION: 'EVIL',
};

export const ROLE_NAME: Record<Role, string> = {
  MERLIN: '멀린', PERCIVAL: '퍼시발', LOYAL_SERVANT: '기사',
  ASSASSIN: '암살자', MORGANA: '모르가나', MORDRED: '모드레드', MINION: '모드레드의 하수인',
};

export const ROLE_GUIDE: Record<Role, string[]> = {
  MERLIN: [
    '악의 세력이 누구인지 알고 있어요. (모드레드는 보이지 않아요)',
    '투표와 발언으로 선의 원정대를 은근히 도와주세요.',
    '너무 티가 나면 마지막에 암살자에게 지목당해요.',
  ],
  PERCIVAL: [
    '멀린 후보 두 명을 알고 있어요. 한 명은 진짜 멀린, 한 명은 모르가나예요.',
    '누가 진짜 멀린인지 알아내서 지켜 주세요.',
    '멀린 대신 의심을 받아 암살자를 헷갈리게 할 수도 있어요.',
  ],
  LOYAL_SERVANT: [
    '특별한 정보는 없어요. 대화와 투표 기록으로 악의 세력을 찾아내세요.',
    '원정에서는 성공 카드만 낼 수 있어요.',
  ],
  ASSASSIN: [
    '다른 악의 세력이 누구인지 알고 있어요.',
    '원정에서 실패 카드를 몰래 내서 원정을 망치세요.',
    '선이 3번 이기면, 멀린을 찾아 지목해 역전할 수 있어요.',
  ],
  MORGANA: [
    '다른 악의 세력이 누구인지 알고 있어요.',
    '퍼시발에게는 당신이 멀린처럼 보여요. 멀린인 척 퍼시발을 속이세요.',
  ],
  MORDRED: [
    '다른 악의 세력이 누구인지 알고 있어요.',
    '멀린에게도 정체가 보이지 않아요. 선의 세력인 척 원정대에 들어가세요.',
  ],
  MINION: [
    '다른 악의 세력이 누구인지 알고 있어요.',
    '원정에서 실패 카드를 몰래 내서 원정을 망치세요.',
  ],
};

export const TIMINGS = {
  roleRevealMs: 20_000,
  voteRevealMs: 4_000,
  questRevealFirstMs: 1_200,   // 카드가 모두 놓인 뒤 첫 장을 뒤집기까지
  questRevealPerCardMs: 1_100,
  questRevealTailMs: 2_800,    // 마지막 장 뒤 결과를 보여주는 시간
};
