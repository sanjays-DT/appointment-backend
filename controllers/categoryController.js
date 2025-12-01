const Category = require("../models/Category");

exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check required fields
    if (!name || !description) {
      return res.status(400).json({ message: "Name and description are required" });
    }

    // Check duplicate name
    const exists = await Category.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const category = await Category.create({ 
      name: name.trim(), 
      description 
    });

    res.status(201).json({
      message: "Category created successfully",
      data: category
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getCategories = async (req, res) => {
  try {
    const list = await Category.find();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true, runValidators: true }
    );

    // If category does not exist
    if (!updated) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({
      message: "Category updated successfully",
      data: updated,
    });
  } catch (err) {
    // Duplicate name handling
    if (err.code === 11000) {
      return res.status(400).json({ message: "Category name already exists" });
    }

    res.status(500).json({ message: err.message });
  }
};



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

