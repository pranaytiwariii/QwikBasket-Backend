import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Catergory name
  image: { type: String, required: true }, // URL for the category image
});

module.exports = mongoose.model("Category", CategorySchema);