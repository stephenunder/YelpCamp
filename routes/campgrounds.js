const express = require("express");
const router = express.Router();
const Campground = require("../models/campground");
const Comment = require("../models/comment");
const Review = require("../models/review");
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
  const perPage = 8;
  let pageQuery = parseInt(req.query.page);
  let pageNumber = pageQuery ? pageQuery : 1;
  let noMatch = null;
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "gi");
    Campground.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
      Campground.countDocuments({name: regex}).exec(function (err, count) {
        if (err) {
          console.log(err);
          res.redirect("back");
        } else {
          if (allCampgrounds.length < 1) {
            noMatch = "No campgrounds match that search, please try again.";
          }
          res.render("campgrounds/index", {
            campgrounds: allCampgrounds,
            current: pageNumber,
            pages: Math.ceil(count / perPage),
            noMatch: noMatch,
            search: req.query.search,
          });
        }
      });
    });
  } else {
    // Get all campgrounds from DB
    Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
      Campground.countDocuments().exec(function (err, count) {
        if (err) {
          console.log(err);
        } else {
          res.render("campgrounds/index", {
            campgrounds: allCampgrounds,
            current: pageNumber,
            noMatch: noMatch,
            page: "campgrounds",
            pages: Math.ceil(count / perPage),
            search: false,
          });
        }
      });
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
      let { name, image, imageId, price, description, author } = {
        name: req.body.name,
        image: result.secure_url,
        imageId: result.public_id,
        price: req.body.price,
        description: req.body.description,
        author: {
          id: req.user._id,
          username: req.user.username,
        }
      };
      // let image = result.secure_url;

      if (err || !data.length) {
        req.flash("error", "Invalid address");
        return res.redirect("back");
      }
      let lat = data[0].latitude;
      let lng = data[0].longitude;
      let location = data[0].formattedAddress;
      let newCampground = {name, image, imageId, price, description, author, location, lat, lng};
      // Create a new campground and save to DB
      Campground.create(newCampground, (err, newlyCreated) => {
        if (err) {
          req.flash("error", err.message);
          return res.redirect("back");
        } else {
            // redirect back to campgrounds page
            res.redirect("/campgrounds/" + newlyCreated._id);
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
  Campground.findById(req.params.id).populate("comments").populate({
    path: "reviews",
    options: {sort: {createdAt: -1}}
  }).exec((err, foundCampground) => {
    if (err || !foundCampground) {
      req.flash("error", "Campground not found");
      res.redirect("back");
    } else {
        // render show template with that campground
        res.render("campgrounds/show", {campground: foundCampground});
    }
  });
});

// EDIT CAMPGROUND ROUTE
router.get("/:id/edit", middleware.checkCampgroundOwnership, (req, res) => {
  Campground.findById(req.params.id, (err, foundCampground) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    res.render("campgrounds/edit", {campground: foundCampground});
  });
});

// UPDATE CAMPGROUND ROUTE
router.put("/:id", middleware.checkCampgroundOwnership, upload.single("image"), (req, res) => {
  geocoder.geocode(req.body.location, (err, data) => {
    if (err || !data.length) {
      req.flash("error", "Invalid address");
      return res.redirect("back");
    }
    delete req.body.campground.rating;
    // find and update the correct campground
    Campground.findById(req.params.id, async (err, updatedCampground) => {
      if (err) {
        req.flash("error", err.message);
        res.redirect("back");
      } else {
          if (req.file) {
            try {
              await cloudinary.uploader.destroy(updatedCampground.imageId);
              let result = await cloudinary.uploader.upload(req.file.path);
              updatedCampground.imageId = result.public_id;
              updatedCampground.image = result.secure_url;
            } catch (err) {
              req.flash("error", err.message);
              return res.redirect("back");
            }
          }
          updatedCampground.name = req.body.campground.name;
          updatedCampground.price = req.body.campground.price;
          updatedCampground.lat = data[0].latitude;
          updatedCampground.lng = data[0].longitude;
          updatedCampground.location = data[0].formattedAddress;
          updatedCampground.description = req.body.campground.description;
          updatedCampground.save();
          req.flash("success", "Campground Updated!");
          res.redirect("/campgrounds/" + updatedCampground._id);
      }
    });
  });
});

// DESTROY CAMPGROUND ROUTE
router.delete("/:id", middleware.checkCampgroundOwnership, (req, res) => {
  Campground.findById(req.params.id, async (err, removedCampground) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    try {
      await cloudinary.uploader.destroy(removedCampground.imageId);
      removedCampground.remove();
      req.flash("success", "Campground deleted successfully!");
      res.redirect("/campgrounds");
    } catch (err) {
        if (err) {
          req.flash("error", err.message);
          return res.redirect("back");
        }
    }
  });
});

module.exports = router;