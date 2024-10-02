import { ApiError } from "../utils/ApiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudnary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { request } from "express";

const generateAccessTokenAndRefreshToken = async (userid) => {
  //get user from database by userid
  try {
    const user = await User.findOne(userid);
    const accessToken = user.generateAccessToken(); //this method is implemented in users.model.js
    const refreshToken = user.generateRefreshToken(); //this method is implemented in users.model.js
    // Now add refresh token in database
    user.refreshToken = refreshToken;
    //now save the refresh token
    await user.save({ validateBeforeSave: false });
    //   return the access and refresh tokens
    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(
      500,
      "Something went wrong while generating Access and Refresh Token"
    );
  }
};
const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  //validate - bot empty
  //check if users already exist
  //check for images, check for avatar, if valibale upload on cloudnary, (check avatar)
  //create user objects - create entry in db
  //remove password and refresh token from response
  //check for user creation
  //return response otherwise throw error is user not created
  const { email, username, password, fullname } = req.body; //get user details from front end
  //   if (fullname === "") {throw new ApiError(400, "Full name is Required")}
  //   if (email === "") {throw new ApiError(400, "email is Required")}
  //   if (username === "") {throw new ApiError(400, "username is Required")}

  //   this is a advanced and short method to check all the fields (validation)
  if (
    [email, username, password, fullname].some(
      (fields) => fields?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }
  //now check if the user is already existing
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }
  //   now check the avatar of the user (Multer)

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //   upload on Cloudnary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(500, "Avatar file is required");
  }
  //now create object and put all data in database
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    username: username.toLowerCase(),
    password,
  });
  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken" //it will exclude password and refresh token from response
  );
  //check user is created or not
  if (!userCreated) {
    throw new ApiError(500, "Something went wrong while registering a user");
  }
  //retuer the response
  return res
    .status(200)
    .json(new ApiResponse(200, userCreated, "User Register Successfully"));
});
const loginUser = asyncHandler(async (req, res) => {
  //get user details from req.body
  //login through email or password
  //find the user
  //check for password
  //access to refresh and access tokens
  //send cookies
  const { email, username, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }
  const user = await User.findOne({ $or: [{ email }, { username }] });
  if (!user) {
    throw new ApiError(404, "User Does Not Exist");
  }

  const isPasswordValid = user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user Password");
  }
  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedInUser = await User.findOne(user._id).select(
    "-password -refreshToken"
  );
  //send cookies and response
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged in Successfully"
      )
    );
});
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logout Successfully"));
});
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.body.refreshToken || req.cookie.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Refresh token");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(404, "Invalid token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired and used");
    }
    //now generate new refreshtoken
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);
    return (
      res
        .status(200)
        .cookie("access Token", accessToken, options)
        .cookie("refresh Token", newRefreshToken, options)
        .json(
          new ApiResponse(
            200,
            { accessToken, refreshToken: newRefreshToken },
            "Access Token Refresh Succesfully"
          )
        ),
      options
    );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  // now find the login user
  const user = await User.findById(req.user?._id);
  //now check the old password of the user is correct ot not
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, "Old password is incorrect");
  }
  //change the old password with the new password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User Data Fetched Successfully"));
});
const updateUserInformation = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!(fullname || email)) {
    throw new ApiError(400, "Full name or email is required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname: fullname,
        email: email.toLowerCase(),
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User Information Updated Successfully"));
});
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new Error(404, "Avatar file id missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new Error(400, "Failed to upload avatar to Cloudinary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User Avatar Updated Successfully"));
});
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImage = req.file?.path;
  if (!coverImage) {
    throw new ApiError(404, "Cover Image is not found");
  }
  const newCoverImage = await uploadOnCloudinary(coverImage);
  if (!newCoverImage.url) {
    throw new ApiError(404, "Failed to upload cover image on Coludnary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: newCoverImage.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User Cover Image Updated Successfully"));
});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateUserInformation,
  updateUserAvatar,
  updateUserCoverImage,
};
