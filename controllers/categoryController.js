const Category = require("../models/Category");
const Provider = require("../models/Provider");
const mongoose = require("mongoose");
const multer = require("multer");

// CREATE
exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = new Category({
      name,
      description,
    });

    if (req.file) {
      category.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    const categoriesWithProviders = [];

    for (const cat of categories) {
      const providerCount = await Provider.countDocuments({ categoryId: cat._id });
      if (providerCount > 0) {
        categoriesWithProviders.push(cat);
      }
    }

    res.json(categoriesWithProviders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// GET SINGLE CATEGORY
exports.getSingleCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    return res.json({
      success: true,
      message: "Category fetched successfully",
      data: category
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


// UPDATE
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.sendStatus(404);

    const { name, description } = req.body;
    if (name) category.name = name;
    if (description) category.description = description;

    if (req.file) {
      category.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await category.save();
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE
exports.deleteCategory = async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET IMAGE
exports.getCategoryImage = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category || !category.image) return res.sendStatus(404);

    res.set("Content-Type", category.image.contentType);
    res.send(category.image.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
