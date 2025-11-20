import mongoose from "mongoose";
import PickupPoint from "../models/pickupPoint.models.js";

const formatPickupPoint = (pickupPoint) => ({
  id: pickupPoint._id,
  name: pickupPoint.name,
  address: pickupPoint.address,
  phone: pickupPoint.phone,
  lat: pickupPoint.lat,
  lng: pickupPoint.lng,
  notes: pickupPoint.notes,
  isActive: pickupPoint.isActive,
  createdAt: pickupPoint.createdAt,
  updatedAt: pickupPoint.updatedAt,
});

export const listActivePickupPoints = async (req, res) => {
  try {
    const pickupPoints = await PickupPoint.find({ isActive: true }).sort({
      name: 1,
    });
    res.status(200).json({
      success: true,
      data: pickupPoints.map(formatPickupPoint),
    });
  } catch (error) {
    console.error("Error listing pickup points:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pickup points",
    });
  }
};

export const listAllPickupPoints = async (req, res) => {
  try {
    const includeInactive =
      req.query.includeInactive && req.query.includeInactive === "true";
    const filter = includeInactive ? {} : { isActive: true };
    const pickupPoints = await PickupPoint.find(filter).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: pickupPoints.map(formatPickupPoint),
    });
  } catch (error) {
    console.error("Error listing all pickup points:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pickup points",
    });
  }
};

export const getPickupPointById = async (req, res) => {
  const { pickupPointId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(pickupPointId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid pickupPointId" });
  }

  try {
    const pickupPoint = await PickupPoint.findById(pickupPointId);
    if (!pickupPoint) {
      return res
        .status(404)
        .json({ success: false, message: "Pickup point not found" });
    }
    res.status(200).json({
      success: true,
      data: formatPickupPoint(pickupPoint),
    });
  } catch (error) {
    console.error("Error fetching pickup point:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pickup point",
    });
  }
};

export const createPickupPoint = async (req, res) => {
  const { name, address, phone, lat, lng, notes, isActive = true } = req.body;

  if (!name || !address || !phone || lat === undefined || lng === undefined) {
    return res.status(400).json({
      success: false,
      message: "name, address, phone, lat and lng are required",
    });
  }

  try {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      return res.status(400).json({
        success: false,
        message: "lat and lng must be valid numbers",
      });
    }
    const pickupPoint = await PickupPoint.create({
      name,
      address,
      phone,
      lat: parsedLat,
      lng: parsedLng,
      notes,
      isActive,
    });
    res.status(201).json({
      success: true,
      message: "Pickup point created successfully",
      data: formatPickupPoint(pickupPoint),
    });
  } catch (error) {
    console.error("Error creating pickup point:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create pickup point",
    });
  }
};

export const updatePickupPoint = async (req, res) => {
  const { pickupPointId } = req.params;
  const { name, address, phone, lat, lng, notes, isActive } = req.body;

  if (!mongoose.Types.ObjectId.isValid(pickupPointId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid pickupPointId" });
  }

  try {
    let parsedLat;
    let parsedLng;
    if (lat !== undefined) {
      parsedLat = Number(lat);
      if (Number.isNaN(parsedLat)) {
        return res.status(400).json({
          success: false,
          message: "lat must be a valid number",
        });
      }
    }
    if (lng !== undefined) {
      parsedLng = Number(lng);
      if (Number.isNaN(parsedLng)) {
        return res.status(400).json({
          success: false,
          message: "lng must be a valid number",
        });
      }
    }
    const updatedPickupPoint = await PickupPoint.findByIdAndUpdate(
      pickupPointId,
      {
        ...(name !== undefined ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(parsedLat !== undefined ? { lat: parsedLat } : {}),
        ...(parsedLng !== undefined ? { lng: parsedLng } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      { new: true }
    );

    if (!updatedPickupPoint) {
      return res
        .status(404)
        .json({ success: false, message: "Pickup point not found" });
    }

    res.status(200).json({
      success: true,
      message: "Pickup point updated successfully",
      data: formatPickupPoint(updatedPickupPoint),
    });
  } catch (error) {
    console.error("Error updating pickup point:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update pickup point",
    });
  }
};

export const deletePickupPoint = async (req, res) => {
  const { pickupPointId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(pickupPointId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid pickupPointId" });
  }

  try {
    const deletedPickupPoint = await PickupPoint.findByIdAndDelete(
      pickupPointId
    );
    if (!deletedPickupPoint) {
      return res
        .status(404)
        .json({ success: false, message: "Pickup point not found" });
    }
    res.status(200).json({
      success: true,
      message: "Pickup point deleted successfully",
      data: formatPickupPoint(deletedPickupPoint),
    });
  } catch (error) {
    console.error("Error deleting pickup point:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete pickup point",
    });
  }
};
