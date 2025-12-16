import React, { useState, useRef, useEffect } from 'react';
import { UserInput, SajuAnalysisResult, ChatMessage } from './types';
import { analyzeSaju, consultSaju, setApiKey, getStoredApiKey, isApiKeySet } from './services/geminiService';
import PillarCard from './components/PillarCard';
import LoadingSpinner from './components/LoadingSpinner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  // State
  const [input, setInput] = useState<UserInput>({
    name: '',
    birthDate: '',
    birthTime: '',
    gender: 'male',
  });
  const [sajuResult, setSajuResult] = useState<SajuAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // API Key State
  const [apiKey, setApiKeyState] = useState('');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  
  // Load stored API key on mount
  useEffect(() => {
    const storedKey = getStoredApiKey();
    if (storedKey) {
      setApiKeyState(storedKey);
      setIsApiKeySaved(true);
    }
  }, []);
  
  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // PDF Export State
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfContent, setPdfContent] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  // Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInput(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.birthDate || !input.birthTime || !input.name) return;
    
    if (!isApiKeySaved || !apiKey.trim()) {
      alert("Gemini API 키를 먼저 입력하고 저장해주세요.");
      return;
    }

    setIsAnalyzing(true);
    if (window.innerWidth < 768) setShowSidebar(false); // Auto close sidebar on mobile

    try {
      const result = await analyzeSaju(input);
      setSajuResult(result);
      
      // Formatting missing elements for the intro message
      const missingText = result.missingElements.map(m => `${m.priority}순위 ${m.element}`).join(', ');

      setChatMessages([
        {
          id: 'init',
          role: 'model',
          text: `반갑네, ${input.name}. 내 자네의 사주를 짚어보니 ${missingText} 기운이 가장 시급하구려. 이를 채우면 대박이 날 터이니, 궁금한 것이 있다면 상세히 물어보게나.`
        }
      ]);
    } catch (error) {
      alert("분석 중 오류가 발생했습니다. 생년월일을 다시 확인해주세요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !sajuResult) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const apiHistory = chatMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
      const answer = await consultSaju(userMsg.text, sajuResult, apiHistory);
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: answer }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "도사님이 잠시 출타중이십니다. 다시 말씀해 주시지요.", isError: true }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // PDF 내용 생성 함수
  const generatePdfContent = () => {
    if (!sajuResult || !input.name) return '';
    
    const missingText = sajuResult.missingElements.map(m => `${m.priority}순위: ${m.element}`).join(', ');
    
    let content = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            🔮 천기누설 (天機漏洩) 사주 분석서 🔮
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 기본 정보
────────────────────────────────────────
• 성명: ${input.name}
• 성별: ${input.gender === 'male' ? '남성' : '여성'}
• 생년월일: ${input.birthDate}
• 출생시각: ${input.birthTime}

📊 사주 원국 (四柱 原局)
────────────────────────────────────────
• 년주 (年柱): ${sajuResult.yearPillar.stem}${sajuResult.yearPillar.branch} (${sajuResult.yearPillar.stemKorean}${sajuResult.yearPillar.branchKorean})
• 월주 (月柱): ${sajuResult.monthPillar.stem}${sajuResult.monthPillar.branch} (${sajuResult.monthPillar.stemKorean}${sajuResult.monthPillar.branchKorean})
• 일주 (日柱): ${sajuResult.dayPillar.stem}${sajuResult.dayPillar.branch} (${sajuResult.dayPillar.stemKorean}${sajuResult.dayPillar.branchKorean})
• 시주 (時柱): ${sajuResult.hourPillar.stem}${sajuResult.hourPillar.branch} (${sajuResult.hourPillar.stemKorean}${sajuResult.hourPillar.branchKorean})

🌿 오행 분포
────────────────────────────────────────
목(木): ${sajuResult.elementCounts.Wood}개 | 화(火): ${sajuResult.elementCounts.Fire}개 | 토(土): ${sajuResult.elementCounts.Earth}개 | 금(金): ${sajuResult.elementCounts.Metal}개 | 수(水): ${sajuResult.elementCounts.Water}개

⚡ 부족한 기운 (용신/희신)
────────────────────────────────────────
${missingText}

📈 대운 (大運) - 10년 주기
────────────────────────────────────────
${sajuResult.daeun.slice(0, 10).map(d => `${Math.floor(d.startAge)}~${d.endAge}세: ${d.stem}${d.branch}(${d.stemKorean}${d.branchKorean}) [${d.startYear}년~]`).join('\n')}

📅 세운 (歲運) - 최근 10년
────────────────────────────────────────
${sajuResult.saeun.filter(s => s.year >= new Date().getFullYear() - 2 && s.year <= new Date().getFullYear() + 7).map(s => `${s.year}년(${s.age}세): ${s.stem}${s.branch}(${s.stemKorean}${s.branchKorean})`).join(' | ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    1. 타고난 기질 (일간 분석)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sajuResult.dayMasterReading}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    2. 채움 비책 (부족한 기운 보충법)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 추천 색상
${sajuResult.chaeumAdvice.colors}

📍 추천 방위
${sajuResult.chaeumAdvice.directions}

🍀 행운 숫자
${sajuResult.chaeumAdvice.numbers}

💼 추천 직업/업종
${sajuResult.chaeumAdvice.careers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    3. 건강 분석 (의학 박사의 처방)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ 취약 장기
${sajuResult.healthAnalysis.weakOrgans}

🩹 예상 증상
${sajuResult.healthAnalysis.symptoms}

📋 전문의 상세 처방
${sajuResult.healthAnalysis.medicalAdvice}

🥗 추천 식이요법
${sajuResult.healthAnalysis.foodRecommendation}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    4. 2026년 (병오년) 대박 운세
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 총운
${sajuResult.fortune2026.overall}

💰 재물운
${sajuResult.fortune2026.wealth}

💼 직업/사업운
${sajuResult.fortune2026.career}

❤️ 애정/가정운
${sajuResult.fortune2026.love}

💊 건강운
${sajuResult.fortune2026.health}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    5. 귀인과 길일 (2026년 행운의 시간표)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

    sajuResult.luckyTable.forEach((row, index) => {
      content += `${index + 1}. ${row.date} | ${row.time} | ${row.direction}\n`;
    });

    // 채팅 내역 추가
    if (chatMessages.length > 0) {
      content += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    📝 상담 내역
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
      chatMessages.forEach(msg => {
        const speaker = msg.role === 'user' ? `[${input.name}]` : '[천기 도사]';
        content += `${speaker}\n${msg.text}\n\n────────────────────────────────────────\n\n`;
      });
    }

    content += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        🙏 천기누설 정통 사주·풍수 감정원 🙏
              작성일: ${new Date().toLocaleDateString('ko-KR')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    return content;
  };

  // PDF 모달 열기
  const openPdfModal = () => {
    const content = generatePdfContent();
    setPdfContent(content);
    setShowPdfModal(true);
  };

  // PDF 다운로드
  const downloadPdf = async () => {
    setIsGeneratingPdf(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const lineHeight = 6;
      let yPosition = margin;
      
      // 폰트 설정 (한글 지원을 위해 기본 폰트 사용)
      pdf.setFont('helvetica');
      
      const lines = pdfContent.split('\n');
      
      for (const line of lines) {
        // 페이지 넘김 체크
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        
        // 제목 스타일 (━ 포함된 라인)
        if (line.includes('━━━')) {
          pdf.setFontSize(8);
          pdf.setTextColor(100, 100, 100);
        } else if (line.includes('🔮') || line.includes('📋') || line.includes('📊') || line.includes('🌿') || line.includes('⚡')) {
          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setFontSize(10);
          pdf.setTextColor(50, 50, 50);
          pdf.setFont('helvetica', 'normal');
        }
        
        // 긴 텍스트는 여러 줄로 분할
        const splitLines = pdf.splitTextToSize(line, pageWidth - (margin * 2));
        
        for (const splitLine of splitLines) {
          if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(splitLine, margin, yPosition);
          yPosition += lineHeight;
        }
      }
      
      pdf.save(`천기누설_사주분석_${input.name}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 텍스트 파일로 다운로드 (한글 완벽 지원)
  const downloadText = () => {
    const blob = new Blob([pdfContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `천기누설_사주분석_${input.name}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-oriental-paper font-sans text-oriental-black overflow-hidden">
      
      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden fixed top-4 right-4 z-50 bg-oriental-black text-white p-2 rounded-full shadow-lg"
      >
        {showSidebar ? '✕' : '☰'}
      </button>

      {/* Sidebar (Input Area) */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-full md:w-80 bg-white border-r border-oriental-gold/20 shadow-xl transition-transform duration-300 ease-in-out transform
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        overflow-y-auto
      `}>
        <div className="p-6">
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-3xl">📜</span>
            <div>
              <h1 className="font-serif font-bold text-xl leading-none">천기누설</h1>
              <p className="text-xs text-gray-500 mt-1">정통 사주 · 풍수 감정원</p>
            </div>
          </div>

          {/* API Key Input */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm">🔑</span>
              <label className="text-xs font-bold text-gray-600">Gemini API Key</label>
            </div>
            <div className="flex space-x-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKeyState(e.target.value);
                  setIsApiKeySaved(false);
                }}
                className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:border-oriental-gold outline-none transition-colors"
                placeholder="API 키를 입력하세요"
              />
              <button
                type="button"
                onClick={() => {
                  if (apiKey.trim()) {
                    setApiKey(apiKey.trim());
                    setIsApiKeySaved(true);
                  }
                }}
                className="px-3 py-2 bg-red-700 text-white text-sm font-medium rounded-md hover:bg-red-800 transition-colors"
              >
                저장
              </button>
            </div>
            {isApiKeySaved && (
              <p className="text-xs text-green-600 mt-1.5 flex items-center">
                <span className="mr-1">✓</span> 저장됨
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">성명 (姓名)</label>
              <input
                type="text"
                name="name"
                value={input.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:border-oriental-gold outline-none transition-colors"
                placeholder="홍길동"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">생년월일 (양력)</label>
              <input
                type="date"
                name="birthDate"
                value={input.birthDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:border-oriental-gold outline-none transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">태어난 시각</label>
              <input
                type="time"
                name="birthTime"
                value={input.birthTime}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:border-oriental-gold outline-none transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">성별</label>
              <div className="flex bg-gray-50 p-1 rounded-md">
                <label className={`flex-1 text-center py-1.5 rounded text-sm cursor-pointer transition-colors ${input.gender === 'male' ? 'bg-white shadow-sm font-bold text-oriental-black' : 'text-gray-400'}`}>
                  <input type="radio" name="gender" value="male" className="hidden" checked={input.gender === 'male'} onChange={handleInputChange} />
                  남성
                </label>
                <label className={`flex-1 text-center py-1.5 rounded text-sm cursor-pointer transition-colors ${input.gender === 'female' ? 'bg-white shadow-sm font-bold text-oriental-black' : 'text-gray-400'}`}>
                  <input type="radio" name="gender" value="female" className="hidden" checked={input.gender === 'female'} onChange={handleInputChange} />
                  여성
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-oriental-black text-white font-serif py-3 rounded-md hover:bg-gray-800 transition-all shadow-md transform active:scale-95 flex items-center justify-center space-x-2"
            >
              <span>운명 감정 받기</span>
              <span>➤</span>
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed text-center">
              "천기(天機)를 알면<br/>백전백승(百戰百勝)이라."
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-screen relative">
        {!sajuResult && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-60">
            <div className="w-32 h-32 bg-oriental-gold/10 rounded-full flex items-center justify-center mb-6">
              <span className="text-5xl">☯️</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-gray-700 mb-2">천기누설 (天機漏洩)</h2>
            <p className="text-gray-500 max-w-sm">
              왼쪽에서 생년월일을 입력하시면<br/>도사님이 직접 당신의 숨겨진 운명과<br/>대박 비책을 감정해 드립니다.
            </p>
          </div>
        )}

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-full">
            <LoadingSpinner message="도사님이 고서를 뒤적이며 만세력을 짚고 계십니다..." />
          </div>
        )}

        {sajuResult && (
          <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-10 animate-fade-in-up pb-24">
            
            {/* Report Header */}
            <div className="text-center space-y-2 border-b-2 border-oriental-black pb-6">
              <h2 className="text-3xl font-serif font-bold">{input.name} 님의 천기누설 감정서</h2>
              <p className="text-gray-600">감정일: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Section 1: Saju Chart */}
            <section>
              <h3 className="text-xl font-serif font-bold mb-4 flex items-center">
                <span className="w-1 h-6 bg-oriental-black mr-2"></span>
                1. 사주 원국 (四柱原局)
              </h3>
              <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-2xl mx-auto mb-6">
                <PillarCard title="시주 (Time)" pillar={sajuResult.hourPillar} />
                <PillarCard title="일주 (Day)" pillar={sajuResult.dayPillar} />
                <PillarCard title="월주 (Month)" pillar={sajuResult.monthPillar} />
                <PillarCard title="년주 (Year)" pillar={sajuResult.yearPillar} />
              </div>
              
              {/* Element Counts Bar */}
              <div className="bg-gray-100 rounded-lg p-3 flex justify-between items-center max-w-2xl mx-auto text-sm md:text-base font-medium">
                <span className="text-green-800">목(Wood) <strong className="text-lg">{sajuResult.elementCounts.Wood}</strong></span>
                <span className="text-red-800">화(Fire) <strong className="text-lg">{sajuResult.elementCounts.Fire}</strong></span>
                <span className="text-yellow-800">토(Earth) <strong className="text-lg">{sajuResult.elementCounts.Earth}</strong></span>
                <span className="text-gray-700">금(Metal) <strong className="text-lg">{sajuResult.elementCounts.Metal}</strong></span>
                <span className="text-blue-900">수(Water) <strong className="text-lg">{sajuResult.elementCounts.Water}</strong></span>
              </div>
            </section>

            {/* 대운 (10년 운) */}
            <section className="mt-8">
              <h3 className="text-xl font-serif font-bold mb-4 flex items-center">
                <span className="w-1 h-6 bg-purple-600 mr-2"></span>
                대운 (大運) <span className="text-sm font-normal text-gray-500 ml-2">큰 운, 10년 주기 운세</span>
              </h3>
              <div className="bg-white rounded-xl paper-shadow overflow-x-auto">
                <div className="min-w-max p-4">
                  {/* 왼쪽이 어린 나이, 오른쪽이 나이 많음 */}
                  <div className="flex space-x-1">
                    {sajuResult.daeun.map((d, idx) => {
                      const currentYear = new Date().getFullYear();
                      const currentAge = currentYear - sajuResult.birthYear + 1;
                      const isCurrentDaeun = currentAge >= d.startAge && currentAge <= d.endAge;
                      return (
                        <div 
                          key={idx} 
                          className={`flex flex-col items-center min-w-[70px] p-2 rounded-lg border ${
                            isCurrentDaeun ? 'bg-orange-100 border-2 border-orange-400' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <span className="text-xs text-gray-500">{Math.floor(d.startAge)}~{d.endAge}세</span>
                          <span className="text-xl font-bold text-red-600">{d.stem}</span>
                          <span className="text-xl font-bold text-blue-600">{d.branch}</span>
                          <span className="text-xs text-gray-500">{d.stemKorean}{d.branchKorean}</span>
                          <span className="text-xs text-gray-400">{d.startYear}년~</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* 세운 (연운/해운) */}
            <section className="mt-8">
              <h3 className="text-xl font-serif font-bold mb-4 flex items-center">
                <span className="w-1 h-6 bg-green-600 mr-2"></span>
                세운 (歲運) <span className="text-sm font-normal text-gray-500 ml-2">해의 운, 연도별 운세</span>
              </h3>
              <div className="bg-white rounded-xl paper-shadow overflow-x-auto">
                <div className="min-w-max p-4">
                  {/* 왼쪽이 태어난 해, 오른쪽이 나중 - 100세까지 */}
                  <div className="flex flex-wrap gap-1">
                    {sajuResult.saeun.slice(0, 100).map((s, idx) => {
                      const currentYear = new Date().getFullYear();
                      const isCurrentYear = s.year === currentYear;
                      return (
                        <div 
                          key={idx} 
                          className={`flex flex-col items-center min-w-[50px] p-1.5 rounded border ${
                            isCurrentYear ? 'bg-orange-100 border-2 border-orange-400' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <span className="text-[10px] text-gray-400">{s.year}</span>
                          <span className="text-base font-bold text-red-600">{s.stem}</span>
                          <span className="text-base font-bold text-blue-600">{s.branch}</span>
                          <span className="text-[10px] text-gray-500">{s.stemKorean}{s.branchKorean}</span>
                          <span className="text-[10px] text-gray-400">{s.age}세</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-right">* 1세~100세 표시</p>
                </div>
              </div>
            </section>

            {/* 월운 */}
            <section className="mt-8">
              <h3 className="text-xl font-serif font-bold mb-4 flex items-center">
                <span className="w-1 h-6 bg-blue-600 mr-2"></span>
                월운 (月運) <span className="text-sm font-normal text-gray-500 ml-2">달의 운, 월별 운세</span>
              </h3>
              <div className="bg-white rounded-xl paper-shadow overflow-x-auto">
                <div className="min-w-max p-4">
                  {/* 이미지처럼 년도별로 1월~12월 순서로 표시 */}
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const currentMonth = new Date().getMonth() + 1;
                    const birthYear = sajuResult.birthYear;
                    
                    // 현재년도 기준 ±2년 표시 (총 5년)
                    const displayYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
                    
                    return (
                      <>
                        <p className="text-xs text-gray-400 mb-3">* 현재 연도 기준 ±2년 표시</p>
                        {displayYears.map(year => {
                          const yearWolun = sajuResult.wolun.filter(w => w.year === year);
                          const age = year - birthYear + 1;
                          
                          return (
                            <div key={year} className="mb-4">
                              <div className="text-sm font-bold text-gray-700 mb-2">{year}년</div>
                              <div className="flex space-x-1">
                                {yearWolun.map((w, idx) => {
                                  const isCurrentMonth = w.year === currentYear && w.month === currentMonth;
                                  return (
                                    <div 
                                      key={idx}
                                      className={`flex flex-col items-center min-w-[48px] p-1.5 rounded border ${
                                        isCurrentMonth ? 'bg-orange-100 border-2 border-orange-400' : 'bg-gray-50 border-gray-200'
                                      }`}
                                    >
                                      <span className="text-[10px] text-gray-400 mb-0.5">{w.month}월</span>
                                      <span className="text-base font-bold text-red-600">{w.stem}</span>
                                      <span className="text-base font-bold text-blue-600">{w.branch}</span>
                                      <span className="text-[9px] text-gray-500">{w.stemKorean}{w.branchKorean}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>
            </section>

            {/* Section 2: General Reading */}
            <section className="bg-white p-6 md:p-8 rounded-xl paper-shadow mt-8">
              <h3 className="text-xl font-serif font-bold mb-4 text-oriental-black">2. 타고난 기질과 운명</h3>
              <p className="text-gray-700 leading-8 whitespace-pre-line text-justify">
                {sajuResult.dayMasterReading}
              </p>
            </section>

            {/* Section 3: Chaeum Feng Shui (KEY FEATURE) */}
            <section className="bg-oriental-paper border-2 border-oriental-gold/30 p-6 md:p-8 rounded-xl relative overflow-hidden mt-8">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">⚖️</div>
              <h3 className="text-xl font-serif font-bold mb-2 text-oriental-gold flex items-center">
                3. 도사님의 개운 비책 (대박의 열쇠)
              </h3>
              <p className="text-sm text-gray-500 mb-6">부족한 오행을 채워 흉을 길로 바꾸는 비법입니다.</p>
              
              <div className="bg-white/80 p-6 rounded-lg mb-6 backdrop-blur-sm">
                <div className="text-center mb-4">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">반드시 채워야 할 기운</span>
                  <div className="flex justify-center space-x-4 mt-2">
                    {sajuResult.missingElements.map((m, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <span className="text-xs text-gray-400 mb-1">{m.priority}순위</span>
                        <span className="text-2xl font-serif font-bold text-oriental-red">{m.element}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-gray-800 text-center font-medium leading-relaxed">
                  {sajuResult.chaeumAdvice.summary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg text-center shadow-sm">
                  <span className="block text-2xl mb-1">🎨</span>
                  <div className="text-xs text-gray-500 font-bold mb-1">행운의 색</div>
                  <div className="font-serif font-bold text-lg">{sajuResult.chaeumAdvice.color}</div>
                </div>
                <div className="bg-white p-4 rounded-lg text-center shadow-sm">
                  <span className="block text-2xl mb-1">🧭</span>
                  <div className="text-xs text-gray-500 font-bold mb-1">대박 방위</div>
                  <div className="font-serif font-bold text-lg">{sajuResult.chaeumAdvice.direction}</div>
                </div>
                <div className="bg-white p-4 rounded-lg text-center shadow-sm">
                  <span className="block text-2xl mb-1">🏺</span>
                  <div className="text-xs text-gray-500 font-bold mb-1">개운 아이템</div>
                  <div className="font-serif font-bold text-lg">{sajuResult.chaeumAdvice.items}</div>
                </div>
              </div>
            </section>

             {/* Section 4: Health Analysis (New Feature) */}
             <section className="bg-blue-50/50 border-2 border-blue-100 p-6 md:p-8 rounded-xl mt-8">
               <h3 className="text-xl font-serif font-bold mb-4 flex items-center text-blue-900">
                <span className="text-2xl mr-2">🩺</span>
                4. 맞춤형 건강 처방 (Medical Report)
              </h3>
              <p className="text-sm text-gray-500 mb-6">의학 전문의가 분석한 사주 체질과 관리법입니다.</p>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                     <h4 className="font-bold text-blue-800 mb-2 flex items-center"><span className="mr-2">⚠️</span>취약 장기</h4>
                     <p className="text-gray-700 font-medium">{sajuResult.healthAnalysis.weakOrgans}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                     <h4 className="font-bold text-blue-800 mb-2 flex items-center"><span className="mr-2">🩹</span>예상 증상</h4>
                     <p className="text-gray-700">{sajuResult.healthAnalysis.symptoms}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-blue-500">
                  <h4 className="font-bold text-gray-800 mb-2">📋 전문의 상세 처방</h4>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line text-justify text-sm md:text-base">
                    {sajuResult.healthAnalysis.medicalAdvice}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-lg shadow-sm">
                  <h4 className="font-bold text-gray-800 mb-2 flex items-center"><span className="mr-2">🥗</span>추천 식이요법</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {sajuResult.healthAnalysis.foodRecommendation}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5: 2026 Fortune */}
            <section className="mt-8">
               <h3 className="text-xl font-serif font-bold mb-4 flex items-center">
                <span className="w-1 h-6 bg-oriental-red mr-2"></span>
                5. 2026년 (병오년) 대박 운세
              </h3>
              <div className="bg-white p-6 rounded-xl paper-shadow space-y-6">
                <div className="border-l-4 border-red-500 pl-4 py-1 bg-red-50 rounded-r-lg">
                  <h4 className="font-bold text-red-800">총운</h4>
                  <p className="text-gray-700 mt-1 text-justify leading-relaxed">{sajuResult.fortune2026.overall}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-bold text-gray-800 mb-1 flex items-center"><span className="mr-2">💰</span>재물운</h5>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">{sajuResult.fortune2026.wealth}</p>
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-800 mb-1 flex items-center"><span className="mr-2">💼</span>직업/사업운</h5>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">{sajuResult.fortune2026.career}</p>
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-800 mb-1 flex items-center"><span className="mr-2">❤️</span>애정/가정운</h5>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">{sajuResult.fortune2026.love}</p>
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-800 mb-1 flex items-center"><span className="mr-2">💊</span>건강운</h5>
                    <p className="text-sm text-gray-600 leading-relaxed text-justify">{sajuResult.fortune2026.health}</p>
                  </div>
                </div>
              </div>
            </section>

             {/* Section 6: Lucky Table */}
             <section className="mt-8">
               <h3 className="text-xl font-serif font-bold mb-4 flex items-center">
                <span className="w-1 h-6 bg-oriental-gold mr-2"></span>
                6. 귀인과 길일 (행운의 시간표)
              </h3>
              <div className="bg-white rounded-xl paper-shadow overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-oriental-black text-white">
                    <tr>
                      <th className="px-4 py-3 font-serif">날짜 (Date)</th>
                      <th className="px-4 py-3 font-serif">시간 (Time)</th>
                      <th className="px-4 py-3 font-serif">방위 (Direction)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sajuResult.luckyTable.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-oriental-red font-bold">{row.date}</td>
                        <td className="px-4 py-3 text-gray-600">{row.time}</td>
                        <td className="px-4 py-3 text-blue-600 font-medium">{row.direction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Consultation Chat */}
            <section className="bg-white rounded-xl shadow-lg border-2 border-oriental-black overflow-hidden flex flex-col h-[700px] mt-8">
              <div className="bg-oriental-black text-white p-4 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🔮</span>
                  <h3 className="font-serif font-bold">천기 도사님 親見室 (친견실)</h3>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] px-5 py-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-oriental-black text-white rounded-br-none'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                      } ${msg.isError ? 'bg-red-50 text-red-600' : ''}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start animate-pulse">
                    <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm text-gray-400 text-sm">
                      도사님이 붓을 들어 장문의 답을 적고 계십니다...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-gray-100">
                <form onSubmit={handleChatSubmit} className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="고민을 자세히 적어주시면 도사님이 정성껏 답변해주십니다. (ex. 로또구입시기, 이사시기, 직장이직여부 등)"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-oriental-gold focus:border-transparent outline-none shadow-sm"
                    disabled={isChatLoading}
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="bg-oriental-black text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-md"
                  >
                    ➤
                  </button>
                </form>
              </div>
            </section>

            {/* PDF Download Section */}
            <section className="mt-8 bg-gradient-to-r from-oriental-gold/20 to-oriental-red/20 p-6 rounded-xl border-2 border-oriental-gold/30">
              <div className="text-center">
                <h3 className="text-xl font-serif font-bold mb-2">📄 사주 분석서 다운로드</h3>
                <p className="text-gray-600 text-sm mb-4">
                  위의 모든 분석 결과와 상담 내역을 파일로 저장하세요.<br/>
                  다운로드 전에 내용을 수정할 수 있습니다.
                </p>
                <button
                  onClick={openPdfModal}
                  className="bg-oriental-red text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg flex items-center justify-center mx-auto space-x-2"
                >
                  <span>📥</span>
                  <span>분석서 다운로드 (수정 가능)</span>
                </button>
              </div>
            </section>

          </div>
        )}
      </main>

      {/* PDF Export Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-oriental-black text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="font-serif font-bold flex items-center space-x-2">
                <span>📄</span>
                <span>사주 분석서 편집 및 다운로드</span>
              </h3>
              <button
                onClick={() => setShowPdfModal(false)}
                className="text-white hover:text-gray-300 text-2xl"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Body - Editable Content */}
            <div className="flex-1 overflow-hidden p-4">
              <p className="text-sm text-gray-500 mb-2">
                💡 아래 내용을 자유롭게 수정한 후 다운로드하세요.
              </p>
              <textarea
                value={pdfContent}
                onChange={(e) => setPdfContent(e.target.value)}
                className="w-full h-[50vh] p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-oriental-gold focus:border-transparent outline-none"
                style={{ lineHeight: '1.6' }}
              />
            </div>
            
            {/* Modal Footer - Download Buttons */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={downloadText}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <span>📝</span>
                  <span>텍스트 파일 (.txt) 다운로드</span>
                </button>
                <button
                  onClick={downloadPdf}
                  disabled={isGeneratingPdf}
                  className="bg-oriental-red text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isGeneratingPdf ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>PDF 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <span>📄</span>
                      <span>PDF 파일 (.pdf) 다운로드</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">
                * 한글이 깨지는 경우 텍스트 파일(.txt)을 권장합니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;