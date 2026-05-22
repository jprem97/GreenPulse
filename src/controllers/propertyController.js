import Property from "../models/Property.js";
import Agent from "../models/Agent.js";

export const createProperty = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const { title, location, price } = req.body;

    if (!title || !location || !price) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const property = await Property.create({
      title,
      location,
      price,
      createdBy: agent._id   // FIX: consistent field name (was createdBy in model but listedBy used in controller queries)
    });

    res.json(property);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getProperties = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // FIX: was querying `listedBy` which doesn't exist — changed to `createdBy`
    const properties = await Property.find({
      createdBy: agent._id
    }).populate("owner", "name phone");

    res.json(properties);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const searchProperties = async (req, res) => {
  try {
    const { location, minPrice, maxPrice } = req.query;

    const filter = {};

    if (location) filter.location = location;

    if (minPrice && maxPrice) {
      filter.price = {
        $gte: Number(minPrice),
        $lte: Number(maxPrice)
      };
    }

    const properties = await Property.find(filter);

    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
