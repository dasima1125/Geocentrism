export const Module_Tester = {
  System_Version: {
    description: "부트테스트_서버의 상태와 확인합니다.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({
      content: [{ type: "text", text: "🚀 Geocentrism 서버: 반가워요 (v1.0.0)" }]
    })
  },
  System_Hello: {
    description: "부트테스트_서버에게 인사하고 현재 시간을 물어봅니다.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const timeString = new Date().toLocaleString('ko-KR');
      return {
        content: [{ type: "text", text: `안녕! 지금시간은.. 음..... \n ${timeString}이야. 아마도?` }]
      };
    }
  },
  System_Help: {
    description: "부트테스트_도움말 및 사용 가능한 명령어 목록을 보여줍니다.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({
      content: [{ type: "text", text: "어.. 아직은 구현이안됬어 아직은말이지?" }]
    })
  }
};