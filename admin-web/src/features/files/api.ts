import { requestData } from "../../api/client";
import type { FileUsage, StoredFile } from "./types";

export const adminFilesApi = {
  uploadFile: (file: File, usage: FileUsage) => {
    const data = new FormData();
    data.append("usage", usage);
    data.append("file", file);
    return requestData<StoredFile>({
      method: "POST",
      url: "/admin/files",
      data,
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
