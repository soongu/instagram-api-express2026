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
  await prisma.upload.createMany({
    data: fileNames.map((fileName) => ({ fileName, uploaderId })),
  });
}
