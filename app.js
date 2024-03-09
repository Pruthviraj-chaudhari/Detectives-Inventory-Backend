const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cookieParser = require('cookie-parser');
const Detective = require("./models/detective");
const Component = require("./models/items");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const dbURI = String(process.env.DATABASE);

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: ["http://localhost:5173", "https://detectives-inventory.vercel.app"],
  credentials: true,
}));
app.use(cookieParser());

// MongoDB connection
mongoose.connect(dbURI, {});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

app.get("/", (req, res) => {
  res.send("Welcome to the Detective Store API");
});

// signup api
app.post("/signup", async (req, res) => {
  try {
    const { teamId, teamName, leaderName, email, points, password } = req.body;

    // Check if detective with the same email already exists
    const existingDetective = await Detective.findOne({ email });
    if (existingDetective) {
      return res
        .status(400)
        .json({ message: "Detective with this email already exists" });
    }

    // Create a new detective
    const newDetective = new Detective({
      teamId,
      teamName,
      leaderName,
      email,
      points,
      password,
    });

    // Save the detective to the database
    await newDetective.save();

    res.status(201).json({ message: "Detective signed up successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//login api
app.post("/login", async (req, res) => {
  try {
    const { teamId, password } = req.body;
    // Find detective by teamId
    const detective = await Detective.findOne({ teamId });

    if (!detective) {
      return res.status(404).json({ message: "Detective's team not found" });
    }

    if (detective.password === password) {
      const token = jwt.sign(
        {
          email: detective.email,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "24h",
        }
      );

      detective.password = null

      const options = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        httpOnly: false,
      };

      res.cookie("token", token, options).status(200).json({
        success: true,
        token,
        detective,
        message: `Login Successful`,
      });
    } else {
      return res.status(401).json({
        success: false,
        message: `Incorrect password. Please try again.`,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/components", async (req, res) => {
  try {
    const components = await Component.find();
    res.status(200).json(components);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/detectives", async (req, res) => {
  try {
    const detectiveEmail=req.body.email;
    
    const detective = await Detective.findOne({ email: detectiveEmail }).select('-password');
   
    if (!detective) {
      return res.status(404).json({ message: "Detective not found" });
    }

    res.status(200).json(detective);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/purchase/:componentId", async (req, res) => {
  try {
    const { componentId } = req.params;
    // Get detective's email from body
    const detectiveEmail = req.body.email;

    // Find the component by ID
    const component = await Component.findOne({ componentId });
    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }

    const componentPrice = component.price;
    const componentLink = component.link;
    const componentPonits = component.points;
    // Find detective by email
    const detective = await Detective.findOne({ email: detectiveEmail });
    if (!detective) {
      return res.status(404).json({ message: "Detective not found" });
    }

    // Check if detective has enough points to purchase the component
    if (detective.points < componentPrice) {
      return res.status(203).json({ message: "Insufficient Money" });
    }

    // Check if component is already purchased by detective
    if (detective.purchaseItems.includes(componentId)) {
      return res.status(200).json({
        message: "Component already purchased",
        remainingPoints: detective.points,
        componentLink: componentLink,
      });
    }

    // Deduct component price from detective's points
    detective.points -= componentPrice;
    detective.rewards += componentPonits;

    // Add componentId to the detective's purchaseItems array
    detective.purchaseItems.push(componentId);

    // Save detective changes to the database
    await detective.save();

    res.status(200).json({
      message: "Purchase successful",
      remainingPoints: detective.points,
      componentLink: componentLink,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});



// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
