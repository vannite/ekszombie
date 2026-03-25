/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Skull, Zap, Keyboard, Play, RotateCcw, Pause, Heart } from 'lucide-react';
import { WORDS, TUTORIAL_DURATION, INITIAL_SPAWN_RATE, MIN_SPAWN_RATE, SPAWN_ACCELERATION, MAX_ZOMBIES_INITIAL, MAX_ZOMBIES_FINAL, EXTERN_MAX, EXTERN_DURATION, EXTERN_SPAWN_MULTIPLIER, STEP_SPEED, SPEED_INCREMENT, MAX_HEALTH, HEALTH_DRAIN_PER_SEC, HEALTH_GAIN_PER_KILL, ATTACK_DELAY_MS } from './constants';

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
  
  const gameLoopRef = useRef<number | null>(null);
  const lastSpawnRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const nextIdRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const zombiesRef = useRef<Zombie[]>([]);
  const currentInputRef = useRef('');

  // Sync refs with state
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
    lastSpawnRef.current = Date.now();
    lastFrameTimeRef.current = 0;
    startTimeRef.current = Date.now();
    nextIdRef.current = 0;
  };

  // Game Over
  const gameOver = useCallback(() => {
    setGameState('gameover');
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
  }, []);

  // Handle Typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing' || isPaused) return;

      if (e.key === 'Backspace') {
        setCurrentInput(prev => {
          const next = prev.slice(0, -1);
          currentInputRef.current = next;
          return next;
        });
        return;
      }

      if (e.key.length === 1) {
        const nextChar = e.key;
        const newInput = currentInputRef.current + nextChar;
        
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
        } else {
          const isPrefix = zombiesRef.current.some(z => z.word.toLowerCase().startsWith(newInput.toLowerCase()));
          if (isPrefix) {
            setCurrentInput(newInput);
            currentInputRef.current = newInput;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isPaused]);

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
        const yOffset = depth * 15; // 0% to 15% from bottom
        const perspectiveScale = 1 - (depth * 0.3); // smaller if further back
        
        const newZombie: Zombie = {
          id: nextIdRef.current++,
          word: WORDS[Math.floor(Math.random() * WORDS.length)],
          x: 110, // Start slightly off-screen
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
            if (nextX <= 18) {
              nextX = 18;
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
    <div className="relative w-full h-screen overflow-hidden font-sans">
      {/* Background Layer */}
      <div className="absolute inset-0 bg-[#1a1a1a]">
        <img 
          src="https://i.ibb.co/PRn2Mk4/loc.png"
          alt="Office Location"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* HUD: Top Left */}
      <div className="absolute top-6 left-6 z-50 flex flex-col gap-2">
        <div className="bg-zinc-900/90 border-2 border-zinc-700 p-4 rounded-lg shadow-2xl flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Время выживания</span>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-500" />
              <span className="text-2xl font-mono font-bold text-white">{formatTime(time)}</span>
            </div>
          </div>
          <div className="w-px h-10 bg-zinc-700" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Побеждено</span>
            <div className="flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-500" />
              <span className="text-2xl font-mono font-bold text-white">{score}</span>
            </div>
          </div>
          <div className="w-px h-10 bg-zinc-700" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Здоровье</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-4 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700 relative">
                <motion.div 
                  className={`h-full ${health > 30 ? 'bg-green-500' : 'bg-red-500'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${(health / MAX_HEALTH) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-white">{Math.ceil(health)}%</span>
            </div>
          </div>
          <div className="w-px h-10 bg-zinc-700" />
          <button 
            onClick={togglePause}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors text-white"
          >
            {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
          </button>
        </div>
      </div>

      {/* HUD: Top Right - Extern Button */}
      <div className="absolute top-6 right-6 z-50">
        <button 
          onClick={triggerExtern}
          disabled={externCharge < EXTERN_MAX || isExternActive}
          className={`group relative flex flex-col items-end transition-all duration-300 ${externCharge >= EXTERN_MAX ? 'scale-110' : 'opacity-80'}`}
        >
          <div className="bg-zinc-900/90 border-2 border-zinc-700 p-3 rounded-lg shadow-2xl flex items-center gap-3">
            <div className="flex flex-col items-end">
              <div className="h-6 mb-1 flex items-center justify-center bg-orange-500 px-2 rounded text-[10px] font-bold text-white">EXTERN</div>
              <div className="w-32 h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <motion.div 
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${(externCharge / EXTERN_MAX) * 100}%` }}
                />
              </div>
            </div>
            <div className={`p-2 rounded-md transition-colors ${externCharge >= EXTERN_MAX ? 'bg-orange-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>
              <Zap className="w-6 h-6" />
            </div>
          </div>
          {externCharge >= EXTERN_MAX && (
            <span className="text-[10px] font-bold text-orange-400 mt-1 uppercase tracking-tighter animate-bounce">Нажми для очистки!</span>
          )}
        </button>
      </div>

      {/* Game Area */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Accountant at Desk (Left) */}
        <div className="absolute bottom-[2%] left-[-12%] w-[1100px] h-[1100px] z-30">
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
                className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white border-4 border-zinc-900 px-6 py-3 rounded-xl shadow-2xl z-[60]"
              >
                <span className="text-2xl font-mono font-bold text-zinc-900 tracking-tight">{currentInput}</span>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-4 border-b-4 border-zinc-900 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Zombies (Enemies from Right) */}
        <AnimatePresence>
          {zombies.map(zombie => (
            <motion.div
              key={zombie.id}
              initial={{ x: '120vw', opacity: 0 }}
              animate={{ 
                x: `${zombie.x}vw`, 
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
              className="absolute w-[250px] h-[350px] flex flex-col items-center"
              style={{ 
                bottom: `${2 + zombie.y}%`,
                scale: zombie.scale,
                zIndex: 20 - Math.floor(zombie.depth * 10)
              }}
            >
              <div className="mb-2 relative z-40">
                <div className="bg-zinc-900 border-2 border-orange-500 px-4 py-2 rounded-lg shadow-2xl">
                  <span className="text-xl font-black text-white whitespace-nowrap uppercase tracking-tight">
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
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-orange-500 rotate-45 border-r-4 border-b-4 border-zinc-900" />
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
          <div className="absolute inset-0 z-[150] bg-zinc-900/40 backdrop-blur-md flex items-center justify-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <h2 className="text-6xl font-black text-white mb-8 uppercase tracking-tighter">ПАУЗА</h2>
              <button 
                onClick={togglePause}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-12 py-4 rounded-xl transition-all active:scale-95 flex items-center gap-3 mx-auto shadow-lg"
              >
                <Play className="w-8 h-8 fill-current" />
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
            className="absolute inset-0 z-[100] bg-zinc-900/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="max-w-2xl w-full bg-zinc-800 border-4 border-zinc-700 p-8 rounded-3xl shadow-2xl">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0 rotate-3">
                  <Keyboard className="w-12 h-12 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Бухгалтер против Дедлайнов</h1>
                  <p className="text-orange-400 font-bold text-sm uppercase tracking-widest">Симулятор выживания в отчетный период</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8 text-left">
                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-700">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> Как играть
                  </h3>
                  <ul className="text-zinc-400 text-xs space-y-2">
                    <li>• Печатайте слова над зомби-отчетами, чтобы уничтожить их.</li>
                    <li>• Не давайте им дойти до вашего стола (левый край).</li>
                    <li>• Каждый убитый зомби восстанавливает 5% здоровья.</li>
                  </ul>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-700">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500" /> Опасности
                  </h3>
                  <ul className="text-zinc-400 text-xs space-y-2">
                    <li>• У стола зомби ждут 1.5 сек, а затем начинают атаку.</li>
                    <li>• Атака зомби быстро истощает вашу шкалу здоровья.</li>
                    <li>• Используйте кнопку EXTERN, чтобы очистить всё поле.</li>
                  </ul>
                </div>
              </div>

              <button 
                onClick={startGame}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 text-xl"
              >
                <Play className="w-8 h-8 fill-current" />
                ПРИНЯТЬ ВЫЗОВ
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'gameover' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[100] bg-red-900/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <div className="max-w-md w-full bg-zinc-900 border-4 border-red-500 p-8 rounded-2xl shadow-2xl text-center">
              <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
                <Skull className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">ВЫ ЗАВАЛЕНЫ!</h2>
              <p className="text-red-200 mb-8">Налоговая проверка добралась до вас. Отчетность не сдана.</p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">Время</span>
                  <span className="text-2xl font-mono font-bold text-white">{formatTime(time)}</span>
                </div>
                <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">Сдано отчетов</span>
                  <span className="text-2xl font-mono font-bold text-white">{score}</span>
                </div>
              </div>

              <button 
                onClick={startGame}
                className="w-full bg-white hover:bg-zinc-200 text-zinc-900 font-bold py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg"
              >
                <RotateCcw className="w-6 h-6" />
                ПОПРОБОВАТЬ СНОВА
              </button>
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
              className="bg-orange-500 text-white px-8 py-4 rounded-full font-black text-4xl shadow-2xl border-4 border-white"
            >
              ЭКСТЕРН АКТИВИРОВАН!
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 text-zinc-400/50 text-[10px] font-bold uppercase tracking-widest">
        <Keyboard className="w-3 h-3" />
        <span>Печатайте на клавиатуре</span>
      </div>
    </div>
  );
}
