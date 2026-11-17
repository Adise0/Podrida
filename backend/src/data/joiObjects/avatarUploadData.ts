import { JoiAvatarUpload } from "./joiTypes";

// PUT /users/myUser/avatar: the whole upload is the body.
const avatarUploadData = JoiAvatarUpload().required();

export default avatarUploadData;
