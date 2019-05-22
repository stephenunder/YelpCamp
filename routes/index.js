const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/user");
const Campground = require("../models/campground");
const async = require("async");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

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

// show edit form
router.get("/users/:id/edit", (req, res) => {
  User.findById(req.params.id, (err, foundUser) => {
    if (err || !foundUser) { return res.redirect("back"); }
    if (foundUser._id.equals(req.user._id)) {
      res.render("users/edit", { user: foundUser });
    } else {
      req.flash("error", "You don't have permission to do that");
      res.redirect("back");
    }
  });
});

// update profile
router.put("/users/:id", (req, res) => {
  User.findByIdAndUpdate(req.params.id, req.body.user, (err, updatedUser) => {
    if (err) {
      if (err.name === 'MongoError' && err.code === 11000) {
        // Duplicate email
        req.flash("error", "That email has already been registered.");
        return res.redirect("/users" + req.params.id);
      }
      // Some other error
      req.flash("error", "Something went wrong...");
      return res.redirect("/users" + req.params.id);
    }
    if (updatedUser._id.equals(req.user._id)) {
      res.redirect("/users/" + req.params.id);
    } else {
      req.flash("error", "You don't have permission to do that");
      res.redirect("/campgrounds");
    }
  });
});

// forgot password
router.get("/forgot", (req, res, next) => {
  res.render("forgot");
});

// send confirmation email
router.post("/forgot", (req, res, next) => {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, (err, buf) => {
        let token = buf.toString("hex");
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, (err, user) => {
        if (err) throw err;
        if (!user) {
          req.flash("error", "No account with that email address found.");
          return res.redirect("/forgot");
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(err => {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      const smtpTransport = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: "yelpcamp.stephenunder@gmail.com",
          pass: process.env.GMAILPW
        }
      });
      const mailOptions = {
        to: user.email,
        from: "yelpcamp.stephenunder@gmail.com",
        subject: "Reset Your YelpCamp Password",
        text: "Hi " + user.firstName + ",\n\n" +
              "We've received a request to reset your password. If you didn't make the request, just ignore this email. Otherwise, you can reset your password using this link:\n\n" +
              "http://" + req.headers.host + "/reset/" + token + "\n\n" +
              "Thanks.\n" +
              "The YelpCamp Team\n"
      };
      smtpTransport.sendMail(mailOptions, err => {
        if (err) throw err;
        console.log("mail sent");
        req.flash("success", "An email has been sent to " + user.email + " with further instructions.");
        done(err, "done");
      });
    }
  ], err => {
    if (err) return next(err);
    res.redirect("/forgot");
  });
});

// reset password
router.get("/reset/:token", (req, res) => {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() }}, (err, user) => {
    if (err) throw err;
    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot");
    }
    res.render("reset", {token: req.params.token});
  });
});

// update password
router.post("/reset/:token", (req, res) => {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() }}, (err, user) => {
        if (err) throw err;
        if (!user) {
          req.flash("error", "Password reset token is invalid or has expired.");
          return res.redirect("back");
        }
        if (req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, err => {
            if (err) throw err;
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;

            user.save(err => {
              if (err) throw err;
              req.logIn(user, err => {
                done(err, user);
              });
            });
          });
        } else {
          req.flash("error", "Passwords do not match.");
          return res.redirect("back");
        }
      });
    },
    function(user, done) {
      const smtpTransport = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: "yelpcamp.stephenunder@gmail.com",
          pass: process.env.GMAILPW
        }
      });
      const mailOptions = {
        from: "yelpcamp.stephenunder@gmail.com",
        to: user.email,
        subject: "Your YelpCamp password has been changed",
        text: "Hi " + user.firstName + ",\n\n" +
              "This is a confirmation that the password for your account " + user.email + " has just been changed.\n\n" +
              "Best,\n"+
              "The YelpCamp Team\n"
      };
      smtpTransport.sendMail(mailOptions, err => {
        if (err) throw err;
        req.flash("success", "Your password has been changed.");
        done(err);
      });
    },
  ], err => {
    if (err) throw err;
    res.redirect("/campgrounds");
  });
});

module.exports = router;