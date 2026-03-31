import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";


//[1] 도구 정의 데이터 (메뉴판)
const TOOLS = {
    /*
    --- 예시 ---
    버전: {
            description: "",                                                                  <=====주석 (ai가 읽는곳임 사람은 읽을일없음)
            inputSchema: { type: "object", properties: {} },                                  <=====페이로드 설정
            handler: async () =>                                                              <=====로직 주입
            ({ content: [{ type: "text", text: "🚀 Geocentrism 서버: 반가워요 (v1.0.0)" }] })  <=====리턴
        },
    */
    
  버전: {
    description: "서버의 상태와 정체성을 확인합니다.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({
      content: [{ type: "text", text: "🚀 Geocentrism 서버: 반가워요 (v1.0.0)" }]
    })
  },
  안녕: {
    description: "서버에게 인사하고 현재 시간을 물어봅니다.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const timeString = new Date().toLocaleString('ko-KR');
      return {
        content: [{ type: "text", text: `안녕! 지금시간은.. 음..... \n ${timeString}이야. 아마도?` }]
      };
    }
  },
  도움말: {
    description: "도움말 및 사용 가능한 명령어 목록을 보여줍니다.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({
      content: [{ type: "text", text: "어.. 아직은 구현이안됬어 아직은말이지?" }]
    })
  }
} as const;


//[2] 서버 초기 설정
 
const server = new Server(
  { name: "geocentrism-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);


//[3] 도구 목록 요청 핸들러 (자동화)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(TOOLS).map(([name, { description, inputSchema }]) => ({
    name,
    description,
    inputSchema,
  })),
}));

//[4] 도구 실행 요청 핸들러 (if문 제거 버전)
 
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  
  const tool = TOOLS[name as keyof typeof TOOLS];
  if (!tool)  throw new Error(`그런게있을리가.. ${name}은(는) 없는 명령이야`);

  return tool.handler();
});

//[5] 메인 실행부

async function main() 
{
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Geocentrism MCP 서버 Online...");

  // 터미널 입력감지
  process.stdin.on("data", (data) => {
    const input = data.toString().trim().toLowerCase();
    if (["exit"].includes(input)) {
      console.error("👋 잘가!");
      process.exit(0);
    }
  });
}

main().catch((error) => {
  console.error("💥 서버 치명적 에러:", error);
  process.exit(1);
});