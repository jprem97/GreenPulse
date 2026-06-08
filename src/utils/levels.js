export const LEVELS = [
  { name: "SEEDLING",       minGP: 0,    icon: "🌱", color: "#86efac", title: "Seedling" },
  { name: "SPROUT",         minGP: 50,   icon: "🌿", color: "#4ade80", title: "Sprout" },
  { name: "GREEN_WORKER",   minGP: 150,  icon: "♻️", color: "#22c55e", title: "Green Worker" },
  { name: "ECO_WARRIOR",    minGP: 350,  icon: "⚔️", color: "#16a34a", title: "Eco Warrior" },
  { name: "EARTH_GUARDIAN", minGP: 700,  icon: "🛡️", color: "#15803d", title: "Earth Guardian" },
  { name: "PLANET_SAVIOR",  minGP: 1200, icon: "🌍", color: "#166534", title: "Planet Savior" },
];

export const ACHIEVEMENTS = [
  { id: "first_upload",     title: "First Steps",       description: "Analyzed your first waste image",      icon: "🎯", condition: (stats) => stats.totalImages >= 1 },
  { id: "ten_uploads",      title: "Getting Serious",    description: "Analyzed 10 waste images",             icon: "📸", condition: (stats) => stats.totalImages >= 10 },
  { id: "fifty_uploads",    title: "Waste Expert",       description: "Analyzed 50 waste images",             icon: "🔬", condition: (stats) => stats.totalImages >= 50 },
  { id: "hundred_uploads",  title: "Eco Legend",         description: "Analyzed 100 waste images",            icon: "🏆", condition: (stats) => stats.totalImages >= 100 },
  { id: "perfect_score",    title: "Perfect Score",      description: "Achieved a score of 100",              icon: "💯", condition: (stats) => stats.bestScore >= 100 },
  { id: "high_roller",      title: "High Roller",        description: "Earned 500+ GP in one upload",         icon: "💎", condition: (stats) => stats.maxSingleGP >= 500 },
  { id: "streak_3",         title: "On a Roll",          description: "3-day upload streak",                  icon: "🔥", condition: (stats) => stats.streak >= 3 },
  { id: "streak_7",         title: "Unstoppable",        description: "7-day upload streak",                  icon: "⚡", condition: (stats) => stats.streak >= 7 },
  { id: "streak_30",        title: "Dedication Master",  description: "30-day upload streak",                 icon: "🌟", condition: (stats) => stats.streak >= 30 },
  { id: "gp_100",           title: "Eco Starter",        description: "Earned 100 total GP",                  icon: "🥉", condition: (stats) => stats.totalGP >= 100 },
  { id: "gp_500",           title: "Eco Enthusiast",     description: "Earned 500 total GP",                  icon: "🥈", condition: (stats) => stats.totalGP >= 500 },
  { id: "gp_1000",          title: "Eco Master",         description: "Earned 1000 total GP",                 icon: "🥇", condition: (stats) => stats.totalGP >= 1000 },
  { id: "good_segregator",  title: "Good Segregator",    description: "10 GOOD classifications",              icon: "✅", condition: (stats) => stats.goodCount >= 10 },
  { id: "level_up",         title: "Level Up!",          description: "Reached Green Worker or above",        icon: "⬆️", condition: (stats) => stats.levelIndex >= 2 },
  { id: "first_plant",      title: "First Sprout",       description: "Created your first plantation",        icon: "🌱", condition: (stats) => (stats.totalPlantations || 0) >= 1 },
  { id: "plant_3",          title: "Green Thumb",        description: "Completed 3 plantations",              icon: "🌿", condition: (stats) => (stats.completedPlantations || 0) >= 3 },
  { id: "plant_5",          title: "Master Gardener",    description: "Completed 5 plantations",              icon: "🌳", condition: (stats) => (stats.completedPlantations || 0) >= 5 },
  { id: "plant_perfect",    title: "Perfect Grower",     description: "Completed a plantation with 90+ avg",  icon: "✨", condition: (stats) => (stats.bestPlantAvgScore || 0) >= 90 },
  { id: "plant_streak_3",   title: "Dedicated Planter",  description: "3-week plantation streak",             icon: "🔥", condition: (stats) => (stats.maxPlantStreak || 0) >= 3 },
  { id: "verification_pro", title: "Verification Pro",   description: "Verified 10 plantation codes",         icon: "🔐", condition: (stats) => (stats.verifiedUploads || 0) >= 10 },
];

export function getLevelForGP(gp) {
  let level = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (gp >= LEVELS[i].minGP) {
      level = LEVELS[i];
      break;
    }
  }
  return level;
}

export function getLevelIndex(gp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (gp >= LEVELS[i].minGP) return i;
  }
  return 0;
}

export function getLevelProgress(gp) {
  const idx = getLevelIndex(gp);
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;

  if (!next) {
    return {
      current,
      next: null,
      index: idx,
      totalLevels: LEVELS.length,
      progress: 100,
      gpInLevel: gp - current.minGP,
      gpNeeded: 0,
    };
  }

  const range = next.minGP - current.minGP;
  const earned = gp - current.minGP;
  const progress = Math.min(Math.round((earned / range) * 100), 100);

  return {
    current,
    next,
    index: idx,
    totalLevels: LEVELS.length,
    progress,
    gpInLevel: earned,
    gpNeeded: range,
  };
}

export function computeStreak(lastUploadDate, currentStreak) {
  if (!lastUploadDate) return 1;

  const last = new Date(lastUploadDate);
  const now = new Date();
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return currentStreak || 1;
  if (diffDays === 1) return (currentStreak || 0) + 1;
  return 1;
}
