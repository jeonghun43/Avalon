import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useStore } from './store';
import { Entry } from './screens/Entry';
import { Game } from './screens/Game';
import { Toast } from './ui/Toast';
import './net/socket';
import './ui/game.css';

function App() {
  const view = useStore((s) => s.view);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    // 카드 글씨를 캔버스에 그리기 전에 Jua 폰트를 기다린다 (최대 2초)
    Promise.race([document.fonts.load('40px Jua'), new Promise((r) => setTimeout(r, 2000))]).finally(() => setFontsReady(true));
  }, []);
  return (
    <>
      {view && fontsReady ? <Game view={view} /> : <Entry />}
      <Toast />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
