'use strict';

const speciesList = [
  { id: 'roach', mouth: [0.052, 0.572], name: 'Плотва', minGrams: 90, maxGrams: 650, pull: 0.85, take: 'glide',
    trophyGrams: 550, groupSize: [5, 12], feedingY: 0.7,
    activity: { morning: 1, day: 0.7, evening: 1, night: 0.38 },
    habits: 'Стая подходит на среднюю дистанцию утром и вечером.',
    description: 'Серебристые бока, красноватая радужка и оранжевые нижние плавники.' },
  { id: 'perch', mouth: [0.061, 0.596], name: 'Окунь', minGrams: 140, maxGrams: 1400, pull: 1, take: 'sink',
    trophyGrams: 1200, groupSize: [2, 6], feedingY: 0.73,
    activity: { morning: 0.9, day: 1, evening: 0.65, night: 0.12 },
    habits: 'Небольшая стая охотится ближе к берегу при дневном свете.',
    description: 'На зеленоватых боках тёмные полосы. Передний спинной плавник колючий.' },
  { id: 'bream', mouth: [0.02, 0.533], name: 'Лещ', minGrams: 500, maxGrams: 3200, pull: 1.18, take: 'lift',
    trophyGrams: 2800, groupSize: [3, 8], feedingY: 0.53,
    activity: { morning: 0.75, day: 0.5, evening: 1, night: 0.85 },
    habits: 'Стая кормится на дальней бровке, особенно вечером и ночью.',
    description: 'Высокое, сжатое с боков тело, бронзовая чешуя и длинный нижний плавник у хвоста.' },
  { id: 'bleak', mouth: [0.043, 0.471], name: 'Уклейка', minGrams: 18, maxGrams: 120, pull: .66, take: 'glide',
    trophyGrams: 100, groupSize: [9, 18], feedingY: 0.65,
    activity: { morning: 0.85, day: 1, evening: 0.65, night: 0.12 },
    habits: 'Многочисленная стайка собирает корм у поверхности, чаще днём.',
    description: 'Узкая серебристая рыбка с тёмной спинкой, прозрачными плавниками и приподнятым ртом.' },
  { id: 'rudd', mouth: [0.032, 0.482], name: 'Краснопёрка', minGrams: 80, maxGrams: 850, pull: .9, take: 'glide',
    trophyGrams: 750, groupSize: [4, 9], feedingY: 0.84,
    activity: { morning: 0.7, day: 1, evening: 0.8, night: 0.15 },
    habits: 'Днём стая ищет корм у прибрежной растительности.',
    description: 'Золотистые бока и ярко-красные плавники. Небольшой рот направлен вверх.' },
  { id: 'whitebream', mouth: [0.036, 0.543], name: 'Густера', minGrams: 100, maxGrams: 950, pull: .95, take: 'lift',
    trophyGrams: 800, groupSize: [5, 11], feedingY: 0.59,
    activity: { morning: 0.6, day: 0.85, evening: 0.7, night: 0.8 },
    habits: 'Стая держится дальше от берега и подходит кормиться как днём, так и ночью.',
    description: 'Высокое серебристое тело, крупный глаз и розоватые основания парных плавников.' },
  { id: 'crucian', mouth: [0.043, 0.525], name: 'Серебряный карась', minGrams: 150, maxGrams: 1900, pull: 1.1, take: 'lift',
    trophyGrams: 1600, groupSize: [2, 5], feedingY: 0.85,
    activity: { morning: 0.7, day: 0.38, evening: 0.9, night: 1 },
    habits: 'Небольшая группа ищет корм у берега, чаще вечером и ночью.',
    description: 'Округлое тело с крупной серебристой чешуёй. Вдоль спины тянется длинный плавник.' },
  { id: 'ide', mouth: [0.02, 0.532], name: 'Язь', minGrams: 300, maxGrams: 2800, pull: 1.22, take: 'sink',
    trophyGrams: 2400, groupSize: [1, 4], feedingY: 0.55,
    activity: { morning: 0.85, day: 0.45, evening: 1, night: 0.45 },
    habits: 'На дальнюю струю утром и вечером выходит одиночная рыба или небольшая группа.',
    description: 'Плотное тело с золотистым отливом, тёмная спинка и красноватые нижние плавники.' }
];

const largestFishGrams = Math.max(...speciesList.map(species => species.maxGrams));

const baits = {
  worm: { name: 'Червь', weights: { perch: 4, bream: 3, ide: 3, crucian: 3, roach: 2, whitebream: 2 } },
  maggot: { name: 'Опарыш', weights: { bleak: 5, roach: 4, rudd: 3, whitebream: 3, perch: 2, bream: 2, ide: 1, crucian: 1 } },
  bloodworm: { name: 'Мотыль', weights: { perch: 4, whitebream: 4, bream: 4, bleak: 3, roach: 3, rudd: 1, crucian: 1 } },
  barley: { name: 'Перловка', weights: { bream: 5, crucian: 5, ide: 3, roach: 2, whitebream: 2, rudd: 1 } },
  bread: { name: 'Хлебный мякиш', weights: { rudd: 5, bleak: 4, ide: 3, roach: 3, crucian: 2, bream: 1 } },
  dough: { name: 'Тесто', weights: { crucian: 6, roach: 4, bream: 3, ide: 2, rudd: 1, whitebream: 1 } }
};
if (typeof module !== 'undefined' && module.exports) module.exports = { speciesList, baits };
