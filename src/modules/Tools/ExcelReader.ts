import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs'; 

export const readExcelFile = (fileName: string) => {
  const filePath = path.isAbsolute(fileName) 
    ? fileName 
    : path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ 파일 추적실패 : ${filePath}`);
    return []; 
  }

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      console.error("❌ 엑셀 시트 색인 불가.");
      return [];
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    return xlsx.utils.sheet_to_json(sheet);
  } 
  catch (error) {
    console.error("❌ 파일에 뭔짓을 한거야 ??:", error);
    return [];
  }
};