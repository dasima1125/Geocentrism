import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport as StandardIO_S } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main() { // await를 쓰기 위해 async 함수로 감쌉니다.
    console.log("------------------------------------------");
    console.log("🚀 Geocentrism MCP 부트 테스트 시퀸스 시작 ");
    console.log("------------------------------------------");

    try {
        const transport = new StandardIO_S();
        
        const server = new Server(
            { name: "geocentrism-boot", version: "1.0.0" },
            { capabilities: {} }
        );

        // 핵심: 서버를 실행(Connect)시킵니다. 
        // 이 줄이 있어야 프로그램이 종료되지 않고 서버가 '가동'됩니다.
        await server.connect(transport); 

        console.log("✅ [규약 체크] StandardIO_S 통로 확보 완료");
        console.log("✅ [엔진 체크] MCP Server 객체 생성 완료");
        console.log("------------------------------------------");
        console.log("✅ Geocentrism MCP 서버 가동 준비 완료!");

    } 
    catch (error) { 
        console.error("❌ 부트 시퀸스 중단됨:", error); 
    }
}

main(); // 실행!