import Agent from "../models/Agent.js";

export const assignAgent = async (clientLocation) => {
  // 1. Try to find ONE agent in the exact same location (case-insensitive)
  let agent = await Agent.findOne({ 
    location: { $regex: new RegExp(`^${clientLocation}$`, 'i') } 
  });

  // 2. Fallback: If no agent is found in that location, pick ANY agent
  if (!agent) {
    agent = await Agent.findOne({});
  }

  // 3. Return the assigned agent (or null if you have 0 agents in your database)
  return agent;
};