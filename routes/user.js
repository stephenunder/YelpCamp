const express = require("express");
const router = express.Router();
const Campground = require("../models/campground");
const User = require("../models/user");
const middleware = require("../middleware");

// User Profiles
router.get("/:id", (req, res) => {
  User.findById(req.params.id, (err, foundUser) => {
    if (err || !foundUser) {
      req.flash("error", "Something went wrong.");
      return res.redirect("/campgrounds");
    }
    Campground.find().where("author.id").equals(foundUser._id).exec((err, campgrounds) => {
      if (err) {
        req.flash("error", "Something went wrong.");
        return res.redirect("/campgrounds");
      }
      res.render("users/show", {user: foundUser, campgrounds});
    });
  });
});

// show edit form
router.get("/:id/edit", middleware.isLoggedIn, (req, res) => {
  User.findById(req.params.id, (err, foundUser) => {
    if (err || !foundUser) {
      req.flash("error", "User not found.");
      return res.redirect("back");
    }
    if (foundUser._id.equals(req.user._id)) {
      res.render("users/edit", { user: foundUser });
    } else {
      req.flash("error", "You don't have permission to do that.");
      res.redirect("back");
    }
  });
});

// update profile
router.put("/:id", middleware.isLoggedIn, (req, res) => {
  User.findByIdAndUpdate(req.params.id, req.body.user, (err, updatedUser) => {
    if (err) {
      if (err.name === 'MongoError' && err.code === 11000) {
        // Duplicate email
        req.flash("error", "That email has already been registered.");
        return res.redirect("/users" + req.params.id);
      }
      // Some other error
      req.flash("error", "Something went wrong.");
      return res.redirect("/users" + req.params.id);
    }
    if (updatedUser._id.equals(req.user._id)) {
      res.redirect("/users/" + req.params.id);
    } else {
      req.flash("error", "You don't have permission to do that.");
      res.redirect("/campgrounds");
    }
  });
});

module.exports = router;