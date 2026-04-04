import axios from "axios";

const SERVICE_KEY = "7d348d93bff4a477b5abf3305dcdc291d19a829afc70aa4a5b4246a2fdb0b177";

const BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
const ENDPOINT_NCST = `${BASE_URL}/getUltraSrtNcst`;       // 1. 지금
const ENDPOINT_SRT_FCST = `${BASE_URL}/getUltraSrtFcst`;   // 2. 근미래   (6시간 쯤)
const ENDPOINT_VILAGE = `${BASE_URL}/getVilageFcst`;       // 3. 단기예보 (3일까지의 규모)
const ENDPOINT_VERSION = `${BASE_URL}/getFcstVersion`;     // 4. 업데이트 (연결확인 & 업데이트 체크)

export const Module_Weather = {
  
  // #region 초단기실황
  날씨조회_현재: {
    description: "향후 6시간 동안의 기상 예측 데이터를 로우데이터로 가져옵니다.",
    inputSchema: {
      type: "object",
      properties: {
        nx: { type: "number", default: 60 },
        ny: { type: "number", default: 127 }
      }
    },
    handler: async (args: { nx?: number, ny?: number }) => {
      try {
        const now = new Date();
        const baseDate = now.toISOString().slice(0, 10).replace(/-/g, "");
        const baseTime = `${String(now.getHours()).padStart(2, '0')}30`; 

        const response = await axios.get(ENDPOINT_NCST, {
          params: {
            serviceKey: SERVICE_KEY,
            dataType: "JSON",
            base_date: baseDate,
            base_time: baseTime,
            nx: args.nx || 60,
            ny: args.ny || 127,
            numOfRows: 200 
          }
        });

        const items = response.data.response?.body?.items?.item;
        return {
          content: [{ 
            type: "text", 
            text: `📅 예보 데이터 수신 (${baseDate} ${baseTime} 발표 기준)\n\n${JSON.stringify(items, null, 2)}` 
          }]
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 예보 조회 실패: ${error.message}` }], isError: true };
      }
    }
  },
  // #endregion


  // #region 예보버전
  예보버전조회: {
    description: "기상청 서버의 최신 데이터 배포 시점을 확인하여 동기화 상태를 체크합니다.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      try {
        const now = new Date();
        const checkTime = now.toISOString().slice(0, 13).replace(/[-T]/g, "") + "00"; 

        const response = await axios.get(ENDPOINT_VERSION, {
          params: { 
            serviceKey: SERVICE_KEY, 
            dataType: "JSON", 
            ftype: "ODAM", // 필수: 실황(ODAM), 초단기(VSRT), 단기(SHRT) 중 선택
            basedatetime: checkTime 
          }
        });

        const header = response.data.response?.header;
        const body = response.data.response?.body;

        if (header?.resultCode !== "00") {
          return { content: [{ type: "text", text: `⚠️ 업데이트 확인 실패: ${header?.resultMsg}` }] };
        }

       
        const latestVersion = body?.items?.item?.[0]?.version || "데이터 없음";

        return {
          content: [{ 
            type: "text", 
            text: `🌐 기상청 통신 상태: 정상 (${header?.resultMsg})\n🔄 최신 데이터 버전: ${latestVersion}\n\n* 이 시각 이후의 실황 데이터가 현재 유효합니다.` 
          }]
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 통신 에러: ${error.message}` }], isError: true };
      }
    }
  }
  // #endregion
};


