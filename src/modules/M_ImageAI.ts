import axios from 'axios';
import path from 'path';
import fs from 'fs';                 // 스트림 전송용 (createReadStream)
import fsPromises from 'fs/promises'; // 비동기 작업용 (mkdir, writeFile)
import FormData from 'form-data';

const TARGET_DIR = 'C:\\MCP_InteractionSpace\\DownLoad\\ImageModule';

export const Module_Image = {
  // [공정 1] 컨셉 이미지 신규 생성
  Image_ConceptCreate_POST: {
    description: "[이미지 시스템] AI를 이용한 컨셉 이미지 생성 도구.",
    inputSchema: {
      type: "object",
      properties: {
        subject:  { type: "string", description: "주제 (예: 사이버펑크 스타일)" },
        fileName: { type: "string", description: "저장할 파일명" }
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

        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer', headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const fullPath = path.join(TARGET_DIR, `${args.fileName}.jpg`);

        await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
        await fsPromises.writeFile(fullPath, Buffer.from(imageRes.data));

        return { content: [{ type: "text", text: `✅ 생성 완료: ${fullPath}` }] };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 에러: ${error.message}` }], isError: true };
      }
    }
  },

  Image_ConceptEdit_POST: {
    description: "[이미지 시스템] AI를 이용한 컨셉 이미지 수정 도구.",
    inputSchema: {
      type: "object",
      properties: {
        path:    { type: "string", description: "수정할 파일의 경로" },
        subject: { type: "string", description: "수정 명령 프롬프트" }
      },
      required: ["path", "subject"]
    },
    handler: async (args: { path: string; subject: string }) => {
      const API_KEY = process.env.SERVICE_KEY_pollinations;
      try {
        const formData = new FormData();
        formData.append('image', fs.createReadStream(args.path)); 
        formData.append('prompt', args.subject);                
        formData.append('model', 'gptimage'); // 비전옵션있어야 수정가능                   
        formData.append('response_format', 'url');

        const response = await axios.post('https://gen.pollinations.ai/v1/images/edits', formData, {
          headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${API_KEY}` }
        });

        const editedUrl = response.data?.data?.[0]?.url;
        if (!editedUrl) throw new Error("수정 URL 생성 실패");

        return { content: [{ type: "text", text: `✨ 수정 요청 성공\n원본: ${args.path}\n결과: ${editedUrl}` }] };
      } catch (error: any) {
        const detail = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
        return { content: [{ type: "text", text: `❌ 에딧 실패:\n${detail}` }], isError: true };
      }
    }
  }
};