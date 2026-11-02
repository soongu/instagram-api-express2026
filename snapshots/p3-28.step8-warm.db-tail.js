
// 서버가 뜰 때 DB 에 쿼리를 하나 보내 둔다 — 첫 요청이 연결을 기다리지 않게.
const start = performance.now();
await prisma.$queryRaw`SELECT 1`;
console.log(`준비 ${(performance.now() - start).toFixed(1)}ms`);
