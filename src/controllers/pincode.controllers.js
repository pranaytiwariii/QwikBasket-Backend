import Pincode from "../models/pincodes.models.js";

// Check if service is available for a pincode
export const checkPincodeService = async (req, res) => {
  try {
    const { pincode } = req.params;

    // Validate pincode format
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit pincode",
      });
    }

    // Find pincode in database
    const pincodeData = await Pincode.findOne({ pincode });

    if (!pincodeData) {
      return res.status(404).json({
        success: false,
        available: false,
        message: "Service is currently not available in this location",
      });
    }

    if (!pincodeData.service) {
      return res.status(200).json({
        success: true,
        available: false,
        message: "Service is currently not available in this location",
        data: {
          pincode: pincodeData.pincode,
        },
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      message: "Service is available in your location",
      data: {
        pincode: pincodeData.pincode,
      },
    });
  } catch (error) {
    console.error("Error checking pincode service:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking pincode availability",
      error: error.message,
    });
  }
};

// Add a new pincode (Admin only)
export const addPincode = async (req, res) => {
  try {
    const { pincode, service, city, state } = req.body;

    // Validate required fields
    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: "Pincode is required",
      });
    }

    // Check if pincode already exists
    const existingPincode = await Pincode.findOne({ pincode });
    if (existingPincode) {
      return res.status(409).json({
        success: false,
        message: "Pincode already exists",
      });
    }

    // Create new pincode
    const newPincode = await Pincode.create({
      pincode,
      service: service !== undefined ? service : true,
    });

    return res.status(201).json({
      success: true,
      message: "Pincode added successfully",
      data: newPincode,
    });
  } catch (error) {
    console.error("Error adding pincode:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding pincode",
      error: error.message,
    });
  }
};

// Update pincode service status (Admin only)
export const updatePincodeService = async (req, res) => {
  try {
    const { pincode } = req.params;
    const { service } = req.body;

    const updateData = {};
    if (service !== undefined) updateData.service = service;

    const updatedPincode = await Pincode.findOneAndUpdate(
      { pincode },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPincode) {
      return res.status(404).json({
        success: false,
        message: "Pincode not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pincode updated successfully",
      data: updatedPincode,
    });
  } catch (error) {
    console.error("Error updating pincode:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating pincode",
      error: error.message,
    });
  }
};

// Delete a pincode (Admin only)
export const deletePincode = async (req, res) => {
  try {
    const { pincode } = req.params;

    const deletedPincode = await Pincode.findOneAndDelete({ pincode });

    if (!deletedPincode) {
      return res.status(404).json({
        success: false,
        message: "Pincode not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pincode deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting pincode:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting pincode",
      error: error.message,
    });
  }
};

// Get all pincodes (Admin only)
export const getAllPincodes = async (req, res) => {
  try {
    const { service  } = req.query;
    
    let query = {};
    
    // Filter by service status if provided
    if (service !== undefined) {
      query.service = service === 'true';
    }
    
    // Search by pincode, city, or state
    // if (search) {
    //   query.$or = [
    //     { pincode: { $regex: search, $options: 'i' } },
    //   ];
    // }

    const pincodes = await Pincode.find(query).sort({ pincode: 1 });

    return res.status(200).json({
      success: true,
      count: pincodes.length,
      data: pincodes,
    });
  } catch (error) {
    console.error("Error fetching pincodes:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching pincodes",
      error: error.message,
    });
  }
};

// Bulk add pincodes (Admin only)
export const bulkAddPincodes = async (req, res) => {
  try {
    const { pincodes } = req.body;

    if (!Array.isArray(pincodes) || pincodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of pincodes",
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const item of pincodes) {
      try {
        const existingPincode = await Pincode.findOne({ pincode: item.pincode });
        
        if (existingPincode) {
          results.failed.push({
            pincode: item.pincode,
            reason: "Pincode already exists",
          });
        } else {
          const newPincode = await Pincode.create(item);
          results.success.push(newPincode);
        }
      } catch (err) {
        results.failed.push({
          pincode: item.pincode,
          reason: err.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Added ${results.success.length} pincodes, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    console.error("Error bulk adding pincodes:", error);
    return res.status(500).json({
      success: false,
      message: "Error bulk adding pincodes",
      error: error.message,
    });
  }
};
