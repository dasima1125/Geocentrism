# 🏗️ Geocentrism
> **Custom MCP Server for Automated 3D Game Asset Generation**

[![npm version](https://img.shields.io/badge/npm-v1.0.1-blue.svg)](https://www.npmjs.com/)
[![Node.js Version](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**생성형 AI 시스템을 활용하여 게임 제작에 필요한 3D 모델과 텍스처를 간단하고 편리하게 생성하고, 이를 로컬 작업 공간에 즉시 적용할 수 있도록 돕는 커스텀 MCP 서버입니다

<sub>*이 시스템은 초기 버전이자 기술 실증(Proof of Concept)을 목적으로 설계되었습니다. 입문 프로젝트로서 구조적인 실험 단계에 있으며, 향후 보다 진보된 아키텍처를 가진 프로젝트를 위한 토대가 될 예정입니다.*</sub>

---

## 📋 Table of Contents
- [01. 개요 (Overview)](#01-개요-overview)
- [02. 핵심 기능 (Key Features)](#02-핵심-기능-key-features)
- [03. 시작하기 (Get Started)](#03-시작하기-get-started)
- [04. 하베스터 공정 (Pipeline Architecture)](#04-하베스터-공정-pipeline-architecture)
- [05. 버전 기록 (Changelog)](#05-버전-기록-changelog)

## 01. 개요 (Overview)

> **Geocentrism**은 파편화된 생성형 AI 에셋 제작 공정을 MCP 환경 내에서 하나로 통합하는 기술 실증용 서버입니다. 
> 이미지나 모델, 텍스처 등 다양한 에셋의 생성부터 로컬 저장소로의 **수확(Harvesting)**까지 이어지는 자동화 파이프라인 구축에 집중합니다.

* **🛡️ 진입로 통일 및 안전장치**: 모든 에셋 생성 요청을 인덱스(Index) 단계에서 단일화된 경로로 제어하고, 예외 처리를 통해 안정성을 보장합니다.
* **🚜 자동화된 자산 수확**: 생성된 에셋의 링크를 시스템에 등록한 뒤, 전용 명령을 통해 로컬 저장소로 일괄 수확하여 처리합니다.
* **📦 워크스페이스 격리**: 에셋별 독립적인 작업 공간을 할당하여 데이터 간 간섭을 차단하고 작업 이력을 개별 제어합니다.
* **📂 자체 파일 시스템 구현**: 에셋별 고유 폴더 구조와 사본 관리 로직을 통해 로컬 데이터를 최적화된 상태로 유지합니다.

<br>

## 01-1. External Resources & Engines
본 프로젝트의 공정 가동을 위해 아래 서비스들의 API 권한이 필요합니다.

* **[Pollinations.ai](https://pollinations.ai/)**: 2D 컨셉 이미지 생성 엔진 (Flux 기반)
* **[Meshy.ai](https://www.meshy.ai/)**: 3D 모델링 및 텍스처링 엔진
* **[Model Context Protocol](https://modelcontextprotocol.io/)**: Anthropic의 에이전틱 서버 표준 규격
* **[공공데이터포털](https://www.data.go.kr/)**: 한국 기상청 단기예보 API 서비스 <sub>*(해당 기능은 MCP 테스트용이며, 인덱스에서 모듈 사용 해제 시 시스템 영향 없이 제거 가능합니다.)*</sub>

## 01-2. Tech Stack & Libraries

### ⚙️ Core System
* **Runtime**: [![Node.js Version](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org/)
* **Language**: [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

### 🛠️ External Libraries
* **MCP SDK**: [![MCP SDK](https://img.shields.io/badge/MCP--SDK-v1.29.0-orange)](https://modelcontextprotocol.io/)
* **Network**: [![Axios](https://img.shields.io/badge/Axios-5A29E4?style=flat&logo=axios&logoColor=white)](https://axios-http.com/)
* **Security**: [![Dotenv](https://img.shields.io/badge/Dotenv-ECD53F?style=flat&logo=dotenv&logoColor=black)](https://github.com/motdotla/dotenv)

<br>

## 02. 핵심 기능 (Key Features)  


### 🛡️ Index (접근부)
>서버 가용성 보장 및 통신 규격 최적화를 위해 클라이언트와 내부 모듈 사이의 관제 레이어 역할을 수행합니다.
* **출고 검수 버퍼**
    > 비동기 모듈 로딩 시 발생할 수 있는 '도구 누락'을 방지하기 위해 필수 도구(`ESSENTIAL_TOOLS`)가 메모리에 완전히 적재될 때까지 최대 10회 재검토 후 가동합니다.
* **스키마 가드너**
    > 클라이언트(Claude 등)의 인식률을 높이기 위해 `inputSchema`의 필수 필드(`properties`, `required`)를 강제 규격화하여 리턴합니다.
* **페이로드 디버거**
    > 송출되는 데이터의 JSON 크기를 바이트 단위로 측정하여 네트워크 부하를 실시간 모니터링합니다.

<br>

### ☀️ Module_Weather (한국 기상청 API)

* **초단기 실황 조회**
    > 현재 시점의 실제 기상 관측 데이터(기온, 강수량, 풍향, 풍속 등)를 수집합니다.
* **초단기 예보 조회**
    > 현재부터 향후 6시간 동안의 기상 변화 추이(하늘 상태, 강수 형태, 1시간 단위 예상 강수량, 기온 변화 등)를 시간 단위로 파악합니다.
* **단기 예보 조회**
    > 오늘부터 모레까지의 상세 동네 예보 데이터(3시간 단위 기온, 강수 확률, 강수 형태, 하늘 상태, 풍속, 풍향, 습도 등)를 수집합니다.
* **지역 좌표 추출기**
    > 자연어 주소(예: 서울 강남구)를 기상청 격자 좌표(nx, ny)로 변환합니다.
* **데이터 동기화 검증기**
    > 기상청 서버의 데이터 업데이트 버전을 대조하여 최신성을 확인합니다.

<br>

### 📁 Module_File (파일 시스템)   

<sub>*사용 주의 (Technical Advisory) > 본 모듈은 현재 기술 실증(PoC) 단계로, 복잡한 로컬 경로 및 권한 환경에서 보안/오류 이슈가 발생할 수 있습니다. 안정적인 작업을 위해 공식 MCP Filesystem 사용을 우선 권장하며, 본 시스템은 차후 아키텍처 개선을 통해 업데이트될 예정입니다.*</sub>
* **파일 제어**
    > - 파일 생성 (Create) : File_File_Create
    > - 파일 조회 (Read) : File_File_Read (20KB Limit / Metadata 지원)
    > - 파일 갱신 (Update) : File_File_Update (Overwrite / Append 지원)
    > - 파일 제거 (Delete) : File_File_Delete (SystemTrash 이전 직접삭제X)
    > - 파일 파생 (Copy/Move) : File_File_Copy, File_File_Move
* **디렉터리 제어**
    > - 디렉터리 분석 (Read/Index) : File_Dict_Indexer, File_Dict_Read
    > - 디렉터리 생성 (Create) : File_Dict_Create (Auto-Indexing 지원)
    > - 디렉터리 변경 (Update) : File_Dict_Update (Rename / Move 지원)
    > - 디렉터리 제거 (Delete) : File_Dict_Delete (SystemTrash 일괄 이전)
    > - 디렉터리 복제 (Copy) : File_Dict_Copy

<br>

### 🎨 Module_Image (생성형 에셋)

* **컨셉 이미지 생성**
    > Pollinations.ai(Flux 모델)를 통해 low-poly 게임 에셋 스타일의 컨셉 이미지를 생성하고, 작업 풀에 등록합니다.
* **이미지 → 3D 변환**
    > 로컬 이미지를 Meshy.ai에 전송하여 3D 모델(.glb)로 변환합니다. standard / lowpoly 품질 선택 및 목표 폴리곤 수 지정이 가능하며, 변환 시 에셋별 독립 작업 공간을 자동 생성합니다.
* **이미지 기반 텍스처 생성 **
    > 기존 3D 모델에 참조 이미지 스타일을 적용하여 PBR 텍스처를 생성합니다. 원본 UV 없이도 동작하며 결과물은 .glb로 저장됩니다.
* **에셋 수확**
    > 작업 풀에 등록된 모든 태스크의 완료 여부를 병렬로 확인하고, 준비된 에셋을 백그라운드에서 로컬로 즉시 다운로드합니다.

<br>
    
## 03. 시작하기

### 1. Requirements
| 환경 | 최소 사양 | 비고 |
| :--- | :--- | :--- |
| **Node.js** | 18.x 이상 | LTS 버전 권장 |
| **Protocol** | MCP | Model Context Protocol 환경 |

### 2. Quick Setup
<sub>*각 모듈은 독립적이며 메인인덱스에서 사용하실꺼만 넣으셔도됩니다.*</sub>
환경 변수(`.env`)를 설정하고 공장을 가동하십시오.

# 기상청 단기예보 서비스 키 (Encoding/Decoding 확인 필요)
SERVICE_KEY_Weather=YOUR_KOREA_WEATHER_KEY

# Google Gemini API Key (에이전트 판단 중추)
SERVICE_KEY_MCPCORE=YOUR_GEMINI_API_KEY

# Pollinations.ai API Key (컨셉 이미지 생성용)
SERVICE_KEY_pollinations=YOUR_POLLINATIONS_KEY

# Meshy.ai API Key (3D 에셋 변환용)
SERVICE_KEY_MESHAI=YOUR_MESHY_API_KEY

```bash
# 1. 레포지토리 클론
git clone [https://github.com/your-repo/geocentrism.git](https://github.com/your-repo/geocentrism.git)

# 2. 의존성 설치 및 빌드
npm install && npm run build

# 3. 하베스터 런칭
npx @modelcontextprotocol/inspector dist/index.js
