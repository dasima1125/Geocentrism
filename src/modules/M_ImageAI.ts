import axios from 'axios';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import FormData from 'form-data'; // <== 안쓰는거아님 컨셉아트수정때 아마 쓸꺼임 지우기 ㄴㄴ
import { JobPool } from './Tools/ModelJobPool.js';

const TASK_ROOT = 'C:\\MCP_InteractionSpace\\System_ImageGenTask';

export const Module_Image = {

  //#region 이미지 생성 및 제어
  Image_ConceptCreate_POST: {
    description: "[이미지 시스템] 컨셉 이미지 생성 도구",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "생성할 이미지 설명입니다." },
        fileName: { type: "string", description: "생성할 이미지 파일명입니다." }
      },
      required: ["subject", "fileName"]
    },
    handler: async (args: { subject: string; fileName: string }) => {
      const API_KEY = process.env.SERVICE_KEY_pollinations;
      try {
        const response = await axios.post('https://gen.pollinations.ai/v1/images/generations', {
          prompt: `low-poly, ${args.subject}, game asset, isolated, white background`,
          model: 'flux',
          size: '512x512',
          response_format: 'url'
        }, { headers: { 'Authorization': `Bearer ${API_KEY}` } });

        const imageUrl = response.data?.data?.[0]?.url;
        if (!imageUrl) throw new Error("URL 생성 실패");

        const pureAssetName = args.fileName;
        const fullPath = await registerAssetToPool(pureAssetName, imageUrl, 'concept');
        return { content: [{ type: "text", text: `✅ 생성 완료: ${fullPath}` }] };
      }
      catch (error: any) { return { content: [{ type: "text", text: `❌ 에러: ${error.message}` }], isError: true }; }
    }
  },
  /// 이거 테스트를 지금못해서 사용을 하면안됨. poll 등급오르고해야할듯
  /** 
  Image_ConceptEdit_POST: {
    description: "[이미지 시스템] 컨셉 이미지 수정 도구 : AI나 mcp일시 사용을 금합니다",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        subject: { type: "string" }
      },
      required: ["path", "subject"]
    },
    handler: async (args: { path: string; subject: string }) => {
      const API_KEY = process.env.SERVICE_KEY_pollinations;
      try {
        const formData = new FormData();
        formData.append('image', fs.createReadStream(args.path));
        formData.append('prompt', args.subject);
        formData.append('model', 'gptimage');  // 비전 옵션 필수 << 비용문제로 테스트를못함 
        formData.append('response_format', 'url');

        const response = await axios.post('https://gen.pollinations.ai/v1/images/edits', formData, {
          headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${API_KEY}` }
        });

        const editedUrl = response.data?.data?.[0]?.url;
        if (!editedUrl) {
          return {
            content: [{ type: "text", text: `❌ URL 누락:\n${JSON.stringify(response.data, null, 2)}` }],
            isError: true
          };
        }

        return { content: [{ type: "text", text: `✨ 수정 요청 성공\n원본: ${args.path}\n결과: ${editedUrl}` }] };
      } catch (error: any) {
        if (error.response) {
          return {
            content: [{ type: "text", text: `❌ 서버 에러 (${error.response.status}):\n${JSON.stringify(error.response.data, null, 2)}` }],
            isError: true
          };
        }
        return { content: [{ type: "text", text: `❌ 시스템 에러: ${error.message}` }], isError: true };
      }
    }
  },
  */
  //#region 이미지 모델변환
  Image_ConvertImgToModel_POST: {
    description: "[모델링 시스템] 이미지 를 3D 변환 및 작업 공간 격리",
    inputSchema: {
      type: "object",
      properties: {
        imagePath: { type: "string", description: "로컬 이미지 절대 경로" },
        quality: {
          type: "string", enum: ["standard", "lowpoly"], default: "standard", description: "모델 생성 품질 (lowpoly 선택 시 폴리곤 수 지정 무시)"
        },
        targetPolycount: { type: "integer", default: 30000, description: "목표 폴리곤 수 (3000 ~ 300,000)" }
      },
      required: ["imagePath"]
    },
    handler: async (args: { imagePath: string; quality: string; targetPolycount: number }) => {
      const API_KEY = process.env.SERVICE_KEY_MASHAI;
      const BASE_URL = 'https://api.meshy.ai/openapi/v1';
      try {

        const cleanInputPath = cleanPath(args.imagePath);
        const imageBuffer = await fsPromises.readFile(cleanInputPath);
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

        const payload: any = {
          image_url: base64Image,
          ai_model: 'meshy-6',
          model_type: args.quality,
          should_texture: false,    // 토큰 절약 (10 크레딧 아낌)
          image_enhancement: false, // AI 보정 차단 (원본 형태 보존)
          moderation: false,        // 불필요한 검수 및 변형 방지
          target_formats: ["glb"]
        };

        if (args.quality === 'standard') {
          payload.should_remesh = true;
          payload.target_polycount = args.targetPolycount;
          payload.topology = 'triangle';
        }

        // API 요청
        const response = await axios.post(`${BASE_URL}/image-to-3d`, payload, { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const taskId = response.data.result;
        if (!taskId) { throw new Error(`API 응답 데이터 부정합: ${JSON.stringify(response.data)}`); }

        // 이미지 이름을 딴 디렉터리 생성 및 원본 이동
        const baseFileName = path.basename(cleanInputPath);
        const pureAssetName = await FileTypeDecoupler(baseFileName) || path.parse(baseFileName).name;

        const { workspacePath } = await createAssetWorkspace(pureAssetName);
        const targetImagePath = path.join(workspacePath, baseFileName);
        if (cleanInputPath !== targetImagePath) await fsPromises.copyFile(cleanInputPath, targetImagePath);

        const fullPath = await registerAssetToPool(pureAssetName, taskId, 'model');
        return { content: [{ type: "text", text: `✅ 모델 생성 완료 - Task ID: ${taskId} - 작업 공간: ${fullPath}` }] };
      }
      catch (error: any) {
        const errorDetail = error.response?.data?.message || error.message;
        return {
          content: [{ type: "text", text: `❌ 접수 실패: ${errorDetail}` }],
          isError: true
        };
      }
    }
  },
  //#region 텍스쳐 생성 
  Image_TextureWithImage_POST: {
    description: "[모델링 시스템] 이미지를 참조하여 3D 모델의 텍스처를 생성",
    inputSchema: {
      type: "object",
      properties: {
        modelPath: { type: "string", description: "리텍스처할 로컬 모델 파일(.glb, .obj 등)의 절대 경로" },
        styleImagePath: { type: "string", description: "스타일 참조용 로컬 이미지의 절대 경로" }
      },
      required: ["modelPath", "styleImagePath"]
    },
    handler: async (args: { modelPath: string; styleImagePath: string }) => {
      const API_KEY = process.env.SERVICE_KEY_MASHAI;
      const BASE_URL = 'https://api.meshy.ai/openapi/v1';

      try {
        // 경로 정규화 및 데이터 준비
        const normModelPath = cleanPath(args.modelPath);
        const normImagePath = cleanPath(args.styleImagePath);

        if (!fs.existsSync(normModelPath)) throw new Error(`모델 파일 누락: ${normModelPath}`);
        if (!fs.existsSync(normImagePath)) throw new Error(`이미지 파일 누락: ${normImagePath}`);

        const modelBuffer = await fsPromises.readFile(normModelPath);
        const imageBuffer = await fsPromises.readFile(normImagePath);

        // Base64/Data URI 변환
        const base64Model = `data:application/octet-stream;base64,${modelBuffer.toString('base64')}`;
        const ext = path.extname(normImagePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

        const payload = {
          model_url: base64Model,
          image_style_url: base64Image,
          ai_model: 'meshy-6',
          enable_original_uv: false, // 없을때쓰면 오류터짐 문제는 등록은걸려서 추적이힘듬
          enable_pbr: true,
          remove_lighting: true,
          target_formats: ["glb"] // 바꾸고싶으면바꾸고
        };

        // API 요청
        const response = await axios.post(`${BASE_URL}/retexture`, payload, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        const taskId = response.data.result;
        if (!taskId) throw new Error(`API 응답 데이터 부정합: ${JSON.stringify(response.data)}`);

        const baseFileName = path.basename(normModelPath);
        const pureAssetName = await FileTypeDecoupler(baseFileName) || path.parse(baseFileName).name;

        const { workspacePath } = await createAssetWorkspace(pureAssetName);
        const targetModelPath = path.join(workspacePath, baseFileName);
        if (normModelPath !== targetModelPath) await fsPromises.copyFile(normModelPath, targetModelPath);
        
        const fullPath = await registerAssetToPool(pureAssetName, taskId, 'texture');
        return { content: [{ type: "text", text: `✅ 모델 생성 완료 - Task ID: ${taskId} - 작업 공간: ${fullPath}` }] };

      }
      catch (error: any) {
        const errorDetail = error.response?.data?.message || error.message;
        return {
          content: [{ type: "text", text: `❌ 접수 실패: ${errorDetail}` }],
          isError: true
        };
      }
    }
  },
  Image_HarvestResults_POST: {
    description: "[모델링 시스템] 준비된 에셋을 로컬로 즉시 확보 (다운로드는 백그라운드 진행)",
    handler: async () => {
      const API_KEY = process.env.SERVICE_KEY_MASHAI;
      const BASE_URL = 'https://api.meshy.ai/openapi/v1';
      try {
        const pool = await JobPool.read();
        if (pool.length === 0) return { content: [{ type: "text", text: "📦 진행 중인 작업이 없습니다." }] };

        // 병렬로 상태 체크 (다운로드를 기다리지 않음)
        const results = await Promise.allSettled(pool.map((task: ModelTask) => processTask(task, API_KEY, BASE_URL)));
        const report = results.map((res, index) => {
          if (res.status === 'fulfilled')
            return res.value;
          else
            return `❌ ${pool[index].fileName} 조회 에러: ${res.reason}`;
        }).join('\n');
        return { content: [{ type: "text", text: report }] };
      }
      catch (error: any) { return { content: [{ type: "text", text: `❌ 에러: ${error.message}` }], isError: true }; }
    }
  }
}

const cleanPath = (rawPath: string): string => {
  if (!rawPath) return '';

  const cleaned = decodeURIComponent(rawPath)             // %20 등 인코딩 제거
    .replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '')   // 유령 문자(LRE 등) 제거
    .replace(/["']/g, '')                                 // 따옴표 제거
    .replace(/\r?\n|\r/g, '')                             // 개행 제거
    .trim();                                              // 앞뒤 공백 제거

  return path.resolve(cleaned);                           // 절대 경로로 반환
};

const createAssetWorkspace = async (inputName: string) => {
  const assetName = inputName.split('__')[0] || inputName;
  const workspacePath = path.join(TASK_ROOT, assetName);

  await fsPromises.mkdir(workspacePath, { recursive: true });

  return { workspacePath, assetName };
};
const FileTypeCoupler = async (fileName: string, type: 'concept' | 'model' | 'texture') => {

  if (fileName.includes(`__${type}`)) { return fileName; }

  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12);

  return `${base}__${type}@${timestamp}${ext}`;
};

const FileTypeDecoupler = async (fileName: string) => {
  const base = path.basename(fileName);
  const ext = path.extname(base);
  const nameWithoutExt = path.basename(base, ext);
  if (nameWithoutExt.includes('__')) { return nameWithoutExt.split('__')[0]; }
  return nameWithoutExt;
};
// #region 작업 풀 저장
async function registerAssetToPool(pureName: string, taskId: string, type: 'concept' | 'model' | 'texture') {

  const { workspacePath, assetName } = await createAssetWorkspace(pureName);
  const FileName_Taged = await FileTypeCoupler(assetName, type);
  const ext = (type === 'concept') ? '.jpg' : '.glb';
  const finalFileName = `${FileName_Taged}${ext}`;
  const fullPath = path.join(workspacePath, finalFileName);

  await JobPool.push({ taskId: taskId, folderPath: workspacePath, fileName: finalFileName, type: type });
  return fullPath;
}

// #region 다운로드 (비동기 버전)
interface TaskVerdict {
  type: 'WAIT' | 'REMOVE' | 'DOWNLOAD';
  msg: string;
  url?: string;
}
interface ModelTask {
  taskId: string;
  folderPath: string;
  fileName: string;
  type: 'concept' | 'model' | 'texture';
}

async function processTask(task: any, API_KEY: string | undefined, BASE_URL: string): Promise<string> {
  try {
    if (task.type === 'concept') {
      saveAsset(task.taskId, task.folderPath, task.fileName)
        .then(async () => { await JobPool.remove(task.taskId); })
        .catch(() => { });

      return `${task.fileName}: 로컬 저장 프로세스 시작 (Concept)`;
    }
    const endpoint = task.type === 'texture' ? 'retexture' : 'image-to-3d';
    const { data } = await axios.get(`${BASE_URL}/${endpoint}/${task.taskId}`, { headers: { 'Authorization': `Bearer ${API_KEY}` } });

    const verdict = getTaskVerdict(data, task);
    if (verdict.type === 'WAIT') return verdict.msg;
    if (verdict.type === 'REMOVE') {
      await JobPool.remove(task.taskId);
      return verdict.msg;
    }
    if (verdict.type === 'DOWNLOAD' && verdict.url) {
      const savePath = task.folderPath || (await createAssetWorkspace(task.fileName)).workspacePath;

      saveAsset(verdict.url, savePath, task.fileName)
        .then(async () => { await JobPool.remove(task.taskId); })
        .catch(() => { });
      return `${task.fileName}: 로컬 저장 프로세스 시작`;
    }
    return `${task.fileName}: 상태 확인 중...`;
  }
  catch (err: any) { throw new Error(`${task.fileName} 조회 실패`); }
}

async function saveAsset(url: string, folderPath: string, fileName: string): Promise<string> {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  const fullPath = path.join(folderPath, fileName);

  await fsPromises.mkdir(folderPath, { recursive: true });
  await fsPromises.writeFile(fullPath, Buffer.from(data));

  // 백그라운드 로그용
  console.error(`[System] 💾 파일 저장 완료: ${fullPath}`);
  return fullPath;
}



const getTaskVerdict = (data: any, task: any): TaskVerdict => {
  const { status, model_urls, progress } = data;

  if (status === "FAILED") return { type: 'REMOVE', msg: `❌ 실패: ${task.fileName}` };
  if (status !== "SUCCEEDED") return { type: 'WAIT', msg: `진행 중: ${task.fileName} (${progress}%)` };

  const downloadUrl = model_urls?.glb || model_urls?.obj;
  if (!downloadUrl) return { type: 'WAIT', msg: `[${task.fileName}] 리소스 대기 중...` };

  return { type: 'DOWNLOAD', msg: '준비 완료', url: downloadUrl };
};