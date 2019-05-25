const express = require("express");
const router = express.Router({mergeParams: true});
const Campground = require("../models/campground");
const Review = require("../models/review");
const middleware = require("../middleware");

// Reviews Index
router.get("/", (req, res) => {
  Campground.findById(req.params.id).populate({
    path: "reviews",
    options: {sort: {createdAt: -1}} // sorting populated reviews array to show latest first
  }).exec((err, campground) => {
    if (err || !campground) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    res.render("reviews/index", {campground: campground});
  });
});

// Reviews New
router.get("/new", middleware.isLoggedIn, middleware.checkReviewExistence, (req, res) => {
  Campground.findById(req.params.id, (err, campground) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    res.render("reviews/new", {campground: campground});
  });
});

// Reviews Create
router.post("/", middleware.isLoggedIn, middleware.checkReviewExistence, (req, res) => {
  Campground.findById(req.params.id).populate("reviews").exec((err, campground) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    Review.create(req.body.review, (err, review) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      // add author username/id and associated campground to review
      review.author.id = req.user._id;
      review.author.username = req.user.username;
      review.campground = campground;
      review.save();
      campground.reviews.push(review);
      // calculate new average review for campground
      campground.rating = calculateAverage(campground.reviews);
      campground.save();
      req.flash("success", "Your review has been successfully added.");
      res.redirect("/campgrounds/" + campground._id);
    });
  })
});

// Reviews Edit
router.get("/:review_id/edit", middleware.checkReviewOwnership, (req, res) => {
  Review.findById(req.params.review_id, (err, foundReview) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    res.render("reviews/edit", {campground_id: req.params.id, review: foundReview});
  });
});

// Reviews Update
router.put("/:review_id", middleware.checkReviewOwnership, (req, res) => {
  Review.findByIdAndUpdate(req.params.review_id, req.body.review, {new: true}, (err, updatedReview) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    Campground.findById(req.params.id).populate("reviews").exec((err, campground) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      // recalculate campground average
      campground.rating = calculateAverage(campground.reviews);
      campground.save();
      req.flash("success", "Your review was successfully updated.");
      res.redirect("/campgrounds/" + campground._id);
    });
  });
});

// Reviews Delete
router.delete("/:review_id", middleware.checkReviewOwnership, (req, res) => {
  Review.findByIdAndRemove(req.params.review_id, (err) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    Campground.findByIdAndUpdate(req.params.id, {$pull: {reviews: req.params.review_id}}, {new: true}).populate("reviews").exec((err, campground) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      // recalculate campground average
      campground.rating = calculateAverage(campground.reviews);
      campground.save();
      req.flash("success", "Your review was successfully deleted.");
      res.redirect("/campgrounds/" + req.params.id);
    });
  });
});

function calculateAverage(reviews) {
  if (reviews.length === 0) {
    return 0;
  }
  let sum = 0;
  reviews.forEach(element => {
    sum += element.rating;
  });
  return sum / reviews.length;
}

module.exports = router;