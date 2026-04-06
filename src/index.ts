import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { Module_Tester } from "./modules/M_BootTest.js";
import { Module_Weather } from "./modules/M_Weather_Korea.js";

const ALL_TOOLS: any = {
  ...Module_Tester,
  ...Module_Weather
};
// 특히 말썽이었던 놈은 꼭 포함
const ESSENTIAL_TOOLS = [
  "System_Version",
  "System_Hello",
  "System_Help",

  "Weather_forecast_now",
  "Weather_forecast_short",
  "Weather_forecast_long",
  "Weather_coords",
  "Weather_version"
   
];


const server = new Server(
  { name: "geocentrism-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 도구 목록 요청 핸들러 
/*
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(ALL_TOOLS).map(([name, tool]: [string, any]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
}));
    개선안. 인식문제 정확히 확인후엔 이걸 사용할예정
      ㄴ 필수 필드가 없는 경우를 대비한 기본값 처리 (중요)
         properties가 없으면 빈 객체라도 명시 (클로드 인식률 상승)
         required가 없으면 빈 배열이라도 명시 (클로드 인식률 상승)
         
*/ 
server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    const toolList = Object.entries(ALL_TOOLS).map(([name, tool]: [string, any]) => {
      return {
        name: name,
        description: tool.description || "이 도구에 대한 설명이 없습니다.",
        inputSchema: {
          type: "object",
          properties: tool.inputSchema?.properties || {},
          required: tool.inputSchema?.required || []
        },
      };
    });
    return { tools: toolList };
  } catch (error) {
    console.error("툴 목록 생성 중 에러:", error);
    return { tools: [] };
  }
});
// 도구 실행 요청 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const tool = ALL_TOOLS[name];
  if (!tool) throw new Error(`그런게있을리가.. ${name}은(는) 없는 명령이야`);
  return tool.handler(request.params.arguments);
});

async function main() {

  /**
   * [출고 검수 버퍼]
   *   모듈 로딩(Async)과 클라이언트 연결(Connect) 사이의 찰나의 지연을 해결.
   *   ESSENTIAL_TOOLS에 명시된 모든 도구가 ALL_TOOLS에 등록될 때까지 최대 1초간 대기.
   *   시퀸스 제어로 모든 도구가 메모리에 적재된 '완성 상태'에서만 클로드와 통신을 시작함.
   */
  console.error("🔍 모듈 로딩 체크 중...");
  for (let i = 0; i < 10; i++) {
    const loadedKeys = Object.keys(ALL_TOOLS);
    const isReady = ESSENTIAL_TOOLS.every(key => loadedKeys.includes(key));

    if (isReady) {
      console.error(`✅ 검수 완료: 총 ${loadedKeys.length}개 도구 로드됨.`);
      break;
    }
    console.error(`⏳ 도구 로딩 대기 중... (${i+1}/10)`);
    await new Promise(res => setTimeout(res, 100));
  }
  
  
  console.error("📦 등록된 툴 목록:", Object.keys(ALL_TOOLS));
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Geocentrism MCP 허브 Online...");
}

main().catch((error) => {
  console.error("💥 서버 치명적 에러:", error);
  process.exit(1);
});

