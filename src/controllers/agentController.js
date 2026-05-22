import Agent from "../models/Agent.js";

export const getMyNotifications = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.json(agent.notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyProfile = async (req, res) => {
try {
    const agent = await Agent.findOne({ user: req.user.id }).populate("user", "name email");
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    
    res.json({
      name: agent.user.name,
      email: agent.user.email,
      location: agent.location,
      currentLoad: agent.currentLoad,
      performanceScore: agent.performanceScore
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    
    // Only return PENDING notifications
    const activeNotifications = agent.notifications.filter(n => n.status === "PENDING");
    res.json(activeNotifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const notification = agent.notifications.id(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // FIX: was setting `notification.read = true` but the schema field is `status`.
    // Now correctly sets status to "COMPLETED" so it actually persists in DB.
    notification.status = "COMPLETED";
    await agent.save();

    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
