const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/user");
const Campground = require("../models/campground");

// root route
router.get("/", (req, res) => {
  res.render("landing");
});

// show register form
router.get("/register", (req, res) => {
  res.render("register", {page: 'register'});
});

// handle sign up logic
router.post("/register", (req, res) => {
  let newUser = new User({
    username: req.body.username,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    avatar: req.body.avatar,
  });
  User.register(newUser, req.body.password, (err, user) => {
    if (err) {
      console.log(err);
      return res.render("register", {"error": err.message});
    }
    passport.authenticate("local")(req, res, () => {
      req.flash("success", `Successfully Signed Up! Welcome to YelpCamp, ${user.username}.`);
      res.redirect("/campgrounds");
    });
  });
});

// show login form
router.get("/login", (req, res) => {
  res.render("login", {page: 'login'});
});

// handle login logic
router.post("/login", passport.authenticate("local", {
  successRedirect: "/campgrounds",
  failureRedirect: "/login",
  failureFlash: true,
  successFlash: "Welcome Back!"
}), (req, res) => {
});

// logout route
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success", "Logged you out!");
  res.redirect("/campgrounds");
});

// User Profiles
router.get("/users/:id", (req, res) => {
  User.findById(req.params.id, (err, foundUser) => {
    if (err) {
      req.flash("error", "Something went wrong.");
      return res.redirect("/");
    }
    Campground.find().where("author.id").equals(foundUser._id).exec((err, campgrounds) => {
      if (err) {
        req.flash("error", "Something went wrong.");
        return res.redirect("/");
      }
      res.render("users/show", {user: foundUser, campgrounds: campgrounds});
    });
  });
});

module.exports = router;