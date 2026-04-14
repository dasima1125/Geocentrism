import axios from 'axios';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import FormData from 'form-data';
import { JobPool } from './Tools/ModelJobPool.js';

const TASK_ROOT = 'C:\\MCP_InteractionSpace\\System_ImageGenTask';

export const Module_Image = {
  
  //#region 이미지 생성 및 제어
  Image_ConceptCreate_POST: {
    description: "[이미지 시스템] 컨셉 이미지 생성 도구",
    inputSchema: {
      type: "object",
      properties: {
        subject:  { type: "string", description: "생성할 이미지 설명입니다." },
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

        const imageRes = await axios.get(imageUrl, { 
          responseType: 'arraybuffer', 
          headers: { 'Authorization': `Bearer ${API_KEY}` } 
        });
        const { workspacePath, assetName } = await createAssetWorkspace(args.fileName);
        const FileName_Taged = await FileTypeCoupler(assetName, "concept");
        const fullPath = path.join(workspacePath, `${FileName_Taged}.jpg`);

        await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
        await fsPromises.writeFile(fullPath, Buffer.from(imageRes.data));

        return { content: [{ type: "text", text: `✅ 생성 완료: ${fullPath}` }] };
      } 
      catch (error: any) { return { content: [{ type: "text", text: `❌ 에러: ${error.message}` }], isError: true }; }
    }
  },
  Image_ConceptEdit_POST: {
    description: "[이미지 시스템] 컨셉 이미지 수정 도구",
    inputSchema: {
      type: "object",
      properties: {
        path:    { type: "string" },
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

  //#region 이미지 모델변환 및 다운로드
  Image_ConvertImgToModel_POST: {
    description: "[모델링 시스템] 이미지 를 3D 변환 및 작업 공간 격리",
    inputSchema: {
      type: "object",
      properties: {
        imagePath: { type: "string", description: "로컬 이미지 절대 경로" },
        quality: { 
          type: "string", enum: ["standard", "lowpoly"], default: "standard",description: "모델 생성 품질 (lowpoly 선택 시 폴리곤 수 지정 무시)"},
          targetPolycount: { type: "integer", default: 30000, description: "목표 폴리곤 수 (3000 ~ 300,000)" }
        },
        required: ["imagePath"]
      },
      handler: async (args: { imagePath: string; quality: string; targetPolycount: number }) => {
        const API_KEY = process.env.SERVICE_KEY_MASHAI;
        const BASE_URL = 'https://api.meshy.ai/openapi/v1';
        try {
          const imageBuffer = await fsPromises.readFile(args.imagePath);
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

        // standard 모드일 때만 리매시와 폴리곤 수 제어 활성화
        if (args.quality === 'standard') {
          payload.should_remesh = true;
          payload.target_polycount = args.targetPolycount;
          payload.topology = 'triangle';
        }

        // API 요청
        const response = await axios.post(`${BASE_URL}/image-to-3d`, payload, { headers: { 'Authorization': `Bearer ${API_KEY}` }});
        const taskId = response.data.result;

        //이미지 이름을 딴 디렉터리 생성 및 원본 이동
        const parsedPath = path.parse(args.imagePath);
        const parentDir = parsedPath.dir;
        const fileName = parsedPath.name;

        const targetFolderPath = path.join(parentDir, fileName);
        await fsPromises.mkdir(targetFolderPath, { recursive: true }); // <== 동일 폴더명이있으면뭐 인덱싱을하든 해결

        await JobPool.push({taskId: taskId, folderPath: targetFolderPath, fileName: parsedPath.name, type: 'model'});

        const newImagePath = path.join(targetFolderPath, parsedPath.base);
        await fsPromises.rename(args.imagePath, newImagePath);

        return {
          content: [{ type: "text",text: `✅ 모델 생성 완료 - Task ID: ${taskId} - 작업 공간: ${targetFolderPath}`}]
        };
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
  
  Image_TextureWithImage_POST: {
    description: "[모델링 시스템] 이미지를 참조하여 3D 모델의 텍스처를 생성",
    inputSchema: {
      type: "object",
      properties: {
        modelPath:      { type: "string", description: "리텍스처할 로컬 모델 파일(.glb, .obj 등)의 절대 경로" },
        styleImagePath: { type: "string", description: "스타일 참조용 로컬 이미지의 절대 경로" }
      },
      required: ["modelPath", "styleImagePath"]
    },
    handler: async (args: { modelPath: string; styleImagePath: string }) => {
      const API_KEY = process.env.SERVICE_KEY_MASHAI;
      const BASE_URL = 'https://api.meshy.ai/openapi/v1';

      try {
        // 1. 파일 읽기 및 Base64 변환 (경로 정규화 포함)
        const normModelPath = path.resolve(args.modelPath);
        const normImagePath = path.resolve(args.styleImagePath);

        if (!fs.existsSync(normModelPath)) throw new Error(`모델 파일 누락: ${normModelPath}`);
        if (!fs.existsSync(normImagePath)) throw new Error(`이미지 파일 누락: ${normImagePath}`);

        const modelBuffer = await fsPromises.readFile(normModelPath);
        const imageBuffer = await fsPromises.readFile(normImagePath);

        // Meshy 문서 규격에 맞춘 Data URI 생성
        const base64Model = `data:application/octet-stream;base64,${modelBuffer.toString('base64')}`;
        const ext = path.extname(normImagePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

        // 2. API 페이로드 구성
        const payload = {
          model_url: base64Model,
          image_style_url: base64Image,
          ai_model: 'meshy-6',
          enable_original_uv: false,
          enable_pbr: true,
          remove_lighting: true,
          target_formats: ["glb"]
        };

        // 3. 요청 전송
        const response = await axios.post(`${BASE_URL}/retexture`, payload, { 
          headers: { 
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        const taskId = response.data.result;
        if (!taskId) throw new Error(`Task ID 생성 실패: ${JSON.stringify(response.data)}`);

        // 4. 작업 공간 생성 및 JobPool 등록
        const parsedPath = path.parse(normModelPath);
        const targetFolderPath = path.join(parsedPath.dir, `${parsedPath.name}_Retextured`);
        await fsPromises.mkdir(targetFolderPath, { recursive: true });
        
        await JobPool.push({ 
          taskId: taskId, 
          folderPath: targetFolderPath, 
          fileName: `${parsedPath.name}`, 
          type: 'texture' 
        });

        return {
          content: [{ 
            type: "text", 
            text: `✅ 리텍스처 접수 완료\n- ID: ${taskId}\n- 경로: ${targetFolderPath}\n- 용량: ${(modelBuffer.length / 1024 / 1024).toFixed(2)}MB` 
          }]
        };
      } 
      catch (error: any) {
        const errorDetail = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
        return {
          content: [{ type: "text", text: `❌ 접수 실패 상세:\n${errorDetail}` }],
          isError: true
        };
      }
    }
  },

  Image_HarvestResults_POST: {
  description: "[모델링 시스템] 작업 풀을 순회하며 완료된 모델/텍스처 일괄 수확",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const API_KEY = process.env.SERVICE_KEY_MASHAI;
    const BASE_URL = 'https://api.meshy.ai/openapi/v1';

    try {
      const pool = await JobPool.read();
      if (pool.length === 0) return { content: [{ type: "text", text: "진행 중인 작업이 없습니다." }] };
      
      const results = [];
      const dateTag = new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12);

      for (const task of pool) {
        try {
          // ✅ 엔드포인트 재확인 (Meshy API v1 기준)
          const endpoint = task.type === 'texture' ? 'retexture' : 'image-to-3d';
          const response = await axios.get(`${BASE_URL}/${endpoint}/${task.taskId}`, { 
            headers: { 'Authorization': `Bearer ${API_KEY}` }
          });

          // 🔍 [데이터 흐름 확인용] 서버 응답 전문 로깅
          console.log(`[DEBUG] Task ${task.taskId} Response:`, JSON.stringify(response.data, null, 2));

          // Meshy API 응답 구조에 따라 status 위치를 확인해야 합니다.
          const data = response.data; 
          const status = data.status;
          const model_urls = data.model_urls;
          const progress = data.progress;

          if (status === "SUCCEEDED") {
            const downloadUrl = model_urls?.glb;
            if (!downloadUrl) {
              results.push(`⏳ [${task.fileName}] 성공했으나 GLB URL이 없음 (응답 확인 필요)`);
              continue;
            }

            const suffix = task.type === "texture" ? "_textured" : "_model";
            const savePath = path.join(task.folderPath, `${task.fileName}${suffix}_${dateTag}.glb`);
            
            // 폴더가 실제 존재하는지 한 번 더 보장
            await fsPromises.mkdir(task.folderPath, { recursive: true });

            const fileRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
            await fsPromises.writeFile(savePath, Buffer.from(fileRes.data));
            
            await JobPool.remove(task.taskId);
            results.push(`✅ [${task.fileName}] 수확 완료: ${savePath}`);
          } 
          else if (status === "FAILED") {
            await JobPool.remove(task.taskId);
            // 실패 원인을 Meshy 서버에서 받아온 메시지로 구체화
            results.push(`❌ [${task.fileName}] 서버 내부 연산 실패: ${data.task_error?.message || '사유 미상'}`);
          } 
          else {
            results.push(`⏳ [${task.fileName}] 진행 중 (${progress}%) - 상태: ${status}`);
          }
        } catch (err: any) {
          // 🚨 상세 에러 데이터 추출
          const serverError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
          results.push(`⚠️ [${task.fileName}] 조회 실패: ${serverError}`);
          console.error(`[ERROR] Task ${task.taskId}:`, serverError);
        }
      }
      return { content: [{ type: "text", text: `작업 결과:\n\n${results.join('\n')}` }]};
    } catch (error: any) {
      return { content: [{ type: "text", text: `❌ 시스템 에러: ${error.message}` }], isError: true };
    }
  }
}
}



const createAssetWorkspace = async (inputName: string) => {
  const assetName = inputName.split('__')[0] || inputName; 
  const workspacePath = path.join(TASK_ROOT, assetName);
  
  await fsPromises.mkdir(workspacePath, { recursive: true });
  
  return { workspacePath, assetName};
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
  
  if (!base.includes('__')) return null;

  return base.split('__')[0];
};