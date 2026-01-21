import { NavLink, Outlet } from 'react-router-dom';
import { Volume2, Music, Waves } from 'lucide-react';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#FFFEF0] relative overflow-hidden">
      {/* Memphis 배경 장식 */}
      <div className="fixed top-10 right-10 w-32 h-32 bg-[#FFE66D] rounded-full opacity-60 -z-10"></div>
      <div className="fixed bottom-20 left-10 w-24 h-24 bg-[#4ECDC4] rotate-45 opacity-60 -z-10"></div>
      <div className="fixed top-1/3 left-5 w-8 h-40 bg-[#DDA0DD] opacity-60 -z-10"></div>
      <div className="fixed bottom-1/4 right-20 w-16 h-16 border-4 border-[#FF6B6B] rounded-full opacity-60 -z-10"></div>

      {/* 헤더 */}
      <header className="bg-white border-b-4 border-black px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FF6B6B] rounded-xl border-3 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Volume2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-black">TBSonic</h1>
              <p className="text-sm text-gray-600 font-medium">AI 오디오 생성</p>
            </div>
          </div>

          {/* 네비게이션 버튼 */}
          <div className="flex items-center gap-3">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-5 py-2 rounded-full border-3 border-black font-bold text-sm flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-[#FF6B6B] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black hover:bg-gray-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px]'
                }`
              }
            >
              <Music className="w-4 h-4" />
              TTS
            </NavLink>
            <NavLink
              to="/sound"
              className={({ isActive }) =>
                `px-5 py-2 rounded-full border-3 border-black font-bold text-sm flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-[#4ECDC4] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black hover:bg-gray-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px]'
                }`
              }
            >
              <Waves className="w-4 h-4" />
              SOUND
            </NavLink>
          </div>
        </div>
      </header>

      {/* 페이지 콘텐츠 */}
      <Outlet />
    </div>
  );
}
