const express = require("express");
const router = express.Router();
const Campground = require("../models/campground");
const middleware = require("../middleware");
const NodeGeocoder = require("node-geocoder");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});

const imageFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

const upload = multer({ storage: storage, fileFilter: imageFilter });

cloudinary.config({
  cloud_name: "yelpcamp-stephenunder",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const options = {
  provider: "google",
  httpAdapter: "https",
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null,
};

const geocoder = NodeGeocoder(options);
const escapeRegex = text => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

// INDEX - show all campgrounds
router.get("/", (req, res) => {
  let noMatch = null;
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "gi");
    Campground.find({name: regex}, (err, allCampgrounds) => {
      if (err) {
        console.log(err);
      } else {
        if (allCampgrounds.length < 1) {
          noMatch = "No campgrounds match that search, please try again.";
        }
        res.render("campgrounds/index", {campgrounds: allCampgrounds, noMatch: noMatch});
      }
    })
  } else {
    // Get all campgrounds from DB
    Campground.find({}, (err, allCampgrounds) => {
      if (err) {
        console.log(err);
      } else {
        res.render("campgrounds/index", {campgrounds: allCampgrounds, noMatch: noMatch, page: 'campgrounds'});
      }
    });
  }
});

// CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single("image"), (req, res) => {
  geocoder.geocode(req.body.location, (err, data) => {
    cloudinary.uploader.upload(req.file.path, (err, result) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      // get data from form and add to campgrounds array
      let { name, price, description, author } = {
        name: req.body.name,
        price: req.body.price,
        description: req.body.description,
        author: {
          id: req.user._id,
          username: req.user.username,
        }
      };
      let image = result.secure_url;

      if (err || !data.length) {
        req.flash("error", "Invalid address");
        return res.redirect("back");
      }
      let lat = data[0].latitude;
      let lng = data[0].longitude;
      let location = data[0].formattedAddress;
      let newCampground = {name, price, image, description, author, location, lat, lng};
      // Create a new campground and save to DB
      Campground.create(newCampground, (err, newlyCreated) => {
        if (err) {
          req.flash("error", err.message);
          return res.redirect("back");
        } else {
            // redirect back to campgrounds page
            res.redirect("/campgrounds/" + newCampground._id);
        }
      });
    });
  });
});

// NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, (req, res) => {
  res.render("campgrounds/new");
});

// SHOW - shows more info about one campground
router.get("/:id", (req, res) => {
  // find the campground with provided ID
  Campground.findById(req.params.id).populate("comments").exec((err, foundCampground) => {
    if (err || !foundCampground) {
      req.flash("error", "Campground not found");
      res.redirect("back");
    } else {
        console.log(foundCampground);
        // render show template with that campground
        res.render("campgrounds/show", {campground: foundCampground});
    }
  });
});

// EDIT CAMPGROUND ROUTE
router.get("/:id/edit", middleware.checkCampgroundOwnership, (req, res) => {
  Campground.findById(req.params.id, (err, foundCampground) => {
    res.render("campgrounds/edit", {campground: foundCampground});
  });
});

// UPDATE CAMPGROUND ROUTE
router.put("/:id", middleware.checkCampgroundOwnership, (req, res) => {
  geocoder.geocode(req.body.location, (err, data) => {
    if (err || !data.length) {
      req.flash("error", "Invalid address");
      return res.redirect("back");
    }
    req.body.campground.lat = data[0].latitude;
    req.body.campground.lng = data[0].longitude;
    req.body.campground.location = data[0].formattedAddress;
    // find and update the correct campground
    Campground.findByIdAndUpdate(req.params.id, req.body.campground, (err, updatedCampground) => {
      if (err) {
        req.flash("error", err.message);
        res.redirect("back");
      } else {
        // redirect somewhere(show page)
        req.flash("success", "Successfully Updated!");
        res.redirect("/campgrounds/" + req.params.id);
      }
    });
  });
});

// DESTROY CAMPGROUND ROUTE
router.delete("/:id", middleware.checkCampgroundOwnership, (req, res) => {
  Campground.findByIdAndRemove(req.params.id, (err) => {
    if (err) {
      res.redirect("/campgrounds");
    } else {
      res.redirect("/campgrounds");
    }
  });
});

module.exports = router;