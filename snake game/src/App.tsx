import { useState, useEffect, useRef, useCallback } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = { easy: 160, medium: 100, hard: 60 };
const SCORES: Record<Difficulty, number> = { easy: 5, medium: 10, hard: 20 };

const INITIAL_SNAKE: Position[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

function randomFood(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef<Direction>('RIGHT');
  const snakeRef = useRef<Position[]>(INITIAL_SNAKE);
  const foodRef = useRef<Position>(randomFood(INITIAL_SNAKE));
  const stateRef = useRef<GameState>('idle');
  const intervalRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('snake-hs') || '0', 10);
    } catch { return 0; }
  });

  const scoreRef = useRef(score);
  const diffRef = useRef(difficulty);
  const hsRef = useRef(highScore);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { diffRef.current = difficulty; }, [difficulty]);
  useEffect(() => { hsRef.current = highScore; }, [highScore]);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  const stopLoop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const endGame = useCallback(() => {
    stopLoop();
    setGameState('gameover');
    const s = scoreRef.current;
    if (s > hsRef.current) {
      setHighScore(s);
      try { localStorage.setItem('snake-hs', s.toString()); } catch {}
    }
  }, [stopLoop]);

  const tick = useCallback(() => {
    const snake = snakeRef.current;
    const head = { ...snake[0] };
    const dir = dirRef.current;

    if (dir === 'UP') head.y--;
    else if (dir === 'DOWN') head.y++;
    else if (dir === 'LEFT') head.x--;
    else if (dir === 'RIGHT') head.x++;

    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      endGame(); return;
    }
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      endGame(); return;
    }

    const newSnake = [head, ...snake];
    const food = foodRef.current;

    if (head.x === food.x && head.y === food.y) {
      setScore(prev => prev + SCORES[diffRef.current]);
      foodRef.current = randomFood(newSnake);
    } else {
      newSnake.pop();
    }
    snakeRef.current = newSnake;
  }, [endGame]);

  const startLoop = useCallback(() => {
    stopLoop();
    intervalRef.current = window.setInterval(tick, SPEEDS[diffRef.current]);
  }, [tick, stopLoop]);

  const startGame = useCallback(() => {
    snakeRef.current = INITIAL_SNAKE.map(p => ({ ...p }));
    foodRef.current = randomFood(INITIAL_SNAKE);
    dirRef.current = 'RIGHT';
    setScore(0);
    setGameState('playing');
  }, []);

  const togglePause = useCallback(() => {
    if (stateRef.current === 'playing') {
      setGameState('paused');
      stopLoop();
    } else if (stateRef.current === 'paused') {
      setGameState('playing');
    }
  }, [stopLoop]);

  const changeDir = useCallback((d: Direction) => {
    const opp: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    if (opp[d] !== dirRef.current) dirRef.current = d;
  }, []);

  // Start/stop loop on state change
  useEffect(() => {
    if (gameState === 'playing') startLoop();
    else stopLoop();
    return stopLoop;
  }, [gameState, startLoop, stopLoop]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (stateRef.current === 'idle' || stateRef.current === 'gameover') startGame();
        else togglePause();
        return;
      }
      if (stateRef.current !== 'playing') return;
      const map: Record<string, Direction> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', W: 'UP', s: 'DOWN', S: 'DOWN', a: 'LEFT', A: 'LEFT', d: 'RIGHT', D: 'RIGHT',
      };
      const d = map[e.key];
      if (d) { e.preventDefault(); changeDir(d); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startGame, togglePause, changeDir]);

  // Touch swipe
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || stateRef.current !== 'playing') return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) changeDir(dx > 0 ? 'RIGHT' : 'LEFT');
      else changeDir(dy > 0 ? 'DOWN' : 'UP');
      touchStartRef.current = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, [changeDir]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let raf = 0;
    let pulse = 0;

    const resize = () => {
      const size = Math.min(container.clientWidth, container.clientHeight, 500);
      canvas.width = size * window.devicePixelRatio;
      canvas.height = size * window.devicePixelRatio;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
    };

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const cell = w / GRID_SIZE;
      const dpr = window.devicePixelRatio;

      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = dpr;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(w, i * cell); ctx.stroke();
      }

      // Food
      pulse += 0.06;
      const p = Math.sin(pulse) * 0.2 + 0.8;
      const fx = foodRef.current.x * cell + cell / 2;
      const fy = foodRef.current.y * cell + cell / 2;
      const fr = (cell / 2 - 2 * dpr) * p;

      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, cell * 1.5);
      glow.addColorStop(0, 'rgba(239,68,68,0.3)');
      glow.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(fx - cell * 1.5, fy - cell * 1.5, cell * 3, cell * 3);

      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();

      // Snake
      const snake = snakeRef.current;
      snake.forEach((seg, i) => {
        const x = seg.x * cell;
        const y = seg.y * cell;
        const pad = 1 * dpr;

        if (i === 0) {
          ctx.fillStyle = '#22c55e';
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 12 * dpr;
        } else {
          const alpha = 1 - (i / snake.length) * 0.6;
          const g = Math.floor(197 - (i / snake.length) * 80);
          ctx.fillStyle = `rgba(34, ${g}, 94, ${alpha})`;
          ctx.shadowBlur = 0;
        }

        const r = 4 * dpr;
        const rx = x + pad; const ry = y + pad;
        const rw = cell - pad * 2; const rh = cell - pad * 2;
        ctx.beginPath();
        ctx.moveTo(rx + r, ry);
        ctx.lineTo(rx + rw - r, ry);
        ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
        ctx.lineTo(rx + rw, ry + rh - r);
        ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
        ctx.lineTo(rx + r, ry + rh);
        ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
        ctx.lineTo(rx, ry + r);
        ctx.quadraticCurveTo(rx, ry, rx + r, ry);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Eyes on head
        if (i === 0) {
          ctx.fillStyle = '#0f172a';
          const es = cell * 0.14;
          const dir = dirRef.current;
          let e1x: number, e1y: number, e2x: number, e2y: number;
          if (dir === 'RIGHT') { e1x = x + cell * 0.7; e1y = y + cell * 0.3; e2x = x + cell * 0.7; e2y = y + cell * 0.7; }
          else if (dir === 'LEFT') { e1x = x + cell * 0.3; e1y = y + cell * 0.3; e2x = x + cell * 0.3; e2y = y + cell * 0.7; }
          else if (dir === 'UP') { e1x = x + cell * 0.3; e1y = y + cell * 0.3; e2x = x + cell * 0.7; e2y = y + cell * 0.3; }
          else { e1x = x + cell * 0.3; e1y = y + cell * 0.7; e2x = x + cell * 0.7; e2y = y + cell * 0.7; }
          ctx.beginPath(); ctx.arc(e1x, e1y, es, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(e2x, e2y, es, 0, Math.PI * 2); ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  const isPlaying = gameState === 'playing' || gameState === 'paused';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 select-none">
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
        🐍 Snake
      </h1>
      <p className="text-slate-500 text-xs sm:text-sm mb-4">
        Flèches/WASD • Espace = Pause • Swipe sur mobile
      </p>

      {/* Score & Difficulty */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4 w-full max-w-[500px]">
        <div className="bg-white/5 backdrop-blur rounded-lg px-4 py-2 border border-white/10">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Score</div>
          <div className="text-xl font-bold text-green-400">{score}</div>
        </div>
        <div className="bg-white/5 backdrop-blur rounded-lg px-4 py-2 border border-white/10">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Record</div>
          <div className="text-xl font-bold text-amber-400">{highScore}</div>
        </div>
        <div className="flex gap-1 bg-white/5 backdrop-blur rounded-lg p-1 border border-white/10">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => !isPlaying && setDifficulty(d)}
              disabled={isPlaying}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                difficulty === d
                  ? d === 'easy' ? 'bg-green-500 text-white' : d === 'medium' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              } ${isPlaying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {d === 'easy' ? 'Facile' : d === 'medium' ? 'Moyen' : 'Difficile'}
            </button>
          ))}
        </div>
      </div>

      {/* Game Board */}
      <div ref={containerRef} className="relative w-full aspect-square max-w-[500px] mx-auto">
        <canvas ref={canvasRef} className="w-full h-full rounded-xl border-2 border-green-500/20 shadow-xl shadow-green-500/5" />

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl">
            <div className="text-6xl mb-4 animate-bounce">🐍</div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Prêt à jouer ?</h2>
            <p className="text-slate-300 text-sm mb-4 text-center px-4">Choisissez la difficulté et lancez-vous !</p>
            <button onClick={startGame} className="px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all hover:scale-105 active:scale-95">
              ▶ Commencer
            </button>
          </div>
        )}

        {/* Paused overlay */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl">
            <div className="text-5xl mb-4">⏸️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Pause</h2>
            <button onClick={togglePause} className="px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all hover:scale-105 active:scale-95">
              ▶ Reprendre
            </button>
          </div>
        )}

        {/* Game Over overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl">
            <div className="text-5xl mb-3">💀</div>
            <h2 className="text-2xl font-bold text-red-400 mb-1">Game Over</h2>
            <p className="text-white text-lg">Score : <span className="font-bold text-green-400">{score}</span></p>
            {score > 0 && score >= highScore && (
              <p className="text-amber-400 text-sm font-bold mt-1 animate-pulse">🏆 Nouveau record !</p>
            )}
            <button onClick={startGame} className="mt-4 px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all hover:scale-105 active:scale-95">
              🔄 Rejouer
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-4">
        {gameState === 'playing' && (
          <button onClick={togglePause} className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all active:scale-95 text-sm">
            ⏸ Pause
          </button>
        )}
        {isPlaying && (
          <button onClick={startGame} className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all active:scale-95 text-sm">
            🔄 Redémarrer
          </button>
        )}
      </div>

      {/* Mobile D-Pad */}
      <div className="grid grid-cols-3 gap-2 mt-6 sm:hidden">
        <div />
        <button onTouchStart={() => changeDir('UP')} className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-xl active:bg-white/20 active:scale-90 transition-all">▲</button>
        <div />
        <button onTouchStart={() => changeDir('LEFT')} className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-xl active:bg-white/20 active:scale-90 transition-all">◀</button>
        <button onTouchStart={() => changeDir('DOWN')} className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-xl active:bg-white/20 active:scale-90 transition-all">▼</button>
        <button onTouchStart={() => changeDir('RIGHT')} className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-xl active:bg-white/20 active:scale-90 transition-all">▶</button>
      </div>

      <p className="mt-4 text-slate-600 text-xs text-center">
        Record sauvegardé localement • Glissez ou utilisez les boutons sur mobile
      </p>
    </div>
  );
}
