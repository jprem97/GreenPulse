import Deal from "../models/Deal.js";
import Client from "../models/Client.js";
import Property from "../models/Property.js";
import Activity from "../models/Activity.js";
import Agent from "../models/Agent.js";

export const createDeal = async (req, res) => {
  try {
    const { clientId, propertyId } = req.body;

    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const client = await Client.findById(clientId);
    const property = await Property.findById(propertyId);

    if (!client || !property) {
      return res.status(404).json({ message: "Invalid client or property" });
    }

    // Enforce: client must belong to this agent
    if (client.assignedAgent.toString() !== agent._id.toString()) {
      return res.status(403).json({ message: "Not your client" });
    }

    // FIX: was checking `property.listedBy` which doesn't exist — field is `createdBy`
    if (property.createdBy.toString() !== agent._id.toString()) {
      return res.status(403).json({ message: "Not your property" });
    }

    // Prevent duplicate active deal for this client
    const existingClientDeal = await Deal.findOne({
      client: clientId,
      status: { $in: ["NEGOTIATION", "AGREEMENT"] }
    });

    if (existingClientDeal) {
      return res.status(400).json({ message: "This client already has an active deal" });
    }

    // FIX: also prevent same property from being double-booked with another client
    const existingPropertyDeal = await Deal.findOne({
      property: propertyId,
      status: { $in: ["NEGOTIATION", "AGREEMENT"] }
    });

    if (existingPropertyDeal) {
      return res.status(400).json({ message: "This property is already in an active deal" });
    }

    const deal = await Deal.create({
      client: clientId,
      property: propertyId,
      agent: agent._id
    });

    // Update client status
    await Client.findByIdAndUpdate(clientId, { status: "QUALIFIED" });

    // Reserve the property
    await Property.findByIdAndUpdate(propertyId, { status: "RESERVED" });

    // FIX: update agent report — totalDeals was never incremented anywhere
    await Agent.findByIdAndUpdate(agent._id, {
      $inc: { "report.totalDeals": 1 }
    });

    // Log auto activity — FIX: "DEAL_CREATED" is now in the Activity enum
    await Activity.create({
      type: "DEAL_CREATED",
      mode: "AUTO",
      description: "Deal created",
      agent: agent._id,
      client: clientId,
      deal: deal._id
    });

    res.json(deal);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDeals = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const deals = await Deal.find({ agent: agent._id })
      .populate("client property");

    res.json(deals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDealById = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate("client property");

    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }

    res.json(deal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateDealStatus = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const deal = await Deal.findOneAndUpdate(
      {
        _id: req.params.id,
        agent: agent._id   // enforce ownership
      },
      { status: req.body.status },
      { new: true }
    );

    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }

    if (req.body.status === "CLOSED") {
      // Update property to SOLD
      await Property.findByIdAndUpdate(deal.property, { status: "SOLD" });

      // FIX: update client status to CLOSED (was never done before)
      await Client.findByIdAndUpdate(deal.client, { status: "CLOSED" });

      // FIX: update agent report — closedDeals and performanceScore were never updated
      await Agent.findByIdAndUpdate(agent._id, {
        $inc: {
          "report.closedDeals": 1,
          performanceScore: 10,     // +10 points per closed deal
          currentLoad: -1           // FIX: decrement load on deal resolution
        }
      });

    } else if (req.body.status === "LOST") {
      // Release property back to available
      await Property.findByIdAndUpdate(deal.property, { status: "AVAILABLE" });

      // FIX: update client status to LOST (was never done before)
      await Client.findByIdAndUpdate(deal.client, { status: "LOST" });

      // FIX: decrement currentLoad when deal is lost
      await Agent.findByIdAndUpdate(agent._id, {
        $inc: { currentLoad: -1 }
      });
    }

    res.json(deal);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
