import { v2 as cloudinary } from "cloudinary";
import fs from "fs"; //fs means file system which help to read,write,remove of any files

// this is how we can congigure cloudnary
cloudinary.config({
  cloud_name: process.env.CLOUDNARY_CLOUD_NAME,
  api_key: process.env.CLOUDNARY_API_KEY,
  api_secret: process.env.CLOUDNARY_API_SECRET,
});

const uploadOnCloudnary = async (localFilePAth) => {
  try {
    if (!localFilePAth) return null;
    //upload the filw on cloudnary
    const response = await cloudinary.uploader.upload(localFilePAth, {
      resource_type: "auto",
    });
    // file has been upload successfully
    console.log(`file is upload on cloudnary: ${response.url}`);
    return response;
  } catch (err) {
    fs.unlinkSync(localFilePAth); //remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};
export { uploadOnCloudnary };
