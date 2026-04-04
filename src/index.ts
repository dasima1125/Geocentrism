import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { Module_Tester } from "./modules/M_BootTest.js";
import { Module_Weather } from "./modules/M_Weather_Korea.js";

const ALL_TOOLS: any = {
  ...Module_Tester,
  ...Module_Weather
};


const server = new Server(
  { name: "geocentrism-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 도구 목록 요청 핸들러 
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(ALL_TOOLS).map(([name, tool]: [string, any]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
}));

// 도구 실행 요청 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  
  const tool = ALL_TOOLS[name];
  if (!tool) throw new Error(`그런게있을리가.. ${name}은(는) 없는 명령이야`);

  // 핸들러 실행 (인자가 필요한 경우를 대비해 request.params.arguments 전달 가능)
  return tool.handler(request.params.arguments);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Geocentrism MCP 허브 Online...");

  process.stdin.on("data", (data) => {
    const input = data.toString().trim().toLowerCase();
    if (["exit"].includes(input)) {
      console.error("👋 잘가!");
      process.exit(0);
    }
    if (["help"].includes(input)) {
      console.error(" 준비중이야!");
    }
    if (["egg"].includes(input)) {
      console.error(" !?!?!?!?!?!?!?!?!!?!?!?!?!?!?!?!?");
    }
  });
}

main().catch((error) => {
  console.error("💥 서버 치명적 에러:", error);
  process.exit(1);
});