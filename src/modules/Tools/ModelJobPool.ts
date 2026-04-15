import path from 'path';
import fsPromises from 'fs/promises';

const DB_DIR = 'C:\\GitHub\\MCP project\\Geocentrism\\data';
const POOL_PATH = path.join(DB_DIR, 'JobPool_Model.json');

export const JobPool = {
    // ✅ 내부 식별을 위한 type 추가
    async push(taskData: { taskId: string; folderPath: string; fileName: string; type: 'model' | 'texture' | 'concept';}) {
        await fsPromises.mkdir(DB_DIR, { recursive: true });
        let pool = [];
        try {
            const content = await fsPromises.readFile(POOL_PATH, 'utf-8');
            pool = JSON.parse(content || "[]"); 
        } 
        catch (e) { pool = []; }
        
        pool.push({ ...taskData, createdAt: new Date().toISOString() });
        await fsPromises.writeFile(POOL_PATH, JSON.stringify(pool, null, 2));
    },

    async read() {
        try {
            const content = await fsPromises.readFile(POOL_PATH, 'utf-8');
            return JSON.parse(content || "[]");
        } 
        catch (e) { return []; }
    },

    async remove(taskId: string) {
        let pool = await this.read();
        pool = pool.filter((t: any) => t.taskId !== taskId);
        await fsPromises.writeFile(POOL_PATH, JSON.stringify(pool, null, 2));
    }
};