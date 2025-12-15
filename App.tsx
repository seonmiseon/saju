import React, { useState, useRef, useEffect } from 'react';
import { UserInput, SajuAnalysisResult, ChatMessage } from './types';
import { analyzeSaju, consultSaju, setApiKey, getStoredApiKey, isApiKeySet } from './services/geminiService';
import PillarCard from './components/PillarCard';
import LoadingSpinner from './components/LoadingSpinner';

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

          </div>
        )}
      </main>
    </div>
  );
};

export default App;