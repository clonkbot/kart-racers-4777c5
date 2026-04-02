import { useState, useEffect, useCallback, useRef } from 'react';
import './styles.css';

interface Player {
  id: number;
  name: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  lap: number;
  checkpoint: number;
  item: string | null;
  color: string;
  boost: number;
  finished: boolean;
  finishTime: number;
}

interface Item {
  id: number;
  x: number;
  y: number;
  type: string;
  active: boolean;
}

const TRACK_WIDTH = 800;
const TRACK_HEIGHT = 600;
const PLAYER_SIZE = 30;
const MAX_SPEED = 6;
const ACCELERATION = 0.15;
const FRICTION = 0.98;
const TURN_SPEED = 0.08;
const BOOST_POWER = 2;
const TOTAL_LAPS = 3;

const ITEMS = ['mushroom', 'banana', 'shell', 'star'];
const ITEM_EMOJIS: Record<string, string> = {
  mushroom: '🍄',
  banana: '🍌',
  shell: '🐢',
  star: '⭐',
};

const CHECKPOINTS = [
  { x: 400, y: 100, radius: 80 },
  { x: 700, y: 300, radius: 80 },
  { x: 400, y: 500, radius: 80 },
  { x: 100, y: 300, radius: 80 },
];

const INITIAL_ITEMS: Item[] = [
  { id: 1, x: 250, y: 150, type: 'random', active: true },
  { id: 2, x: 550, y: 150, type: 'random', active: true },
  { id: 3, x: 650, y: 400, type: 'random', active: true },
  { id: 4, x: 150, y: 400, type: 'random', active: true },
  { id: 5, x: 400, y: 300, type: 'random', active: true },
];

const BOOST_PADS = [
  { x: 300, y: 100, width: 60, height: 30, angle: 0 },
  { x: 700, y: 200, width: 30, height: 60, angle: 0 },
  { x: 500, y: 500, width: 60, height: 30, angle: 0 },
];

function App() {
  const [gameState, setGameState] = useState<'menu' | 'countdown' | 'racing' | 'finished'>('menu');
  const [players, setPlayers] = useState<Player[]>([]);
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [countdown, setCountdown] = useState(3);
  const [raceTime, setRaceTime] = useState(0);
  const [droppedItems, setDroppedItems] = useState<{ x: number; y: number; type: string }[]>([]);
  const keysPressed = useRef<Set<string>>(new Set());
  const gameLoopRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const createPlayers = (count: number): Player[] => {
    const colors = ['#FF1493', '#00FFFF', '#00FF00', '#FFD700'];
    const names = ['P1', 'P2', 'P3', 'P4'];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      name: names[i],
      x: 400 + (i % 2) * 50 - 25,
      y: 50 + Math.floor(i / 2) * 40,
      angle: Math.PI / 2,
      speed: 0,
      lap: 0,
      checkpoint: 0,
      item: null,
      color: colors[i],
      boost: 0,
      finished: false,
      finishTime: 0,
    }));
  };

  const startGame = (playerCount: number) => {
    setPlayers(createPlayers(playerCount));
    setItems(INITIAL_ITEMS.map(item => ({ ...item, active: true })));
    setDroppedItems([]);
    setGameState('countdown');
    setCountdown(3);
    setRaceTime(0);
  };

  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('racing');
        startTimeRef.current = Date.now();
      }
    }
  }, [gameState, countdown]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const useItem = useCallback((playerIndex: number) => {
    setPlayers(prev => {
      const newPlayers = [...prev];
      const player = { ...newPlayers[playerIndex] };
      if (!player.item) return prev;

      switch (player.item) {
        case 'mushroom':
          player.boost = 30;
          break;
        case 'banana':
          setDroppedItems(d => [...d, {
            x: player.x - Math.cos(player.angle) * 40,
            y: player.y - Math.sin(player.angle) * 40,
            type: 'banana'
          }]);
          break;
        case 'shell':
          setDroppedItems(d => [...d, {
            x: player.x + Math.cos(player.angle) * 40,
            y: player.y + Math.sin(player.angle) * 40,
            type: 'shell'
          }]);
          break;
        case 'star':
          player.boost = 60;
          break;
      }
      player.item = null;
      newPlayers[playerIndex] = player;
      return newPlayers;
    });
  }, []);

  const updatePlayer = useCallback((player: Player, controls: { up: boolean; down: boolean; left: boolean; right: boolean; item: boolean }, playerIndex: number): Player => {
    if (player.finished) return player;

    const newPlayer = { ...player };

    // Handle boost
    if (newPlayer.boost > 0) {
      newPlayer.boost--;
    }

    // Turning
    if (controls.left) newPlayer.angle -= TURN_SPEED * (newPlayer.speed > 0 ? 1 : -0.5);
    if (controls.right) newPlayer.angle += TURN_SPEED * (newPlayer.speed > 0 ? 1 : -0.5);

    // Acceleration
    const maxSpd = MAX_SPEED + (newPlayer.boost > 0 ? BOOST_POWER : 0);
    if (controls.up) {
      newPlayer.speed = Math.min(newPlayer.speed + ACCELERATION, maxSpd);
    } else if (controls.down) {
      newPlayer.speed = Math.max(newPlayer.speed - ACCELERATION * 1.5, -maxSpd / 2);
    } else {
      newPlayer.speed *= FRICTION;
    }

    // Movement
    newPlayer.x += Math.cos(newPlayer.angle) * newPlayer.speed;
    newPlayer.y += Math.sin(newPlayer.angle) * newPlayer.speed;

    // Boundary collision
    if (newPlayer.x < PLAYER_SIZE) { newPlayer.x = PLAYER_SIZE; newPlayer.speed *= 0.5; }
    if (newPlayer.x > TRACK_WIDTH - PLAYER_SIZE) { newPlayer.x = TRACK_WIDTH - PLAYER_SIZE; newPlayer.speed *= 0.5; }
    if (newPlayer.y < PLAYER_SIZE) { newPlayer.y = PLAYER_SIZE; newPlayer.speed *= 0.5; }
    if (newPlayer.y > TRACK_HEIGHT - PLAYER_SIZE) { newPlayer.y = TRACK_HEIGHT - PLAYER_SIZE; newPlayer.speed *= 0.5; }

    // Use item
    if (controls.item && newPlayer.item) {
      useItem(playerIndex);
    }

    // Check boost pads
    BOOST_PADS.forEach(pad => {
      if (newPlayer.x > pad.x && newPlayer.x < pad.x + pad.width &&
          newPlayer.y > pad.y && newPlayer.y < pad.y + pad.height) {
        newPlayer.boost = Math.max(newPlayer.boost, 15);
      }
    });

    // Check checkpoints
    const nextCheckpoint = CHECKPOINTS[newPlayer.checkpoint % CHECKPOINTS.length];
    const distToCheckpoint = Math.hypot(newPlayer.x - nextCheckpoint.x, newPlayer.y - nextCheckpoint.y);
    if (distToCheckpoint < nextCheckpoint.radius) {
      newPlayer.checkpoint++;
      if (newPlayer.checkpoint % CHECKPOINTS.length === 0 && newPlayer.checkpoint > 0) {
        newPlayer.lap++;
        if (newPlayer.lap >= TOTAL_LAPS) {
          newPlayer.finished = true;
          newPlayer.finishTime = Date.now() - startTimeRef.current;
        }
      }
    }

    return newPlayer;
  }, [useItem]);

  useEffect(() => {
    if (gameState !== 'racing') return;

    const gameLoop = () => {
      setRaceTime(Date.now() - startTimeRef.current);

      setPlayers(prev => {
        const controls = [
          { up: keysPressed.current.has('w'), down: keysPressed.current.has('s'), left: keysPressed.current.has('a'), right: keysPressed.current.has('d'), item: keysPressed.current.has('q') },
          { up: keysPressed.current.has('arrowup'), down: keysPressed.current.has('arrowdown'), left: keysPressed.current.has('arrowleft'), right: keysPressed.current.has('arrowright'), item: keysPressed.current.has('/') },
          { up: keysPressed.current.has('i'), down: keysPressed.current.has('k'), left: keysPressed.current.has('j'), right: keysPressed.current.has('l'), item: keysPressed.current.has('u') },
          { up: keysPressed.current.has('8'), down: keysPressed.current.has('5'), left: keysPressed.current.has('4'), right: keysPressed.current.has('6'), item: keysPressed.current.has('7') },
        ];

        return prev.map((player, i) => updatePlayer(player, controls[i], i));
      });

      // Check item pickups
      setItems(prevItems => {
        const newItems = [...prevItems];
        setPlayers(prevPlayers => {
          const newPlayers = [...prevPlayers];
          newItems.forEach((item, itemIndex) => {
            if (!item.active) return;
            newPlayers.forEach((player, playerIndex) => {
              if (player.item) return;
              const dist = Math.hypot(player.x - item.x, player.y - item.y);
              if (dist < 30) {
                newItems[itemIndex] = { ...item, active: false };
                newPlayers[playerIndex] = {
                  ...player,
                  item: ITEMS[Math.floor(Math.random() * ITEMS.length)]
                };
                setTimeout(() => {
                  setItems(prev => prev.map((it, idx) =>
                    idx === itemIndex ? { ...it, active: true } : it
                  ));
                }, 5000);
              }
            });
          });
          return newPlayers;
        });
        return newItems;
      });

      // Check dropped item collisions
      setDroppedItems(prevDropped => {
        const remaining = [...prevDropped];
        setPlayers(prevPlayers => {
          return prevPlayers.map(player => {
            for (let i = remaining.length - 1; i >= 0; i--) {
              const dropped = remaining[i];
              const dist = Math.hypot(player.x - dropped.x, player.y - dropped.y);
              if (dist < 25) {
                remaining.splice(i, 1);
                return { ...player, speed: player.speed * -0.5, boost: 0 };
              }
            }
            return player;
          });
        });
        return remaining;
      });

      // Check if race finished
      setPlayers(prev => {
        if (prev.every(p => p.finished)) {
          setGameState('finished');
        }
        return prev;
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, updatePlayer]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const remainingMs = Math.floor((ms % 1000) / 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(2, '0')}`;
  };

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.checkpoint - a.checkpoint;
  });

  return (
    <div className="min-h-screen bg-[#0a0014] text-white overflow-hidden relative flex flex-col">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-pink-900/30" />
        <div className="racing-stripes" />
        <div className="grid-overlay" />
        <div className="scanlines" />
      </div>

      {/* Header */}
      <header className="relative z-10 text-center py-4 md:py-6">
        <h1 className="title-text text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter">
          <span className="inline-block animate-float-1">K</span>
          <span className="inline-block animate-float-2">A</span>
          <span className="inline-block animate-float-3">R</span>
          <span className="inline-block animate-float-4">T</span>
          <span className="inline-block mx-1 md:mx-2"></span>
          <span className="inline-block animate-float-5">R</span>
          <span className="inline-block animate-float-6">A</span>
          <span className="inline-block animate-float-7">C</span>
          <span className="inline-block animate-float-8">E</span>
          <span className="inline-block animate-float-9">R</span>
          <span className="inline-block animate-float-10">S</span>
        </h1>
        <p className="text-pink-400 text-xs sm:text-sm md:text-base mt-2 tracking-[0.2em] md:tracking-[0.3em] uppercase font-mono">
          Multiplayer Mayhem
        </p>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-2 sm:px-4 pb-4">
        {gameState === 'menu' && (
          <div className="menu-container text-center space-y-6 md:space-y-8 animate-fade-in">
            <div className="space-y-3 md:space-y-4">
              <p className="text-cyan-400 text-sm md:text-lg font-mono mb-4 md:mb-8">Select Players</p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
                {[2, 3, 4].map(num => (
                  <button
                    key={num}
                    onClick={() => startGame(num)}
                    className="neon-button px-6 md:px-8 py-3 md:py-4 text-lg md:text-xl font-bold rounded-lg
                             bg-gradient-to-r from-pink-600 to-purple-600
                             hover:from-pink-500 hover:to-purple-500
                             transform hover:scale-105 transition-all duration-200
                             shadow-lg shadow-pink-500/50 hover:shadow-pink-500/80
                             min-w-[140px] min-h-[52px]"
                  >
                    {num} PLAYERS
                  </button>
                ))}
              </div>
            </div>

            <div className="controls-info mt-6 md:mt-12 p-4 md:p-6 bg-black/50 rounded-xl border border-cyan-500/30 max-w-2xl mx-auto">
              <h3 className="text-cyan-400 font-bold mb-3 md:mb-4 text-base md:text-lg">CONTROLS</h3>
              <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-xs md:text-sm font-mono">
                <div className="text-pink-400">P1: WASD + Q</div>
                <div className="text-cyan-400">P2: Arrows + /</div>
                <div className="text-green-400">P3: IJKL + U</div>
                <div className="text-yellow-400">P4: 8456 + 7</div>
              </div>
              <p className="text-gray-400 mt-3 md:mt-4 text-[10px] md:text-xs">Race through checkpoints • Collect items • 3 laps to win!</p>
            </div>
          </div>
        )}

        {(gameState === 'countdown' || gameState === 'racing' || gameState === 'finished') && (
          <div className="game-container w-full max-w-4xl">
            {/* HUD */}
            <div className="flex flex-wrap justify-between items-start mb-2 md:mb-4 gap-2">
              <div className="flex flex-wrap gap-2 md:gap-4">
                {sortedPlayers.map((player, pos) => (
                  <div key={player.id}
                       className="player-hud px-2 md:px-3 py-1 md:py-2 rounded-lg bg-black/70 border-2 text-xs md:text-sm"
                       style={{ borderColor: player.color }}>
                    <span className="font-bold text-[10px] md:text-xs">{pos + 1}.</span>
                    <span style={{ color: player.color }} className="font-bold ml-1"> {player.name}</span>
                    <span className="text-gray-400 ml-1 md:ml-2 text-[10px] md:text-xs">L{player.lap + 1}/{TOTAL_LAPS}</span>
                    {player.item && <span className="ml-1 md:ml-2 text-base md:text-lg">{ITEM_EMOJIS[player.item]}</span>}
                  </div>
                ))}
              </div>
              <div className="time-display px-3 md:px-4 py-1 md:py-2 bg-black/70 rounded-lg border-2 border-yellow-400 font-mono text-yellow-400 text-sm md:text-lg">
                {formatTime(raceTime)}
              </div>
            </div>

            {/* Track */}
            <div className="track-container relative mx-auto rounded-2xl overflow-hidden border-4 border-purple-500/50 shadow-2xl shadow-purple-500/30"
                 style={{ maxWidth: TRACK_WIDTH, aspectRatio: `${TRACK_WIDTH}/${TRACK_HEIGHT}` }}>
              <svg viewBox={`0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`} className="w-full h-full bg-[#1a0a2e]">
                {/* Track surface */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2a1a4e" strokeWidth="1"/>
                  </pattern>
                  <radialGradient id="trackGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#2a1a4e"/>
                    <stop offset="100%" stopColor="#0a0014"/>
                  </radialGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#trackGradient)"/>
                <rect width="100%" height="100%" fill="url(#grid)"/>

                {/* Racing line (oval track) */}
                <ellipse cx="400" cy="300" rx="320" ry="220" fill="none" stroke="#3a2a5e" strokeWidth="100" strokeDasharray="20 10"/>
                <ellipse cx="400" cy="300" rx="320" ry="220" fill="none" stroke="#4a3a6e" strokeWidth="80"/>

                {/* Checkpoints */}
                {CHECKPOINTS.map((cp, i) => (
                  <g key={i}>
                    <circle cx={cp.x} cy={cp.y} r={cp.radius} fill="none" stroke="#00ffff33" strokeWidth="3" strokeDasharray="10 5"/>
                    <text x={cp.x} y={cp.y + 5} textAnchor="middle" fill="#00ffff" fontSize="20" fontWeight="bold">{i + 1}</text>
                  </g>
                ))}

                {/* Boost pads */}
                {BOOST_PADS.map((pad, i) => (
                  <g key={i}>
                    <rect x={pad.x} y={pad.y} width={pad.width} height={pad.height} fill="#ffff00" opacity="0.6" rx="4"/>
                    <rect x={pad.x} y={pad.y} width={pad.width} height={pad.height} fill="none" stroke="#ff8800" strokeWidth="2" rx="4">
                      <animate attributeName="opacity" values="1;0.5;1" dur="0.5s" repeatCount="indefinite"/>
                    </rect>
                  </g>
                ))}

                {/* Item boxes */}
                {items.map(item => item.active && (
                  <g key={item.id}>
                    <rect x={item.x - 15} y={item.y - 15} width="30" height="30" fill="#ff00ff" opacity="0.3" rx="5">
                      <animate attributeName="transform" type="rotate" values="0 ${item.x} ${item.y};360 ${item.x} ${item.y}" dur="2s" repeatCount="indefinite"/>
                    </rect>
                    <text x={item.x} y={item.y + 6} textAnchor="middle" fontSize="20">❓</text>
                  </g>
                ))}

                {/* Dropped items */}
                {droppedItems.map((item, i) => (
                  <text key={i} x={item.x} y={item.y + 6} textAnchor="middle" fontSize="24">
                    {item.type === 'banana' ? '🍌' : '🐢'}
                  </text>
                ))}

                {/* Players */}
                {players.map(player => (
                  <g key={player.id} transform={`translate(${player.x}, ${player.y})`}>
                    {/* Boost trail */}
                    {player.boost > 0 && (
                      <g transform={`rotate(${(player.angle * 180 / Math.PI) + 180})`}>
                        <ellipse cx="0" cy="25" rx="8" ry="20" fill="#ffff00" opacity="0.8">
                          <animate attributeName="ry" values="15;25;15" dur="0.1s" repeatCount="indefinite"/>
                        </ellipse>
                        <ellipse cx="0" cy="25" rx="4" ry="15" fill="#ff8800"/>
                      </g>
                    )}
                    {/* Kart body */}
                    <g transform={`rotate(${player.angle * 180 / Math.PI})`}>
                      <ellipse cx="0" cy="0" rx={PLAYER_SIZE/2} ry={PLAYER_SIZE/3} fill={player.color}/>
                      <rect x="-8" y="-6" width="16" height="12" fill={player.color} rx="3"/>
                      <circle cx="10" cy="0" r="5" fill="#333"/>
                      <rect x="8" y="-2" width="6" height="4" fill="#666"/>
                    </g>
                    {/* Player indicator */}
                    <text y="-25" textAnchor="middle" fill={player.color} fontSize="12" fontWeight="bold">{player.name}</text>
                  </g>
                ))}

                {/* Start/Finish line */}
                <rect x="350" y="30" width="100" height="10" fill="white"/>
                <g>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <rect key={i} x={350 + i * 10} y="30" width="10" height="10" fill={i % 2 === 0 ? 'black' : 'white'}/>
                  ))}
                </g>
              </svg>

              {/* Countdown overlay */}
              {gameState === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <span className="countdown-number text-7xl sm:text-8xl md:text-9xl font-black animate-pulse-scale">
                    {countdown > 0 ? countdown : 'GO!'}
                  </span>
                </div>
              )}

              {/* Finish overlay */}
              {gameState === 'finished' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4">
                  <h2 className="finish-text text-4xl sm:text-5xl md:text-6xl font-black mb-4 md:mb-8 animate-bounce">FINISH!</h2>
                  <div className="results space-y-2 md:space-y-3 mb-4 md:mb-8">
                    {sortedPlayers.map((player, pos) => (
                      <div key={player.id} className="flex items-center gap-2 md:gap-4 text-base md:text-xl font-mono">
                        <span className={pos === 0 ? 'text-yellow-400' : pos === 1 ? 'text-gray-300' : pos === 2 ? 'text-orange-400' : 'text-gray-500'}>
                          {pos + 1}{pos === 0 ? 'st' : pos === 1 ? 'nd' : pos === 2 ? 'rd' : 'th'}
                        </span>
                        <span style={{ color: player.color }} className="font-bold">{player.name}</span>
                        <span className="text-gray-400">{formatTime(player.finishTime)}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setGameState('menu')}
                    className="neon-button px-6 md:px-8 py-3 md:py-4 text-lg md:text-xl font-bold rounded-lg
                             bg-gradient-to-r from-cyan-600 to-blue-600
                             hover:from-cyan-500 hover:to-blue-500
                             transform hover:scale-105 transition-all
                             shadow-lg shadow-cyan-500/50 min-h-[52px]"
                  >
                    PLAY AGAIN
                  </button>
                </div>
              )}
            </div>

            {/* Mobile controls hint */}
            <p className="text-center text-gray-500 text-[10px] md:text-xs mt-3 md:mt-4 font-mono">
              Use keyboard controls • Desktop recommended for multiplayer
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-3 md:py-4">
        <p className="text-gray-600 text-[10px] md:text-xs font-mono">
          Requested by <span className="text-gray-500">@dev_ShogunBP</span> · Built by <span className="text-gray-500">@clonkbot</span>
        </p>
      </footer>
    </div>
  );
}

export default App;
