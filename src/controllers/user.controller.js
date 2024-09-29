import { ApiError } from "../utils/ApiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudnary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
export { registerUser, loginUser, logoutUser };
