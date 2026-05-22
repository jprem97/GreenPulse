import Agent from "../models/Agent.js";

export const getAgentsByLocation = async (req, res) => {
  try {
    const { location } = req.query;

    const agents = await Agent.find({ location })
      .populate("user", "name email");

    res.json(agents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAgentPerformance = async (req, res) => {
  try {
    const agents = await Agent.find()
      .populate("user", "name");

    // FIX: `report` fields (totalDeals, closedDeals, revenue) are now actually updated
    // by dealController when deals are created/closed, so this now returns real data.
    const result = agents.map(a => ({
      name: a.user?.name,
      location: a.location,
      performanceScore: a.performanceScore,
      currentLoad: a.currentLoad,
      report: a.report
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
