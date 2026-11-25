// ~/instagram-api/services/uploadService.js
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';

// uploads 폴더에서 파일을 지운다. 파일 하나를 못 지워도 멈추지 않고, 에러를 터미널에 찍고 다음 파일로 간다.
export async function removeFiles(fileNames) {
  for (const fileName of fileNames) {
    try {
      await rm(path.join('uploads', fileName), { force: true });
    } catch (error) {
      console.error(error);
    }
  }
}

// 올린 사진마다 누가 올렸는지 적는다 — 아직 어느 게시물에도 쓰지 않은 사진이라 게시물은 비워 둔다.
export async function recordUploads(uploaderId, fileNames) {
  try {
    await prisma.upload.createMany({
      data: fileNames.map((fileName) => ({ fileName, uploaderId })),
    });
  } catch (error) {
    // 파일은 이미 저장됐다. 기록 없이 남은 파일은 나중에 찾을 길이 없으니, 지우고 나서 실패를 그대로 넘긴다.
    await removeFiles(fileNames);
    throw error;
  }
}

// 올린 지 이만큼이 지나도록 아무 데도 쓰지 않은 사진은 치운다 - 사진을 올리고 글을 쓰기에 넉넉한 시간이다.
const UNUSED_UPLOAD_LIFETIME = 60 * 60 * 1000; // 1시간(밀리초)

// 올린 지 오래됐는데 아직 게시물에도 프로필에도 쓰지 않은 사진의 기록과 파일을 지운다. 지운 파일 이름 목록을 돌려준다.
export async function removeUnusedUploads() {
  const unused = await prisma.upload.findMany({
    where: { postId: null, profileUserId: null, createdAt: { lt: new Date(Date.now() - UNUSED_UPLOAD_LIFETIME) } },
    select: { id: true, fileName: true },
  });

  const removed = [];
  for (const upload of unused) {
    // 고른 뒤에 그 사진을 게시물이나 프로필에 썼을 수도 있다 - 지금도 아무 데도 쓰지 않았을 때만 기록을 지운다.
    const { count } = await prisma.upload.deleteMany({ where: { id: upload.id, postId: null, profileUserId: null } });
    if (count === 1) {
      await removeFiles([upload.fileName]);
      removed.push(upload.fileName);
    }
  }

  return removed;
}
