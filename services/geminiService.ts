import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SajuAnalysisResult, UserInput, Pillar, DaeunEntry, SaeunEntry, WolunEntry } from "../types";
// @ts-ignore
import { Solar, Lunar } from "lunar-javascript";

let ai: GoogleGenAI | null = null;

export const setApiKey = (apiKey: string) => {
  ai = new GoogleGenAI({ apiKey });
  localStorage.setItem('gemini_api_key', apiKey);
};

export const getStoredApiKey = (): string | null => {
  return localStorage.getItem('gemini_api_key');
};

export const isApiKeySet = (): boolean => {
  return ai !== null;
};

// Initialize from localStorage if available
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
if (storedKey) {
  ai = new GoogleGenAI({ apiKey: storedKey });
}

// ---------------------------------------------------------------------------
// 1. Static Data & Lookup Tables
// ---------------------------------------------------------------------------

const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GAN_KOR = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const ZHI_KOR = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

type ElementType = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

const ELEMENT_MAP: Record<string, ElementType> = {
  "甲": "Wood", "乙": "Wood", "寅": "Wood", "卯": "Wood",
  "丙": "Fire", "丁": "Fire", "巳": "Fire", "午": "Fire",
  "戊": "Earth", "己": "Earth", "辰": "Earth", "戌": "Earth", "丑": "Earth", "未": "Earth",
  "庚": "Metal", "辛": "Metal", "申": "Metal", "酉": "Metal",
  "壬": "Water", "癸": "Water", "亥": "Water", "子": "Water",
};

const COLOR_MAP: Record<ElementType, string> = {
  "Wood": "#4A7c59", "Fire": "#D9534F", "Earth": "#Eebb4d", "Metal": "#Aaaaaa", "Water": "#292b2c"
};

// Ten Gods Lookup Table (Day Stem Index vs Target Stem Index)
// Rows: Day Stem (0=甲 ... 9=癸)
// Cols: Target Stem (0=甲 ... 9=癸)
const TEN_GODS_MAP = [
  // 甲(0) Day Master
  ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"],
  // 乙(1)
  ["겁재", "비견", "상관", "식신", "정재", "편재", "정관", "편관", "정인", "편인"],
  // 丙(2)
  ["편인", "정인", "비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관"],
  // 丁(3)
  ["정인", "편인", "겁재", "비견", "상관", "식신", "정재", "편재", "정관", "편관"],
  // 戊(4)
  ["편관", "정관", "편인", "정인", "비견", "겁재", "식신", "상관", "편재", "정재"],
  // 己(5)
  ["정관", "편관", "정인", "편인", "겁재", "비견", "상관", "식신", "정재", "편재"],
  // 庚(6)
  ["편재", "정재", "편관", "정관", "편인", "정인", "비견", "겁재", "식신", "상관"],
  // 辛(7)
  ["정재", "편재", "정관", "편관", "정인", "편인", "겁재", "비견", "상관", "식신"],
  // 壬(8)
  ["식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인", "비견", "겁재"],
  // 癸(9)
  ["상관", "식신", "정재", "편재", "정관", "편관", "정인", "편인", "겁재", "비견"],
];

// Mapping Branches to their "Main Qi" Stem for Ten God calculation
const BRANCH_MAIN_QI: Record<string, string> = {
  "子": "癸", "丑": "己", "寅": "甲", "卯": "乙", "辰": "戊", "巳": "丙",
  "午": "丁", "未": "己", "申": "庚", "酉": "辛", "戌": "戊", "亥": "壬"
};

// ---------------------------------------------------------------------------
// 2. Helper Functions
// ---------------------------------------------------------------------------

function getKoreanChar(hanja: string): string {
  const ganIdx = GAN.indexOf(hanja);
  if (ganIdx !== -1) return GAN_KOR[ganIdx];
  const zhiIdx = ZHI.indexOf(hanja);
  if (zhiIdx !== -1) return ZHI_KOR[zhiIdx];
  return "";
}

function getTenGod(dayStem: string, target: string): string {
  if (dayStem === target) return "비견"; // Should be handled, but just in case
  const dayIdx = GAN.indexOf(dayStem);
  
  // If target is a Branch, convert to Main Qi Stem
  let targetStem = target;
  if (ZHI.includes(target)) {
    targetStem = BRANCH_MAIN_QI[target];
  }
  
  const targetIdx = GAN.indexOf(targetStem);
  if (dayIdx === -1 || targetIdx === -1) return "";
  
  return TEN_GODS_MAP[dayIdx][targetIdx];
}

// 60갑자 인덱스 계산
function getGanZhiIndex(stem: string, branch: string): number {
  const ganIdx = GAN.indexOf(stem);
  const zhiIdx = ZHI.indexOf(branch);
  // 60갑자 인덱스 = (천간인덱스 * 12 + 지지인덱스) % 60 이 아니라
  // 갑자=0, 을축=1, ... 계해=59
  // 천간과 지지가 같은 음양일 때만 조합 가능
  for (let i = 0; i < 60; i++) {
    if (GAN[i % 10] === stem && ZHI[i % 12] === branch) {
      return i;
    }
  }
  return 0;
}

// 60갑자에서 천간/지지 가져오기
function getGanZhiFromIndex(index: number): { stem: string; branch: string } {
  const normalizedIndex = ((index % 60) + 60) % 60;
  return {
    stem: GAN[normalizedIndex % 10],
    branch: ZHI[normalizedIndex % 12]
  };
}

// 대운 계산 함수
function calculateDaeun(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  gender: 'male' | 'female',
  monthStem: string,
  monthBranch: string,
  yearStem: string
): { daeun: DaeunEntry[]; startAge: number } {
  // 양남음녀는 순행, 음남양녀는 역행
  const yearStemIdx = GAN.indexOf(yearStem);
  const isYangYear = yearStemIdx % 2 === 0; // 갑병무경임 = 양
  const isMale = gender === 'male';
  const isForward = (isYangYear && isMale) || (!isYangYear && !isMale);
  
  // 월주의 60갑자 인덱스
  const monthGanZhiIdx = getGanZhiIndex(monthStem, monthBranch);
  
  // 대운 시작 나이 계산 (간략화: 출생월 기준)
  // 실제로는 절기까지의 일수로 계산하지만, 여기서는 간략화
  // 출생월에 따라 대략적으로 계산 (생일이 해당 월 중순 기준)
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let daysToJeolgi = Math.round(daysInMonth[birthMonth - 1] / 2 - birthDay + 15);
  if (daysToJeolgi < 0) daysToJeolgi = Math.abs(daysToJeolgi);
  
  // 3일 = 1년으로 환산
  const startAge = Math.round((daysToJeolgi / 3) * 10) / 10;
  
  const daeunList: DaeunEntry[] = [];
  
  // 대운 13개 (0세~130세 커버)
  for (let i = 0; i < 13; i++) {
    const ganZhiIdx = isForward 
      ? monthGanZhiIdx + i + 1 
      : monthGanZhiIdx - i - 1;
    
    const { stem, branch } = getGanZhiFromIndex(ganZhiIdx);
    
    const ageStart = i === 0 ? startAge : Math.floor(startAge) + (i * 10);
    const ageEnd = Math.floor(startAge) + ((i + 1) * 10) - 1;
    
    daeunList.push({
      startAge: ageStart,
      endAge: ageEnd,
      stem,
      branch,
      stemKorean: getKoreanChar(stem),
      branchKorean: getKoreanChar(branch),
      startYear: birthYear + Math.floor(ageStart)
    });
  }
  
  return { daeun: daeunList, startAge };
}

// 세운 (연운) 계산 함수
function calculateSaeun(birthYear: number): SaeunEntry[] {
  const saeunList: SaeunEntry[] = [];
  
  // 1년부터 110세까지
  for (let age = 1; age <= 110; age++) {
    const currentYear = birthYear + age - 1; // 한국 나이 기준
    
    // 해당 연도의 천간/지지 계산
    // 갑자년 기준: 1984년이 갑자년
    const yearOffset = currentYear - 1984;
    const ganZhiIdx = ((yearOffset % 60) + 60) % 60;
    
    const stem = GAN[ganZhiIdx % 10];
    const branch = ZHI[ganZhiIdx % 12];
    
    saeunList.push({
      year: currentYear,
      age,
      stem,
      branch,
      stemKorean: getKoreanChar(stem),
      branchKorean: getKoreanChar(branch)
    });
  }
  
  return saeunList;
}

// 월운 계산 함수 (60갑자 전체)
function calculateWolun(birthYear: number): WolunEntry[] {
  const wolunList: WolunEntry[] = [];
  
  // 60갑자 = 5년치 (12개월 * 5년 = 60)
  // 여기서는 출생년도부터 60년치 월운 계산
  for (let yearOffset = 0; yearOffset < 60; yearOffset++) {
    const currentYear = birthYear + yearOffset;
    
    for (let monthNum = 1; monthNum <= 12; monthNum++) {
      // 월의 천간 계산: 연간에 따라 결정
      // 갑기년: 병인월(1월), 을경년: 무인월, 병신년: 경인월, 정임년: 임인월, 무계년: 갑인월
      const yearGanZhiIdx = ((currentYear - 1984) % 60 + 60) % 60;
      const yearGan = GAN[yearGanZhiIdx % 10];
      const yearGanIdx = GAN.indexOf(yearGan);
      
      // 인월(1월)의 천간 결정 규칙
      // 갑기년 -> 병인월, 을경년 -> 무인월, 병신년 -> 경인월, 정임년 -> 임인월, 무계년 -> 갑인월
      const monthStemStartIdx = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0][yearGanIdx]; // 인월 천간
      
      // 월의 천간: 인월부터 시작해서 순행
      const monthStemIdx = (monthStemStartIdx + monthNum - 1) % 10;
      const monthStem = GAN[monthStemIdx];
      
      // 월의 지지: 1월=인, 2월=묘, ... 12월=축
      const monthBranchIdx = (monthNum + 1) % 12; // 1월=인(2), 2월=묘(3)...
      const monthBranch = ZHI[monthBranchIdx];
      
      wolunList.push({
        year: currentYear,
        month: monthNum,
        stem: monthStem,
        branch: monthBranch,
        stemKorean: getKoreanChar(monthStem),
        branchKorean: getKoreanChar(monthBranch)
      });
    }
  }
  
  return wolunList;
}

// ---------------------------------------------------------------------------
// 3. Main Analysis Logic
// ---------------------------------------------------------------------------

export const analyzeSaju = async (input: UserInput): Promise<SajuAnalysisResult> => {
  // 1. Calculate Pillars LOCALLY (Deterministic)
  const [year, month, day] = input.birthDate.split('-').map(Number);
  const [hour, minute] = input.birthTime.split(':').map(Number);

  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  const baZi = lunar.getEightChar();

  const yearStem = baZi.getYearGan();
  const yearBranch = baZi.getYearZhi();
  const monthStem = baZi.getMonthGan();
  const monthBranch = baZi.getMonthZhi();
  const dayStem = baZi.getDayGan();
  const dayBranch = baZi.getDayZhi();
  const hourStem = baZi.getTimeGan();
  const hourBranch = baZi.getTimeZhi();

  // 2. Element Counting
  const allChars = [yearStem, yearBranch, monthStem, monthBranch, dayStem, dayBranch, hourStem, hourBranch];
  const counts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  
  allChars.forEach(char => {
    const el = ELEMENT_MAP[char];
    if (el) counts[el]++;
  });

  // 3. Construct Pillar Objects
  const createPillar = (stem: string, branch: string): Pillar => ({
    stem,
    stemKorean: getKoreanChar(stem),
    stemTenGod: stem === dayStem ? "일원" : getTenGod(dayStem, stem),
    branch,
    branchKorean: getKoreanChar(branch),
    branchTenGod: getTenGod(dayStem, branch),
    element: ELEMENT_MAP[stem] || "Earth", // Simplified for UI color
    color: COLOR_MAP[ELEMENT_MAP[stem]]
  });

  const yearPillar = createPillar(yearStem, yearBranch);
  const monthPillar = createPillar(monthStem, monthBranch);
  const dayPillar = createPillar(dayStem, dayBranch);
  const hourPillar = createPillar(hourStem, hourBranch);

  // 4. Determine Missing/Priority Elements
  const missing = [];
  
  const promptContext = `
    [확정된 사주 원국]
    년주: ${yearStem}${yearBranch} (${yearPillar.stemTenGod}, ${yearPillar.branchTenGod})
    월주: ${monthStem}${monthBranch} (${monthPillar.stemTenGod}, ${monthPillar.branchTenGod})
    일주: ${dayStem}${dayBranch} (본원, ${dayPillar.branchTenGod})
    시주: ${hourStem}${hourBranch} (${hourPillar.stemTenGod}, ${hourPillar.branchTenGod})
    
    [오행 개수]
    목: ${counts.Wood}, 화: ${counts.Fire}, 토: ${counts.Earth}, 금: ${counts.Metal}, 수: ${counts.Water}
  `;

  const model = "gemini-2.5-flash";
  const prompt = `
    당신은 40년 경력의 정통 명리학자 '천기 도사'입니다.
    
    ${promptContext}
    
    사용자 정보:
    - 이름: ${input.name}
    - 성별: ${input.gender === 'male' ? '남성' : '여성'}
    
    [지시사항]
    1. 오행 개수를 보고 **부족하거나(0개) 가장 필요한 기운**을 1순위, 2순위로 선정하십시오. (예: 1순위 목, 2순위 화)
    2. **2026년(병오년)의 미래 운세**를 아주 구체적으로 분석하십시오.
       - **중요**: 2025년은 이미 지나온 과거의 흐름이나 현재의 기반을 닦는 시기로 짧게 언급만 하고, **분석의 90% 이상을 2026년 이후의 미래 예측**에 집중하십시오.
    3. 일간(${dayStem})을 중심으로 타고난 기질을 분석하십시오.
    4. 텍스트는 **상당히 상세하고 길게(각 항목별 500자 이상)** 작성하십시오.
    
    [건강운(healthAnalysis) 작성 지침]
    - 이 부분만큼은 사주 명리학 지식과 **'현대 의학 박사(Medical Doctor)'**의 전문 지식을 결합하여 작성하십시오.
    - 사주의 오행 불균형(예: 수가 부족하면 신장/방광, 화가 과하면 심혈관 등)을 분석하여 **가장 취약한 장기**를 지목하십시오.
    - 예상되는 증상을 설명하고, 전문의로서 **구체적인 생활 관리법, 운동 처방, 필수 섭취해야 할 물의 양이나 영양소** 등을 아주 상세히 처방하십시오.
    - 말투는 신뢰감 있는 의사 선생님처럼 작성하십시오.
    
    [길일표 작성 시 주의사항 - 중요]
    - **'날짜(Date)'**는 월과 일을 하나로 합쳐서 표기하십시오.
    - 반드시 **"3월 15일 (갑자일)"** 처럼 **구체적인 양력 날짜와 간지**를 함께 적으십시오.
    - 2026년 달력을 기준으로 실제 존재하는 정확한 날짜를 선정하십시오.
    
    [JSON 포맷 준수]
    - missingElements 배열에는 반드시 1순위, 2순위 요소를 담으세요.
  `;

  const SAJU_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
      dayMasterReading: { type: Type.STRING },
      missingElements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            element: { type: Type.STRING },
            priority: { type: Type.NUMBER },
          }
        }
      },
      chaeumAdvice: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          color: { type: Type.STRING },
          direction: { type: Type.STRING },
          items: { type: Type.STRING },
        },
        required: ["summary", "color", "direction", "items"]
      },
      healthAnalysis: {
        type: Type.OBJECT,
        properties: {
          weakOrgans: { type: Type.STRING, description: "사주상 취약한 장기" },
          symptoms: { type: Type.STRING, description: "주요 증상" },
          medicalAdvice: { type: Type.STRING, description: "전문의 상세 처방" },
          foodRecommendation: { type: Type.STRING, description: "추천 음식" },
        },
        required: ["weakOrgans", "symptoms", "medicalAdvice", "foodRecommendation"]
      },
      fortune2026: {
        type: Type.OBJECT,
        properties: {
          overall: { type: Type.STRING },
          wealth: { type: Type.STRING },
          career: { type: Type.STRING },
          health: { type: Type.STRING },
          love: { type: Type.STRING },
        },
        required: ["overall", "wealth", "career", "health", "love"],
      },
      luckyTable: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "구체적인 날짜와 간지 (예: 3월 15일 (갑자일))" },
            time: { type: Type.STRING },
            direction: { type: Type.STRING },
          }
        }
      }
    },
    required: ["dayMasterReading", "missingElements", "chaeumAdvice", "healthAnalysis", "fortune2026", "luckyTable"]
  };

  try {
    const response = await ai!.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SAJU_SCHEMA,
        temperature: 0.3,
      },
    });

    if (!response.text) throw new Error("No response");
    
    const aiResult = JSON.parse(response.text);

    // 대운, 세운, 월운 계산
    const { daeun, startAge } = calculateDaeun(year, month, day, input.gender, monthStem, monthBranch, yearStem);
    const saeun = calculateSaeun(year);
    const wolun = calculateWolun(year);

    return {
      yearPillar,
      monthPillar,
      dayPillar,
      hourPillar,
      elementCounts: counts,
      missingElements: aiResult.missingElements,
      dayMasterReading: aiResult.dayMasterReading,
      chaeumAdvice: aiResult.chaeumAdvice,
      healthAnalysis: aiResult.healthAnalysis,
      fortune2026: aiResult.fortune2026,
      luckyTable: aiResult.luckyTable,
      daeun,
      saeun,
      wolun,
      birthYear: year,
      birthMonth: month,
      daeunStartAge: startAge
    };

  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const consultSaju = async (
  question: string,
  sajuContext: SajuAnalysisResult,
  chatHistory: { role: string; parts: { text: string }[] }[]
): Promise<string> => {
  const model = "gemini-2.5-flash";
  
  const missingStr = sajuContext.missingElements.map(m => `${m.priority}순위 ${m.element}`).join(', ');
  
  // Adjusted system context to focus on 2026 as future
  const systemContext = `
    역할: 당신은 '천기 도사'입니다. AI가 아닙니다.
    
    [현재 시점 - 매우 중요]
    - **오늘 날짜: 2025년 12월**
    - **"내년"은 반드시 2026년(병오년)**을 의미합니다.
    - **"올해"는 2025년(을사년)**을 의미합니다.
    - 사용자가 "내년"이라고 말하면 무조건 **2026년**으로 해석하십시오.
    
    [사용자 사주 정보]
    - 일간(나): ${sajuContext.dayPillar.stem}${sajuContext.dayPillar.branch} (일원)
    - 월지(사회궁): ${sajuContext.monthPillar.branch} (${sajuContext.monthPillar.branchTenGod})
    - 오행 분포: 목(${sajuContext.elementCounts.Wood}), 화(${sajuContext.elementCounts.Fire}), 토(${sajuContext.elementCounts.Earth}), 금(${sajuContext.elementCounts.Metal}), 수(${sajuContext.elementCounts.Water})
    - **가장 필요한 기운(용신/희신)**: ${missingStr}
    
    [작성 지침 - 중요]
    1. 사용자의 질문에 대해 **최소 2000자 이상**의 아주 상세하고 깊이 있는 답변을 작성하십시오.
    2. **시점 설정 (필수 준수)**:
       - 사용자가 "내년"이라고 하면 **반드시 2026년(병오년)**에 대해 답하십시오.
       - 2025년은 현재이므로 간략히 언급만 하고, **답변의 90% 이상을 2026년 분석**에 집중하십시오.
       - "내년(2026년 병오년)에는..." 형태로 명시적으로 연도를 표기하십시오.
    3. 답변 구조:
       - **[2026년 병오년 운세 분석]**: 2026년에 펼쳐질 운세 상세 분석
       - **[문제의 원인]**: 사주 원국에서 기인한 근본적인 원인
       - **[상세 해결책]**: 현실적인 조언과 풍수 비책
       - **[결론 및 축원]**: 요약 및 덕담
    4. 말투: 매우 점잖고 권위 있는 도사님의 말투 (~하게나, ~일세, ~보이는구려).
  `;
  
  const adjustedHistory = [...chatHistory];
  if (adjustedHistory.length > 0 && adjustedHistory[0].role === 'model') {
    adjustedHistory.unshift({ role: 'user', parts: [{ text: '도사님, 제 사주 결과를 알려주십시오.' }] });
  }

  try {
    const chat = ai!.chats.create({
      model,
      config: {
        systemInstruction: systemContext,
      },
      history: adjustedHistory,
    });

    const result = await chat.sendMessage({ message: question });
    return result.text || "답변을 생성하지 못했습니다.";
  } catch (error) {
    console.error(error);
    throw error;
  }
};