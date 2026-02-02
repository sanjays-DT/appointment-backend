const Category = require("../models/Category");
const Provider = require("../models/Provider");
const mongoose = require("mongoose");
const multer = require("multer");


exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    // const categoriesWithProviders = [];

    // for (const cat of categories) {
    //   const providerCount = await Provider.countDocuments({ categoryId: cat._id });
    //   if (providerCount > 0) {
    //     categoriesWithProviders.push(cat);
    //   }
    // }

    res.json(categories);
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
