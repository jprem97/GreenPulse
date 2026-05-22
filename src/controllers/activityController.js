import Activity from "../models/Activity.js";
import Agent from "../models/Agent.js";

export const getMyActivities = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const activities = await Activity.find({ agent: agent._id })
      .sort({ createdAt: -1 })
      .populate("client deal");

    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// FIX: createActivity existed in the controller but was never wired to a route.
// Now exported properly and added to activityRoutes.js below.
export const createActivity = async (req, res) => {
  try {
    const { type, description, clientId, dealId } = req.body;

    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    if (!type || !description) {
      return res.status(400).json({
        message: "Type and description are required"
      });
    }

    const activity = await Activity.create({
      type,
      mode: "MANUAL",
      description,
      agent: agent._id,
      client: clientId || null,
      deal: dealId || null
    });

    res.json({
      message: "Activity logged successfully",
      activity
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
