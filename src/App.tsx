/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Skull, Zap, Keyboard, Play, RotateCcw, Pause, Heart } from 'lucide-react';
import { WORDS, TUTORIAL_DURATION, INITIAL_SPAWN_RATE, MIN_SPAWN_RATE, SPAWN_ACCELERATION, MAX_ZOMBIES_INITIAL, MAX_ZOMBIES_FINAL, EXTERN_MAX, EXTERN_DURATION, EXTERN_SPAWN_MULTIPLIER, STEP_SPEED, SPEED_INCREMENT, MAX_HEALTH, HEALTH_DRAIN_PER_SEC, HEALTH_GAIN_PER_KILL, ATTACK_DELAY_MS, GAME_WIDTH, GAME_HEIGHT } from './constants';

interface Zombie {
  id: number;
  word: string;
  x: number; // percentage from left (0 to 100)
  y: number; // vertical offset for perspective
  speed: number;
  type: number; // for visual variety (0-3)
  scale: number; // random size variation
  depth: number; // depth factor (0 to 1)
  isAttacking?: boolean;
  attackStartTime?: number | null;
}

const ZOMBIE_IMAGES = [
  'https://i.ibb.co/Gv9Xqn3c/1.png',
  'https://i.ibb.co/k6S8TZG8/2.png',
  'https://i.ibb.co/kV9WXhM8/3.png',
  'https://i.ibb.co/jZ1xyQZd/4.png'
];

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [zombies, setZombies] = useState<Zombie[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);
  const [externCharge, setExternCharge] = useState(0);
  const [isExternActive, setIsExternActive] = useState(false);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [isPaused, setIsPaused] = useState(false);
  const [spawnRate, setSpawnRate] = useState(INITIAL_SPAWN_RATE);
  const [isPortrait, setIsPortrait] = useState(false);
  const [containerScale, setContainerScale] = useState(1);
  const [canUseContinueExtern, setCanUseContinueExtern] = useState(true);
  const [viewportHeight, setViewportHeight] = useState('100vh');
  
  const gameLoopRef = useRef<number | null>(null);
  const lastSpawnRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const nextIdRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const zombiesRef = useRef<Zombie[]>([]);
  const currentInputRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Adaptive Scaling Logic
  useEffect(() => {
    const handleResize = () => {
      const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const offsetTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
      
      setIsPortrait(height > width);
      setViewportHeight(`${height}px`);
      
      if (rootRef.current) {
        rootRef.current.style.top = `${offsetTop}px`;
      }

      // Target resolution: GAME_WIDTH x GAME_HEIGHT
      const scaleX = width / GAME_WIDTH;
      const scaleY = height / GAME_HEIGHT;
      
      // Use min scale to ensure everything fits
      const scale = Math.min(scaleX, scaleY) * 0.98;
      
      setContainerScale(scale);
      
      // Prevent browser from scrolling away
      window.scrollTo(0, 0);
    };

    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Focus input for mobile keyboard
  const focusInput = useCallback(() => {
    if (!isPaused && !isPortrait) {
      inputRef.current?.focus();
    }
  }, [isPaused, isPortrait]);

  useEffect(() => {
    if (gameState === 'playing' && !isPaused) {
      focusInput();
    }
  }, [gameState, isPaused, focusInput]);
  useEffect(() => {
    zombiesRef.current = zombies;
  }, [zombies]);

  useEffect(() => {
    currentInputRef.current = currentInput;
  }, [currentInput]);

  // Start Game
  const startGame = () => {
    setGameState('playing');
    setZombies([]);
    zombiesRef.current = [];
    setCurrentInput('');
    currentInputRef.current = '';
    setScore(0);
    setHealth(MAX_HEALTH);
    setTime(0);
    setExternCharge(0);
    setSpawnRate(INITIAL_SPAWN_RATE);
    setIsExternActive(false);
    setIsPaused(false);
    setCanUseContinueExtern(true);
    lastSpawnRef.current = Date.now();
    lastFrameTimeRef.current = 0;
    startTimeRef.current = Date.now();
    nextIdRef.current = 0;
    setTimeout(focusInput, 100);
  };

  // Game Over
  const gameOver = useCallback(() => {
    setGameState('gameover');
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
  }, []);

  const continueWithExtern = () => {
    if (!canUseContinueExtern) return;
    
    setCanUseContinueExtern(false);
    setHealth(MAX_HEALTH);
    setZombies([]);
    zombiesRef.current = [];
    setGameState('playing');
    setIsPaused(false);
    lastSpawnRef.current = Date.now();
    lastFrameTimeRef.current = 0;
    // We don't reset score or time
    setTimeout(focusInput, 100);
  };

  // Handle Typing
  useEffect(() => {
    const handleInput = (val: string) => {
      if (gameState !== 'playing' || isPaused) return;
      
      const newInput = val;
      const matchedZombieIndex = zombiesRef.current.findIndex(z => z.word.toLowerCase() === newInput.toLowerCase());
      
      if (matchedZombieIndex !== -1) {
        setZombies(prev => {
          const next = prev.filter((_, i) => i !== matchedZombieIndex);
          zombiesRef.current = next;
          return next;
        });
        setScore(s => s + 1);
        setHealth(h => Math.min(MAX_HEALTH, h + HEALTH_GAIN_PER_KILL));
        setExternCharge(prev => Math.min(EXTERN_MAX, prev + 1));
        setCurrentInput('');
        currentInputRef.current = '';
        if (inputRef.current) inputRef.current.value = '';
      } else {
        const isPrefix = zombiesRef.current.some(z => z.word.toLowerCase().startsWith(newInput.toLowerCase()));
        if (isPrefix) {
          setCurrentInput(newInput);
          currentInputRef.current = newInput;
        } else {
          // If not a prefix, reset or keep current if it was a prefix
          // To make it feel better, we only update if it's a valid step
          // or if the user is clearing
          if (newInput.length < currentInputRef.current.length) {
            setCurrentInput(newInput);
            currentInputRef.current = newInput;
          } else if (inputRef.current) {
            inputRef.current.value = currentInputRef.current;
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing' || isPaused) return;
      if (e.key === 'Enter') focusInput();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isPaused, focusInput]);

  // Game Loop
  useEffect(() => {
    if (gameState !== 'playing' || isPaused) return;

    const loop = (timestamp: number) => {
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
      const dt = (timestamp - lastFrameTimeRef.current) / 1000; // delta time in seconds
      lastFrameTimeRef.current = timestamp;

      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTimeRef.current) / 1000);
      setTime(elapsedSeconds);

      const isTutorial = elapsedSeconds < TUTORIAL_DURATION;
      const maxZombies = isTutorial 
        ? MAX_ZOMBIES_INITIAL 
        : Math.min(MAX_ZOMBIES_FINAL, MAX_ZOMBIES_INITIAL + Math.floor((elapsedSeconds - TUTORIAL_DURATION) / 8));
      
      // Spawn logic
      const currentSpawnRate = isExternActive ? spawnRate * EXTERN_SPAWN_MULTIPLIER : spawnRate;
      if (zombiesRef.current.length < maxZombies && now - lastSpawnRef.current > currentSpawnRate) {
        // Delay speed acceleration until after 30 seconds
        const speedPhase = Math.max(0, elapsedSeconds - 30);
        const depth = Math.random(); // 0 (front) to 1 (back)
        const yOffset = depth * 25; // Increased vertical spread for perspective
        const perspectiveScale = 1 - (depth * 0.3); // smaller if further back
        
        const newZombie: Zombie = {
          id: nextIdRef.current++,
          word: WORDS[Math.floor(Math.random() * WORDS.length)],
          x: 130, // Start further off-screen to ensure smooth entry
          y: yOffset,
          depth: depth,
          speed: (STEP_SPEED + speedPhase * SPEED_INCREMENT) * perspectiveScale,
          type: Math.floor(Math.random() * 4),
          scale: (0.9 + Math.random() * 0.4) * perspectiveScale
        };
        setZombies(prev => {
          const next = [...prev, newZombie];
          zombiesRef.current = next;
          return next;
        });
        lastSpawnRef.current = now;
        
        if (!isTutorial && !isExternActive) {
          setSpawnRate(prev => Math.max(MIN_SPAWN_RATE, prev - SPAWN_ACCELERATION));
        }
      }

      // Movement and Attack logic
      setZombies(prev => {
        let totalDamage = 0;
        const toDestroy: number[] = [];

        const updated = prev.map(z => {
          let nextX = z.x;
          let isAttacking = z.isAttacking || false;
          let attackStartTime = z.attackStartTime || null;

          // Movement
          nextX -= z.speed * dt;

          // EXTERN logic: Destroy at center (x: 60)
          if (isExternActive && nextX <= 60) {
            toDestroy.push(z.id);
          }

          // Normal attack logic (only if not being destroyed by EXTERN)
          if (!isExternActive) {
            if (nextX <= 25) {
              nextX = 25;
              if (!isAttacking) {
                isAttacking = true;
                attackStartTime = now;
              }
            }

            if (isAttacking && attackStartTime && now - attackStartTime > ATTACK_DELAY_MS) {
              totalDamage += HEALTH_DRAIN_PER_SEC * dt;
            }
          }

          return { ...z, x: nextX, isAttacking, attackStartTime };
        });

        // Handle destruction from EXTERN
        if (toDestroy.length > 0) {
          const count = toDestroy.length;
          setScore(s => s + count);
          setHealth(h => Math.min(MAX_HEALTH, h + (count * HEALTH_GAIN_PER_KILL)));
          
          const filtered = updated.filter(z => !toDestroy.includes(z.id));
          zombiesRef.current = filtered;
          return filtered;
        }

        if (totalDamage > 0) {
          setHealth(h => {
            const next = h - totalDamage;
            if (next <= 0) {
              gameOver();
              return 0;
            }
            return next;
          });
        }

        zombiesRef.current = updated;
        return updated;
      });

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, isExternActive, isPaused, spawnRate, gameOver]);

  // Extern Ability
  const triggerExtern = () => {
    if (externCharge < EXTERN_MAX || isExternActive) return;
    
    setIsExternActive(true);
    setExternCharge(0);
    
    setTimeout(() => {
      setIsExternActive(false);
      lastSpawnRef.current = Date.now();
    }, EXTERN_DURATION);
  };

  const togglePause = () => {
    if (gameState !== 'playing') return;
    setIsPaused(prev => !prev);
    if (!isPaused) {
      lastFrameTimeRef.current = 0; // Reset frame time on resume
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={rootRef}
      className="fixed inset-0 overflow-hidden bg-black flex items-center justify-center font-sans touch-none"
      style={{ height: viewportHeight }}
      onClick={focusInput}
    >
      {/* Elongated Background for Mobile/Wide screens */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://i.ibb.co/tTVcbsPw/generated-image-94.png"
          alt="Office Background"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Fixed Aspect Ratio Game Container */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden shrink-0 z-10"
        style={{
          width: `${GAME_WIDTH}px`,
          height: `${GAME_HEIGHT}px`,
          transform: `scale(${containerScale})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Hidden Input for Mobile Keyboard */}
        <input
          ref={inputRef}
          type="text"
          className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none"
          onInput={(e) => {
            const target = e.target as HTMLInputElement;
            const handleInput = (val: string) => {
              if (gameState !== 'playing' || isPaused) return;
              const newInput = val;
              const matchedZombieIndex = zombiesRef.current.findIndex(z => z.word.toLowerCase() === newInput.toLowerCase());
              if (matchedZombieIndex !== -1) {
                setZombies(prev => {
                  const next = prev.filter((_, i) => i !== matchedZombieIndex);
                  zombiesRef.current = next;
                  return next;
                });
                setScore(s => s + 1);
                setHealth(h => Math.min(MAX_HEALTH, h + HEALTH_GAIN_PER_KILL));
                setExternCharge(prev => Math.min(EXTERN_MAX, prev + 1));
                setCurrentInput('');
                currentInputRef.current = '';
                target.value = '';
              } else {
                const isPrefix = zombiesRef.current.some(z => z.word.toLowerCase().startsWith(newInput.toLowerCase()));
                if (isPrefix) {
                  setCurrentInput(newInput);
                  currentInputRef.current = newInput;
                } else {
                  if (newInput.length < currentInputRef.current.length) {
                    setCurrentInput(newInput);
                    currentInputRef.current = newInput;
                  } else {
                    target.value = currentInputRef.current;
                  }
                }
              }
            };
            handleInput(target.value);
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        
        {/* HUD: Top Left */}
        <div className="absolute top-10 left-10 z-50 flex flex-col gap-4">
          <div className="bg-zinc-900/95 border-4 border-zinc-700 p-6 rounded-2xl shadow-2xl flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Время выживания</span>
              <div className="flex items-center gap-3">
                <Timer className="w-6 h-6 text-amber-500" />
                <span className="text-4xl font-mono font-bold text-white">{formatTime(time)}</span>
              </div>
            </div>
            <div className="w-px h-16 bg-zinc-700" />
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Побеждено</span>
              <div className="flex items-center gap-3">
                <Skull className="w-6 h-6 text-red-500" />
                <span className="text-4xl font-mono font-bold text-white">{score}</span>
              </div>
            </div>
            <div className="w-px h-16 bg-zinc-700" />
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Здоровье</span>
              <div className="flex items-center gap-3">
                <div className="w-48 h-6 bg-zinc-800 rounded-full overflow-hidden border-2 border-zinc-700 relative">
                  <motion.div 
                    className={`h-full ${health > 30 ? 'bg-green-500' : 'bg-red-500'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${(health / MAX_HEALTH) * 100}%` }}
                  />
                </div>
                <span className="text-lg font-mono font-bold text-white">{Math.ceil(health)}%</span>
              </div>
            </div>
            <div className="w-px h-16 bg-zinc-700" />
            <button 
              onClick={togglePause}
              className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors text-white"
            >
              {isPaused ? <Play className="w-10 h-10 fill-current" /> : <Pause className="w-10 h-10 fill-current" />}
            </button>
          </div>
        </div>

        {/* HUD: Top Right - Extern Button */}
        <div className="absolute top-10 right-10 z-50">
          <button 
            onClick={triggerExtern}
            disabled={externCharge < EXTERN_MAX || isExternActive}
            className={`group relative flex flex-col items-end transition-all duration-300 ${externCharge >= EXTERN_MAX ? 'scale-110' : 'opacity-80'}`}
          >
            <div className="bg-zinc-900/95 border-4 border-zinc-700 p-5 rounded-2xl shadow-2xl flex items-center gap-5">
              <div className="flex flex-col items-end">
                <div className="h-8 mb-2 flex items-center justify-center bg-orange-500 px-4 rounded-lg text-xs font-bold text-white">EXTERN</div>
                <div className="w-48 h-4 bg-zinc-800 rounded-full overflow-hidden border-2 border-zinc-700">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${(externCharge / EXTERN_MAX) * 100}%` }}
                  />
                </div>
              </div>
              <div className={`p-4 rounded-xl transition-colors ${externCharge >= EXTERN_MAX ? 'bg-orange-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>
                <Zap className="w-10 h-10" />
              </div>
            </div>
            {externCharge >= EXTERN_MAX && (
              <span className="text-xs font-bold text-orange-400 mt-2 uppercase tracking-tighter animate-bounce">Нажми для очистки!</span>
            )}
          </button>
        </div>

        {/* Game Area */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Accountant at Desk (Left) */}
          <div className="absolute bottom-[-10%] left-[-15%] w-[1300px] h-[1300px] z-30">
            <img 
              src="https://i.ibb.co/hxG46cfk/hero.png"
              alt="Heroine Accountant"
              className="w-full h-full object-contain object-bottom"
              referrerPolicy="no-referrer"
            />

            <AnimatePresence>
              {currentInput && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute top-[20%] left-[55%] -translate-x-1/2 bg-white border-4 border-zinc-900 px-10 py-5 rounded-2xl shadow-2xl z-[60]"
                >
                  <span className="text-5xl font-mono font-bold text-zinc-900 tracking-tight">{currentInput}</span>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border-r-4 border-b-4 border-zinc-900 rotate-45" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Zombies (Enemies from Right) */}
          <AnimatePresence>
            {zombies.map(zombie => (
              <motion.div
                key={zombie.id}
                initial={{ x: '2500px', opacity: 0 }}
                animate={{ 
                  x: `${(zombie.x / 100) * GAME_WIDTH}px`, 
                  opacity: 1,
                  filter: isExternActive && zombie.x <= 70 ? 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)' : 'none'
                }}
                exit={{ 
                  scale: 0, 
                  opacity: 0,
                  rotate: 45,
                  filter: 'brightness(5) sepia(1) hue-rotate(-50deg)'
                }}
                transition={{ type: 'tween', ease: 'linear', duration: 0 }}
                className="absolute w-[300px] h-[400px] flex flex-col items-center"
                style={{ 
                  bottom: `${10 + zombie.y}%`,
                  scale: zombie.scale,
                  zIndex: 20 - Math.floor(zombie.depth * 10)
                }}
              >
                <div className="mb-4 relative z-40">
                  <div className="bg-zinc-900 border-4 border-orange-500 px-6 py-3 rounded-xl shadow-2xl">
                    <span className="text-2xl font-black text-white whitespace-nowrap uppercase tracking-tight">
                      {zombie.word.split('').map((char, i) => (
                        <span 
                          key={i} 
                          className={currentInput.toLowerCase()[i] === char.toLowerCase() ? 'text-orange-400' : 'text-white'}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-orange-500 rotate-45 border-r-4 border-b-4 border-zinc-900" />
                </div>

                <div className="w-full h-full flex items-center justify-center z-20">
                  <img 
                    src={ZOMBIE_IMAGES[zombie.type % ZOMBIE_IMAGES.length]}
                    alt="Zombie Deadline"
                    className="w-full h-full object-contain object-bottom"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Screens */}
        <AnimatePresence>
          {isPaused && (
            <div className="absolute inset-0 z-[150] bg-zinc-900/40 backdrop-blur-md flex items-center justify-center p-10">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center max-w-full"
              >
                <h2 className="text-9xl font-black text-white mb-12 uppercase tracking-tighter">ПАУЗА</h2>
                <button 
                  onClick={togglePause}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-20 py-8 rounded-3xl transition-all active:scale-95 flex items-center gap-6 mx-auto shadow-2xl text-4xl"
                >
                  <Play className="w-12 h-12 fill-current" />
                  ПРОДОЛЖИТЬ
                </button>
              </motion.div>
            </div>
          )}

          {gameState === 'start' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-zinc-900/90 backdrop-blur-md flex items-center justify-center p-10"
            >
              <div className="max-w-4xl w-full max-h-[95%] bg-zinc-800 border-8 border-zinc-700 p-10 rounded-[3rem] shadow-2xl overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-10 mb-10">
                  <div className="w-24 h-24 bg-orange-500 rounded-3xl flex items-center justify-center shadow-lg shrink-0 rotate-3">
                    <Keyboard className="w-16 h-16 text-white" />
                  </div>
                  <div>
                    <h1 className="text-6xl font-black text-white uppercase tracking-tighter leading-none mb-2">Бухгалтер против Дедлайнов</h1>
                    <p className="text-orange-400 font-bold text-xl uppercase tracking-widest">Симулятор выживания в отчетный период</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10 text-left">
                  <div className="bg-zinc-900/50 p-8 rounded-3xl border-2 border-zinc-700">
                    <h3 className="text-2xl text-white font-bold mb-4 flex items-center gap-4">
                      <Zap className="w-6 h-6 text-amber-500" /> Как играть
                    </h3>
                    <ul className="text-zinc-400 text-lg space-y-3">
                      <li>• Печатайте слова над зомби-отчетами, чтобы уничтожить их.</li>
                      <li>• Не давайте им дойти до вашего стола (левый край).</li>
                      <li>• Каждый убитый зомби восстанавливает 5% здоровья.</li>
                    </ul>
                  </div>
                  <div className="bg-zinc-900/50 p-8 rounded-3xl border-2 border-zinc-700">
                    <h3 className="text-2xl text-white font-bold mb-4 flex items-center gap-4">
                      <Heart className="w-6 h-6 text-red-500" /> Опасности
                    </h3>
                    <ul className="text-zinc-400 text-lg space-y-3">
                      <li>• У стола зомби ждут 1.5 сек, а затем начинают атаку.</li>
                      <li>• Атака зомби быстро истощает вашу шкалу здоровья.</li>
                      <li>• Используйте кнопку EXTERN, чтобы очистить всё поле.</li>
                    </ul>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    startGame();
                    inputRef.current?.focus();
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-8 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-6 shadow-xl shadow-orange-500/20 text-4xl"
                >
                  <Play className="w-12 h-12 fill-current" />
                  ПРИНЯТЬ ВЫЗОВ
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-[100] bg-red-900/80 backdrop-blur-sm flex items-center justify-center p-10"
            >
              <div className="max-w-2xl w-full max-h-[95%] bg-zinc-900 border-8 border-red-500 p-10 rounded-[2.5rem] shadow-2xl text-center overflow-y-auto custom-scrollbar">
                <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg animate-bounce">
                  <Skull className="w-16 h-16 text-white" />
                </div>
                <h2 className="text-7xl font-black text-white mb-4 uppercase tracking-tighter">ВЫ ЗАВАЛЕНЫ!</h2>
                <p className="text-2xl text-red-200 mb-10">Налоговая проверка добралась до вас. Отчетность не сдана.</p>
                
                <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="bg-zinc-800 p-6 rounded-3xl border-2 border-zinc-700">
                    <span className="text-lg uppercase text-zinc-500 font-bold block mb-1">Время</span>
                    <span className="text-4xl font-mono font-bold text-white">{formatTime(time)}</span>
                  </div>
                  <div className="bg-zinc-800 p-6 rounded-3xl border-2 border-zinc-700">
                    <span className="text-lg uppercase text-zinc-500 font-bold block mb-1">Сдано отчетов</span>
                    <span className="text-4xl font-mono font-bold text-white">{score}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  {canUseContinueExtern && (
                    <button 
                      onClick={continueWithExtern}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 rounded-2xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1 shadow-lg shadow-orange-500/20 text-2xl border-4 border-orange-400"
                    >
                      <div className="flex items-center gap-4">
                        <Zap className="w-8 h-8 fill-current" />
                        <span>ПОДКЛЮЧИТЬ ЭКСТЕРН И ПРОДОЛЖИТЬ ИГРУ</span>
                      </div>
                      <span className="text-xs opacity-80 uppercase tracking-widest">Доступно 1 раз за сессию</span>
                    </button>
                  )}

                  <button 
                    onClick={startGame}
                    className="w-full bg-white hover:bg-zinc-200 text-zinc-900 font-bold py-6 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-6 shadow-lg text-3xl"
                  >
                    <RotateCcw className="w-8 h-8" />
                    ПОПРОБОВАТЬ СНОВА
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Extern Break Overlay */}
        <AnimatePresence>
          {isExternActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-orange-500/20 pointer-events-none flex items-center justify-center"
            >
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-orange-500 text-white px-16 py-8 rounded-full font-black text-7xl shadow-2xl border-8 border-white"
              >
                ЭКСТЕРН АКТИВИРОВАН!
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Orientation Lock Overlay */}
      <AnimatePresence>
        {isPortrait && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-zinc-900 flex flex-col items-center justify-center p-12 text-center"
          >
            <motion.div
              animate={{ rotate: 90 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="mb-8"
            >
              <RotateCcw className="w-24 h-24 text-orange-500" />
            </motion.div>
            <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Поверните устройство</h2>
            <p className="text-zinc-400">Для игры в "Бухгалтер против Дедлайнов" необходимо использовать горизонтальный режим.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 text-zinc-400/50 text-[10px] font-bold uppercase tracking-widest">
        <Keyboard className="w-3 h-3" />
        <span>Печатайте на клавиатуре {isPortrait ? '' : '(или нажмите на экран)'}</span>
      </div>
    </div>
  );
}
