export const WORDS = [
  "Сальдо",
  "Маржа",
  "ФСБУ",
  "Налоговая проверка",
  "Налоги",
  "Учёт",
  "Дебет",
  "Кредит",
  "Баланс",
  "Отчётность",
  "Аудит",
  "НДС",
  "Прибыль",
  "Убыток",
  "Проводка",
  "Инвентаризация",
  "Амортизация",
  "Актив",
  "Пассив",
  "Дивиденды",
  "Капитал",
  "Ликвидность",
  "Офшор",
  "Пеня",
  "Рентабельность",
  "Субсидия",
  "Тендер",
  "Уставный капитал",
  "Факторинг",
  "Хеджирование",
  "Эмиссия",
  "Юрлицо"
];

export const TUTORIAL_DURATION = 5; // shorter initial phase for 20s game
export const INITIAL_SPAWN_RATE = 2000; // ms (faster initial spawn)
export const MIN_SPAWN_RATE = 600; // ms
export const SPAWN_ACCELERATION = 300; // ms (faster acceleration)
export const MAX_ZOMBIES_INITIAL = 4; 
export const MAX_ZOMBIES_FINAL = 10; // More zombies for intensity
export const MAX_HEALTH = 100;
export const HEALTH_DRAIN_PER_SEC = 25; // Dies faster if overwhelmed
export const HEALTH_GAIN_PER_KILL = 4;
export const ATTACK_DELAY_MS = 1000; // 1 second delay
export const EXTERN_MAX = 4; 
export const EXTERN_DURATION = 5000; // 5 seconds
export const EXTERN_SPAWN_MULTIPLIER = 0.5; // 2x faster spawning during frenzy
export const GAME_DURATION = 20; // 20 seconds limit

// Speed constants
// To reach from x:130 to x:18 (112 units) in 3 seconds:
// 112 / 3 = 37.3 units per second
export const STEP_SPEED = 20; 
export const SPEED_INCREMENT = 0.7; // slower acceleration

export const GAME_WIDTH = 1600;
export const GAME_HEIGHT = 900;
