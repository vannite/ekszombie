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

export const TUTORIAL_DURATION = 15; // seconds (longer initial phase)
export const INITIAL_SPAWN_RATE = 4000; // ms
export const MIN_SPAWN_RATE = 800; // ms
export const SPAWN_ACCELERATION = 150; // ms
export const MAX_ZOMBIES_INITIAL = 3; 
export const MAX_ZOMBIES_FINAL = 8; // Increase count first
export const MAX_HEALTH = 100;
export const HEALTH_DRAIN_PER_SEC = 20; // 100 / 5 = 20 (dies in 5 seconds)
export const HEALTH_GAIN_PER_KILL = 5;
export const ATTACK_DELAY_MS = 1500; // 1.5 seconds delay before health starts draining
export const EXTERN_MAX = 4; 
export const EXTERN_DURATION = 5000; // 5 seconds
export const EXTERN_SPAWN_MULTIPLIER = 0.6; // 1.6x faster spawning during frenzy (was 3x)

// Speed constants
// To reach from x:110 to x:18 (92vw distance) in 8 seconds:
// 92 / 8 = 11.5 units per second
export const STEP_SPEED = 11.5; 
export const SPEED_INCREMENT = 0.2; // even slower acceleration

export const GAME_WIDTH = 1600;
export const GAME_HEIGHT = 900;
