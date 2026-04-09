import path from 'path';
import fs from 'fs/promises';

const ROOT_PATH = path.normalize("c:\\MCP_InteractionSpace");
const LOG_PATH   = path.normalize("c:\\MCP_InteractionSpace\\SystemLog");
const TRASH_PATH = path.normalize("c:\\MCP_InteractionSpace\\SystemTrash");


//type F_CMode = 'Null1' | 'Null2' ;
type F_RMode = 'Content' | 'Meta' ;
type F_UMode = 'Update' | 'Append' ;
//type F_DMode = 'nomarl' | 'hard' ;

type F_DictUMode = 'Move' | 'Rename';

export const Module_File = {
  // #region File_Operations 
  File_File_Create:
  {
    description: "[로컬 파일시스템] 텍스트 파일을 생성합니다. (대상 : .txt, .log, .json, .md)",
    inputSchema: {
      type: "object",
      properties: {
        path:    { type: "string", description: "저장할 파일의 상대 경로" },
        content: { type: "string", description: "저장할 내용"}
      },
      required: ["path"]
    },
    handler: async (args: { path : string, content ?: string}) => {
      try{
        const { fullPath, isFound, isDir } = await getSafePath(args.path, 'file');
        
        if (isFound && isDir) { throw new Error(`동일한 이름의 디렉터리가 이미 존재합니다: '${args.path}'. 파일로 생성할 수 없습니다.`); }
        if (isFound) { throw new Error(`파일이 이미 존재합니다: '${args.path}'. 내용을 수정하려면 'File_File_Update'를 사용하세요.`); }

        await fs.mkdir(path.dirname(fullPath), { recursive: true }); 
        await fs.writeFile(fullPath, args.content || "", 'utf-8');
        
        return { content: [{ type: "text", text: `✅ [생성 성공] ${args.path}` }] };
      }
      catch(error: any){ return { content: [{ type: "text", text: `❌ 실패: ${error.message}` }], isError: true };}
    }
  },

  File_File_Read: {
    description: "[로컬 파일시스템] 파일 내용을 읽어옵니다. (최대 20KB 제한)",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "읽을 파일의 상대 경로"},
        type: { type: "string", enum: ["Content", "Meta"], description: "읽기 유형: 'Content'(본문), 'Meta'(크기/시간 정보)"}
      },
      required: ["path", "type"] 
    },
    handler: async (args: { path: string, type: F_RMode }) => {
      try {
        const { fullPath, isFound, isDir } = await getSafePath(args.path, 'file');

        if (!isFound) throw new Error("파일을 찾을 수 없습니다.");
        if (isDir)    throw new Error("디렉터리는 읽을 수 없습니다. File_Indexer를 사용하세요.");

        const stats = await fs.stat(fullPath);
        switch (args.type) {
          case 'Meta':
            return {content: [{type: "text",
              text: `[파일 메타 정보]\n---\n` +
              `- 파일명: ${path.basename(fullPath)}\n` +
              `- 크기: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)\n` +
              `- 생성일: ${stats.birthtime.toLocaleString()}\n` +
              `- 수정일: ${stats.mtime.toLocaleString()}`
              }]
            };
          case 'Content':
            const limit = 20 * 1024; 
            if (stats.size > limit) { throw new Error(`파일이 너무 큽니다 (${(stats.size / 1024).toFixed(1)}KB).`); }
            const data = await fs.readFile(fullPath, 'utf-8');
            return { content: [{ type: "text", text: `✅ [읽기 성공]\n---\n${data}` }]};
          default: 
            throw new Error(`허용불가능한 읽기 모드입니다: ${args.type}`);
        }
      } 
      catch (error: any) { return { content: [{ type: "text", text: `❌ 읽기 실패: ${error.message}` }], isError: true }; } 
    }
  },
 
  File_File_Update: {
    description: "[로컬 파일시스템] 파일을 업데이트합니다. (대상 : .txt, .log, .json, .md)",
    inputSchema: {
      type: "object",
      properties: {
        path :   { type: "string", description: "저장할 파일의 상대 경로"},
        type :   { type: "string", description: "업데이트타입 (덮어쓰기, 뒤에쓰기)" , enum: ["Update" , "Append"]},
        content: { type: "string", description: "작성할 내용"}
      },
      required: ["path", "type", "content"]
    },
    handler: async (args: { path: string, type: F_UMode, content: string }) => {
      try {
        const { fullPath, isFound, isDir } = await getSafePath(args.path, 'file');

        if (isFound && isDir) { throw new Error(`경로 충돌: '${args.path}'는 디렉터리입니다.`); }
        if (!isFound) { throw new Error(`파일을 찾을 수 없습니다: '${args.path}'. 'Create'를 먼저 사용하세요.`); }

        if (args.type === "Append") { await fs.appendFile(fullPath, `\n${args.content}`, 'utf-8'); } 
        else { await fs.writeFile(fullPath, args.content, 'utf-8'); }

        return { content: [{ type: "text", text: `✅ [${args.type} 성공]: ${args.path}` }]};
      } 
      catch (error: any) { return { content: [{ type: "text", text: `❌ 저장 실패: ${error.message}` }], isError: true};} 
    }
  },

  File_File_Delete: {
    description: "[로컬 파일시스템] 파일을 휴지통으로 이동시킵니다.)",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "삭제할 파일의 상대 경로" }
      },
      required: ["path"]
    },
    handler: async (args: { path: string }) => {
      try {
        const { fullPath, isFound, isDir } = await getSafePath(args.path, 'file');

        if (!isFound) { throw new Error(`삭제할 파일을 찾을 수 없습니다: '${args.path}'`); }
        if (isDir) { throw new Error("디렉터리는 삭제할 수 없습니다. (파일 전용 도구)"); }

          // 윈도우처럼 두 레이어로 나누기엔 너무 해비함
        const fileName = path.basename(fullPath);
        const trashPath = path.join(TRASH_PATH, `${Date.now()}_${fileName}`);
   
        await fs.mkdir(TRASH_PATH, { recursive: true });
        await fs.rename(fullPath, trashPath);

        return { content: [{ type: "text", text: `✅[삭제 성공] 파일이 휴지통으로 이동되었습니다: ${args.path}` }]};
      } 
      catch (error: any) { return { content: [{ type: "text", text: `❌ 삭제 실패: ${error.message}` }], isError: true}; }
    }
  },
  File_File_Copy: {
    description: "[로컬 파일시스템] 파일을 복사합니다. (대상 : .txt, .log, .json, .md)",
    inputSchema: {
      type: "object",
      properties: {
        pathStart :  { type: "string", description: "복사할 대상의 파일 경로"},
        pathEnd   :  { type: "string", description: "복사할 위치 경로"},
      },
      required: ["pathStart", "pathEnd"]
    },
    handler: async(args: { pathStart: string, pathEnd: string }) => {
      try {
          const start  = await getSafePath(args.pathStart, 'file');
          const end = await getSafePath(args.pathEnd, 'file');

          if (!start.isFound)  throw new Error(`복사할 파일을 찾을 수 없습니다: '${args.pathStart}'`);
          if (start.isDir)     throw new Error(`디렉터리는 복사할 수 없습니다: '${args.pathStart}'`);
          if (end.isFound)     throw new Error(`이미 파일이 존재합니다: '${args.pathEnd}'`);

          // 인덱싱시스템. 이미 있으면 test(1).txt 형태로 자동 변경 파일이름을 final(2024).txt이런거라고? 그건 사용자잘못이지
          //const finalPath = await resolveIndexedPath(end.fullPath);

          await fs.mkdir(path.dirname(end.fullPath), { recursive: true });
          await fs.copyFile(start.fullPath, end.fullPath);

          return { content: [{ type: "text", text: `✅ [복사 성공] ${args.pathStart} → ${args.pathEnd}` }]};
      }
      catch(error: any) { return { content: [{ type: "text", text: `❌ 실패: ${error.message}` }], isError: true }; }
    }
  },
  File_File_Move: {
    description: "[로컬 파일시스템] 파일을 이동합니다. (대상 : .txt, .log, .json, .md)",
    inputSchema: {
      type: "object",
      properties: {
        pathStart :  { type: "string", description: "이동할 대상의 파일 경로"},
        pathEnd   :  { type: "string", description: "이동할 위치 경로"},
      },
      required: ["pathStart", "pathEnd"]
    },
    handler: async(args: { pathStart: string, pathEnd: string }) => {
      try {
          const start  = await getSafePath(args.pathStart, 'file');
          const end = await getSafePath(args.pathEnd, 'file');

          if (!start.isFound)  throw new Error(`이동할 파일을 찾을 수 없습니다: '${args.pathStart}'`);
          if (start.isDir)     throw new Error(`디렉터리는 이동할 수 없습니다: '${args.pathStart}'`);
          if (end.isFound)     throw new Error(`이미 파일이 존재합니다: '${args.pathEnd}'`);

          await fs.mkdir(path.dirname(end.fullPath), { recursive: true });
          await fs.rename(start.fullPath, end.fullPath);

          return { content: [{ type: "text", text: `✅ [이동 성공] ${args.pathStart} → ${args.pathEnd}` }]};
      }
      catch(error: any) { return { content: [{ type: "text", text: `❌ 실패: ${error.message}` }], isError: true }; }
    }
  },
    //////////////////////////////////
   // #region Directory_Operations //
  //////////////////////////////////
  File_Dict_Indexer: {
    description: "C:\\MCP_InteractionSpace의 파일 및 디렉터리 구조를 스캔합니다.",
    inputSchema: {
      type: "object",
      properties: {
        directory: { type: "string", description: "스캔할 시작 폴더 (기본값: 루트)", default: "" },
        depth:     { type: "number", description: "탐색할 최대 깊이 (기본값: 3, 최대깊이 -1)", default: 3 }
      },
      required: [] 
    },
    handler: async (args: { directory?: string, depth?: number }) => {
      try {
        const { fullPath, isFound, isDir } = await getSafePath(args.directory || "", 'directory');
        if (isFound && isDir === false) { throw new Error("지정된 경로는 폴더가 아닌 파일입니다."); }
        const inputDepth = args.depth ?? 3;
        
        let maxDepth: number;
        if (inputDepth === -1) { maxDepth = Infinity; } else { maxDepth = Math.max(1, inputDepth); }

        let depthDisplay: string; 
        if (maxDepth === Infinity) { depthDisplay = "전체"; } else { depthDisplay = String(maxDepth); }

        const { tree, counter } = await buildTree(fullPath, maxDepth);
        const body    = tree || '비어 있음';
        const summary = `📊 [요약] 폴더: ${counter.dirs}개, 파일: ${counter.files}개`;

        return { 
          content: [{ 
            type: "text", 
            text: `🌐 [스캔 결과] - 시작: '${args.directory || 'Root'}' (최대 깊이: ${depthDisplay})\n\n${body}\n${summary}` 
          }] 
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 스캔 실패: ${error.message}` }], isError: true };
      }
    }
  },

  File_Dict_Create: {
    description: "[로컬 파일시스템] 새로운 폴더를 생성합니다.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "생성할 폴더의 상대 경로" }
      },
      required: ["path"]
    },
    handler: async (args: { path: string }) => {
      try {
        const { fullPath, isFound } = await getSafePath(args.path, 'directory');

        // 인덱싱: 이미 있으면 Test1(1) 형태로 자동 변경
        //const finalPath = isFound ? await resolveIndexedPath(fullPath) : fullPath;
        const finalPath = await resolveIndexedPath(fullPath);

        await fs.mkdir(finalPath, { recursive: true });

        const finalName = path.basename(finalPath);
        const inputName = path.basename(fullPath);
        const renamed   = finalName !== inputName ? ` (이름 변경: ${inputName} → ${finalName})` : '';

        return { content: [{ type: "text", text: `✅ [생성 성공] ${args.path}${renamed}` }] };
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 생성 실패: ${error.message}` }], isError: true };
      }
    }
  },

  File_Dict_Read: {
    description: "[로컬 파일시스템] 폴더의 메타데이터를 읽어옵니다.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "읽을 폴더의 상대 경로" }
      },
      required: ["path"]
    },
    handler: async (args: { path: string }) => {
      try {
        const { fullPath, isFound, isDir } = await getSafePath(args.path, 'directory');

        if (!isFound) throw new Error(`폴더를 찾을 수 없습니다: '${args.path}'`);
        if (!isDir)   throw new Error(`폴더가 아닙니다: '${args.path}'`);

        const stats   = await fs.stat(fullPath);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        let fileCount = 0;
        let dirCount  = 0;

        for (const entry of entries) {
            const entryPath = path.join(fullPath, entry.name);
            if (isInside(LOG_PATH, entryPath) || isInside(TRASH_PATH, entryPath)) continue;
            entry.isDirectory() ? dirCount++ : fileCount++;
        }

        const totalSize = await calcDirSize(fullPath);

        return { content: [{ type: "text", text:
            `[폴더 메타 정보]\n---\n` +
            `- 폴더명: ${path.basename(fullPath)}\n` +
            `- 생성일: ${stats.birthtime.toLocaleString()}\n` +
            `- 수정일: ${stats.mtime.toLocaleString()}\n` +
            `- 하위 폴더: ${dirCount}개\n` +
            `- 하위 파일: ${fileCount}개\n` +
            `- 전체 크기: ${(totalSize / 1024).toFixed(2)} KB`
        }]};
      } catch (error: any) {
        return { content: [{ type: "text", text: `❌ 읽기 실패: ${error.message}` }], isError: true };
      }
    }
  },

  File_Dict_Update: {
    description: "[로컬 파일시스템] 폴더를 이동하거나 이름을 변경합니다.",
    inputSchema: {
      type: "object",
      properties: {
        type:      { type: "string", enum: ["Move", "Rename"], description: "업데이트 타입" },
        pathStart: { type: "string", description: "현재 폴더 경로" },
        pathEnd:   { type: "string", description: "이동할 경로 또는 변경할 전체 경로" }
      },
      required: ["type", "pathStart", "pathEnd"]
    },
    handler: async (args: { type: F_DictUMode, pathStart: string, pathEnd: string }) => {
      try {
        const start = await getSafePath(args.pathStart, 'directory');
        const end   = await getSafePath(args.pathEnd, 'directory');

        if (!start.isFound) throw new Error(`폴더를 찾을 수 없습니다: '${args.pathStart}'`);
        if (!start.isDir)   throw new Error(`폴더가 아닙니다: '${args.pathStart}'`);

        if (start.fullPath === ROOT_PATH) throw new Error(`[보안 위반] ROOT 폴더는 이동/변경할 수 없습니다.`);
        if (start.fullPath === end.fullPath) throw new Error(`출발지와 목적지가 같습니다: '${args.pathStart}'`);
        if (end.isFound) throw new Error(`이미 존재하는 경로입니다: '${args.pathEnd}'`);

        await fs.mkdir(path.dirname(end.fullPath), { recursive: true });
        await fs.rename(start.fullPath, end.fullPath);

        return { content: [{ type: "text", text: `✅ [${args.type} 성공] ${args.pathStart} → ${args.pathEnd}` }]};
      } 
      catch (error: any) { return { content: [{ type: "text", text: `❌ 실패: ${error.message}` }], isError: true };}
    }
  },
  File_Dict_Delete: {
    description: "[로컬 파일시스템] 폴더를 휴지통으로 이동시킵니다.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "삭제할 폴더의 상대 경로" }
      },
      required: ["path"]
    },
    handler: async (args: { path: string }) => {
      try {
        const { fullPath, isFound, isDir } = await getSafePath(args.path, 'directory');

        if (!isFound) throw new Error(`삭제할 폴더를 찾을 수 없습니다: '${args.path}'`);
        if (!isDir)   throw new Error(`폴더가 아닙니다. (폴더 전용 도구)`);

        // ROOT 보호
        if (fullPath === ROOT_PATH) throw new Error(`[보안 위반] ROOT 폴더는 삭제할 수 없습니다.`);

        const dirName   = path.basename(fullPath);
        const trashPath = path.join(TRASH_PATH, `${Date.now()}_${dirName}`);

        await fs.mkdir(TRASH_PATH, { recursive: true });
        await fs.rename(fullPath, trashPath);

        return { content: [{ type: "text", text: `✅ [삭제 성공] 폴더가 휴지통으로 이동되었습니다: ${args.path}` }]};
      }
      catch (error: any) { return { content: [{ type: "text", text: `❌ 삭제 실패: ${error.message}` }], isError: true }; }
    }
  },
  File_Dict_Copy: {
    description: "[로컬 파일시스템] 폴더를 복사합니다.",
    inputSchema: {
      type: "object",
      properties: {
        pathStart: { type: "string", description: "복사할 폴더 경로" },
        pathEnd:   { type: "string", description: "복사할 위치 경로" }
      },
      required: ["pathStart", "pathEnd"]
    },
    handler: async (args: { pathStart: string, pathEnd: string }) => {
      try {
        const start = await getSafePath(args.pathStart, 'directory');
        const end   = await getSafePath(args.pathEnd, 'directory');

        if (!start.isFound) throw new Error(`폴더를 찾을 수 없습니다: '${args.pathStart}'`);
        if (!start.isDir)   throw new Error(`폴더가 아닙니다: '${args.pathStart}'`);
        if (start.fullPath === ROOT_PATH) throw new Error(`[보안 위반] ROOT 폴더는 복사할 수 없습니다.`);
        if (start.fullPath === end.fullPath) throw new Error(`출발지와 목적지가 같습니다: '${args.pathStart}'`);
        if (end.isFound)    throw new Error(`이미 존재하는 경로입니다: '${args.pathEnd}'`);

        await copyDir(start.fullPath, end.fullPath);

        return { content: [{ type: "text", text: `✅ [복사 성공] ${args.pathStart} → ${args.pathEnd}` }]};
      }
      catch (error: any) { return { content: [{ type: "text", text: `❌ 실패: ${error.message}` }], isError: true }; }
    }
  },
};


// 엑스트라 툴
type PathMode = 'file' | 'directory' | 'any';
interface SafePathResult {
  fullPath: string;       // 검증된 절대 경로
  isFound: boolean;       // 실제 존재 여부
  isDir: boolean | null;  // 디렉터리 여부 (존재할 경우)
}

const IndexedPath = (fullPath: string): string => {
    const ext  = path.extname(fullPath);
    const base = path.basename(fullPath, ext);
    const dir  = path.dirname(fullPath);

    const match = base.match(/^(.*)\((\d+)\)$/);
    const cleanBase = match?.[1] ?? base;
    const nextIndex = match?.[2] ? parseInt(match[2]) + 1 : 1;

    return path.join(dir, `${cleanBase}(${nextIndex})${ext}`);
}

const isInside = (parent: string, child: string): boolean => {
    const relative = path.relative(parent, child);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
};

async function resolveIndexedPath(fullPath: string): Promise<string> {
    let candidate = fullPath;
    while (true) {
        try {
            await fs.stat(candidate);
            candidate = IndexedPath(candidate);
        } 
        catch { return candidate; }
    }
}

async function getSafePath(userInput: string, mode: PathMode = 'any'): Promise<SafePathResult> {
    // 1. 입력값 정규화 (앞뒤 공백 제거 및 경로 교정)
    const normalizedInput = userInput.trim().replace(/\/+/g, path.sep);
    const resolvedPath = path.resolve(ROOT_PATH, normalizedInput);
    // 2. 경로 이탈 검증 & 경로경계 방어
    if (!isInside(ROOT_PATH, resolvedPath)) {
        throw new Error(`[보안 위반] 허용된 구역(${ROOT_PATH})을 벗어날 수 없습니다.`);
    }
    if (isInside(LOG_PATH, resolvedPath) || isInside(TRASH_PATH, resolvedPath)) {
        throw new Error(`[보안 위반] 시스템 보호 구역(${path.basename(resolvedPath)})에는 직접 접근할 수 없습니다.`);
    }
    // 3. 확장자 및 모드 검증
    /**
     * [ 검증 매트릭스 ]
     * -------------------------------------------------------------------------
     * MODE      | 확장자 필수 | 허용 목록 체크 | 비고
     * -------------------------------------------------------------------------
     * file      |    YES    |      YES      | 데이터 파일만 접근 허용 (.exe 등 차단)
     * directory |    NO     |      N/A      | 폴더명에 .txt 등 포함 금지 (구조 오염 방지)
     * any       |    FREE   |      NO       | 경로 이탈만 검증 (존재 여부 확인용 등)
     * -------------------------------------------------------------------------
     */
    const ext = path.extname(resolvedPath).toLowerCase();
    const allowedExtensions = ['.txt', '.log', '.json', '.md'];
    if (mode === 'file') {
        if (!ext) throw new Error(`[보안 위반] 파일 작업에는 확장자가 필요합니다.`);
        if (!allowedExtensions.includes(ext)) {
            throw new Error(`[보안 위반] 허용되지 않는 파일 형식(${ext})입니다.`);
        }
    } 
    else if (mode === 'directory') {
        // 1.윈도우에서 폴더/파일명에 절대 쓸 수 없는 예약 특수문자 차단
        // 2.폴더명 끝이 마침표나 공백으로 끝나는지 검사 
        const invalidWinChars = /[<>:"|?*]/;
        const baseName = path.basename(resolvedPath);
        
        if (invalidWinChars.test(baseName)) { throw new Error(`[보안 위반] 윈도우 폴더명에 사용할 수 없는 특수문자가 포함되어 있습니다: ${baseName}`); }
        if (baseName.endsWith('.') || baseName.endsWith(' ')) { throw new Error(`[보안 위반] 윈도우에서 폴더명은 마침표(.)나 공백으로 끝날 수 없습니다.`); }
    }

    // 4. 실제 디스크 상태 확인
    // 파일이 존재하는가?
    // 파일이 폴더인가 파일인가?
    let isFound = false;
    let isDir: boolean | null = null; 

    try {
        const stats = await fs.stat(resolvedPath);
        isFound = true;
        isDir = stats.isDirectory();
    } 
    catch {
        isFound = false;
        isDir = null; 
    }
    return { fullPath: resolvedPath, isFound, isDir };
}
async function buildTree(
    currentPath: string, 
    maxDepth: number, 
    currentDepth: number = 0, 
    indent: string = "",
    counter: { files: number, dirs: number } = { files: 0, dirs: 0 }
): Promise<{ tree: string, counter: { files: number, dirs: number } }> {
    
    if (currentDepth >= maxDepth) return { tree: "", counter };

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    let treeStr = "";

    for (const entry of entries) {
        const nextPath = path.join(currentPath, entry.name);
        const isDir = entry.isDirectory();

        if (isInside(LOG_PATH, nextPath) || isInside(TRASH_PATH, nextPath)) continue;
        treeStr += `${indent}${isDir ? '[DIR]' : '[FILE]'} ${entry.name}\n`;
        if (isDir) {
            counter.dirs++;
            if (isInside(ROOT_PATH, nextPath)) {
                const child = await buildTree(nextPath, maxDepth, currentDepth + 1, indent + "  │ ", counter);
                treeStr += child.tree;
            }
        } else {
            counter.files++;
        }
    }
    return { tree: treeStr, counter };
}
//warring 확장자 방어모듈 제외상태 이 메서드는 단일구간에서만 사용하고 재사용을 금함
async function calcDirSize(dirPath: string): Promise<number> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let total = 0;

    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (isInside(LOG_PATH, entryPath) || isInside(TRASH_PATH, entryPath)) continue;

        if (entry.isDirectory()) { total += await calcDirSize(entryPath); } 
        else {
            const s = await fs.stat(entryPath);
            total += s.size;
        }
    }
    return total;
}
// warning 확장자 방어모듈 제외상태 이 메서드는 단일구간에서만 사용하고 재사용을 금함
async function copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (isInside(LOG_PATH, srcPath) || isInside(TRASH_PATH, srcPath)) continue;

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}
/**
async function buildTreeLegacy(currentPath: string, maxDepth: number, currentDepth: number = 0, indent: string = ""): Promise<string> {
    // [추가] 깊이 제한: 설정한 깊이에 도달하면 더 이상 파고들지 않음
    if (currentDepth >= maxDepth) return "";

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    let treeStr = "";

    for (const entry of entries) {
        const nextPath = path.join(currentPath, entry.name);
        const isDir = entry.isDirectory();

        if (isInside(LOG_PATH, nextPath) || isInside(TRASH_PATH, nextPath)) continue;
        treeStr += `${indent}${isDir ? '[DIR]' : '[FILE]'} ${entry.name}\n`;
        if (isDir && isInside(ROOT_PATH, nextPath)) { treeStr += await buildTree(nextPath, maxDepth, currentDepth + 1, indent + "  │ ");}
    }
    return treeStr;
}

async function getSafePathLegacy(userInput: string): Promise<string> {
    // 1. 경로 이탈 검증 
    const resolvedPath = path.resolve(ROOT_PATH, userInput);
    if (!resolvedPath.startsWith(ROOT_PATH)) {
        throw new Error(`[보안 위반] 월권행위 감지: 허용된 구역을 벗어날 수 없습니다.`);
    }
    // 2. 파일 형식 검증 및 실행 차단(읽기만 가능)
    const ext = path.extname(resolvedPath).toLowerCase();
    const allowedExtensions = ['.txt', '.log', '.json', '.md']; // << 데이터 파일만 허용
    if (ext && !allowedExtensions.includes(ext)) {              // 폴더 조회(Indexer) 시에는 확장자가 없을 수 있으므로 체크
        throw new Error(`[보안 위반] 월권행위 감지: 파일 형식(${ext})입니다. 실행 시도나 비정상 접근으로 간주합니다.`);
    }
    return resolvedPath;
}

 */
