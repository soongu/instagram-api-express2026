// ~/instagram-api/lab/p3-50/practice3.js
import { prisma } from '../../db.js';

// 사진 기록 하나에 게시물을 적는다 — 내가 올렸고, 아직 아무 게시물에도 쓰지 않았을 때만.
// 적었으면 true, 못 적었으면 false 를 돌려준다.
export async function attachUpload(fileName, userId, postId) {
  const { count } = await prisma.upload.updateMany({
    // 지금은 파일 이름만 본다 — 조건 두 가지를 더 채운다.
    where: { fileName },
    data: { postId },
  });

  return count === 1;
}
