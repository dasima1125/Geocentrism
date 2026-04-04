import axios from 'axios';
import dotenv from 'dotenv';
import { readExcelFile } from './Tools/ExcelReader.js';

dotenv.config();

const SERVICE_KEY = process.env.SERVICE_KEY_Weather || "";

const BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
const ENDPOINT_NCST = `${BASE_URL}/getUltraSrtNcst`;      // 1. 실황 (지금)
const ENDPOINT_SRT_FCST = `${BASE_URL}/getUltraSrtFcst`;  // 2. 초단기예보 (6시간)
const ENDPOINT_VILAGE = `${BASE_URL}/getVilageFcst`;      // 3. 단기예보 (3일)
const ENDPOINT_VERSION = `${BASE_URL}/getFcstVersion`;    // 4. 버전확인

export const Module_Weather = {

  // #region 1. 초단기실황
  날씨조회_현재: {
    description: "현재 시점의 실제 기상 관측 데이터를 로우데이터로 가져옵니다.",
    inputSchema: {
      type: "object",
      properties: {
        nx: { type: "number", default: 60 },
        ny: { type: "number", default: 127 }
      }
    },
    handler: async (args: { nx?: number, ny?: number }) => {
      try {
        const { baseDate, baseTime } = getKmaTimeConfig('NCST');
        
        const params: WeatherRequestparams = {
          serviceKey: SERVICE_KEY,
          dataType: "JSON",
          base_date: baseDate,
          base_time: baseTime,
          nx: args.nx || 60,
          ny: args.ny || 127,
          numOfRows: 100
        };

        const response = await axios.get(ENDPOINT_NCST, { params });
        const items = response.data.response?.body?.items?.item;
        
        return {
          content: [{ 
            type: "text", 
            text: `✅ [초단기 실황] 데이터 수신 (${baseDate} ${baseTime} 기준)\n\n${JSON.stringify(convertRespones(items), null, 2)}` 
          }]
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 초단기 실황 조회 실패: ${error.message}` }], isError: true };
      }
    }
  },
  // #endregion

  // #region 2. 초단기예보 
  날씨예보_단기: {
    description: "지금부터 향후 6시간 동안의 시간별 기상 예측 데이터를 가져옵니다.",
    inputSchema: {
      type: "object",
      properties: {
        nx: { type: "number", default: 60 },
        ny: { type: "number", default: 127 }
      }
    },
    handler: async (args: { nx?: number, ny?: number }) => {
      try {
        const { baseDate, baseTime } = getKmaTimeConfig('SRT_FCST');

        const params: WeatherRequestparams = {
          serviceKey: SERVICE_KEY,
          dataType: "JSON",
          base_date: baseDate,
          base_time: baseTime,
          nx: args.nx || 60,
          ny: args.ny || 127,
          numOfRows: 200
        };

        const response = await axios.get(ENDPOINT_SRT_FCST, { params });
        const items = response.data.response?.body?.items?.item;

        return {
          content: [{ 
            type: "text", 
            text: `✅ [초단기예보] 데이터 수신 (${baseDate} ${baseTime} 기준)\n\n${JSON.stringify(convertRespones(items), null, 2)}` 
          }]
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 초단기예보 조회 실패: ${error.message}` }], isError: true };
      }
    }
  },
  // #endregion

  // #region 3. 단기예보 
  날씨예보_장기: {
    description: "오늘부터 모레까지의 상세 동네 예보 데이터를 가져옵니다.",
    inputSchema: {
      type: "object",
      properties: {
        nx: { type: "number", default: 60 },
        ny: { type: "number", default: 127 }
      }
    },
    handler: async (args: { nx?: number, ny?: number }) => {
      try {
        const { baseDate, baseTime } = getKmaTimeConfig('VILAGE');

        const params: WeatherRequestparams = {
          serviceKey: SERVICE_KEY,
          dataType: "JSON",
          base_date: baseDate,
          base_time: baseTime,
          nx: args.nx || 60,
          ny: args.ny || 127,
          numOfRows: 1000
        };

        const response = await axios.get(ENDPOINT_VILAGE, { params });
        const items = response.data.response?.body?.items?.item;

        return {
          content: [{ 
            type: "text", 
            text: `✅ [단기예보] 데이터 수신 (${baseDate} ${baseTime} 기준)\n\n${JSON.stringify(convertRespones(items), null, 2)}` 
          }]
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 단기예보 조회 실패: ${error.message}` }], isError: true };
      }
    }
  },
  // #endregion

  // #region 4. 예보버전조회
  예보버전조회: {
    description: "기상청 서버의 데이터 동기화 버전을 확인합니다. (실황, 초단기, 단기 중 선택)",
    inputSchema: { 
      type: "object", 
      properties: {
        ftype: { 
          type: "string", 
          enum: ["ODAM", "VSRT", "SHRT"], 
          description: "조회할 타입 (ODAM: 실황, VSRT: 초단기, SHRT: 단기)" 
        }
      },
      required: ["ftype"] 
    },
    handler: async (args: { ftype: "ODAM" | "VSRT" | "SHRT" }) => {
      try {
        const { baseDate, baseTime } = getKmaTimeConfig('NCST'); 
        const checkTime = `${baseDate}${baseTime.substring(0, 2)}00`; 

        const response = await axios.get(ENDPOINT_VERSION, {
          params: { 
            serviceKey: SERVICE_KEY, 
            dataType: "JSON", 
            ftype: args.ftype, 
            basedatetime: checkTime 
          }
        });

        const latestVersion = response.data.response?.body?.items?.item?.[0]?.version || "데이터 없음";

        return {
          content: [{ 
            type: "text", 
            text: `🌐 [${args.ftype}] 동기화 상태 점검\n🔄 최신 데이터 버전: ${latestVersion}` 
          }]
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 통신 에러: ${error.message}` }], isError: true };
      }
    }
  },
  // #endregion

  // #region 좌표조회
  좌표조회: {
    description: "한국의 지역명(예: 서울 강남구, 부천시 중동)을 입력받아 기상청 격자 좌표(nx, ny)를 반환합니다.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "조회할 지역명 (시/군/구/동 단위 자유롭게 입력)" }
      },
      required: ["address"]
    },
    handler: async (args: { address: string }) => {
      try {
        const searchKeyword = args.address?.trim();
        if (!searchKeyword) {
          return { 
            content: [{ type: "text", text: "❌ 지역명을 입력해주세요. (예: 서울 강남구, 부천 중동)" }], 
            isError: true 
          };
        }

        const keywords = searchKeyword.split(/\s+/).filter(k => k.length > 0);
        const excelData = readExcelFile('data/kma_coords.xlsx') as any[];
        
        const found = excelData.find(row => {
          const fullAddr = `${row['1단계']} ${row['2단계'] || ''} ${row['3단계'] || ''}`.replace(/\s+/g, ' ').trim();
          return keywords.every(key => fullAddr.includes(key));
        });

        if (!found) {
          return { 
            content: [{ type: "text", text: `❌ '${searchKeyword}' 지역을 엑셀 데이터에서 찾을 수 없습니다.` }], 
            isError: true 
          };
        }
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              address: `${found['1단계']} ${found['2단계'] || ''} ${found['3단계'] || ''}`.replace(/\s+/g, ' ').trim(),
              nx: Number(found['격자 X']),
              ny: Number(found['격자 Y'])
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return { 
          content: [{ type: "text", text: `❌ 좌표 조회 중 오류 발생: ${error.message}` }], 
          isError: true 
        };
      }
    }
  }
  // #endregion
  
};

// #region 추가기능 모듈

// 시간 조율 기능
const getKmaTimeConfig = (serviceType: 'NCST' | 'SRT_FCST' | 'VILAGE') => {
  const now = new Date();
  
  // 한국 시간 계산 (UTC+9)
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  
  let baseDate = kstDate.toISOString().slice(0, 10).replace(/-/g, "");
  let hours = kstDate.getUTCHours();
  let minutes = kstDate.getUTCMinutes();
  let baseTime = "";

  switch (serviceType) {
    case 'NCST': // 실황 : 40분 전이면 이전 시간
      if (minutes < 40) hours -= 1;
      baseTime = `${String(hours).padStart(2, '0')}00`;
      break;

    case 'SRT_FCST': // 초단기예보 : 45분 전이면 이전 타임
      if (minutes < 45) {
        if (minutes < 30) {
          hours -= 1;
          baseTime = `${String(hours).padStart(2, '0')}30`;
        } else {
          baseTime = `${String(hours).padStart(2, '0')}00`;
        }
      } else {
        baseTime = `${String(hours).padStart(2, '0')}30`;
      }
      break;

    case 'VILAGE': // 단기예보: 02, 05, 08, 11, 14, 17, 20, 23
      let effectiveHours = hours;
      if (minutes < 10) effectiveHours -= 1; 

      const fastTimes = [2, 5, 8, 11, 14, 17, 20, 23];
      const targetHour = [...fastTimes].reverse().find(t => t <= effectiveHours);
      
      if (targetHour === undefined) {
        hours = 23;
        const yesterday = new Date(kstDate.getTime() - 24 * 60 * 60 * 1000);
        baseDate = yesterday.toISOString().slice(0, 10).replace(/-/g, "");
      } else {
        hours = targetHour;
      }
      baseTime = `${String(hours).padStart(2, '0')}00`;
      break;
  }
  //음수처리
  if (hours < 0) {
    hours = 23;
    const yesterday = new Date(kstDate.getTime() - 24 * 60 * 60 * 1000);
    baseDate = yesterday.toISOString().slice(0, 10).replace(/-/g, "");
    baseTime = `${String(hours).padStart(2, '0')}00`;
  }

  return { baseDate, baseTime };
};

// 결과 자연어 변환기
const convertRespones = (items: any[]): WeatherResult => {
  const timeMap = new Map<string, WeatherResponse>();

  items.forEach(item => {
    const fcstDate = item.fcstDate ?? item.baseDate;
    const fcstTime = item.fcstTime ?? item.baseTime;
    const key = `${fcstDate} ${fcstTime}`;
   
    if (!timeMap.has(key)) {
      timeMap.set(key, { 
        dt: key,
        temp: "", sky: "", rainType: "", rainVal: "", 
        hum: "", windSpd: "", windDir: "", lightning: "" 
      });
    }

    const res = timeMap.get(key)!;
    const val = (item.obsrValue ?? item.fcstValue ?? "") as string; 

    switch (item.category) {
      case 'T1H':
      case 'TMP': 
        res.temp = `${val}℃`; 
        break;
      case 'RN1':
        res.rainVal = (val === "0" || val === "") ? "강수없음" : `${val}mm`;
        break;
      case 'PCP':
        res.rainVal = val; 
        break;
      case 'POP':
        res.rainProb = `${val}%`;
        break;
      case 'LGT':
        res.lightning = val === "0" ? "없음" : "발생(주의)";
        break;
      case 'REH': 
        res.hum = `${val}%`; 
        break;
      case 'WSD': 
        res.windSpd = `${val}m/s`; 
        break;
      case 'SKY': {
        const skyMap: Record<string, string> = { "1": "맑음", "3": "구름많음", "4": "흐림" };
        res.sky = skyMap[val] ?? val; 
        break;
      }
      case 'PTY': {
        const rainMap: Record<string, string> = { "0": "없음", "1": "비", "2": "비/눈", "3": "눈", "4": "소나기" };
        res.rainType = rainMap[val] ?? val; 
        break;
      }
      case 'VEC': {
        const directions = ['북', '북동', '동', '남동', '남', '남서', '서', '북서', '북'];
        const angle = parseFloat(val);
        const idx = isNaN(angle) ? 0 : Math.round(angle / 45);
        res.windDir = directions[idx] ?? "무풍";
        break;
      }
    }
  });

  return Array.from(timeMap.values());
};

// #endregion


// #region  인터페이스 정의 (DTO)
interface WeatherRequestparams {
  serviceKey: string;
  dataType: "JSON";
  base_date: string;
  base_time: string;
  nx: number;
  ny: number;
  numOfRows: number;
}

interface WeatherResponse {
  dt: string;        // 일시 (20260405 0200)
  temp: string;      // 기온
  sky: string;       // 하늘상태 (문자열 매핑 완료)
  rainType: string;  // 강수형태 (문자열 매핑 완료)
  rainVal: string;   // 강수량
  rainProb?: string; // 강수확률 (단기에만 존재)
  hum: string;       // 습도
  windSpd: string;   // 풍속
  windDir: string;   // 풍향 (텍스트 변환 완료)
  lightning: string; // 낙뢰여부
  extra?: string;    // 최고/최저기온 등
}

type WeatherResult = WeatherResponse[];

// #endregion
