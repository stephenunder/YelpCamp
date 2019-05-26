const mongoose = require("mongoose");
const Campground = require("./models/campground");
const Comment   = require("./models/comment");
const Review = require("./models/review");
const User = require("./models/user");

let seeds = [
  {
    name: "Cloud's Rest",
    price: 5,
    image: "https://farm4.staticflickr.com/3795/10131087094_c1c0a1c859.jpg",
    description: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    location: "Yosemite Valley, California",
    lat: 37.767852,
    lng: -119.489314,
  },
  {
    name: "Desert Mesa",
    price: 0,
    image: "https://farm6.staticflickr.com/5487/11519019346_f66401b6c1.jpg",
    description: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    location: "Yuma, AZ",
    lat: 32.658668,
    lng: -114.495542,
    author: {
      username: "Betty",
      email: "betty@gmail.com",
    }
  },
  {
    name: "Canyon Floor",
    price: 11.99,
    image: "https://farm1.staticflickr.com/189/493046463_841a18169e.jpg",
    description: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    location: "Grand Canyon, AZ",
    lat: 36.448743,
    lng: -112.135637,
    author: {
      username: "Cal",
      email: "cal@gmail.com",
    }
  }
];

async function seedDB(){
  try {
    await Campground.deleteMany({});
    console.log("Campgrounds removed");
    await Comment.deleteMany({});
    console.log("Comments removed");
    await User.deleteMany({});
    console.log("Users removed");
    await Review.deleteMany({});
    console.log("Reviews removed");

    let user = await User.create({
      username: "Abe",
      email: "abe@gmail.com",
    });
    for (const seed of seeds) {
      let campground = await Campground.create(seed);
      console.log("Campground created");
      let comment = await Comment.create({
        text: "This place is great, but I wish there was internet",
        author: {
          username: "Homer"
        }
      });
      console.log("User added");
      campground.author = user;
      console.log("Comment created");
      campground.comments.push(comment);
      console.log("Comment added to campground");
      campground.save();
    }
  } catch(err) {
    console.log(err);
  }
}

module.exports = seedDB;