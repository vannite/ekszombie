/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Skull, Zap, Keyboard, Play, RotateCcw, Pause, Heart, Target, CheckCircle2, XCircle } from 'lucide-react';
import { WORDS, TUTORIAL_DURATION, INITIAL_SPAWN_RATE, MIN_SPAWN_RATE, SPAWN_ACCELERATION, MAX_ZOMBIES_INITIAL, MAX_ZOMBIES_FINAL, EXTERN_MAX, EXTERN_DURATION, EXTERN_SPAWN_MULTIPLIER, STEP_SPEED, SPEED_INCREMENT, MAX_HEALTH, HEALTH_DRAIN_PER_SEC, HEALTH_GAIN_PER_KILL, ATTACK_DELAY_MS, GAME_WIDTH, GAME_HEIGHT, GAME_DURATION } from './constants';

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
  const [gameResult, setGameResult] = useState<'win' | 'loss' | null>(null);
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
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
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
      
      const isLandscape = width > height;
      const keyboardActive = isLandscape && height < 500;
      
      setIsPortrait(!isLandscape);
      setIsKeyboardMode(keyboardActive);
      setViewportHeight(`${height}px`);
      
      if (rootRef.current) {
        rootRef.current.style.top = `${offsetTop}px`;
      }

      // Target resolution: GAME_WIDTH x GAME_HEIGHT
      const scaleX = width / GAME_WIDTH;
      const scaleY = height / GAME_HEIGHT;
      
      // In keyboard mode, scale to fill width and align to bottom
      const scale = keyboardActive ? scaleX : Math.min(scaleX, scaleY) * 0.98;
      
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
    setGameResult(null);
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
    // Do not reset nextIdRef.current to 0 to avoid duplicate keys with exiting zombies
    if (inputRef.current) inputRef.current.value = '';
    setTimeout(focusInput, 100);
  };

  // Game Over
  const gameOver = useCallback((result: 'win' | 'loss') => {
    setGameState('gameover');
    setGameResult(result);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
  }, []);

  const continueWithExtern = () => {
    if (!canUseContinueExtern) return;
    
    setCanUseContinueExtern(false);
    setHealth(MAX_HEALTH);
    setZombies([]);
    zombiesRef.current = [];
    setGameState('playing');
    setGameResult(null);
    setIsPaused(false);
    lastSpawnRef.current = Date.now();
    lastFrameTimeRef.current = 0;
    if (inputRef.current) inputRef.current.value = '';
    // We don't reset score or time
    setTimeout(focusInput, 100);
  };

  // Handle Typing
  const handleTyping = useCallback((val: string) => {
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
        if (newInput.length < currentInputRef.current.length) {
          setCurrentInput(newInput);
          currentInputRef.current = newInput;
        } else if (inputRef.current) {
          inputRef.current.value = currentInputRef.current;
        }
      }
    }
  }, [gameState, isPaused]);

  useEffect(() => {
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

      if (elapsedSeconds >= GAME_DURATION) {
        gameOver('win');
        return;
      }

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
              gameOver('loss');
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
          transformOrigin: isKeyboardMode ? 'center bottom' : 'center center'
        }}
      >
        {/* Hidden Input for Mobile Keyboard */}
        <input
          ref={inputRef}
          type="text"
          className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none"
          onInput={(e) => handleTyping((e.target as HTMLInputElement).value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        
        {/* HUD: Top Left */}
        <div className={`absolute ${isKeyboardMode ? 'bottom-10' : 'top-10'} left-10 z-50 flex flex-col gap-4`}>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl shadow-2xl flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-black mb-1">Осталось времени</span>
              <div className="flex items-center gap-3">
                <Timer className="w-6 h-6 text-orange-400" />
                <span className="text-4xl font-mono font-black text-white">{Math.max(0, GAME_DURATION - time)}с</span>
              </div>
            </div>
            
            <div className="w-px h-12 bg-white/10" />
            
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-black mb-1">Сдано отчетов</span>
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-blue-400" />
                <span className="text-4xl font-mono font-black text-white">{score}</span>
              </div>
            </div>

            <div className="w-px h-12 bg-white/10" />

            <div className="flex flex-col min-w-[200px]">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-black mb-1">Здоровье</span>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden border border-white/10">
                  <motion.div 
                    className={`h-full ${health < 30 ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${(health / MAX_HEALTH) * 100}%` }}
                  />
                </div>
                <span className="text-xl font-mono font-black text-white">{Math.ceil(health)}%</span>
              </div>
            </div>

            <button 
              onClick={togglePause}
              className="ml-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white transition-all active:scale-90"
            >
              {isPaused ? <Play className="w-8 h-8 fill-current" /> : <Pause className="w-8 h-8 fill-current" />}
            </button>
          </div>
        </div>

        {/* Extern Button: Top Right */}
        <div className={`absolute ${isKeyboardMode ? 'bottom-10' : 'top-10'} right-10 z-50 flex flex-col items-center gap-3`}>
          <button 
            onClick={triggerExtern}
            disabled={externCharge < EXTERN_MAX || isExternActive}
            className="group relative"
          >
            <div className="flex items-center gap-6 bg-white/10 backdrop-blur-3xl border border-white/20 p-3 pr-8 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95">
              {/* Logo Area */}
              <div className={`w-28 h-28 rounded-full flex items-center justify-center transition-all ${externCharge >= EXTERN_MAX ? 'bg-white shadow-[0_0_50px_rgba(255,255,255,0.4)] animate-pulse' : 'bg-white/10'}`}>
                <div className="flex flex-col items-center -space-y-1 select-none">
                  <span className="text-xl font-bold text-black tracking-tighter leading-none">Контур</span>
                  <span className="text-2xl font-black text-[#FF6321] tracking-tighter leading-none">Экстерн</span>
                </div>
              </div>

              {/* Charge Info */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <span className={`text-[8px] font-bold tracking-[0.3em] uppercase transition-colors ${externCharge >= EXTERN_MAX ? 'text-white' : 'text-white/30'}`}>Заряд энергии</span>
                  {externCharge >= EXTERN_MAX && <Zap className="w-5 h-5 text-[#FF6321] fill-current" />}
                </div>
                <div className="w-48 h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-[#FF6321] to-amber-400"
                    animate={{ 
                      width: `${(externCharge / EXTERN_MAX) * 100}%`,
                    }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </div>
              </div>
            </div>
          </button>
          
          {/* Text under the button */}
          <span className={`text-sm font-bold uppercase tracking-[0.2em] transition-all ${externCharge >= EXTERN_MAX ? 'text-[#FF6321] drop-shadow-[0_0_10px_rgba(255,99,33,0.3)]' : 'text-white/20'}`}>
            свести все отчёты
          </span>
        </div>

        {/* Game Area */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Accountant at Desk (Left) */}
          <div className="absolute bottom-0 left-0 w-[900px] h-[900px] z-30">
            <img 
              src="https://i.ibb.co/hxG46cfk/hero.png"
              alt="Heroine Accountant"
              className="w-full h-full object-contain object-bottom"
              referrerPolicy="no-referrer"
            />

            <AnimatePresence mode="popLayout">
              {currentInput && (
                <motion.div 
                  key="input-bubble"
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
          <AnimatePresence mode="popLayout">
            {zombies.map(zombie => (
              <motion.div
                key={`zombie-${zombie.id}`}
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
                          key={`${zombie.id}-char-${i}`} 
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

      </div>

      {/* MODALS & OVERLAYS (Outside Game Container for correct layering) */}
      <AnimatePresence>
        {/* Extern Break Overlay */}
        {isExternActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-orange-500/20 pointer-events-none flex items-center justify-center"
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

        {isPaused && gameState === 'playing' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl flex items-center justify-center p-10"
          >
            <div className="max-w-md w-full bg-white/10 border border-white/20 p-12 rounded-[3rem] shadow-2xl text-center backdrop-blur-3xl">
              <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-10 border border-white/20">
                <Pause className="w-12 h-12 text-white fill-current" />
              </div>
              <h2 className="text-6xl font-black text-white mb-12 uppercase tracking-tighter">ПАУЗА</h2>
              
              <div className="flex flex-col gap-6">
                <button 
                  onClick={togglePause}
                  className="w-full bg-white text-black font-black py-8 rounded-2xl transition-all hover:bg-orange-500 hover:text-white active:scale-95 flex items-center justify-center gap-6 shadow-2xl text-3xl uppercase tracking-widest"
                >
                  <Play className="w-8 h-8 fill-current" />
                  ПРОДОЛЖИТЬ
                </button>
                
                <button 
                  onClick={() => {
                    setIsPaused(false);
                    setGameState('start');
                  }}
                  className="w-full bg-white/5 text-white/60 font-black py-6 rounded-2xl transition-all hover:bg-white/10 hover:text-white active:scale-95 flex items-center justify-center gap-4 text-xl uppercase tracking-widest border border-white/10"
                >
                  <RotateCcw className="w-6 h-6" />
                  В МЕНЮ
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'start' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-2xl flex items-center justify-center p-4"
          >
            <div className="max-w-4xl w-full max-h-[95vh] bg-white/10 border border-white/20 p-8 rounded-[3rem] shadow-2xl overflow-y-auto custom-scrollbar backdrop-blur-3xl">
              <div className="flex items-center gap-8 mb-6">
                <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(249,115,22,0.4)] shrink-0 rotate-3">
                  <img 
                    src="https://s.kontur.ru/common-v2/logos/logo-extern-32.svg" 
                    alt="Extern Logo" 
                    className="w-12 h-12 invert brightness-0"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-1">БУХГАЛТЕР <span className="text-orange-500">VS</span> ДЕДЛАЙН</h1>
                  <p className="text-white/40 font-black text-sm uppercase tracking-[0.3em]">Симулятор выживания в отчетный период</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6 text-left">
                <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10">
                  <h3 className="text-lg text-white font-black mb-3 flex items-center gap-3 uppercase tracking-wider">
                    <Zap className="w-5 h-5 text-amber-500" /> Как играть
                  </h3>
                  <ul className="text-white/60 text-sm space-y-2 font-medium">
                    <li className="flex gap-2"><span className="text-orange-500">01.</span> Печатайте слова над отчетами.</li>
                    <li className="flex gap-2"><span className="text-orange-500">02.</span> У вас есть ровно 20 секунд, чтобы сдать всё.</li>
                    <li className="flex gap-2"><span className="text-orange-500">03.</span> Каждый сданный отчет восстанавливает 5% здоровья.</li>
                  </ul>
                </div>
                <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10">
                  <h3 className="text-lg text-white font-black mb-3 flex items-center gap-3 uppercase tracking-wider">
                    <Heart className="w-5 h-5 text-red-500" /> Опасности
                  </h3>
                  <ul className="text-white/60 text-sm space-y-2 font-medium">
                    <li className="flex gap-2"><span className="text-red-500">!</span> Отчеты атакуют ваш стол, если дойдут.</li>
                    <li className="flex gap-2"><span className="text-red-500">!</span> Атака быстро истощает здоровье.</li>
                    <li className="flex gap-2"><span className="text-red-500">!</span> Если здоровье упадет до 0 — вы проиграли.</li>
                  </ul>
                </div>
              </div>

              <button 
                onClick={() => {
                  startGame();
                  inputRef.current?.focus();
                }}
                className="w-full bg-white text-black font-black py-6 rounded-[1.5rem] transition-all hover:bg-orange-500 hover:text-white active:scale-95 flex items-center justify-center gap-4 shadow-2xl text-3xl uppercase tracking-widest"
              >
                <Play className="w-10 h-10 fill-current" />
                НАЧАТЬ ОТЧЕТ
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'gameover' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`fixed inset-0 z-[100] ${gameResult === 'win' ? 'bg-green-950/80' : 'bg-red-950/80'} backdrop-blur-2xl flex items-center justify-center p-4`}
          >
            <div className={`max-w-2xl w-full max-h-[95vh] bg-white/10 border ${gameResult === 'win' ? 'border-green-500/50' : 'border-red-500/50'} p-8 rounded-[3rem] shadow-2xl text-center overflow-y-auto custom-scrollbar backdrop-blur-3xl`}>
              <div className={`w-20 h-20 ${gameResult === 'win' ? 'bg-green-500 shadow-[0_0_40px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {gameResult === 'win' ? <CheckCircle2 className="w-12 h-12 text-white" /> : <XCircle className="w-12 h-12 text-white" />}
              </div>
              
              <h2 className="text-5xl font-black text-white mb-2 uppercase tracking-tighter">
                {gameResult === 'win' ? 'У ВАС ВСЁ СОШЛОСЬ!' : 'У ВАС НЕ СОШЛОСЬ!'}
              </h2>
              <p className="text-lg text-white/50 mb-6 font-medium">
                {gameResult === 'win' 
                  ? 'Все дедлайны закрыты, баланс идеален. Вы — легенда бухгалтерии!' 
                  : 'Налоговая проверка выявила нарушения. Отчетность заблокирована.'}
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black block mb-1">Время</span>
                  <span className="text-3xl font-mono font-black text-white">{formatTime(time)}</span>
                </div>
                <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black block mb-1">Сдано отчетов</span>
                  <span className="text-3xl font-mono font-black text-white">{score}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {gameResult === 'loss' && canUseContinueExtern && (
                  <button 
                    onClick={continueWithExtern}
                    className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl transition-all hover:bg-orange-600 active:scale-95 flex flex-col items-center justify-center gap-1 shadow-[0_0_30px_rgba(249,115,22,0.3)] text-xl border-2 border-white/20"
                  >
                    <div className="flex items-center gap-3">
                      <Zap className="w-6 h-6 fill-current" />
                      <span>ПОДКЛЮЧИТЬ ЭКСТЕРН</span>
                    </div>
                    <span className="text-[10px] opacity-60 uppercase tracking-[0.2em]">Доступно 1 раз</span>
                  </button>
                )}

                <button 
                  onClick={startGame}
                  className="w-full bg-white text-black font-black py-6 rounded-2xl transition-all hover:bg-zinc-200 active:scale-95 flex items-center justify-center gap-4 shadow-2xl text-2xl uppercase tracking-widest"
                >
                  <RotateCcw className="w-6 h-6" />
                  НОВАЯ СМЕНА
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Orientation Lock Overlay */}
      <AnimatePresence>
        {isPortrait && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-2xl flex flex-col items-center justify-center p-12 text-center"
          >
            <motion.div
              animate={{ rotate: 90 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="mb-12 w-32 h-32 bg-white/10 rounded-[2.5rem] flex items-center justify-center border border-white/20 shadow-2xl"
            >
              <RotateCcw className="w-16 h-16 text-orange-500" />
            </motion.div>
            <h2 className="text-5xl font-black text-white mb-6 uppercase tracking-tighter">Поверните устройство</h2>
            <p className="text-white/40 text-xl font-medium max-w-md">Для игры в "Бухгалтер против Дедлайнов" необходимо использовать горизонтальный режим.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Hint */}
      {!isKeyboardMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 text-zinc-400/50 text-[10px] font-bold uppercase tracking-widest">
          <Keyboard className="w-3 h-3" />
          <span>Печатайте на клавиатуре {isPortrait ? '' : '(или нажмите на экран)'}</span>
        </div>
      )}
    </div>
  );
}
