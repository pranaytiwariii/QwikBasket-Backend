import Offer from "../models/offer.models.js";
import { imageUploadUtil } from "../config/cloudinary.js";

// @desc    Get all offers with filtering and pagination
// @route   GET /api/offers
// @access  Public
export const getOffers = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    // Build query object
    const query = {};

    // Filter by status (based on expiry date)
    if (status) {
      const now = new Date();
      if (status === "active") {
        query.expiryDate = { $gt: now };
      } else if (status === "expired") {
        query.expiryDate = { $lte: now };
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const offers = await Offer.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Get total count for pagination
    const totalOffers = await Offer.countDocuments(query);

    res.status(200).json({
      success: true,
      data: offers,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalOffers / Number(limit)),
        totalOffers,
        hasNextPage: skip + offers.length < totalOffers,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching offers",
      error: error.message,
    });
  }
};

// @desc    Get single offer by ID
// @route   GET /api/offers/:id
// @access  Public
export const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findById(id).lean();

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: offer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching offer",
      error: error.message,
    });
  }
};

// @desc    Get active offers only
// @route   GET /api/offers/active
// @access  Public
export const getActiveOffers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const offers = await Offer.getActiveOffers().limit(Number(limit)).lean();

    res.status(200).json({
      success: true,
      data: offers,
      totalOffers: offers.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching active offers",
      error: error.message,
    });
  }
};

// @desc    Create new offer
// @route   POST /api/offers
// @access  Private/Admin
export const createOffer = async (req, res) => {
  try {
    const { date, expiryDate } = req.body;

    // Handle image upload
    let imageUrl = "";
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const url = "data:" + req.file.mimetype + ";base64," + b64;
      const uploadResult = await imageUploadUtil(url);
      imageUrl = uploadResult.secure_url;
    } else {
      return res.status(400).json({
        success: false,
        message: "Offer image is required",
      });
    }

    // Validate dates
    const offerDate = date ? new Date(date) : new Date();
    const offerExpiryDate = new Date(expiryDate);

    if (offerExpiryDate <= offerDate) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be after the offer date",
      });
    }

    const offerData = {
      image: imageUrl,
      date: offerDate,
      expiryDate: offerExpiryDate,
    };
    const offer = await Offer.create(offerData);

    res.status(201).json({
      success: true,
      data: offer,
      message: "Offer created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating offer",
      error: error.message,
    });
  }
};

// @desc    Update offer
// @route   PUT /api/offers/:id
// @access  Private/Admin
export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // Handle image upload if new image is provided
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const url = "data:" + req.file.mimetype + ";base64," + b64;
      const uploadResult = await imageUploadUtil(url);
      updateData.image = uploadResult.secure_url;
    }

    // Validate dates if provided
    if (updateData.date || updateData.expiryDate) {
      const offerDate = updateData.date
        ? new Date(updateData.date)
        : offer.date;
      const offerExpiryDate = updateData.expiryDate
        ? new Date(updateData.expiryDate)
        : offer.expiryDate;

      if (offerExpiryDate <= offerDate) {
        return res.status(400).json({
          success: false,
          message: "Expiry date must be after the offer date",
        });
      }
    }

    const updatedOffer = await Offer.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.status(200).json({
      success: true,
      data: updatedOffer,
      message: "Offer updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating offer",
      error: error.message,
    });
  }
};

// @desc    Delete offer
// @route   DELETE /api/offers/:id
// @access  Private/Admin
export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    await Offer.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting offer",
      error: error.message,
    });
  }
};
