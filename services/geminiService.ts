import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SajuAnalysisResult, UserInput, Pillar } from "../types";
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
      luckyTable: aiResult.luckyTable
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
    
    [사용자 사주 정보]
    - 일간(나): ${sajuContext.dayPillar.stem}${sajuContext.dayPillar.branch} (일원)
    - 월지(사회궁): ${sajuContext.monthPillar.branch} (${sajuContext.monthPillar.branchTenGod})
    - 오행 분포: 목(${sajuContext.elementCounts.Wood}), 화(${sajuContext.elementCounts.Fire}), 토(${sajuContext.elementCounts.Earth}), 금(${sajuContext.elementCounts.Metal}), 수(${sajuContext.elementCounts.Water})
    - **가장 필요한 기운(용신/희신)**: ${missingStr}
    
    [작성 지침 - 중요]
    1. 사용자의 질문에 대해 **최소 2000자 이상**의 아주 상세하고 깊이 있는 답변을 작성하십시오.
    2. **시점 설정**:
       - **2025년**은 "지금까지 흘러온 운세" 혹은 "현재 겪고 있는 과도기"로 설명하십시오.
       - **2026년(병오년)** 이후를 **본격적인 미래의 대운**으로 설정하여, 앞으로 다가올 미래에 대한 구체적인 예측과 대비책을 제시하십시오.
       - 예시: "2025년까지는 이러하였으나, 다가오는 2026년부터는..."
    3. 답변 구조:
       - **[미래 운의 흐름]**: 2026년 이후 펼쳐질 대운의 흐름 분석
       - **[문제의 원인]**: 사주 원국에서 기인한 근본적인 원인
       - **[상세 해결책]**: 현실적인 조언과 풍수 비책 (미래 지향적)
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