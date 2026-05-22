import Client from "../models/Client.js";
import Agent from "../models/Agent.js";
import Property from "../models/Property.js";
import { assignAgent } from "../utils/assignAgent.js";

export const createClient = async (req, res) => {
  try {
    const { name, phone, type, preferredLocation, price } = req.body;

    // 1. Prevent duplicate
    const existing = await Client.findOne({ phone });
    if (existing) {
      return res.status(400).json({
        message: "Client with this phone already exists"
      });
    }

    // 2. Assign agent — may be null if no agent covers the location
    const agent = await assignAgent(preferredLocation);

    // FIX: warn caller if no agent could be assigned instead of silently creating an orphaned client
    if (!agent) {
      return res.status(400).json({
        message: `No agent available for location: ${preferredLocation}. Client not created.`
      });
    }

    // 3. Create client — FIX: `price` is now included in the create call (was destructured but never saved)
    const client = await Client.create({
      name,
      phone,
      type,
      preferredLocation,
      price: price || null,
      assignedAgent: agent._id
    });

    // 4. SELLER → auto-create a property listing
    let propertyId = null;
    if (type === "SELLER" && price) {
      const property = await Property.create({
        title: `${name}'s Property`,
        location: preferredLocation,
        price,
        owner: client._id,
        createdBy: agent._id
      });
      propertyId = property._id;
    }

    // 5. Push notification to assigned agent + increment load
    await Agent.findByIdAndUpdate(agent._id, {
      $inc: { currentLoad: 1 },
      $push: {
        notifications: {
          $each: [{
            message: `New ${type} client: ${name}  number : ${phone}`,
            type: "NEW_CLIENT",
            client: client._id,
            property: propertyId,   // FIX: was referencing undefined variable `propertyId`
            status: "PENDING",
          }],
          $position: 0
        }
      }
    });

    res.json({
      message: "Client created successfully",
      client
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        message: "Client already exists (duplicate phone)"
      });
    }
    res.status(500).json({ message: err.message });
  }
};

export const getClientById = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const client = await Client.findOne({
      _id: req.params.id,
      assignedAgent: agent._id
    });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json(client);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateClientStatus = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const client = await Client.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedAgent: agent._id   // security: agent can only update their own clients
      },
      { status: req.body.status },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // FIX: decrement agent load when a client is CLOSED or LOST
    if (req.body.status === "CLOSED" || req.body.status === "LOST") {
      await Agent.findByIdAndUpdate(agent._id, {
        $inc: { currentLoad: -1 }
      });
    }

    res.json(client);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getClients = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const { status, search } = req.query;

    const filter = { assignedAgent: agent._id };

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const clients = await Client.find(filter).sort({ createdAt: -1 });

    res.json(clients);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
