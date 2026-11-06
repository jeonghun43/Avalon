// 입장 시 무작위로 배정되는 KayKit 캐릭터 풀 (CC0, Kay Lousberg)
export const CHARACTERS = [
  { id: 'knight', file: 'knight.glb', label: 'Knight' },
  { id: 'barbarian', file: 'barbarian.glb', label: 'Barbarian' },
  { id: 'mage', file: 'mage.glb', label: 'Mage' },
  { id: 'rogue', file: 'rogue.glb', label: 'Rogue' },
  { id: 'rogue_hooded', file: 'rogue_hooded.glb', label: 'Rogue Hooded' },
  { id: 'skeleton_warrior', file: 'skeleton_warrior.glb', label: 'Skeleton Warrior' },
  { id: 'skeleton_mage', file: 'skeleton_mage.glb', label: 'Skeleton Mage' },
  { id: 'skeleton_rogue', file: 'skeleton_rogue.glb', label: 'Skeleton Rogue' },
  { id: 'skeleton_minion', file: 'skeleton_minion.glb', label: 'Skeleton Minion' },
] as const;

export type CharacterId = (typeof CHARACTERS)[number]['id'];

// 자리별 고유 색 (닉네임 표, 의자 방석)
export const SEAT_COLORS = [
  '#F2B53A', '#E8684A', '#A77BE0', '#4FA3D9', '#6CC08B',
  '#E58FB8', '#8FD3C9', '#D9C25A', '#9AA9F0', '#C98C5A',
] as const;
