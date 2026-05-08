import { requestData } from "../../api/client";
import type { FileUsage, StoredFile } from "./types";

export const memberFilesApi = {
  uploadFile: (file: File, usage: FileUsage) => {
    const data = new FormData();
    data.append("usage", usage);
    data.append("file", file);
    return requestData<StoredFile>({
      method: "POST",
      url: "/files",
      data,
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
