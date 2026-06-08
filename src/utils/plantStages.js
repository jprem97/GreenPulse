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
export const COMPLETION_GP = 50;

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

export function calculateStageGP(plantType, stageIndex, totalStages, aiScore) {
  const typeConfig = PLANT_TYPE_GP[plantType] || PLANT_TYPE_GP.INDOOR;
  const baseGp = typeConfig.base;
  const growthGp = typeConfig.growth;
  const progress = (stageIndex + 1) / totalStages;
  const stageGp = Math.round(baseGp + growthGp * progress);
  const scoreMultiplier = Math.max(0.4, aiScore / 100);
  return Math.max(1, Math.round(stageGp * scoreMultiplier));
}

export function generateVerificationCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `GP-${num}`;
}
