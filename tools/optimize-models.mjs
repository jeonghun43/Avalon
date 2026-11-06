// KayKit 원본 glb에서 무기 메시와 안 쓰는 애니메이션을 지우고 client/public/models로 내보낸다.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = 'assets-src/kaykit';
const OUT = 'client/public/models';
const KEEP_ANIMS = new Set(['Idle', 'Cheer', 'Sit_Chair_Idle', 'Sit_Chair_Pose']);
const KEEP_MESH = /_(Hat|Helmet|Cape|Cloak|Hood|ArmLeft|ArmRight|Body|Head|Head_Hooded|LegLeft|LegRight|Eyes|Jaw|Skull)$/;

mkdirSync(OUT, { recursive: true });
const io = new NodeIO();
for (const pack of ['adventurers', 'skeletons']) {
  for (const file of readdirSync(join(SRC, pack)).filter((f) => f.endsWith('.glb'))) {
    const doc = await io.read(join(SRC, pack, file));
    const root = doc.getRoot();
    for (const anim of root.listAnimations()) {
      if (KEEP_ANIMS.has(anim.getName())) continue;
      anim.listChannels().forEach((c) => c.dispose());
      anim.listSamplers().forEach((s) => s.dispose()); // 시간 축 데이터는 공유될 수 있으니 prune에 맡김
      anim.dispose();
    }
    for (const node of root.listNodes()) if (node.getMesh() && !KEEP_MESH.test(node.getName())) node.dispose();
    await doc.transform(prune(), dedup());
    const out = join(OUT, basename(file).toLowerCase());
    await io.write(out, doc);
    const anims = root.listAnimations().map((a) => a.getName()).join(',');
    console.log(`${file} -> ${(statSync(out).size / 1024).toFixed(0)}KB  [${anims}]`);
  }
}
