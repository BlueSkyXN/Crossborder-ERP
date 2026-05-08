export type FileUsage =
  | "PARCEL_PHOTO"
  | "REMITTANCE_PROOF"
  | "MESSAGE_ATTACHMENT"
  | "PRODUCT_IMAGE"
  | "CONTENT_IMAGE"
  | "PURCHASE_PROOF"
  | "IMPORT_FILE"
  | "GENERAL";

export type StoredFile = {
  file_id: string;
  usage: FileUsage;
  owner_type: "MEMBER" | "ADMIN";
  original_name: string;
  content_type: string;
  size_bytes: number;
  status: "ACTIVE" | "DELETED";
  download_url: string;
  created_at: string;
  updated_at: string;
};
