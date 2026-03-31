//기본 출력 테스트
console.log("테스트 유닛 가동");


console.log("--------------------------------");
console.log(`현재 노드 버전: ${process.version}`);
console.log(`운영체제 플랫폼: ${process.platform}`);
console.log(`현재 실행 경로: ${process.cwd()}`);
console.log("--------------------------------");


console.log("3초 뒤에 종료합니다...");
setTimeout(() => {
  console.log("✅ 테스트 종료");
  process.exit(0); // 정상 종료
}, 3000);