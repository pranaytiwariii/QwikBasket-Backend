import express from "express"
import { upload,invoiceUploadUtil } from "../config/cloudinary.js"
const router=express.Router();
router.post("/invoice", upload.single("invoice"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }
      const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await invoiceUploadUtil(dataURI);

    res.status(200).json({
      success: true,
      message: "Invoice uploaded successfully",
      data: {
        url: result.secure_url, 
        publicId: result.public_id,
      },
    });
  } catch (error) {
    console.error("Error uploading invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload invoice",
    });
  }
});

export default router;