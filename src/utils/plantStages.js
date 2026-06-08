export const STAGE_MAP = {
  4:  [1, 2, 4],
  8:  [1, 2, 4, 6, 8],
  12: [1, 3, 6, 9, 12],
};

export const PLANT_TYPE_GP = {
  TREE:     { base: 8, growth: 12 },
  FLOWER:   { base: 6, growth: 10 },
  VEGETABLE: { base: 5, growth: 8 },
  INDOOR:   { base: 5, growth: 8 },
};

export const CREATION_GP = 5;

export const COMPLETION_GP_MAP = {
  4: 25,
  8: 50,
  12: 75,
};

export const WEEKLY_STREAK_BONUS = 2;
export const MAX_STREAK_BONUS = 10;
export const GROWTH_MILESTONE_BONUS = 5;
export const CONSISTENCY_BONUS = 15;

export function getCompletionGP(durationWeeks) {
  return COMPLETION_GP_MAP[durationWeeks] || 25;
}

export function getStagesForDuration(weeks) {
  return STAGE_MAP[weeks] || STAGE_MAP[4];
}

export function getNextStage(durationWeeks, currentStage) {
  const stages = getStagesForDuration(durationWeeks);
  const idx = stages.indexOf(currentStage);
  if (idx === -1 || idx >= stages.length - 1) return null;
  return stages[idx + 1];
}

export function isFirstUpload(durationWeeks) {
  const stages = getStagesForDuration(durationWeeks);
  return stages[0];
}

export function isJourneyComplete(durationWeeks, currentStage) {
  const stages = getStagesForDuration(durationWeeks);
  return currentStage === stages[stages.length - 1];
}

export function calculateStageGP(plantType, stageIndex, totalStages, aiScore, growthQuality) {
  const typeConfig = PLANT_TYPE_GP[plantType] || PLANT_TYPE_GP.INDOOR;
  const baseGp = typeConfig.base;
  const growthGp = typeConfig.growth;
  const progress = (stageIndex + 1) / totalStages;
  const stageGp = Math.round(baseGp + growthGp * progress);
  const scoreMultiplier = Math.max(0.4, aiScore / 100);
  let gp = Math.max(1, Math.round(stageGp * scoreMultiplier));

  if (growthQuality === "EXCELLENT") {
    gp += GROWTH_MILESTONE_BONUS;
  }

  return gp;
}

export function calculatePlantStreak(uploads, durationWeeks) {
  if (!uploads || uploads.length === 0) return 0;

  const stages = getStagesForDuration(durationWeeks);
  const sortedUploads = [...uploads].sort((a, b) => a.week - b.week);

  let streak = 0;
  for (let i = 0; i < sortedUploads.length; i++) {
    const expectedWeek = stages[i];
    const actualWeek = sortedUploads[i].week;
    if (actualWeek === expectedWeek) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function calculateStreakBonus(plantStreak) {
  return Math.min(plantStreak * WEEKLY_STREAK_BONUS, MAX_STREAK_BONUS);
}

export function isUploadOnSchedule(uploads, durationWeeks, expectedWeek) {
  const stages = getStagesForDuration(durationWeeks);
  const expectedIndex = stages.indexOf(expectedWeek);
  if (expectedIndex === -1) return true;

  if (expectedIndex === 0) return true;

  const prevWeek = stages[expectedIndex - 1];
  const prevUpload = uploads.find((u) => u.week === prevWeek);
  if (!prevUpload) return false;

  const elapsedWeeks = expectedWeek - prevWeek;
  const uploadDate = new Date(prevUpload.uploadedAt);
  const now = new Date();
  const daysSinceLastUpload = (now - uploadDate) / (1000 * 60 * 60 * 24);
  const expectedDays = elapsedWeeks * 7;

  return daysSinceLastUpload >= expectedDays * 0.5 && daysSinceLastUpload <= expectedDays * 2.5;
}

export function getCompletionBonusWithMultiplier(durationWeeks, uploads) {
  const baseBonus = getCompletionGP(durationWeeks);
  if (!uploads || uploads.length === 0) return baseBonus;

  const avgScore = uploads.reduce((sum, u) => sum + (u.aiResponse?.score || 0), 0) / uploads.length;
  const multiplier = Math.max(1.0, avgScore / 80);
  return Math.round(baseBonus * multiplier);
}

export function getCurrentWeek(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const msElapsed = now.getTime() - created.getTime();
  const weeksElapsed = Math.floor(msElapsed / (7 * 24 * 60 * 60 * 1000));
  return weeksElapsed + 1;
}

export function isStageUnlocked(durationWeeks, createdAt, stageWeek) {
  const currentWeek = getCurrentWeek(createdAt);
  return currentWeek >= stageWeek;
}

export function getNextUnlockedStage(durationWeeks, createdAt, uploads) {
  const stages = getStagesForDuration(durationWeeks);
  for (const week of stages) {
    const alreadyUploaded = uploads.some((u) => u.week === week);
    if (alreadyUploaded) continue;
    if (isStageUnlocked(durationWeeks, createdAt, week)) return week;
  }
  return null;
}

export function generateVerificationCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `GP-${num}`;
}
